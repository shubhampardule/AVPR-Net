const assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path");
const {runPair}=require("./npm-profile.cjs"),{requireHostedVm}=require("./node-profile.cjs");
async function main(){
 requireHostedVm();const temp=await fs.realpath(process.env.RUNNER_TEMP),root=await fs.mkdtemp(path.join(temp,"avpr-npm-contract-"));
 try{
  const before=path.join(root,"before"),after=path.join(root,"after");await fs.mkdir(before);await fs.mkdir(after);
  const manifest={name:"avpr-isolation-fixture",version:"1.0.0",scripts:{preinstall:"node -e \"process.exit(99)\"",test:"node --test test/*.test.cjs"}};
  const lock={name:manifest.name,version:manifest.version,lockfileVersion:3,packages:{"":{name:manifest.name,version:manifest.version}}};
  const test=`const t=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
t('project tests run without host authority',()=>{a.equal(process.getuid(),65532);a.deepEqual(Object.keys(os.networkInterfaces()),['lo']);
a.equal(process.env.GITHUB_TOKEN,undefined);a.equal(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,undefined);a.equal(process.env.DATABASE_URL,undefined);
a.equal(fs.existsSync('/var/run/docker.sock'),false);a.throws(()=>fs.writeFileSync('/source/escape','x'));a.equal(require('../value.cjs'),42);});`;
  for(const folder of [before,after]){await fs.writeFile(path.join(folder,"package.json"),JSON.stringify(manifest));await fs.writeFile(path.join(folder,"package-lock.json"),JSON.stringify(lock));
   await fs.mkdir(path.join(folder,"test"));await fs.writeFile(path.join(folder,"test","value.test.cjs"),test);await fs.writeFile(path.join(folder,"value.cjs"),"module.exports=42;");}
  assert.equal((await runPair(before,after)).status,"passed");
  await fs.writeFile(path.join(after,"value.cjs"),"module.exports=0;");
  const regression=await runPair(before,after);assert.equal(regression.status,"failed");assert.equal(regression.reason,"PROPOSED_TESTS_FAILED");
  assert.equal(regression.packages[0].baseline.status,"passed");assert.equal(regression.packages[0].proposed.status,"failed");
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(()=>runPair(before,after,{signal:cancelled.signal}));
  console.log(JSON.stringify({status:"passed",checks:["npm_test_runs_in_nonroot_networkless_secret_free_container","install_scripts_disabled","baseline_and_proposal_pass","regression_rejected","cancelled_job_refused"]}));
 }finally{if(path.dirname(root)!==temp||!/^avpr-npm-contract-[A-Za-z0-9]+$/.test(path.basename(root)))throw new Error("Unsafe cleanup");await fs.rm(root,{recursive:true,force:true});}
}
main().catch(()=>{console.error("Npm runner contract failed; customer test results cannot be trusted.");process.exitCode=1;});
