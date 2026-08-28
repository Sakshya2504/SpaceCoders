import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyAuditChain } from '../services/audit.js';
const router=Router();router.use(requireAuth);
router.get('/',async(req,res,next)=>{try{return res.json({success:true,data:await AuditLog.find().sort({timestamp:-1}).limit(Math.min(Number(req.query.limit||100),250)).lean(),message:'Audit events',error:null});}catch(e){next(e);}});
router.get('/patient/:patientId',async(req,res,next)=>{try{return res.json({success:true,data:await AuditLog.find({patientId:req.params.patientId}).sort({timestamp:-1}).lean(),message:'Patient audit',error:null});}catch(e){next(e);}});
router.get('/verify',async(req,res,next)=>{try{return res.json({success:true,data:await verifyAuditChain(),message:'Audit chain verification',error:null});}catch(e){next(e);}});
export default router;
