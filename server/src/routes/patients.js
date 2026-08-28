import { Router } from 'express';
import Patient from '../models/Patient.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { scorePatient } from '../services/triageEngine.js';
import { extractClinicalSignals } from '../services/nlp.js';
import { getSafeMaxWait, reorderQueue } from '../services/queueMonitor.js';
import { appendAudit } from '../services/audit.js';
import { ok, fail } from '../utils/api.js';

const router = Router();
router.use(requireAuth);
const io = (req) => req.app.get('io');
const buildPatientId = () => `PT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) { const q = String(req.query.q).trim(); filter.$or = [{ patientId:new RegExp(q,'i') },{ firstName:new RegExp(q,'i') },{ lastName:new RegExp(q,'i') },{ chiefComplaint:new RegExp(q,'i') }]; }
    return ok(res, await Patient.find(filter).sort({ arrivalTime: -1 }).limit(200).lean());
  } catch (e) { next(e); }
});

router.get('/:id', async (req,res,next)=>{ try { const p=await Patient.findOne({$or:[{_id:req.params.id},{patientId:req.params.id}]}).lean(); if(!p)return fail(res,'Patient not found','PATIENT_NOT_FOUND',null,404); return ok(res,p); } catch(e){next(e);} });

router.post('/', allowRoles('triage_nurse','charge_nurse','clinical_admin','system_admin'), async(req,res,next)=>{
  try{
    const b=req.body||{}; const required=['firstName','lastName','age','chiefComplaint']; const missing=required.filter(k=>b[k]===undefined||b[k]===''); if(missing.length)return fail(res,`Missing fields: ${missing.join(', ')}`,'VALIDATION_ERROR',null,422);
    const patient=await Patient.create({patientId:b.patientId||buildPatientId(),...b,extractedSymptoms:extractClinicalSignals(b.chiefComplaint),status:'WAITING',queueStatus:'WAITING'});
    const scored=scorePatient(patient.toObject()); patient.triage={...scored,generatedAt:new Date(scored.timestamp)}; patient.finalEsi=scored.esi; patient.safeMaxWaitMinutes=getSafeMaxWait(scored.esi); patient.nextReassessmentAt=new Date(Date.now()+300000); patient.assessments.push({...scored,generatedAt:new Date(scored.timestamp),trigger:'ARRIVAL'}); if(scored.action==='FAIL_OPEN')patient.status='MANUAL_TRIAGE_REQUIRED'; await patient.save(); await reorderQueue();
    await appendAudit({eventType:'PATIENT_CREATED',patientId:patient.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{esi:scored.esi}}); await appendAudit({eventType:'TRIAGE_SCORED',patientId:patient.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{esi:scored.esi,confidence:scored.confidence,action:scored.action}}); if(scored.escalation)await appendAudit({eventType:'ESCALATION',patientId:patient.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{action:scored.action}});
    io(req)?.emit('patient:created',{patientId:patient.patientId}); io(req)?.emit('triage:completed',{patientId:patient.patientId,esi:scored.esi,action:scored.action}); if(scored.escalation)io(req)?.emit('escalation',{patientId:patient.patientId,action:scored.action}); return ok(res,await Patient.findById(patient._id).lean(),'Patient created',201);
  }catch(e){next(e);}
});

router.post('/:id/triage', allowRoles('triage_nurse','charge_nurse','clinical_admin','system_admin'), async(req,res,next)=>{
  try{const p=await Patient.findOne({$or:[{_id:req.params.id},{patientId:req.params.id}]});if(!p)return fail(res,'Patient not found','PATIENT_NOT_FOUND',null,404);if(process.env.MANUAL_MODE==='true'){await appendAudit({eventType:'FAIL_OPEN',patientId:p.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{reason:'MANUAL_MODE'}});return ok(res,{action:'FAIL_OPEN',manualRequired:true},'AI unavailable; manual ESI required');}const scored=scorePatient({...p.toObject(),...req.body});p.triage={...scored,generatedAt:new Date(scored.timestamp)};p.finalEsi=p.manualEsi||scored.esi;p.safeMaxWaitMinutes=getSafeMaxWait(p.finalEsi);p.lastReassessmentAt=new Date();p.nextReassessmentAt=new Date(Date.now()+(p.surgeMode?60000:300000));p.assessments.push({...scored,generatedAt:new Date(scored.timestamp),trigger:req.body.trigger||'MANUAL'});await p.save();await appendAudit({eventType:'TRIAGE_SCORED',patientId:p.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{esi:scored.esi,confidence:scored.confidence,action:scored.action}});if(scored.escalation)await appendAudit({eventType:'ESCALATION',patientId:p.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{action:scored.action}});io(req)?.emit('triage:completed',{patientId:p.patientId,esi:scored.esi,action:scored.action});return ok(res,p,'Triage completed');}catch(e){next(e);}
});

router.post('/:id/accept', allowRoles('triage_nurse','charge_nurse','clinical_admin','system_admin'), async(req,res,next)=>{try{const p=await Patient.findOne({$or:[{_id:req.params.id},{patientId:req.params.id}]});if(!p)return fail(res,'Patient not found','PATIENT_NOT_FOUND',null,404);p.manualEsi=null;p.finalEsi=p.triage?.esi||p.finalEsi;await p.save();await appendAudit({eventType:'CLINICIAN_ACCEPTED',patientId:p.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{esi:p.finalEsi}});io(req)?.emit('queue:updated',{reason:'accepted'});return ok(res,p,'Recommendation accepted');}catch(e){next(e);}});

router.post('/:id/override', allowRoles('triage_nurse','charge_nurse','clinical_admin','system_admin'), async(req,res,next)=>{try{const{targetEsi,reason,note=''}=req.body||{};if(!Number.isInteger(Number(targetEsi))||Number(targetEsi)<1||Number(targetEsi)>5||!reason)return fail(res,'targetEsi and structured reason are required','VALIDATION_ERROR',null,422);const p=await Patient.findOne({$or:[{_id:req.params.id},{patientId:req.params.id}]});if(!p)return fail(res,'Patient not found','PATIENT_NOT_FOUND',null,404);p.overridden=true;p.overrideBy=req.user._id.toString();p.overrideAt=new Date();p.overrideReason=reason;p.overrideNote=note;p.manualEsi=Number(targetEsi);p.finalEsi=Number(targetEsi);p.safeMaxWaitMinutes=getSafeMaxWait(targetEsi);await p.save();await appendAudit({eventType:'CLINICIAN_OVERRIDE',patientId:p.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{targetEsi:Number(targetEsi),reason,note}});await reorderQueue();io(req)?.emit('override',{patientId:p.patientId,targetEsi:Number(targetEsi)});io(req)?.emit('queue:updated',{reason:'override'});return ok(res,p,'Override recorded');}catch(e){next(e);}});

router.post('/:id/reassess', allowRoles('triage_nurse','charge_nurse','clinical_admin','system_admin'), async(req,res,next)=>{try{const p=await Patient.findOne({$or:[{_id:req.params.id},{patientId:req.params.id}]});if(!p)return fail(res,'Patient not found','PATIENT_NOT_FOUND',null,404);const previousEsi=p.finalEsi||p.triage?.esi||5;const scored=scorePatient({...p.toObject(),...req.body});p.triage={...scored,generatedAt:new Date(scored.timestamp)};p.finalEsi=p.manualEsi||scored.esi;p.deteriorationDetected=Boolean(p.deteriorationDetected||(scored.esi&&scored.esi<previousEsi));p.lastReassessmentAt=new Date();p.nextReassessmentAt=new Date(Date.now()+(p.surgeMode?60000:300000));p.assessments.push({...scored,generatedAt:new Date(scored.timestamp),trigger:'MANUAL_REASSESSMENT'});await p.save();await appendAudit({eventType:'QUEUE_REASSESSMENT',patientId:p.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{previousEsi,newEsi:scored.esi}});if(p.deteriorationDetected)await appendAudit({eventType:'DETERIORATION_DETECTED',patientId:p.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{newEsi:scored.esi}});io(req)?.emit('reassessment',{patientId:p.patientId,esi:p.finalEsi,deteriorationDetected:p.deteriorationDetected});await reorderQueue();return ok(res,p,'Reassessment completed');}catch(e){next(e);}});

router.post('/:id/manual-triage', allowRoles('triage_nurse','charge_nurse','clinical_admin','system_admin'), async(req,res,next)=>{try{const{esi}=req.body||{};if(!Number.isInteger(Number(esi))||Number(esi)<1||Number(esi)>5)return fail(res,'Manual ESI must be 1-5','VALIDATION_ERROR',null,422);const p=await Patient.findOne({$or:[{_id:req.params.id},{patientId:req.params.id}]});if(!p)return fail(res,'Patient not found','PATIENT_NOT_FOUND',null,404);p.manualEsi=Number(esi);p.finalEsi=Number(esi);p.status='WAITING';await p.save();await appendAudit({eventType:'MANUAL_TRIAGE',patientId:p.patientId,actorId:req.user._id.toString(),actorRole:req.user.role,payload:{esi:Number(esi)}});io(req)?.emit('queue:updated',{reason:'manual triage'});return ok(res,p,'Manual triage recorded');}catch(e){next(e);}});

export default router;
