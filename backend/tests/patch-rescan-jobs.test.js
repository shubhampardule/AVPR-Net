jest.mock("../src/models/PatchRescanJob",()=>({findOne:jest.fn(),findOneAndUpdate:jest.fn(),updateOne:jest.fn(),create:jest.fn()}));
jest.mock("../src/models/Scan",()=>({findOne:jest.fn()}));
jest.mock("../src/models/Finding",()=>({findOne:jest.fn()}));
jest.mock("../src/models/Organization",()=>({exists:jest.fn()}));
jest.mock("../src/models/OrganizationMember",()=>({exists:jest.fn()}));
jest.mock("../src/services/budget.service",()=>({reserveSlots:jest.fn(),consume:jest.fn()}));
jest.mock("../src/services/patch-rescan.service",()=>({digest:v=>require("node:crypto").createHash("sha256").update(v).digest("hex"),policyHash:()=>"policy",rescanPatch:jest.fn()}));
jest.mock("../src/services/remediation.service",()=>({validate:jest.fn()}));
const Job=require("../src/models/PatchRescanJob"),Scan=require("../src/models/Scan"),Finding=require("../src/models/Finding");
const budget=require("../src/services/budget.service"),service=require("../src/services/patch-rescan-jobs.service");
const {digest}=require("../src/services/patch-rescan.service");
const id="507f1f77bcf86cd799439011";
const scan={_id:id,organization:"org",commitSha:"a".repeat(40)};
const finding={_id:"finding",scanner:"semgrep",filePath:"code.js"};
const validation={context:{originalCode:"before"},content:"after",syntax:{status:"passed"}};
const query=value=>({select(){return this;},lean:async()=>value,then:(yes,no)=>Promise.resolve(value).then(yes,no)});
let record,release;
const result=()=>({status:"passed",tests:"not_executed",patchHash:record.patchHash,sourceHash:record.sourceHash,
 proposedHash:record.proposedHash,commitSha:record.commitSha,policyHash:record.policyHash});
beforeEach(()=>{
 jest.clearAllMocks();release=jest.fn().mockResolvedValue();budget.reserveSlots.mockResolvedValue(release);
 record={_id:id,organization:"org",scan:id,finding:"finding",requestedBy:"actor",status:"running",patch:"diff",patchHash:digest("diff"),
  sourceHash:digest("before"),proposedHash:digest("after"),policyHash:"policy",commitSha:scan.commitSha,targetPath:"code.js",deadlineAt:new Date(Date.now()+60000),expiresAt:new Date(Date.now()+3600000)};
 Job.findOneAndUpdate.mockImplementation(()=>query(record));Job.updateOne.mockResolvedValue({modifiedCount:1});
 Scan.findOne.mockReturnValue(query(scan));Finding.findOne.mockReturnValue(query(finding));
 require("../src/models/Organization").exists.mockResolvedValue(true);require("../src/models/OrganizationMember").exists.mockResolvedValue(true);
 require("../src/services/remediation.service").validate.mockResolvedValue(validation);
});
test("a passing result is finalized only under the owning lease and patch is removed",async()=>{
 const engine=jest.fn(async()=>result());
 expect(await service.processJob(id,{engine})).toEqual({completed:true});
 const [filter,update]=Job.findOneAndUpdate.mock.calls[1];
 expect(filter).toMatchObject({_id:id,status:"running",leaseToken:expect.any(String),deadlineAt:{$gt:expect.any(Date)}});
 expect(update).toMatchObject({$set:{status:"completed",result:{status:"passed",tests:"not_executed"},leaseToken:null},$unset:{patch:""}});
 expect(release).toHaveBeenCalled();
});
test("cancelled or replaced workers cannot finalize a result",async()=>{
 Job.findOneAndUpdate.mockReturnValueOnce(query(record)).mockReturnValueOnce(query(null));
 expect(await service.processJob(id,{engine:async()=>result()})).toEqual({completed:false});
});
test("duplicate deliveries never run an engine without a claim",async()=>{
 Job.findOneAndUpdate.mockReturnValueOnce(query(null));const engine=jest.fn();
 expect(await service.processJob(id,{engine})).toEqual({skipped:true});expect(engine).not.toHaveBeenCalled();expect(release).toHaveBeenCalled();
});
test("busy workers leave jobs queued instead of running unconstrained scanners",async()=>{
 budget.reserveSlots.mockRejectedValueOnce(new Error("busy"));
 expect(await service.processJob(id)).toEqual({busy:true});expect(Job.findOneAndUpdate).not.toHaveBeenCalled();
});
test.each(["access","source","policy"])("%s changes block scanning and erase queued patch data",async kind=>{
 if(kind==="access")require("../src/models/OrganizationMember").exists.mockResolvedValue(false);
 if(kind==="source")record.patch="tampered";
 if(kind==="policy")record.policyHash="old";
 const engine=jest.fn();expect(await service.processJob(id,{engine})).toEqual({failed:true});expect(engine).not.toHaveBeenCalled();
 expect(Job.updateOne).toHaveBeenCalledWith(expect.objectContaining({status:"running",leaseToken:expect.any(String)}),expect.objectContaining({$unset:{patch:""}}));
});
test("provider/engine errors expose only fixed categories, never private diagnostics",async()=>{
 await service.processJob(id,{engine:async()=>{throw new Error("PRIVATE_CODE_OR_CREDENTIAL");}});
 expect(JSON.stringify(Job.updateOne.mock.calls)).not.toContain("PRIVATE_CODE_OR_CREDENTIAL");
 expect(Job.updateOne.mock.calls[0][1].$set.errorCode).toBe("RESCAN_UNAVAILABLE");
});
test("public job payload omits the patch and worker lease",()=>{
 const payload=service.publicJob({...record,leaseToken:"secret"});expect(payload.patch).toBeUndefined();expect(payload.leaseToken).toBeUndefined();
});
test("PR gate checks scope, exact source/patch hashes, policy, expiry and completed outcome",async()=>{
 Job.findOne.mockReturnValue(query({...record,result:{rulesHash:"rules"}}));
 expect(await service.requirePassed({jobId:id,scan,finding,patch:"diff",validation})).toMatchObject({status:"passed",jobId:id});
 expect(Job.findOne).toHaveBeenCalledWith(expect.objectContaining({organization:"org",scan:id,finding:"finding",targetPath:"code.js",
  status:"completed",patchHash:digest("diff"),sourceHash:digest("before"),proposedHash:digest("after"),policyHash:"policy","result.status":"passed",expiresAt:{$gt:expect.any(Date)}}));
 Job.findOne.mockReturnValue(query(null));
 await expect(service.requirePassed({jobId:id,scan,finding,patch:"diff",validation})).rejects.toMatchObject({code:"PATCH_RESCAN_REQUIRED"});
});
test("a missing rescan ID fails before any database lookup",async()=>{
 await expect(service.requirePassed({scan,finding,patch:"diff",validation})).rejects.toMatchObject({code:"PATCH_RESCAN_REQUIRED"});expect(Job.findOne).not.toHaveBeenCalled();
});
test("identical completed proposals reuse their job without consuming a new quota",async()=>{
 Job.findOne.mockReturnValue(query({...record,status:"completed"}));
 await service.enqueue({scan,finding,patch:"diff",actorId:"actor"});expect(budget.consume).toHaveBeenCalledTimes(1);
 expect(budget.consume).toHaveBeenCalledWith("patch-rescan-requests:org",60,3600000);expect(Job.create).not.toHaveBeenCalled();
});
test("an engine result for a different patch cannot be finalized",async()=>{
 expect(await service.processJob(id,{engine:async()=>({...result(),patchHash:"wrong"})})).toEqual({failed:true});
 expect(Job.updateOne.mock.calls[0][1].$set.errorCode).toBe("RESCAN_RESULT_MISMATCH");
});
