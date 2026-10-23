// Only this trusted supervisor invokes Docker. Customer code runs inside the container.
const fs=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const {IMAGE,requireHostedVm,snapshot,command,execute}=require("./node-profile.cjs");
const PROFILE="npm-ci-tests-v1";
function validateManifest(manifest,lock){
 if(typeof manifest.scripts?.test!=="string"||!manifest.scripts.test.trim())throw new Error("NO_TEST_SCRIPT");
 if(![2,3].includes(lock.lockfileVersion)||!lock.packages||manifest.workspaces||manifest.overrides)throw new Error("UNSUPPORTED_LOCKFILE");
 const specs=object=>{for(const group of ["dependencies","devDependencies","optionalDependencies"])
  for(const spec of Object.values(object[group]||{}))if(typeof spec!=="string"||!spec||!/^[A-Za-z0-9.*~^<>=| +_-]+$/.test(spec))throw new Error("UNSUPPORTED_DEPENDENCY");};
 specs(manifest);
 for(const [name,item] of Object.entries(lock.packages)){
  specs(item);
  if(item.link||name.includes("..")||name.startsWith("/")||name.includes("\\"))throw new Error("UNSUPPORTED_DEPENDENCY");
  if(item.resolved){let url;try{url=new URL(item.resolved);}catch{throw new Error("UNSUPPORTED_DEPENDENCY");}
   if(url.protocol!=="https:"||url.hostname!=="registry.npmjs.org"||url.port||url.username||url.password||url.search||url.hash||!/^sha(?:256|384|512)-/.test(item.integrity||""))throw new Error("UNSUPPORTED_DEPENDENCY");}
  else if(name&&item.version)throw new Error("UNSUPPORTED_DEPENDENCY");
 }
 return true;
}
function args(name,source,deps,root,install){
 if(!/^avpr-test-[a-f0-9]{24}$/.test(name)||!["","backend","frontend"].includes(root)||[source,deps].some(p=>!path.isAbsolute(p)||/[\r\n,]/.test(p)))throw new Error("Invalid profile input");
 const pkg=`/source${root?`/${root}`:""}`;
 return ["create","--name",name,"--pull","never","--platform","linux/amd64",
  ...(!install?["--network","none"]:[]),"--read-only","--cap-drop","ALL","--security-opt","no-new-privileges=true",
  "--cpus","1","--memory","1g","--memory-swap","1g","--pids-limit","128","--ulimit","nofile=256:256","--shm-size","32m","--log-driver","none",
  "--user",install?`${process.getuid?.()||1001}:${process.getgid?.()||1001}`:"65532:65532","--env","HOME=/tmp","--env","CI=true","--env","npm_config_cache=/tmp/npm-cache",
  "--tmpfs","/tmp:rw,nosuid,nodev,size=256m,mode=1777",
  ...(install?["--mount",`type=bind,source=${deps},target=/work`,"--workdir","/work"]:
   ["--mount",`type=bind,source=${source},target=/source,readonly`,"--mount",`type=bind,source=${path.join(deps,"node_modules")},target=${pkg}/node_modules,readonly`,"--workdir",pkg]),
  "--entrypoint","npm",IMAGE,...(install?["ci","--ignore-scripts","--no-audit","--no-fund"]:["test"])];
}
async function container(source,deps,root,install,signal){
 signal?.throwIfAborted();const name=`avpr-test-${crypto.randomBytes(12).toString("hex")}`;let result;
 try{await command(args(name,source,deps,root,install));result=await execute(name,120000,signal);}
 finally{try{await command(["rm","--force",name]);}catch{if(await command(["ps","--all","--filter",`name=^/${name}$`,"--format","{{.Names}}"]))throw new Error("CLEANUP_FAILED");}}
 return result;
}
async function runPair(before,after,{signal}={}){
 requireHostedVm();if(process.getuid()===0)throw new Error("Hosted supervisor must be nonroot");
 const temp=await fs.realpath(process.env.RUNNER_TEMP),work=await fs.mkdtemp(path.join(temp,"avpr-npm-"));
 const packages=[];
 try{
  await snapshot(before,path.join(work,"before"));await snapshot(after,path.join(work,"after"));
  const roots=[];
  for(const root of ["","backend","frontend"]){
   const folder=path.join(work,"before",root),manifest=await fs.readFile(path.join(folder,"package.json"),"utf8").catch(()=>null);
   if(!manifest)continue;
   const parsed=JSON.parse(manifest);if(!parsed.scripts?.test)continue;
   const lockText=await fs.readFile(path.join(folder,"package-lock.json"),"utf8");validateManifest(parsed,JSON.parse(lockText));roots.push(root);
   // Test dependencies must be identical for baseline and proposal.
   for(const file of ["package.json","package-lock.json"])
    if(await fs.readFile(path.join(folder,file),"utf8")!==await fs.readFile(path.join(work,"after",root,file),"utf8"))throw new Error("DEPENDENCIES_CHANGED");
  }
  if(!roots.length)return {status:"unavailable",reason:"NO_SUPPORTED_NPM_PROJECT",profile:PROFILE,packages};
  if(roots.length>2)throw new Error("TOO_MANY_PACKAGES");
  for(const [index,root] of roots.entries()){
   signal?.throwIfAborted();const deps=path.join(work,`deps-${index}`);await fs.mkdir(deps,{mode:0o777});await fs.chmod(deps,0o777);
   for(const file of ["package.json","package-lock.json"])await fs.copyFile(path.join(work,"before",root,file),path.join(deps,file));
   const install=await container(path.join(work,"before"),deps,root,true,signal);
   if(install.status!=="passed")return {status:"unavailable",reason:"DEPENDENCY_PREPARATION_FAILED",profile:PROFILE,packages};
   await fs.mkdir(path.join(deps,"node_modules"),{recursive:true});
   await fs.mkdir(path.join(work,"before",root,"node_modules"),{recursive:true});
   await fs.mkdir(path.join(work,"after",root,"node_modules"),{recursive:true});
   const baseline=await container(path.join(work,"before"),deps,root,false,signal);
   const proposed=await container(path.join(work,"after"),deps,root,false,signal);
   packages.push({root:root||".",baseline,proposed});
  }
  const baselinePassed=packages.every(item=>item.baseline.status==="passed"),proposedPassed=packages.every(item=>item.proposed.status==="passed");
  return {status:baselinePassed&&proposedPassed?"passed":"failed",reason:!baselinePassed?"BASELINE_TESTS_FAILED":!proposedPassed?"PROPOSED_TESTS_FAILED":"TESTS_PASSED",profile:PROFILE,packages};
 }finally{
  if(path.dirname(work)!==temp||!/^avpr-npm-[A-Za-z0-9]+$/.test(path.basename(work)))throw new Error("Unsafe profile cleanup");
  await fs.rm(work,{recursive:true,force:true});
 }
}
module.exports={runPair,validateManifest,args,PROFILE};
