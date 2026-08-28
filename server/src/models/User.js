import mongoose from 'mongoose';
const userSchema=new mongoose.Schema({name:{type:String,required:true,trim:true},email:{type:String,required:true,unique:true,lowercase:true,trim:true},passwordHash:{type:String,required:true},role:{type:String,enum:['triage_nurse','charge_nurse','clinical_admin','system_admin'],default:'triage_nurse'},active:{type:Boolean,default:true}},{timestamps:true});
export default mongoose.model('User',userSchema);
