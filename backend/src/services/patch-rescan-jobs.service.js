const Job = require("../models/PatchRescanJob");
const Scan = require("../models/Scan");
const Finding = require("../models/Finding");
const Organization = require("../models/Organization");
const Member = require("../models/OrganizationMember");
const { digest, rescanPatch, policyHash } = require("./patch-rescan.service");
const { bad } = require("../utils/input");
const DEADLINE_MS = 10 * 60 * 1000;
const publicJob = job => ({ id:String(job._id),scanId:String(job.scan),findingId:String(job.finding),status:job.status,
  patchHash:job.patchHash,sourceHash:job.sourceHash,proposedHash:job.proposedHash,commitSha:job.commitSha,targetPath:job.targetPath,
  result:job.result,errorCode:job.errorCode,createdAt:job.createdAt,completedAt:job.completedAt,deadlineAt:job.deadlineAt });

async function enqueue({scan,finding,patch,actorId}) {
  if (!["semgrep","bandit","secrets"].includes(finding.scanner)||!/\.(?:js|jsx|ts|tsx|py)$/.test(finding.filePath)) throw bad("This finding does not support patch rescanning",400,"RESCAN_FINDING_UNSUPPORTED");
  await require("./budget.service").consume(`patch-rescan-requests:${scan.organization}`,60,3600000);
  const validation=await require("./remediation.service").validate(scan,finding,patch);
  if(validation.syntax.status!=="passed") throw bad("A passing syntax check is required before rescanning",409,"RESCAN_SYNTAX_REQUIRED");
  const patchHash=digest(patch), sourceHash=digest(validation.context.originalCode), proposedHash=digest(validation.content);
  const policy=policyHash();
  const key=digest(JSON.stringify([String(scan.organization),String(scan._id),String(finding._id),scan.commitSha,patchHash,policy]));
  let job=await Job.findOne({key});
  if(job&&["queued","running","completed"].includes(job.status)&&job.expiresAt>new Date()) return publicJob(job);
  await require("./budget.service").consume(`patch-rescan:${scan.organization}`,20,3600000);
  const now=new Date();
  const fields={organization:scan.organization,scan:scan._id,finding:finding._id,requestedBy:actorId,key,patch,patchHash,sourceHash,proposedHash,
    commitSha:scan.commitSha,targetPath:finding.filePath,policyHash:policy,status:"queued",deadlineAt:new Date(now.getTime()+DEADLINE_MS),
    expiresAt:new Date(now.getTime()+86400000),result:null,errorCode:null,leaseToken:null,leaseUntil:null,completedAt:null};
  if(job) job=await Job.findOneAndUpdate({_id:job._id,$or:[{status:{$in:["failed","cancelled"]}},{expiresAt:{$lte:now}}]},{$set:fields},{returnDocument:"after"});
  else try { job=await Job.create(fields); } catch(error) { if(error.code!==11000) throw error;job=await Job.findOne({key}); }
  if(!job) throw bad("Verification changed. Refresh and retry",409,"RESCAN_JOB_CHANGED");
  if(process.env.NODE_ENV==="development") setImmediate(()=>processJob(String(job._id)).catch(()=>{}));
  return publicJob(job);
}
async function get({jobId,scanId,findingId,organizationId}) {
  const job=await Job.findOne({_id:jobId,scan:scanId,finding:findingId,organization:organizationId});
  if(!job) throw bad("Patch rescan not found",404);
  return publicJob(job);
}
async function cancel({jobId,scanId,findingId,organizationId}) {
  await Job.updateOne({_id:jobId,scan:scanId,finding:findingId,organization:organizationId,status:{$in:["queued","running"]}},
    {$set:{status:"cancelled",completedAt:new Date(),leaseToken:null,leaseUntil:null},$unset:{patch:""}});
  return get({jobId,scanId,findingId,organizationId});
}
async function processJob(jobId,{engine=rescanPatch}={}) {
  let release;
  try {release=await require("./budget.service").reserveSlots("patch-rescan-workers",2);}
  catch {return {busy:true};}
  try { return await processClaimedJob(jobId,engine); }
  finally {await release();}
}
async function processClaimedJob(jobId,engine) {
  const leaseToken=require("node:crypto").randomUUID(),now=new Date();
  const job=await Job.findOneAndUpdate({_id:jobId,deadlineAt:{$gt:now},$or:[{status:"queued"},{status:"running",leaseUntil:{$lt:now}}]},
    {$set:{status:"running",leaseToken,leaseUntil:new Date(Date.now()+60000)}},{returnDocument:"after"}).select("+patch +leaseToken");
  if(!job) return {skipped:true};
  const controller=new AbortController();
  const scope={_id:job._id,status:"running",leaseToken,deadlineAt:{$gt:new Date()}};
  const active=async()=>Boolean(await Organization.exists({_id:job.organization,status:"active"})&&
    await Member.exists({organization:job.organization,user:job.requestedBy,status:"active"}));
  const timer=setTimeout(()=>controller.abort(),Math.min(180000,Math.max(1,job.deadlineAt-Date.now())));
  const pulse=setInterval(async()=>{try{
    if(!await active()||!await Job.findOneAndUpdate({...scope,deadlineAt:{$gt:new Date()}},{$set:{leaseUntil:new Date(Date.now()+60000)}})) controller.abort();
  }catch{controller.abort();}},10000);
  try{
    if(!await active()) throw Object.assign(new Error("Inactive scope"),{code:"RESCAN_ACCESS_CHANGED"});
    const scan=await Scan.findOne({_id:job.scan,organization:job.organization,commitSha:job.commitSha}).lean();
    const finding=await Finding.findOne({_id:job.finding,scan:job.scan,organization:job.organization,filePath:job.targetPath}).lean();
    if(!scan||!finding||digest(job.patch||"")!==job.patchHash) throw Object.assign(new Error("Changed input"),{code:"RESCAN_SOURCE_MISMATCH"});
    if(job.policyHash!==policyHash()) throw Object.assign(new Error("Changed scanner policy"),{code:"RESCAN_POLICY_CHANGED"});
    const result=await require("./scan-context").run({signal:controller.signal},()=>engine({scan,finding,patch:job.patch,
      sourceHash:job.sourceHash,proposedHash:job.proposedHash,signal:controller.signal}));
    controller.signal.throwIfAborted();
    if(!["passed","failed"].includes(result?.status)||result.patchHash!==job.patchHash||result.sourceHash!==job.sourceHash||
      result.proposedHash!==job.proposedHash||result.commitSha!==job.commitSha||result.policyHash!==job.policyHash)
      throw Object.assign(new Error("Mismatched engine result"),{code:"RESCAN_RESULT_MISMATCH"});
    if(!await active()) throw Object.assign(new Error("Inactive scope"),{code:"RESCAN_ACCESS_CHANGED"});
    const completed=await Job.findOneAndUpdate({...scope,deadlineAt:{$gt:new Date()}},{$set:{status:"completed",result,
      completedAt:new Date(),leaseToken:null,leaseUntil:null},$unset:{patch:""}});
    return {completed:Boolean(completed)};
  }catch(error){
    const code=/^RESCAN_[A-Z_]+$/.test(error.code||"")?error.code:controller.signal.aborted?"RESCAN_CANCELLED_OR_TIMED_OUT":"RESCAN_UNAVAILABLE";
    await Job.updateOne({_id:job._id,status:"running",leaseToken},{$set:{status:"failed",errorCode:code,completedAt:new Date(),leaseToken:null,leaseUntil:null},$unset:{patch:""}});
    return {failed:true};
  }finally{clearTimeout(timer);clearInterval(pulse);}
}
async function runPending() {
  const expired=await Job.find({status:{$in:["queued","running"]},deadlineAt:{$lte:new Date()}}).select("_id").limit(500).lean();
  if(expired.length) await Job.updateMany({_id:{$in:expired.map(j=>j._id)},status:{$in:["queued","running"]},deadlineAt:{$lte:new Date()}},
    {$set:{status:"failed",errorCode:"RESCAN_DEADLINE_EXCEEDED",completedAt:new Date(),leaseToken:null,leaseUntil:null},$unset:{patch:""}});
  const next=await Job.findOne({deadlineAt:{$gt:new Date()},$or:[{status:"queued"},{status:"running",leaseUntil:{$lt:new Date()}}]}).sort({createdAt:1}).select("_id").lean();
  if(next) await processJob(String(next._id));
}
async function requirePassed({jobId,scan,finding,patch,validation}) {
  if(!require("mongoose").isValidObjectId(jobId)) throw bad("Run a passing security rescan for this exact patch before creating a draft PR",409,"PATCH_RESCAN_REQUIRED");
  const job=await Job.findOne({_id:jobId,organization:scan.organization,scan:scan._id,finding:finding._id,targetPath:finding.filePath,
    status:"completed",expiresAt:{$gt:new Date()},commitSha:scan.commitSha,patchHash:digest(patch),
    sourceHash:digest(validation.context.originalCode),proposedHash:digest(validation.content),policyHash:policyHash(),"result.status":"passed"}).lean();
  if(!job) throw bad("The patch rescan is missing, expired, or does not match this proposal. Rescan it again",409,"PATCH_RESCAN_REQUIRED");
  return {status:"passed",jobId:String(job._id),rulesHash:job.result.rulesHash,policyHash:job.policyHash};
}
module.exports={enqueue,get,cancel,processJob,runPending,publicJob,requirePassed};
