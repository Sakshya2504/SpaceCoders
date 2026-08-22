import mongoose from "mongoose";
const auditSchema=new mongoose.Schema({event:{type:String,required:true},actor:{type:String,default:"system"},actorRole:String,patientId:String,payload:mongoose.Schema.Types.Mixed,hash:String,previousHash:String,createdAt:{type:Date,default:Date.now,immutable:true}},{versionKey:false});
export default mongoose.model("AuditLog",auditSchema);
