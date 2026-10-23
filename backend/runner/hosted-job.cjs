const fs=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto"),AdmZip=require("adm-zip");
const {requireHostedVm}=require("./node-profile.cjs"),{runPair}=require("./npm-profile.cjs");
const {applyExactDiff}=require("../src/utils/exact-patch");
const BASE="https://avpr-psi.vercel.app/api/v1/internal/project-tests",AUDIENCE="https://avpr-psi.vercel.app/project-tests";
const digest=value=>crypto.createHash("sha256").update(value,"utf8").digest("hex");
async function oidc(){
 const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
 if(url.protocol!=="https:"||!url.hostname.endsWith(".actions.githubusercontent.com")){console.error(JSON.stringify({category:"IDENTITY_ORIGIN_REFUSED"}));throw new Error("Invalid identity endpoint");}
 url.searchParams.set("audience",AUDIENCE);
 const response=await fetch(url,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},redirect:"error",signal:AbortSignal.timeout(15000)});
 if(!response.ok){console.error(JSON.stringify({category:"IDENTITY_UNAVAILABLE",httpStatus:response.status}));throw new Error("Identity unavailable");}
 const data=await response.json();if(typeof data.value!=="string")throw new Error("Identity unavailable");return data.value;
}
async function request(id,action,body={}){
 const identity=await oidc();
 const response=await fetch(`${BASE}/${id}/${action}`,{method:"POST",headers:{Authorization:`Bearer ${identity}`,"Content-Type":"application/json"},
  body:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(20000)});
 if(!response.ok){
  // Fixed supervisor metadata only: never emit tokens, archive URLs, source or provider messages.
  console.error(JSON.stringify({operation:action,httpStatus:response.status,category:"RUNNER_REQUEST_REFUSED"}));
  if(action==="claim"){
   const claims=JSON.parse(Buffer.from(identity.split(".")[1],"base64url"));
   console.error(JSON.stringify({category:"RUNNER_IDENTITY_METADATA",...Object.fromEntries(["repository","repository_id","repository_owner_id","ref","sub","workflow_ref","sha","workflow_sha","event_name","runner_environment","run_id","run_attempt","iat","nbf","exp"].map(key=>[key,claims[key]??null]))}));
  }
  throw new Error("Runner request refused");
 }return (await response.json()).data;
}
async function extract(url,destination){
 const parsed=new URL(url);if(parsed.protocol!=="https:"||parsed.hostname!=="codeload.github.com"||parsed.port||parsed.username||parsed.password)throw new Error("Invalid archive origin");
 const response=await fetch(parsed,{redirect:"error",signal:AbortSignal.timeout(60000)});if(!response.ok||!response.body)throw new Error("Archive unavailable");
 const chunks=[];let bytes=0;
 for await(const chunk of response.body){bytes+=chunk.length;if(bytes>50*1024*1024)throw new Error("Archive limit exceeded");chunks.push(chunk);}
 const entries=new AdmZip(Buffer.concat(chunks)).getEntries();if(entries.length>5000)throw new Error("File limit exceeded");
 let expanded=0;const names=new Set();
 for(const entry of entries){
  const parts=entry.entryName.split("/");
  if(!parts[0]||parts.some(part=>part==="..")||entry.entryName.startsWith("/")||entry.entryName.includes("\\")||entry.entryName.includes("\0")||((entry.attr>>>16)&0xf000)===0xa000)throw new Error("Unsafe archive entry");
  const relative=parts.slice(1).filter(Boolean).join("/");if(!relative)continue;
  if(parts.some(part=>[".git","node_modules",".local",".env"].includes(part)||part.startsWith(".env.")))continue;
  if(names.has(relative))throw new Error("Duplicate archive entry");names.add(relative);
  const target=path.resolve(destination,relative);if(!target.startsWith(path.resolve(destination)+path.sep))throw new Error("Unsafe archive entry");
  expanded+=entry.header.size;if(entry.header.size>2*1024*1024||expanded>20*1024*1024)throw new Error("Expanded archive limit exceeded");
  if(entry.isDirectory)await fs.mkdir(target,{recursive:true});
  else{const data=entry.getData();if(data.length!==entry.header.size)throw new Error("Invalid archive size");await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,data,{mode:0o644});}
 }
}
async function main(){
 requireHostedVm();const id=process.env.AVPR_JOB_ID;if(!/^[a-f0-9]{24}$/.test(id||""))throw new Error("Invalid job identifier");
 const temp=await fs.realpath(process.env.RUNNER_TEMP),work=await fs.mkdtemp(path.join(temp,"avpr-job-"));
 const controller=new AbortController();let job,pulse,pulsing=false,result;
 try{
  job=await request(id,"claim");
  pulse=setInterval(async()=>{if(pulsing)return;pulsing=true;try{await request(id,"pulse",{lease:job.lease});}catch{controller.abort();}finally{pulsing=false;}},10000);
  try{
   const before=path.join(work,"before"),after=path.join(work,"after");await fs.mkdir(before);await extract(job.archiveUrl,before);controller.signal.throwIfAborted();
   if(!/^[a-f0-9]{40}$/.test(job.commitSha)||digest(job.patch)!==job.patchHash||typeof job.targetPath!=="string"||job.targetPath.split("/").some(p=>!p||p===".."||p.startsWith(".")))throw new Error("Invalid patch source");
   const target=path.resolve(before,job.targetPath);if(!target.startsWith(before+path.sep))throw new Error("Invalid target");
   const original=await fs.readFile(target,"utf8");if(digest(original)!==job.sourceHash)throw new Error("Source hash mismatch");
   const proposed=applyExactDiff(original,job.patch,job.targetPath);if(digest(proposed)!==job.proposedHash)throw new Error("Proposal hash mismatch");
   await fs.cp(before,after,{recursive:true});await fs.writeFile(path.resolve(after,job.targetPath),proposed);
   result=await runPair(before,after,{signal:controller.signal});
  }catch{result={status:"unavailable",reason:"RUNNER_UNAVAILABLE",profile:"npm-ci-tests-v1",packages:[]};}
  controller.signal.throwIfAborted();
  await request(id,"complete",{lease:job.lease,result:{...result,commitSha:job.commitSha,patchHash:job.patchHash,sourceHash:job.sourceHash,proposedHash:job.proposedHash}});
  console.log(JSON.stringify({recorded:true,status:result.status,reason:result.reason,packages:result.packages.map(item=>({root:item.root,baseline:item.baseline.status,proposed:item.proposed.status}))}));
 }finally{
  clearInterval(pulse);controller.abort();
  if(path.dirname(work)!==temp||!/^avpr-job-[A-Za-z0-9]+$/.test(path.basename(work)))throw new Error("Unsafe cleanup");
  await fs.rm(work,{recursive:true,force:true});
 }
}
if(require.main===module)main().catch(()=>{console.error("Project test job unavailable, cancelled, or refused. No passing result is claimed.");process.exitCode=1;});
module.exports={extract,digest};
