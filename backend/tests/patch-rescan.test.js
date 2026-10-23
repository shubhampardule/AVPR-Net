jest.mock("../src/config/github",()=>({getInstallationOctokit:jest.fn()}));
jest.mock("../src/scanners/process",()=>({cleanupWslWorkspace:jest.fn().mockResolvedValue()}));
const fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path");
const {createTwoFilesPatch}=require("diff");
const {summarize,comparable,rescanPatch,digest}=require("../src/services/patch-rescan.service");
const finding={scanner:"semgrep",filePath:"src/code.js",ruleId:"host.prefix.securepatch.js.dynamic-eval",startLine:2};
const alert=(overrides={})=>({scanner:"semgrep",filePath:"src/code.js",ruleId:"securepatch.js.dynamic-eval",startLine:2,endLine:2,...overrides});
test("a reproduced target disappearing without new alert counts passes only static checks",()=>{
 expect(summarize([alert()],[],finding)).toMatchObject({status:"passed",baselineReproduced:true,tests:"not_executed"});
});
test("absence without reproducing the baseline never confirms a fix",()=>expect(summarize([],[],finding)).toMatchObject({status:"failed",outcome:"baseline_not_reproduced"}));
test("moving the same alert does not make a fix pass",()=>expect(summarize([alert()],[alert({startLine:20,endLine:20})],finding)).toMatchObject({status:"failed",outcome:"target_alert_remains"}));
test("new alerts anywhere in the repository block the static result",()=>expect(summarize([alert()],[alert({filePath:"other.js",ruleId:"other"})],finding)).toMatchObject({status:"failed",outcome:"new_alerts_detected",introducedAlerts:1}));
test("unrelated alerts moving lines are not invented regressions",()=>{
 expect(summarize([alert(),alert({ruleId:"other"})],[alert({ruleId:"other",startLine:50,endLine:50})],finding)).toMatchObject({status:"passed",introducedAlerts:0});
});
test("coverage changes, skipped files and unknown versions cannot be accepted",()=>{
 const base={coverage:[{scanner:"semgrep",version:"1",scanned:1,skipped:0,filesHash:"hash"}]};
 expect(()=>comparable(base,base)).not.toThrow();
 for(const update of [{version:"2"},{scanned:0},{filesHash:"other"},{skipped:1},{version:null}])
  expect(()=>comparable(base,{coverage:[{...base.coverage[0],...update}]})).toThrow("RESCAN_COVERAGE_CHANGED");
});
function results(items=[]){return {scannersRun:["semgrep","bandit","secrets"],scannerErrors:[],
 results:[{scanner:"semgrep",findings:items},{scanner:"bandit",findings:[]},{scanner:"secrets",findings:[]}],
 coverage:["semgrep","bandit","secrets"].map(scanner=>({scanner,version:"1",scanned:1,filesHash:"same",skipped:0}))};}
const raw={path:"src/code.js",check_id:"prefix.securepatch.js.dynamic-eval",start:{line:2},end:{line:2},extra:{metadata:{cwe:["CWE-95"]}}};
async function setup({original="// fixture\nconst value = eval(input);\n",content="// fixture\nconst value = JSON.parse(input);\n",before=results([raw]),after=results()}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"avpr-rescan-test-"));
 await fs.mkdir(path.join(root,"src"));await fs.writeFile(path.join(root,"src/code.js"),original);
 const cleanup=jest.fn(()=>fs.rm(root,{recursive:true,force:true}));
 const run=jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
 return {root,cleanup,run,args:{scan:{installationId:"1",owner:"team",repo:"project",commitSha:"a".repeat(40)},finding,
  patch:createTwoFilesPatch("a/src/code.js","b/src/code.js",original,content),sourceHash:digest(original),proposedHash:digest(content),signal:new AbortController().signal},
 runtime:{createWorkspace:async()=>({workspacePath:root,cleanup}),createOrchestrator:()=>({runAll:run}),parser:async()=>({status:"passed"})}};
}
test("paired scans read original then patched content, clean host/WSL data and emit no source",async()=>{
 const s=await setup();const seen=[];
 s.run.mockReset().mockImplementation(async()=>{seen.push(await fs.readFile(path.join(s.root,"src/code.js"),"utf8"));return seen.length===1?results([raw]):results();});
 const result=await rescanPatch(s.args,s.runtime);
 expect(seen[0]).toContain("eval(input)");expect(seen[1]).toContain("JSON.parse(input)");
 expect(result).toMatchObject({status:"passed",tests:"not_executed",patchHash:digest(s.args.patch)});
 expect(JSON.stringify(result)).not.toContain("const value");expect(s.cleanup).toHaveBeenCalledTimes(1);
 expect(require("../src/scanners/process").cleanupWslWorkspace).toHaveBeenCalledWith(s.root);
 await expect(fs.stat(s.root)).rejects.toMatchObject({code:"ENOENT"});
});
test.each(["source","patch","cancel","syntax","coverage","suppression"])("%s failure cannot produce a passed result and cleans the workspace",async kind=>{
 const s=await setup(kind==="suppression"?{content:"// nosemgrep\nconst value = JSON.parse(input);\n"}:{});
 if(kind==="source")s.args.sourceHash="wrong";
 if(kind==="patch")s.args.proposedHash="wrong";
 if(kind==="cancel")s.args.signal=AbortSignal.abort();
 if(kind==="syntax")s.runtime.parser=async()=>({status:"failed"});
 if(kind==="coverage")s.run.mockReset().mockResolvedValueOnce({...results([raw]),scannerErrors:[{scanner:"bandit"}]});
 await expect(rescanPatch(s.args,s.runtime)).rejects.toThrow();
 expect(s.cleanup).toHaveBeenCalledTimes(1);await expect(fs.stat(s.root)).rejects.toMatchObject({code:"ENOENT"});
});
