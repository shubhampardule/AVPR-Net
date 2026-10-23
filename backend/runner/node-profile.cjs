// Trusted supervisor for a fresh GitHub-hosted Linux VM. Never import repository code here.
const fs=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const {spawn,execFile}=require("node:child_process");
const IMAGE="node:22.23.1-bookworm-slim@sha256:8607a9064d4a571140998ae9e52a3b3fcf9cff361d04642d5971e6cd76d39e27";
const OUTPUT_LIMIT=65536;
const dockerEnv=()=>Object.fromEntries(Object.entries({PATH:process.env.PATH,HOME:process.env.HOME,LANG:"C.UTF-8"}).filter(([,v])=>v));
const command=(args)=>new Promise((resolve,reject)=>execFile("docker",args,{env:dockerEnv(),timeout:15000,maxBuffer:8192,windowsHide:true},
 (error,stdout)=>error?reject(new Error("Runner container operation failed")):resolve(stdout.trim())));
function requireHostedVm(env=process.env){
 if(env.GITHUB_ACTIONS!=="true"||env.RUNNER_ENVIRONMENT!=="github-hosted"||env.RUNNER_OS!=="Linux"||env.RUNNER_ARCH!=="X64"||!env.RUNNER_TEMP||env.DOCKER_HOST)
  throw new Error("This test profile requires a fresh standard GitHub-hosted Linux x64 VM");
}
function containerArgs(name,source,tests){
 if(!/^avpr-test-[a-f0-9]{24}$/.test(name)||!path.isAbsolute(source)||/[\r\n,]/.test(source)||
  !tests.length||tests.length>50||tests.some(file=>!/^test\/[A-Za-z0-9_.-]+\.test\.(?:js|cjs|mjs)$/.test(file))) throw new Error("Invalid test profile input");
 return ["create","--name",name,"--pull","never","--platform","linux/amd64","--network","none","--read-only",
  "--cap-drop","ALL","--security-opt","no-new-privileges=true","--cpus","1","--memory","512m","--memory-swap","512m",
  "--pids-limit","64","--ulimit","nofile=128:128","--ulimit","nproc=64:64","--shm-size","16m","--log-driver","none",
  "--user","65532:65532","--tmpfs","/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777","--workdir","/workspace",
  "--mount",`type=bind,source=${source},target=/workspace,readonly`,"--entrypoint","node",IMAGE,"--test",...tests.map(file=>`/workspace/${file}`)];
}
async function snapshot(source,destination){
 let count=0,bytes=0;
 async function walk(from,to){
  await fs.mkdir(to,{recursive:true,mode:0o755});
  for(const entry of await fs.readdir(from,{withFileTypes:true})){
   if([".git","node_modules",".env",".local"].includes(entry.name)||entry.name.startsWith(".env."))continue;
   const original=path.join(from,entry.name),target=path.join(to,entry.name);
   if(entry.isSymbolicLink()||(!entry.isFile()&&!entry.isDirectory()))throw new Error("Source contains an unsupported entry");
   if(++count>5000)throw new Error("Source file limit exceeded");
   if(entry.isDirectory())await walk(original,target);
   else {const info=await fs.stat(original);bytes+=info.size;if(info.size>2*1024*1024||bytes>20*1024*1024)throw new Error("Source byte limit exceeded");
    await fs.copyFile(original,target);await fs.chmod(target,0o644);}
  }
 }
 if((await fs.lstat(source)).isSymbolicLink())throw new Error("Source root cannot be a symlink");
 await walk(source,destination);
 const tests=(await fs.readdir(path.join(destination,"test")).catch(()=>[])).filter(file=>/^[A-Za-z0-9_.-]+\.test\.(?:js|cjs|mjs)$/.test(file)).sort().map(file=>`test/${file}`);
 if(tests.length>50)throw new Error("Too many test files");
 return tests;
}
async function execute(name,timeoutMs,signal){
 let bytes=0,reason=null;
 const child=spawn("docker",["start","--attach",name],{env:dockerEnv(),stdio:["ignore","pipe","pipe"]});
 const stop=async code=>{if(reason)return;reason=code;await command(["rm","--force",name]).catch(()=>{});child.kill("SIGKILL");};
 for(const stream of [child.stdout,child.stderr])stream.on("data",chunk=>{bytes+=chunk.length;if(bytes>OUTPUT_LIMIT)void stop("OUTPUT_LIMIT");});
 const timer=setTimeout(()=>void stop("TIMEOUT"),timeoutMs);
 const abort=()=>void stop("CANCELLED");signal?.addEventListener("abort",abort,{once:true});if(signal?.aborted)abort();
 try{return await new Promise(resolve=>{
  child.once("error",()=>resolve({status:"unavailable",reason:"CONTAINER_START_FAILED",outputBytes:Math.min(bytes,OUTPUT_LIMIT)}));
  child.once("close",code=>resolve({status:(reason||code!==0)?"failed":"passed",reason:reason||(code===0?"PROFILE_EXIT_ZERO":"PROFILE_EXIT_NONZERO"),exitCode:code,outputBytes:Math.min(bytes,OUTPUT_LIMIT)}));
 });}finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}
async function runProfile(source,{timeoutMs=120000}={}){
 requireHostedVm();
 if(!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>120000)throw new Error("Invalid profile deadline");
 const tempRoot=await fs.realpath(process.env.RUNNER_TEMP),workspace=await fs.mkdtemp(path.join(tempRoot,"avpr-profile-"));
 const name=`avpr-test-${crypto.randomBytes(12).toString("hex")}`;
 let created=false,result;
 try{
  const tests=await snapshot(await fs.realpath(source),path.join(workspace,"source"));
  if(!tests.length)return {status:"unavailable",reason:"NO_SUPPORTED_TEST_FILES",testsExecuted:false};
  const args=containerArgs(name,path.join(workspace,"source"),tests);
  created=true;
  await command(args);
  result={...await execute(name,timeoutMs),profile:"node22-dependency-free-v1",image:IMAGE,testFiles:tests.length,testsExecuted:true};
 }finally{
  let cleanupFailed=false;
  if(created){
   try{await command(["rm","--force",name]);}
   catch{try{cleanupFailed=Boolean(await command(["ps","--all","--filter",`name=^/${name}$`,"--format","{{.Names}}"]));}
    catch{cleanupFailed=true;}}
  }
  if(path.dirname(workspace)!==tempRoot||!/^avpr-profile-[A-Za-z0-9]+$/.test(path.basename(workspace)))throw new Error("Unsafe runner cleanup path");
  await fs.rm(workspace,{recursive:true,force:true});
  if(cleanupFailed)throw new Error("Container cleanup could not be confirmed");
 }
 return result;
}
if(require.main===module)runProfile(process.argv[2]||process.cwd()).then(result=>{
 console.log(JSON.stringify(result));process.exitCode=result.status==="passed"?0:result.status==="unavailable"?3:1;
}).catch(()=>{console.error("Isolated test profile unavailable; no passing test result is claimed.");process.exitCode=3;});
module.exports={IMAGE,requireHostedVm,containerArgs,snapshot,runProfile,command,execute};
