const crypto=require("node:crypto");
const Job=require("../models/ProjectTestJob"),Scan=require("../models/Scan"),Rescan=require("../models/PatchRescanJob");
const Organization=require("../models/Organization"),Member=require("../models/OrganizationMember");
const {bad}=require("../utils/input"),{digest}=require("./patch-rescan.service");
const PROFILE="npm-ci-tests-v1";
function configured(){return /^[a-f0-9]{40}$/.test(process.env.PROJECT_TEST_RUNNER_SHA||"");}
function publicJob(job){return {id:String(job._id),status:job.status,result:job.result,errorCode:job.errorCode,
 commitSha:job.commitSha,patchHash:job.patchHash,createdAt:job.createdAt,deadlineAt:job.deadlineAt,completedAt:job.completedAt};}
async function active(job){return Boolean(await Organization.exists({_id:job.organization,status:"active"})&&
 await Member.exists({organization:job.organization,user:job.requestedBy,status:"active"}));}
async function enqueue({scan,finding,patch,rescanJobId,actorId}){
 if(!configured())throw bad("Project-test runner is not configured",503,"PROJECT_TESTS_UNAVAILABLE");
 await require("./budget.service").consume(`project-test-requests:${scan.organization}`,60,3600000);
 await Job.init();
 const validation=await require("./remediation.service").validate(scan,finding,patch);
 const proof=await require("./patch-rescan-jobs.service").requirePassed({jobId:rescanJobId,scan,finding,patch,validation});
 const key=digest(JSON.stringify([String(scan.organization),String(scan._id),String(finding._id),digest(patch),proof.policyHash,process.env.PROJECT_TEST_RUNNER_SHA]));
 const previous=await Job.findOne({key});
 if(previous&&["queued","running","completed"].includes(previous.status)&&previous.deadlineAt>new Date())return publicJob(previous);
 await require("./budget.service").consume(`project-tests:${scan.organization}`,3,3600000);
 await require("./budget.service").consume("project-tests-global",20,86400000);
 const now=Date.now(),fields={organization:scan.organization,scan:scan._id,finding:finding._id,requestedBy:actorId,rescan:rescanJobId,key,patch,
  patchHash:digest(patch),sourceHash:digest(validation.context.originalCode),proposedHash:digest(validation.content),policyHash:proof.policyHash,
  commitSha:scan.commitSha,targetPath:finding.filePath,runnerRevision:process.env.PROJECT_TEST_RUNNER_SHA,status:"queued",runId:null,lease:null,
  leaseUntil:null,result:null,errorCode:null,completedAt:null,deadlineAt:new Date(now+20*60000),expiresAt:new Date(now+86400000)};
 let job;
 if(previous)job=await Job.findOneAndUpdate({_id:previous._id,$or:[{status:{$in:["failed","cancelled"]}},{deadlineAt:{$lte:new Date()}}]},{$set:fields},{returnDocument:"after"});
 else try{job=await Job.create(fields);}catch(error){if(error.code!==11000)throw error;return publicJob(await Job.findOne({key}));}
 if(!job)throw bad("Test job changed. Refresh and retry",409);
 try{
  const client=await require("../config/github").getInstallationOctokit(173100925);
  await client.request("POST /repos/{owner}/{repo}/dispatches",{owner:"shubhampardule",repo:"AVPR-Net",event_type:"avpr-project-tests",client_payload:{jobId:String(job._id)}});
 }catch{
  await Job.updateOne({_id:job._id,status:"queued"},{$set:{status:"failed",errorCode:"RUNNER_DISPATCH_FAILED",completedAt:new Date()},$unset:{patch:""}});
  throw bad("The hosted runner could not start. Check the App installation and retry",503,"RUNNER_DISPATCH_FAILED");
 }
 return publicJob(job);
}
async function get(scope){
 await Job.updateOne({...scope,status:{$in:["queued","running"]},deadlineAt:{$lte:new Date()}},{$set:{status:"failed",errorCode:"RUNNER_DEADLINE_EXCEEDED",completedAt:new Date()},$unset:{patch:"",lease:""}});
 const job=await Job.findOne(scope);if(!job)throw bad("Project-test job not found",404);return publicJob(job);
}
async function cancel(scope){await Job.updateOne({...scope,status:{$in:["queued","running"]}},{$set:{status:"cancelled",completedAt:new Date()},$unset:{patch:"",lease:""}});return get(scope);}
async function claim(id,identity){
 const current=await Job.findById(id);
 if(!current||!await active(current))throw bad("Test job is unavailable",409);
 const rescan=await Rescan.findOne({_id:current.rescan,status:"completed","result.status":"passed",policyHash:current.policyHash,expiresAt:{$gt:new Date()}});
 if(!rescan)throw bad("Static verification expired",409);
 const lease=crypto.randomBytes(32).toString("hex");
 const job=await Job.findOneAndUpdate({_id:id,status:"queued",runnerRevision:identity.revision,deadlineAt:{$gt:new Date()}},
  {$set:{status:"running",runId:identity.runId,lease,leaseUntil:new Date(Date.now()+60000)}},{returnDocument:"after"}).select("+patch");
 if(!job)throw bad("Test job was already claimed or expired",409);
 try{
  const scan=await Scan.findOne({_id:job.scan,organization:job.organization,commitSha:job.commitSha}).lean();
  if(!scan)throw bad("Scanned source is unavailable",409);
  const archiveUrl=await require("./workspace.service").signedArchiveUrl(scan.installationId,scan.owner,scan.repo,scan.commitSha);
  return {id:String(job._id),lease,archiveUrl,patch:job.patch,targetPath:job.targetPath,commitSha:job.commitSha,
   patchHash:job.patchHash,sourceHash:job.sourceHash,proposedHash:job.proposedHash,profile:PROFILE};
 }catch{
  await Job.updateOne({_id:id,status:"running",runId:identity.runId,lease},{$set:{status:"failed",errorCode:"RUNNER_SOURCE_UNAVAILABLE",completedAt:new Date()},$unset:{patch:"",lease:""}});
  throw bad("The pinned source is unavailable",503,"RUNNER_SOURCE_UNAVAILABLE");
 }
}
function leaseScope(id,identity,lease){if(!/^[a-f0-9]{64}$/.test(lease||""))throw bad("Invalid job lease",401);
 return {_id:id,status:"running",runId:identity.runId,runnerRevision:identity.revision,lease,leaseUntil:{$gt:new Date()},deadlineAt:{$gt:new Date()}};}
async function pulse(id,identity,lease){
 const scope=leaseScope(id,identity,lease),job=await Job.findOne(scope);
 if(!job||!await active(job))throw bad("Test job cancelled or access changed",409);
 if(!await Job.findOneAndUpdate(scope,{$set:{leaseUntil:new Date(Date.now()+60000)}}))throw bad("Test job lease expired",409);
 return {active:true};
}
function cleanResult(value,job){
 if(value?.patchHash!==job.patchHash||value?.sourceHash!==job.sourceHash||value?.proposedHash!==job.proposedHash||value?.commitSha!==job.commitSha||value?.profile!==PROFILE||
  !["passed","failed","unavailable"].includes(value.status)||!Array.isArray(value.packages)||value.packages.length>2)throw bad("Mismatched test result",400);
 const packages=value.packages.map(item=>{
  if(![".","backend","frontend"].includes(item.root))throw bad("Invalid test package",400);
  const outcome=entry=>{
   if(!["passed","failed","unavailable"].includes(entry?.status)||!Number.isInteger(entry.outputBytes)||entry.outputBytes<0||entry.outputBytes>65536||
    !["PROFILE_EXIT_ZERO","PROFILE_EXIT_NONZERO","OUTPUT_LIMIT","TIMEOUT","CANCELLED","CONTAINER_START_FAILED"].includes(entry.reason))throw bad("Invalid test outcome",400);
   if(entry.status==="passed"&&(entry.exitCode!==0||entry.reason!=="PROFILE_EXIT_ZERO"))throw bad("Invalid passing test outcome",400);
   return {status:entry.status,reason:entry.reason,exitCode:Number.isInteger(entry.exitCode)?entry.exitCode:null,outputBytes:entry.outputBytes};
  };
  return {root:item.root,baseline:outcome(item.baseline),proposed:outcome(item.proposed)};
 });
 if(new Set(packages.map(p=>p.root)).size!==packages.length||value.status==="passed"&&(!packages.length||packages.some(p=>p.baseline.status!=="passed"||p.proposed.status!=="passed")))throw bad("Invalid passing test result",400);
 const reason=["TESTS_PASSED","BASELINE_TESTS_FAILED","PROPOSED_TESTS_FAILED","NO_SUPPORTED_NPM_PROJECT","DEPENDENCY_PREPARATION_FAILED","RUNNER_UNAVAILABLE"].includes(value.reason)?value.reason:"RUNNER_UNAVAILABLE";
 return {status:value.status,reason,profile:PROFILE,packages,commitSha:job.commitSha,patchHash:job.patchHash,sourceHash:job.sourceHash,proposedHash:job.proposedHash,
  runUrl:`https://github.com/shubhampardule/AVPR-Net/actions/runs/${job.runId}`};
}
async function complete(id,identity,lease,result){
 const scope=leaseScope(id,identity,lease),job=await Job.findOne(scope);
 if(!job||!await active(job))throw bad("Test job cancelled, expired or access changed",409);
 const cleaned=cleanResult(result,job);
 if(!await Job.findOneAndUpdate(scope,{$set:{status:"completed",result:cleaned,completedAt:new Date()},$unset:{patch:"",lease:""}}))throw bad("Job lease changed",409);
 return {recorded:true};
}
async function requirePassed({jobId,scan,finding,patch,validation}){
 if(!require("mongoose").isValidObjectId(jobId))throw bad("Run project tests for this exact proposal",409,"PROJECT_TESTS_REQUIRED");
 const job=await Job.findOne({_id:jobId,organization:scan.organization,scan:scan._id,finding:finding._id,status:"completed",expiresAt:{$gt:new Date()},
  commitSha:scan.commitSha,patchHash:digest(patch),sourceHash:digest(validation.context.originalCode),proposedHash:digest(validation.content),"result.status":"passed"}).lean();
 if(!job)throw bad("Passing project tests are missing, expired or do not match this patch",409,"PROJECT_TESTS_REQUIRED");
 return {status:"passed",jobId:String(job._id),profile:PROFILE,runnerRevision:job.runnerRevision,runUrl:job.result.runUrl};
}
module.exports={enqueue,get,cancel,claim,pulse,complete,cleanResult,configured,publicJob,requirePassed};
