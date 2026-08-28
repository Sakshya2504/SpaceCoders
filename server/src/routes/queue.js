import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import Patient from '../models/Patient.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { reorderQueue, runQueueTick } from '../services/queueMonitor.js';
import { scorePatient } from '../services/triageEngine.js';
import { appendAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

const io = req => req.app.get('io');

// Application IDs are designed for people to read and share. Only query
// MongoDB's internal ObjectId when the incoming value actually has that shape.
function patientSelector(id) {
  return isValidObjectId(id)
    ? { $or: [{ _id: id }, { patientId: id }] }
    : { patientId: id };
}

router.get('/', async (req, res, next) => {
  try {
    const patients = await Patient.find({ queueStatus: 'WAITING' })
      .sort({ position: 1 })
      .lean();

    return res.json({
      success: true,
      data: patients,
      message: 'Queue',
      error: null
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/tick',
  allowRoles('triage_nurse', 'charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const result = await runQueueTick({
        io: io(req),
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        force: true
      });

      return res.json({
        success: true,
        data: result,
        message: 'Queue tick completed',
        error: null
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/simulate-deterioration',
  allowRoles('triage_nurse', 'charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const patientId = req.body?.patientId;
      const patient = await Patient.findOne(patientSelector(patientId));

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // The demo deliberately worsens a few vitals so the deterioration,
      // notification and audit paths can be demonstrated without real data.
      patient.vitals = {
        ...patient.vitals,
        spo2: Math.max(70, Number(patient.vitals?.spo2 || 96) - 7),
        respiratoryRate: Number(patient.vitals?.respiratoryRate || 18) + 8,
        heartRate: Number(patient.vitals?.heartRate || 80) + 18
      };
      patient.deteriorationDetected = true;

      // scorePatient may call the Python XGBoost service, so it must be awaited.
      const scored = await scorePatient(patient.toObject());

      patient.triage = {
        ...scored,
        generatedAt: new Date(scored.timestamp)
      };
      patient.finalEsi = scored.esi;
      patient.lastReassessmentAt = new Date();
      patient.nextReassessmentAt = new Date(
        Date.now() + (patient.surgeMode ? 60000 : 300000)
      );
      patient.assessments.push({
        ...scored,
        generatedAt: new Date(scored.timestamp),
        trigger: 'DETERIORATION_SIMULATION'
      });

      await patient.save();

      await appendAudit({
        eventType: 'DETERIORATION_DETECTED',
        patientId: patient.patientId,
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        payload: {
          reason: 'Demo simulation',
          esi: scored.esi,
          modelSource: scored.modelSource
        }
      });

      await reorderQueue();

      io(req)?.emit('deterioration', {
        patientId: patient.patientId,
        esi: patient.finalEsi
      });
      io(req)?.emit('queue:updated', {
        reason: 'deterioration simulation'
      });

      return res.json({
        success: true,
        data: patient,
        message: 'Deterioration simulated',
        error: null
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/surge',
  allowRoles('charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const enabled = Boolean(req.body?.enabled);
      const nextReassessmentAt = new Date(
        Date.now() + (enabled ? 60000 : 300000)
      );

      await Patient.updateMany(
        { queueStatus: 'WAITING' },
        {
          $set: {
            surgeMode: enabled,
            nextReassessmentAt
          }
        }
      );

      io(req)?.emit('surge:status', { enabled });
      io(req)?.emit('queue:updated', { reason: 'surge status' });

      return res.json({
        success: true,
        data: { enabled },
        message: 'Surge status changed',
        error: null
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/surge/run',
  allowRoles('charge_nurse', 'clinical_admin', 'system_admin'),
  async (req, res, next) => {
    try {
      const baseArrivals = Number(req.body?.baseArrivals || 6);
      const total = Math.max(18, baseArrivals * 3);
      const started = Date.now();
      const patients = await Patient.find({ queueStatus: 'WAITING' }).limit(total);
      let alerts = 0;

      for (const patient of patients) {
        const scored = await scorePatient(patient.toObject());

        patient.surgeMode = true;
        patient.triage = {
          ...scored,
          generatedAt: new Date(scored.timestamp)
        };
        patient.finalEsi = scored.esi;
        patient.nextReassessmentAt = new Date(Date.now() + 60000);
        patient.assessments.push({
          ...scored,
          generatedAt: new Date(scored.timestamp),
          trigger: 'SURGE_SIMULATION'
        });

        await patient.save();

        if (scored.escalation) {
          alerts += 1;
        }
      }

      await reorderQueue();

      const result = {
        simulatedArrivals: total,
        processed: patients.length,
        reassessed: patients.length,
        alerts,
        latencyMs: Date.now() - started,
        queueDepth: await Patient.countDocuments({ queueStatus: 'WAITING' }),
        cadenceMinutes: 1
      };

      await appendAudit({
        eventType: 'SURGE_SIMULATION',
        actorId: req.user._id.toString(),
        actorRole: req.user.role,
        payload: result
      });

      io(req)?.emit('surge:completed', result);
      io(req)?.emit('queue:updated', { reason: 'surge simulation' });

      return res.json({
        success: true,
        data: result,
        message: '3× surge simulation completed',
        error: null
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
