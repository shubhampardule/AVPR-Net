// Called only from lifecycle-acceptance after its empty disposable-database guard.
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Job=require("../models/PatchRescanJob"),Scan=require("../models/Scan"),Finding=require("../models/Finding");
const service=require("../services/patch-rescan-jobs.service");
const {digest,policyHash}=require("../services/patch-rescan.service");
async function runPatchRescanChecks({organization,actor}){
 const checks=[];
 const scan=await Scan.create({organization,owner:"fixture",repo:"rescan",installationId:"fixture",status:"completed",commitSha:"a".repeat(40)});
 const finding=await Finding.create({organization,scan:scan._id,owner:"fixture",repo:"rescan",filePath:"code.js",startLine:1,ruleId:"fixture-rule",
  scanner:"semgrep",severity:"low",title:"Synthetic rescan evidence",fingerprint:"rescan-fixture",riskScore:1,riskCategory:"low",
  riskFactors:{severity:1,exploitability:1,occurrence:1,businessImpact:1}});
 const create=extra=>Job.create({organization,scan:scan._id,finding:finding._id,requestedBy:actor._id,key:require("node:crypto").randomUUID(),
  patch:"diff",patchHash:digest("diff"),sourceHash:digest("before"),proposedHash:digest("after"),commitSha:scan.commitSha,targetPath:"code.js",
  policyHash:policyHash(),deadlineAt:new Date(Date.now()+60000),expiresAt:new Date(Date.now()+3600000),...extra});
 const result=()=>({status:"passed",rulesHash:"r".repeat(64),tests:"not_executed",patchHash:digest("diff"),sourceHash:digest("before"),
  proposedHash:digest("after"),commitSha:scan.commitSha,policyHash:policyHash()});
 let job=await create(),release,started;
 const gate=new Promise(resolve=>{release=resolve;}),claimed=new Promise(resolve=>{started=resolve;});
 const running=service.processJob(String(job._id),{engine:async()=>{started();await gate;return result();}});
 try{
  await claimed;
  assert.deepEqual(await service.processJob(String(job._id),{engine:async()=>{throw new Error("Duplicate executed");}}),{skipped:true});
  await service.cancel({jobId:job._id,scanId:scan._id,findingId:finding._id,organizationId:organization});
 }finally{release();await running;}
 assert.equal((await Job.findById(job._id)).status,"cancelled");assert.equal((await Job.findById(job._id).select("+patch")).patch,undefined);
 checks.push("rescan_cancelled_job_and_duplicate_delivery_cannot_publish_success");
 job=await create();
 await service.processJob(String(job._id),{engine:async()=>{
  await Job.updateOne({_id:job._id},{$set:{leaseToken:"replacement",leaseUntil:new Date(Date.now()+60000)}});
  return result();
 }});
 assert.equal((await Job.findById(job._id).select("+leaseToken")).leaseToken,"replacement");assert.equal((await Job.findById(job._id)).result,null);
 checks.push("rescan_replaced_lease_rejects_stale_completion");
 job=await create();
 await service.processJob(String(job._id),{engine:async()=>result()});
 const proof=await service.requirePassed({jobId:String(job._id),scan,finding,patch:"diff",validation:{context:{originalCode:"before"},content:"after"}});
 assert.equal(proof.status,"passed");assert.equal((await Job.findById(job._id).select("+patch")).patch,undefined);
 await assert.rejects(service.requirePassed({jobId:String(job._id),scan,finding,patch:"different",validation:{context:{originalCode:"before"},content:"after"}}),error=>error.code==="PATCH_RESCAN_REQUIRED");
 checks.push("rescan_proof_binds_exact_patch_source_commit_and_policy_without_retaining_patch");
 await assert.rejects(service.get({jobId:job._id,scanId:scan._id,findingId:finding._id,organizationId:new mongoose.Types.ObjectId()}),error=>error.statusCode===404);
 checks.push("rescan_result_cannot_be_read_from_another_organization");
 return checks;
}
module.exports={runPatchRescanChecks};
