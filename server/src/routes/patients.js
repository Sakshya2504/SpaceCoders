import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
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

const buildPatientId = () =>
  `PT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// Route IDs use the human-readable PT-YYYY-XXXX format. Only query MongoDB's
// internal ObjectId field when the value actually has ObjectId syntax.
const patientSelector = (id) =>
  isValidObjectId(id)
    ? { $or: [{ _id: id }, { patientId: id }] }
    : { patientId: id };

router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.status) filter.status = req.query.status;

    if (req.query.q) {
      const query = String(req.query.q).trim();
      filter.$or = [
        { patientId: new RegExp(query, 'i') },
        { firstName: new RegExp(query, 'i') },
        { lastName: new RegExp(query, 'i') },
        { chiefComplaint: new RegExp(query, 'i') }
      ];
    }

    return ok(
      res,
      await Patient.find(filter).sort({ arrivalTime: -1 }).limit(200).lean()
    );
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const patient = await Patient.findOne(patientSelector(req.params.id)).lean();

    if (!patient) {
      return fail(res, 'Patient not found', 'PATIENT_NOT_FOUND', null, 404);
    }

    return ok(res, patient);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  allowRoles('triage_nurse', 'charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const body = req.body || {};
      const required = ['firstName', 'lastName', 'age', 'chiefComplaint'];
      const missing = required.filter(
        (key) => body[key] === undefined || body[key] === ''
      );

      if (missing.length) {
        return fail(
          res,
          `Missing fields: ${missing.join(', ')}`,
          'VALIDATION_ERROR',
          null,
          422
        );
      }

      // The browser can provide modelFeatures, but the server persists and
      // validates the resulting feature contract before it is used for scoring.
      const patient = await Patient.create({
        patientId: body.patientId || buildPatientId(),
        ...body,
        extractedSymptoms: extractClinicalSignals(body.chiefComplaint),
        status: 'WAITING',
        queueStatus: 'WAITING'
      });

      const scored = await scorePatient(patient.toObject());

      patient.triage = {
        ...scored,
        generatedAt: new Date(scored.timestamp)
      };
      patient.finalEsi = scored.esi;
      patient.safeMaxWaitMinutes = getSafeMaxWait(scored.esi);
      patient.nextReassessmentAt = new Date(Date.now() + 300000);
      patient.assessments.push({
        ...scored,
        generatedAt: new Date(scored.timestamp),
        trigger: 'ARRIVAL'
      });

      if (scored.action === 'FAIL_OPEN') {
        patient.status = 'MANUAL_TRIAGE_REQUIRED';
      }

      await patient.save();
      await reorderQueue();

      const actorId = req.user._id.toString();

      await appendAudit({
        eventType: 'PATIENT_CREATED',
        patientId: patient.patientId,
        actorId,
        actorRole: req.user.role,
        payload: { esi: scored.esi, modelSource: scored.modelSource }
      });

      await appendAudit({
        eventType: 'TRIAGE_SCORED',
        patientId: patient.patientId,
        actorId,
        actorRole: req.user.role,
        payload: {
          esi: scored.esi,
          confidence: scored.confidence,
          action: scored.action,
          modelSource: scored.modelSource,
          modelVersion: scored.modelVersion
        }
      });

      if (scored.escalation) {
        await appendAudit({
          eventType: 'ESCALATION',
          patientId: patient.patientId,
          actorId,
          actorRole: req.user.role,
          payload: { action: scored.action }
        });
      }

      io(req)?.emit('patient:created', { patientId: patient.patientId });
      io(req)?.emit('triage:completed', {
        patientId: patient.patientId,
        esi: scored.esi,
        action: scored.action,
        modelSource: scored.modelSource
      });

      if (scored.escalation) {
        io(req)?.emit('escalation', {
          patientId: patient.patientId,
          action: scored.action
        });
      }

      return ok(
        res,
        await Patient.findById(patient._id).lean(),
        'Patient created',
        201
      );
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/triage',
  allowRoles('triage_nurse', 'charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const patient = await Patient.findOne(patientSelector(req.params.id));

      if (!patient) {
        return fail(res, 'Patient not found', 'PATIENT_NOT_FOUND', null, 404);
      }

      if (process.env.MANUAL_MODE === 'true') {
        await appendAudit({
          eventType: 'FAIL_OPEN',
          patientId: patient.patientId,
          actorId: req.user._id.toString(),
          actorRole: req.user.role,
          payload: { reason: 'MANUAL_MODE' }
        });

        return ok(
          res,
          { action: 'FAIL_OPEN', manualRequired: true },
          'AI unavailable; manual ESI required'
        );
      }

      const scored = await scorePatient({ ...patient.toObject(), ...req.body });

      patient.triage = {
        ...scored,
        generatedAt: new Date(scored.timestamp)
      };
      patient.finalEsi = patient.manualEsi || scored.esi;
      patient.safeMaxWaitMinutes = getSafeMaxWait(patient.finalEsi);
      patient.lastReassessmentAt = new Date();
      patient.nextReassessmentAt = new Date(
        Date.now() + (patient.surgeMode ? 60000 : 300000)
      );
      patient.assessments.push({
        ...scored,
        generatedAt: new Date(scored.timestamp),
        trigger: req.body.trigger || 'MANUAL'
      });

      await patient.save();

      await appendAudit({
        eventType: 'TRIAGE_SCORED',
        patientId: patient.patientId,
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        payload: {
          esi: scored.esi,
          confidence: scored.confidence,
          action: scored.action,
          modelSource: scored.modelSource
        }
      });

      if (scored.escalation) {
        await appendAudit({
          eventType: 'ESCALATION',
          patientId: patient.patientId,
          actorId: req.user._id.toString(),
          actorRole: req.user.role,
          payload: { action: scored.action }
        });
      }

      io(req)?.emit('triage:completed', {
        patientId: patient.patientId,
        esi: scored.esi,
        action: scored.action,
        modelSource: scored.modelSource
      });

      return ok(res, patient, 'Triage completed');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/accept',
  allowRoles('triage_nurse', 'charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const patient = await Patient.findOne(patientSelector(req.params.id));

      if (!patient) {
        return fail(res, 'Patient not found', 'PATIENT_NOT_FOUND', null, 404);
      }

      const acceptedEsi = patient.triage?.esi || patient.finalEsi;

      if (!acceptedEsi) {
        return fail(
          res,
          'There is no triage recommendation to accept. Reassess or complete triage first.',
          'NO_TRIAGE_RECOMMENDATION',
          null,
          409
        );
      }

      patient.manualEsi = null;
      patient.finalEsi = acceptedEsi;
      patient.clinicianDecision = 'ACCEPTED';
      patient.clinicianDecisionAt = new Date();
      patient.clinicianDecisionBy = req.user._id.toString();

      await patient.save();
      await reorderQueue();

      await appendAudit({
        eventType: 'CLINICIAN_ACCEPTED',
        patientId: patient.patientId,
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        payload: {
          esi: patient.finalEsi,
          decision: 'ACCEPTED'
        }
      });

      io(req)?.emit('queue:updated', {
        reason: 'accepted',
        patientId: patient.patientId
      });
      io(req)?.emit('decision:accepted', {
        patientId: patient.patientId,
        esi: patient.finalEsi
      });

      return ok(res, patient, 'Recommendation accepted');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/override',
  allowRoles('triage_nurse', 'charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const { targetEsi, reason, note = '' } = req.body || {};

      if (
        !Number.isInteger(Number(targetEsi)) ||
        Number(targetEsi) < 1 ||
        Number(targetEsi) > 5 ||
        !reason
      ) {
        return fail(
          res,
          'targetEsi and structured reason are required',
          'VALIDATION_ERROR',
          null,
          422
        );
      }

      const patient = await Patient.findOne(patientSelector(req.params.id));

      if (!patient) {
        return fail(res, 'Patient not found', 'PATIENT_NOT_FOUND', null, 404);
      }

      patient.overridden = true;
      patient.overrideBy = req.user._id.toString();
      patient.overrideAt = new Date();
      patient.overrideReason = reason;
      patient.overrideNote = note;
      patient.manualEsi = Number(targetEsi);
      patient.finalEsi = Number(targetEsi);
      patient.clinicianDecision = 'OVERRIDDEN';
      patient.clinicianDecisionAt = new Date();
      patient.clinicianDecisionBy = req.user._id.toString();
      patient.safeMaxWaitMinutes = getSafeMaxWait(targetEsi);

      await patient.save();

      await appendAudit({
        eventType: 'CLINICIAN_OVERRIDE',
        patientId: patient.patientId,
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        payload: { targetEsi: Number(targetEsi), reason, note }
      });

      await reorderQueue();

      io(req)?.emit('override', {
        patientId: patient.patientId,
        targetEsi: Number(targetEsi)
      });
      io(req)?.emit('queue:updated', {
        reason: 'override',
        patientId: patient.patientId
      });

      return ok(res, patient, 'Override recorded');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/reassess',
  allowRoles('triage_nurse', 'charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const patient = await Patient.findOne(patientSelector(req.params.id));

      if (!patient) {
        return fail(res, 'Patient not found', 'PATIENT_NOT_FOUND', null, 404);
      }

      const previousEsi = patient.finalEsi || patient.triage?.esi || 5;
      const previousDecision = patient.clinicianDecision;
      const incoming = req.body || {};

      // Reassessment is a true observation update, not just a new score. Persist
      // the new vitals and clinical context so the next review starts from them.
      if (incoming.vitals && typeof incoming.vitals === 'object') {
        patient.vitals = {
          ...(patient.vitals?.toObject?.() || patient.vitals || {}),
          ...incoming.vitals
        };
      }

      if (incoming.chiefComplaint !== undefined) {
        patient.chiefComplaint = String(incoming.chiefComplaint).trim();
        patient.extractedSymptoms = extractClinicalSignals(patient.chiefComplaint);
      }

      if (incoming.mentalStatus !== undefined) {
        patient.mentalStatus = incoming.mentalStatus;
      }

      const updatedModelFeatures = {
        ...(patient.modelFeatures || {}),
        ...(incoming.modelFeatures || {})
      };

      if (patient.vitals) {
        updatedModelFeatures.heart_rate = patient.vitals.heartRate;
        updatedModelFeatures.respiratory_rate = patient.vitals.respiratoryRate;
        updatedModelFeatures.systolic_bp = patient.vitals.systolicBP;
        updatedModelFeatures.diastolic_bp = patient.vitals.diastolicBP;
        updatedModelFeatures.temperature_c = patient.vitals.temperature;
        updatedModelFeatures.spo2 = patient.vitals.spo2;
        updatedModelFeatures.pain_score = patient.vitals.painScore;
      }

      if (incoming.mentalStatus !== undefined) {
        updatedModelFeatures.mental_status_triage = incoming.mentalStatus;
      }

      patient.modelFeatures = updatedModelFeatures;

      const scoringInput = {
        ...patient.toObject(),
        ...incoming,
        vitals: patient.vitals,
        chiefComplaint: patient.chiefComplaint,
        mentalStatus: patient.mentalStatus,
        modelFeatures: patient.modelFeatures
      };

      const scored = await scorePatient(scoringInput);

      patient.triage = {
        ...scored,
        generatedAt: new Date(scored.timestamp)
      };
      patient.finalEsi = patient.manualEsi || scored.esi;
      patient.deteriorationDetected = Boolean(
        patient.deteriorationDetected ||
          (scored.esi && scored.esi < previousEsi)
      );
      patient.lastReassessmentAt = new Date();
      patient.nextReassessmentAt = new Date(
        Date.now() + (patient.surgeMode ? 60000 : 300000)
      );

      // A fresh recommendation needs fresh human acknowledgement. Keep an
      // existing clinician override intact because it remains the final decision.
      if (patient.manualEsi == null && previousDecision !== 'OVERRIDDEN') {
        patient.clinicianDecision = 'PENDING';
        patient.clinicianDecisionAt = undefined;
        patient.clinicianDecisionBy = undefined;
      }

      patient.assessments.push({
        ...scored,
        generatedAt: new Date(scored.timestamp),
        trigger: 'MANUAL_REASSESSMENT'
      });

      await patient.save();

      const actorId = req.user._id.toString();
      await appendAudit({
        eventType: 'QUEUE_REASSESSMENT',
        patientId: patient.patientId,
        actorId,
        actorRole: req.user.role,
        payload: {
          previousEsi,
          newEsi: scored.esi,
          modelSource: scored.modelSource
        }
      });

      if (patient.deteriorationDetected) {
        await appendAudit({
          eventType: 'DETERIORATION_DETECTED',
          patientId: patient.patientId,
          actorId,
          actorRole: req.user.role,
          payload: { newEsi: scored.esi }
        });
      }

      io(req)?.emit('reassessment', {
        patientId: patient.patientId,
        esi: patient.finalEsi,
        deteriorationDetected: patient.deteriorationDetected
      });

      await reorderQueue();
      return ok(res, patient, 'Reassessment completed');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/manual-triage',
  allowRoles('triage_nurse', 'charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const { esi } = req.body || {};

      if (!Number.isInteger(Number(esi)) || Number(esi) < 1 || Number(esi) > 5) {
        return fail(res, 'Manual ESI must be 1-5', 'VALIDATION_ERROR', null, 422);
      }

      const patient = await Patient.findOne(patientSelector(req.params.id));

      if (!patient) {
        return fail(res, 'Patient not found', 'PATIENT_NOT_FOUND', null, 404);
      }

      patient.manualEsi = Number(esi);
      patient.finalEsi = Number(esi);
      patient.clinicianDecision = 'OVERRIDDEN';
      patient.clinicianDecisionAt = new Date();
      patient.clinicianDecisionBy = req.user._id.toString();
      patient.status = 'WAITING';
      await patient.save();

      await appendAudit({
        eventType: 'MANUAL_TRIAGE',
        patientId: patient.patientId,
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        payload: { esi: Number(esi) }
      });

      io(req)?.emit('queue:updated', { reason: 'manual triage' });
      return ok(res, patient, 'Manual triage recorded');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
