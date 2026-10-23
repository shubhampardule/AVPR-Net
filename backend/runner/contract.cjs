const assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path");
const {runProfile,requireHostedVm}=require("./node-profile.cjs");
async function main(){
 requireHostedVm();const root=await fs.mkdtemp(path.join(process.env.RUNNER_TEMP,"avpr-runner-contract-"));
 const checks=[];
 try{
  await fs.mkdir(path.join(root,"test"));
  const fixture=path.join(root,"test","boundary.test.cjs");
  await fs.writeFile(fixture,`const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
test('bounded networkless read-only nonroot execution',()=>{
 a.equal(process.getuid(),65532);a.equal(process.env.GITHUB_TOKEN,undefined);a.equal(process.env.NVIDIA_API_KEY,undefined);
 a.equal(fs.existsSync('/var/run/docker.sock'),false);a.deepEqual(Object.keys(os.networkInterfaces()),['lo']);
 a.throws(()=>fs.writeFileSync('/workspace/escape','x'));a.throws(()=>fs.writeFileSync('/etc/escape','x'));
 a.equal(fs.readFileSync('/sys/fs/cgroup/pids.max','utf8').trim(),'64');
 a.equal(fs.readFileSync('/sys/fs/cgroup/memory.max','utf8').trim(),'536870912');
});`);
  assert.equal((await runProfile(root)).status,"passed");checks.push("nonroot_networkless_readonly_secret_free_resource_limits");
  await fs.writeFile(fixture,"require('node:test')('failure',()=>{throw new Error('Expected failure');});");
  assert.equal((await runProfile(root)).status,"failed");checks.push("failing_tests_are_not_passes");
  await fs.writeFile(fixture,"require('node:test')('timeout',()=>{while(true){}});");
  assert.equal((await runProfile(root,{timeoutMs:1500})).reason,"TIMEOUT");checks.push("timeout_forces_teardown");
  await fs.writeFile(fixture,"require('node:test')('output',()=>{for(let i=0;i<50000;i++)console.log('x'.repeat(100));});");
  assert.equal((await runProfile(root)).reason,"OUTPUT_LIMIT");checks.push("oversized_output_forces_teardown");
  console.log(JSON.stringify({status:"passed",checks}));
 }finally{
  if(path.dirname(root)!==process.env.RUNNER_TEMP||!path.basename(root).startsWith("avpr-runner-contract-"))throw new Error("Unsafe contract cleanup");
  await fs.rm(root,{recursive:true,force:true});
 }
}
main().catch(()=>{console.error("Runner isolation contract failed; do not enable customer test execution.");process.exitCode=1;});
