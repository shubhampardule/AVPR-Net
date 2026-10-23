jest.mock("../src/models/ProjectTestJob",()=>({findOne:jest.fn(),findOneAndUpdate:jest.fn(),findById:jest.fn(),updateOne:jest.fn(),create:jest.fn()}));
jest.mock("../src/models/Organization",()=>({exists:jest.fn()}));
jest.mock("../src/models/OrganizationMember",()=>({exists:jest.fn()}));
const Job=require("../src/models/ProjectTestJob"),Org=require("../src/models/Organization"),Member=require("../src/models/OrganizationMember");
const service=require("../src/services/project-test-jobs.service");
const job={_id:"a".repeat(24),organization:"org",requestedBy:"actor",runId:"123",runnerRevision:"a".repeat(40),commitSha:"b".repeat(40),patchHash:"c".repeat(64),sourceHash:"d".repeat(64),proposedHash:"e".repeat(64)};
const outcome={status:"passed",reason:"PROFILE_EXIT_ZERO",exitCode:0,outputBytes:99};
const result=()=>({...job,status:"passed",reason:"TESTS_PASSED",profile:"npm-ci-tests-v1",packages:[{root:".",baseline:outcome,proposed:outcome}]});
beforeEach(()=>{jest.clearAllMocks();Org.exists.mockResolvedValue(true);Member.exists.mockResolvedValue(true);});
test("passing test results require an exact commit, patch and source, with both baselines passing",()=>{
 expect(service.cleanResult(result(),job)).toMatchObject({status:"passed",runUrl:"https://github.com/shubhampardule/AVPR-Net/actions/runs/123"});
 for(const key of ["commitSha","patchHash","sourceHash","proposedHash","profile"])expect(()=>service.cleanResult({...result(),[key]:"different"},job)).toThrow();
 expect(()=>service.cleanResult({...result(),packages:[]},job)).toThrow();
 expect(()=>service.cleanResult({...result(),packages:[{root:".",baseline:{...outcome,status:"failed"},proposed:outcome}]},job)).toThrow();
 expect(()=>service.cleanResult({...result(),packages:[{root:".",baseline:outcome,proposed:{...outcome,exitCode:1}}]},job)).toThrow();
});
test("callback data is whitelisted and never stores raw logs or source",()=>{
 const cleaned=service.cleanResult({...result(),privateSource:"secret",logs:"secret"},job);expect(JSON.stringify(cleaned)).not.toContain("secret");
 expect(service.publicJob({...job,patch:"private",lease:"private"})).not.toHaveProperty("patch");
 expect(service.publicJob({...job,lease:"private"})).not.toHaveProperty("lease");
});
test("late, cancelled and cross-run callbacks cannot finalize",async()=>{
 Job.findOne.mockResolvedValue(null);
 await expect(service.complete(job._id,{runId:"123",revision:job.runnerRevision},"f".repeat(64),result())).rejects.toThrow();
 expect(Job.findOneAndUpdate).not.toHaveBeenCalled();
 expect(Job.findOne).toHaveBeenCalledWith(expect.objectContaining({runId:"123",status:"running",lease:"f".repeat(64),leaseUntil:{$gt:expect.any(Date)}}));
});
test("membership revocation refuses result publication",async()=>{
 Job.findOne.mockResolvedValue(job);Member.exists.mockResolvedValue(false);
 await expect(service.complete(job._id,{runId:"123",revision:job.runnerRevision},"f".repeat(64),result())).rejects.toThrow();expect(Job.findOneAndUpdate).not.toHaveBeenCalled();
});
test("successful completion removes transient patch and lease using compare-and-set",async()=>{
 Job.findOne.mockResolvedValue(job);Job.findOneAndUpdate.mockResolvedValue(job);
 await expect(service.complete(job._id,{runId:"123",revision:job.runnerRevision},"f".repeat(64),result())).resolves.toEqual({recorded:true});
 expect(Job.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({status:"running",runId:"123"}),expect.objectContaining({$unset:{patch:"",lease:""}}));
});
test("a replaced lease cannot publish a result even after validation",async()=>{
 Job.findOne.mockResolvedValue(job);Job.findOneAndUpdate.mockResolvedValue(null);
 await expect(service.complete(job._id,{runId:"123",revision:job.runnerRevision},"f".repeat(64),result())).rejects.toThrow();
});
