import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import Patient from '../models/Patient.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { scorePatient } from '../services/triageEngine.js';
import { buildModelFeatures } from '../services/modelFeatures.js';
import { extractClinicalSignals } from '../services/nlp.js';
import { getSafeMaxWait, reorderQueue } from '../services/queueMonitor.js';
import { appendAudit } from '../services/audit.js';
import { ok, fail } from '../utils/api.js';

const router = Router();
router.use(requireAuth);

const CLINICAL_ROLES = [
  'triage_nurse',
  'charge_nurse',
  'clinical_admin',
  'system_admin'
];

const io = req => req.app.get('io');

function buildPatientId() {
  return `PT-${new Date().getFullYear()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

// Human-readable IDs are the public route identifiers. Only valid MongoDB
// ObjectIds should ever be passed through the _id branch of the query.
function patientSelector(id) {
  return isValidObjectId(id)
    ? { $or: [{ _id: id }, { patientId: id }] }
    : { patientId: id };
}

async function writeTriageAudit(req, patient, scored) {
  await appendAudit({
    eventType: 'TRIAGE_SCORED',
    patientId: patient.patientId,
    actorId: req.user._id.toString(),
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
      actorId: req.user._id.toString(),
      actorRole: req.user.role,
      payload: { action: scored.action }
    });
  }
}

router.get('/', async (req, res, next) => {
  try {
    const filter = { queueStatus: 'WAITING' };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.q) {
      const query = String(req.query.q).trim();
      filter.$or = [
        { patientId: new RegExp(query, 'i') },
        { firstName: new RegExp(query, 'i') },
        { lastName: new RegExp(query, 'i') },
        { chiefComplaint: new RegExp(query, 'i') }
      ];
    }

    const patients = await Patient.find(filter)
      .sort({ position: 1, arrivalTime: -1 })
      .limit(200)
      .lean();

    return ok(res, patients, 'Live queue');
  } catch (error) {
    next(error);
  }
});

// Completed encounters are archived rather than deleted. Historical reviews
// therefore keep the original assessments and audit trail intact.
router.get('/past', async (req, res, next) => {
  try {
    const filter = { queueStatus: 'COMPLETED' };

    if (req.query.q) {
      const query = String(req.query.q).trim();
      filter.$or = [
        { patientId: new RegExp(query, 'i') },
        { firstName: new RegExp(query, 'i') },
        { lastName: new RegExp(query, 'i') },
        { chiefComplaint: new RegExp(query, 'i') }
      ];
    }

    const patients = await Patient.find(filter)
      .sort({ serviceCompletedAt: -1, updatedAt: -1 })
      .limit(200)
      .lean();

    return ok(res, patients, 'Past patients');
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

router.post('/', allowRoles(...CLINICAL_ROLES), async (req, res, next) => {
  try {
    const body = req.body || {};
    const required = ['firstName', 'lastName', 'age', 'chiefComplaint'];
    const missing = required.filter(
      key => body[key] === undefined || body[key] === ''
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

    const patient = await Patient.create({
      patientId: body.patientId || buildPatientId(),
      ...body,
      extractedSymptoms: extractClinicalSignals(body.chiefComplaint),
      status: 'WAITING',
      queueStatus: 'WAITING',
      clinicianDecision: 'PENDING'
    });

    const scored = await scorePatient(patient.toObject());
    patient.triage = {
      ...scored,
      generatedAt: new Date(scored.timestamp)
    };
    patient.modelFeatures = buildModelFeatures(patient.toObject());
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

    await appendAudit({
      eventType: 'PATIENT_CREATED',
      patientId: patient.patientId,
      actorId: req.user._id.toString(),
      actorRole: req.user.role,
      payload: { esi: scored.esi, modelSource: scored.modelSource }
    });
    await writeTriageAudit(req, patient, scored);

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
});

router.post(
  '/:id/triage',
  allowRoles(...CLINICAL_ROLES),
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
      patient.modelFeatures = buildModelFeatures(patient.toObject());
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
      await writeTriageAudit(req, patient, scored);

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
  allowRoles(...CLINICAL_ROLES),
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
          'There is no triage recommendation to accept.',
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
        payload: { esi: patient.finalEsi, decision: 'ACCEPTED' }
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
  allowRoles(...CLINICAL_ROLES),
  async (req, res, next) => {
    try {
      const { targetEsi, reason, note = '' } = req.body || {};
      const esi = Number(targetEsi);

      if (!Number.isInteger(esi) || esi < 1 || esi > 5 || !reason) {
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
      patient.manualEsi = esi;
      patient.finalEsi = esi;
      patient.clinicianDecision = 'OVERRIDDEN';
      patient.clinicianDecisionAt = new Date();
      patient.clinicianDecisionBy = req.user._id.toString();
      patient.safeMaxWaitMinutes = getSafeMaxWait(esi);

      await patient.save();
      await reorderQueue();

      await appendAudit({
        eventType: 'CLINICIAN_OVERRIDE',
        patientId: patient.patientId,
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        payload: { targetEsi: esi, reason, note }
      });

      io(req)?.emit('override', {
        patientId: patient.patientId,
        targetEsi: esi
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
  allowRoles(...CLINICAL_ROLES),
  async (req, res, next) => {
    try {
      const patient = await Patient.findOne(patientSelector(req.params.id));

      if (!patient) {
        return fail(res, 'Patient not found', 'PATIENT_NOT_FOUND', null, 404);
      }

      const previousEsi = patient.finalEsi || patient.triage?.esi || 5;
      const previousDecision = patient.clinicianDecision;
      const incoming = req.body || {};

      // Reassessment changes only freshly observed clinical information. Static
      // identity and arrival context stay unchanged for clean comparisons.
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
        patient.mentalStatus = String(incoming.mentalStatus);
      }

      patient.modelFeatures = {
        ...(patient.modelFeatures || {}),
        ...(incoming.modelFeatures || {}),
        heart_rate: patient.vitals?.heartRate,
        respiratory_rate: patient.vitals?.respiratoryRate,
        systolic_bp: patient.vitals?.systolicBP,
        diastolic_bp: patient.vitals?.diastolicBP,
        temperature_c: patient.vitals?.temperature,
        spo2: patient.vitals?.spo2,
        pain_score: patient.vitals?.painScore,
        mental_status_triage: patient.mentalStatus
      };

      const scored = await scorePatient({
        ...patient.toObject(),
        ...incoming,
        vitals: patient.vitals,
        chiefComplaint: patient.chiefComplaint,
        mentalStatus: patient.mentalStatus,
        modelFeatures: patient.modelFeatures
      });

      patient.triage = {
        ...scored,
        generatedAt: new Date(scored.timestamp)
      };
      patient.modelFeatures = buildModelFeatures(patient.toObject());
      patient.finalEsi = patient.manualEsi || scored.esi;
      patient.deteriorationDetected = Boolean(
        patient.deteriorationDetected ||
          (scored.esi && scored.esi < previousEsi)
      );
      patient.lastReassessmentAt = new Date();
      patient.nextReassessmentAt = new Date(
        Date.now() + (patient.surgeMode ? 60000 : 300000)
      );

      // Unless an explicit override remains in force, a fresh recommendation
      // needs new human acknowledgement before it is considered final.
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
      await writeTriageAudit(req, patient, scored);

      if (patient.deteriorationDetected) {
        await appendAudit({
          eventType: 'DETERIORATION_DETECTED',
          patientId: patient.patientId,
          actorId: req.user._id.toString(),
          actorRole: req.user.role,
          payload: { newEsi: scored.esi, previousEsi }
        });
      }

      io(req)?.emit('reassessment', {
        patientId: patient.patientId,
        esi: patient.finalEsi,
        deteriorationDetected: patient.deteriorationDetected,
        modelSource: scored.modelSource
      });
      io(req)?.emit('queue:updated', { reason: 'reassessment' });

      if (patient.deteriorationDetected || scored.escalation) {
        io(req)?.emit('escalation', {
          patientId: patient.patientId,
          action: scored.action,
          reason: 'reassessment'
        });
      }

      await reorderQueue();
      return ok(res, patient, 'Reassessment completed');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/complete',
  allowRoles(...CLINICAL_ROLES),
  async (req, res, next) => {
    try {
      const patient = await Patient.findOne(patientSelector(req.params.id));

      if (!patient) {
        return fail(res, 'Patient not found', 'PATIENT_NOT_FOUND', null, 404);
      }

      if (!patient.triage?.esi && !patient.finalEsi) {
        return fail(
          res,
          'Complete triage before marking the patient service as done.',
          'TRIAGE_REQUIRED',
          null,
          409
        );
      }

      patient.queueStatus = 'COMPLETED';
      patient.status = 'SEEN';
      patient.position = null;
      patient.serviceCompletedAt = new Date();
      patient.serviceCompletedBy = req.user._id.toString();
      patient.completionNote = String(req.body?.note || '').trim();

      await patient.save();
      await reorderQueue();

      await appendAudit({
        eventType: 'PATIENT_SERVICE_COMPLETED',
        patientId: patient.patientId,
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        payload: {
          finalEsi: patient.finalEsi,
          note: patient.completionNote
        }
      });

      io(req)?.emit('patient:completed', {
        patientId: patient.patientId,
        finalEsi: patient.finalEsi
      });
      io(req)?.emit('queue:updated', { reason: 'patient completed' });

      return ok(res, patient, 'Patient service completed');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/manual-triage',
  allowRoles(...CLINICAL_ROLES),
  async (req, res, next) => {
    try {
      const esi = Number(req.body?.esi);

      if (!Number.isInteger(esi) || esi < 1 || esi > 5) {
        return fail(res, 'Manual ESI must be 1-5', 'VALIDATION_ERROR', null, 422);
      }

      const patient = await Patient.findOne(patientSelector(req.params.id));

      if (!patient) {
        return fail(res, 'Patient not found', 'PATIENT_NOT_FOUND', null, 404);
      }

      patient.manualEsi = esi;
      patient.finalEsi = esi;
      patient.clinicianDecision = 'OVERRIDDEN';
      patient.clinicianDecisionAt = new Date();
      patient.clinicianDecisionBy = req.user._id.toString();
      patient.status = 'WAITING';
      patient.queueStatus = 'WAITING';

      await patient.save();
      await appendAudit({
        eventType: 'MANUAL_TRIAGE',
        patientId: patient.patientId,
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        payload: { esi }
      });

      io(req)?.emit('queue:updated', { reason: 'manual triage' });
      return ok(res, patient, 'Manual triage recorded');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
