process.env.DOTENV_CONFIG_QUIET="true";
require("dotenv").config({quiet:true});
const fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os");
const {createTwoFilesPatch}=require("diff");
const {rescanPatch,digest}=require("../services/patch-rescan.service");
const {applyExactDiff}=require("../services/remediation.service");
const cases=[
 {id:"javascript-sql",language:"javascript",file:"source.js",rule:"securepatch.js.sql-concatenation",line:2,
  before:"export async function findUser(db, name) {\n  return db.query(\"SELECT * FROM users WHERE name = '\" + name + \"'\");\n}\n",
  after:"export async function findUser(db, name) {\n  return db.query(\"SELECT * FROM users WHERE name = $1\", [name]);\n}\n"},
 {id:"python-yaml",language:"python",file:"source.py",rule:"securepatch.python.insecure-yaml",line:3,
  before:"import yaml\ndef read_config(text):\n    return yaml.load(text)\n",
  after:"import yaml\ndef read_config(text):\n    return yaml.safe_load(text)\n"},
];
async function main(){
 const live=process.argv.includes("--live-nvidia");
 let assistant;
 if(live){const provider=new(require("../services/nvidia.service").NvidiaService)();
  assistant=new(require("../services/assistant.service").AssistantService)({provider,rag:new(require("../services/rag.service").RagService)({provider})});}
 const report={kind:live?"live_nvidia_static_remediation":"deterministic_patch_static_remediation",synthetic:true,testsExecuted:false,cases:[]};
 for(const item of cases){
  let patch;
  if(live){const generated=await assistant.generateCode({language:item.language,mode:"review",originalCode:item.before,targetPath:item.file,
    request:`Fix ${item.rule}. ${require("../services/remediation-guidance.service").forFinding({scanner:"semgrep",ruleId:item.rule}).steps.join(" ")} Without unrelated changes or scanner suppressions, preserve the function signature and intended behavior. Return the complete corrected file and suggest tests.`});
   if(generated.status!=="complete"||!generated.proposal)throw new Error("Hosted proposal unavailable");patch=generated.proposal.code;
  }else patch=createTwoFilesPatch(`a/${item.file}`,`b/${item.file}`,item.before,item.after);
  const content=applyExactDiff(item.before,patch,item.file);
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"avpr-remediation-acceptance-"));
  await fs.writeFile(path.join(root,item.file),item.before);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);
  try{
   const result=await rescanPatch({scan:{installationId:"synthetic",owner:"fixture",repo:item.id,commitSha:"a".repeat(40)},
    finding:{scanner:"semgrep",filePath:item.file,ruleId:item.rule,startLine:item.line},patch,sourceHash:digest(item.before),proposedHash:digest(content),signal:controller.signal},
    {createWorkspace:async()=>({workspacePath:root,cleanup:async()=>{
      try{await require("../scanners/process").cleanupWslWorkspace(root);}
      finally{if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith("avpr-remediation-acceptance-"))throw new Error("Unsafe cleanup");await fs.rm(root,{recursive:true,force:true});}
    }})});
   report.cases.push({id:item.id,...result});
  }finally{clearTimeout(timer);}
 }
 console.log(JSON.stringify(report,null,2));
 if(report.cases.some(c=>c.status!=="passed"))process.exitCode=1;
}
if(require.main===module)main().catch(()=>{console.error("Remediation acceptance did not complete; no functional test or fix guarantee is claimed.");process.exitCode=2;});
module.exports={main};
