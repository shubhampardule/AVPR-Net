const router=require("express").Router(),handler=require("../utils/asyncHandler");
const {objectId,bad}=require("../utils/input"),jobs=require("../services/project-test-jobs.service");
router.use(handler(async(req,res,next)=>{
 const value=req.get("authorization")||"";
 if(!value.startsWith("Bearer "))throw bad("Runner identity required",401);
 req.runnerIdentity=await require("../services/runner-identity.service").verify(value.slice(7));next();
}));
router.post("/:jobId/claim",handler(async(req,res)=>{objectId(req.params.jobId);res.json({success:true,data:await jobs.claim(req.params.jobId,req.runnerIdentity)});}));
router.post("/:jobId/pulse",handler(async(req,res)=>{objectId(req.params.jobId);res.json({success:true,data:await jobs.pulse(req.params.jobId,req.runnerIdentity,req.body?.lease)});}));
router.post("/:jobId/complete",handler(async(req,res)=>{objectId(req.params.jobId);res.json({success:true,data:await jobs.complete(req.params.jobId,req.runnerIdentity,req.body?.lease,req.body?.result)});}));
module.exports=router;
