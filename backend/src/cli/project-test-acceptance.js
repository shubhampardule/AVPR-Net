// Invoked only after lifecycle-acceptance's empty disposable-database guard.
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Job=require("../models/ProjectTestJob"),jobs=require("../services/project-test-jobs.service");
async function runProjectTestChecks({organization,actor}){
 const checks=[],revision="a".repeat(40),identity={runId:"123",revision},lease="b".repeat(64);
 const create=extra=>Job.create({organization,requestedBy:actor._id,scan:new mongoose.Types.ObjectId(),finding:new mongoose.Types.ObjectId(),rescan:new mongoose.Types.ObjectId(),key:require("node:crypto").randomUUID(),
  patch:"private fixture diff",patchHash:"c".repeat(64),sourceHash:"d".repeat(64),proposedHash:"e".repeat(64),policyHash:"f".repeat(64),commitSha:"1".repeat(40),targetPath:"index.js",
  runnerRevision:revision,status:"running",runId:"123",lease,leaseUntil:new Date(Date.now()+60000),deadlineAt:new Date(Date.now()+60000),expiresAt:new Date(Date.now()+3600000),...extra});
 const outcome={status:"passed",reason:"PROFILE_EXIT_ZERO",exitCode:0,outputBytes:10};
 const result=job=>({status:"passed",reason:"TESTS_PASSED",profile:"npm-ci-tests-v1",commitSha:job.commitSha,patchHash:job.patchHash,sourceHash:job.sourceHash,proposedHash:job.proposedHash,
  packages:[{root:".",baseline:outcome,proposed:outcome}]});
 let job=await create();await jobs.complete(job._id,identity,lease,result(job));
 assert.equal((await Job.findById(job._id)).result.status,"passed");assert.equal((await Job.findById(job._id).select("+patch +lease")).patch,undefined);
 await assert.rejects(jobs.complete(job._id,identity,lease,result(job)));checks.push("project_test_completion_erases_patch_and_rejects_replay");
 await Job.deleteOne({_id:job._id});job=await create();
 const scope={_id:job._id,organization,scan:job.scan,finding:job.finding};await jobs.cancel(scope);
 await assert.rejects(jobs.complete(job._id,identity,lease,result(job)));assert.equal((await Job.findById(job._id)).status,"cancelled");checks.push("cancelled_project_test_job_rejects_late_success");
 await Job.deleteOne({_id:job._id});job=await create();
 await assert.rejects(jobs.complete(job._id,identity,lease,{...result(job),patchHash:"0".repeat(64)}));assert.equal((await Job.findById(job._id)).result,null);
 checks.push("project_test_result_for_different_patch_is_refused");
 await assert.rejects(jobs.get({_id:job._id,organization:new mongoose.Types.ObjectId()}),error=>error.statusCode===404);checks.push("project_test_result_is_scoped_to_organization");
 await Job.updateOne({_id:job._id},{$set:{deadlineAt:new Date(Date.now()-1000)}});await jobs.get({_id:job._id,organization});
 assert.equal((await Job.findById(job._id)).status,"failed");assert.equal((await Job.findById(job._id).select("+patch")).patch,undefined);checks.push("expired_project_test_job_erases_patch_and_never_passes");
 return checks;
}
module.exports={runProjectTestChecks};
