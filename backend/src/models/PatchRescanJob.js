const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  organization:{type:mongoose.Schema.Types.ObjectId,ref:"Organization",required:true,index:true},
  scan:{type:mongoose.Schema.Types.ObjectId,ref:"Scan",required:true},
  finding:{type:mongoose.Schema.Types.ObjectId,ref:"Finding",required:true},
  requestedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
  key:{type:String,required:true,unique:true},
  patch:{type:String,maxlength:18000,select:false},
  patchHash:{type:String,required:true}, sourceHash:{type:String,required:true}, proposedHash:{type:String,required:true},
  policyHash:{type:String,required:true},
  commitSha:{type:String,required:true}, targetPath:{type:String,required:true,maxlength:500},
  status:{type:String,enum:["queued","running","completed","failed","cancelled"],default:"queued",index:true},
  leaseToken:{type:String,default:null,select:false}, leaseUntil:{type:Date,default:null},
  deadlineAt:{type:Date,required:true}, completedAt:{type:Date,default:null},
  result:{type:mongoose.Schema.Types.Mixed,default:null}, errorCode:{type:String,default:null},
  expiresAt:{type:Date,required:true,expires:0},
},{timestamps:true,strict:"throw"});
schema.index({status:1,deadlineAt:1,leaseUntil:1});
module.exports=mongoose.models.PatchRescanJob||mongoose.model("PatchRescanJob",schema);
