import { Router } from 'express';
import Patient from '../models/Patient.js';
import AuditLog from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { dbHealth } from '../config/db.js';

const router = Router();
router.use(requireAuth);

function getTodayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatAverageTriageTime(patients) {
  const durations = patients
    .map(patient => {
      const arrival = new Date(patient.arrivalTime).getTime();
      const generated = new Date(patient.triage?.generatedAt).getTime();

      if (!Number.isFinite(arrival) || !Number.isFinite(generated)) {
        return null;
      }

      return Math.max(0, Math.round((generated - arrival) / 1000));
    })
    .filter(value => value !== null);

  if (!durations.length) {
    return '—';
  }

  const averageSeconds = Math.round(
    durations.reduce((sum, value) => sum + value, 0) / durations.length
  );
  const minutes = Math.floor(averageSeconds / 60);
  const seconds = averageSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

router.get('/summary', async (req, res, next) => {
  try {
    const patients = await Patient.find().lean();
    const todayStart = getTodayStart();

    const patientsToday = patients.filter(
      patient => new Date(patient.arrivalTime) >= todayStart
    );
    const waiting = patients.filter(patient => patient.queueStatus === 'WAITING');
    const critical = waiting.filter(
      patient => Number(patient.finalEsi || patient.triage?.esi) <= 2
    );
    const activeAlerts = waiting.filter(patient =>
      ['IMMEDIATE_ESCALATION', 'ABSTAIN_AND_ESCALATE'].includes(
        patient.triage?.action
      )
    );
    const reassessmentDue = waiting.filter(
      patient =>
        patient.nextReassessmentAt &&
        new Date(patient.nextReassessmentAt) <= new Date()
    );

    const averageConfidence = patientsToday.length
      ? Math.round(
          patientsToday.reduce(
            (sum, patient) => sum + Number(patient.triage?.confidence || 0),
            0
          ) / patientsToday.length
        )
      : 0;

    const esi = [1, 2, 3, 4, 5].map(level => ({
      name: `ESI ${level}`,
      value: patientsToday.filter(
        patient => Number(patient.finalEsi || patient.triage?.esi) === level
      ).length
    }));

    const redFlags = [
      ['Sepsis', 'sepsis'],
      ['MI', 'mi'],
      ['Stroke', 'stroke'],
      ['Respiratory Failure', 'respiratoryFailure']
    ].map(([name, key]) => ({
      name,
      value: patientsToday.filter(
        patient => patient.triage?.redFlags?.[key]?.positive
      ).length
    }));

    return res.json({
      success: true,
      data: {
        patientsToday: patientsToday.length,
        waiting: waiting.length,
        critical: critical.length,
        highRisk: activeAlerts.length,
        avgTriageTime: formatAverageTriageTime(patientsToday),
        reassessmentDue: reassessmentDue.length,
        activeAlerts: activeAlerts.length,
        avgConfidence: averageConfidence,
        esi,
        redFlags,
        surgeMode: waiting.some(patient => patient.surgeMode),
        systemHealth: {
          aiEngine:
            process.env.MANUAL_MODE === 'true' ? 'FAIL-OPEN' : 'ONLINE',
          database: dbHealth()
        }
      },
      message: 'Dashboard summary',
      error: null
    });
  } catch (error) {
    next(error);
  }
});

router.get('/metrics', async (req, res, next) => {
  try {
    const [overrides, escalations, reassessments, recent] = await Promise.all([
      AuditLog.countDocuments({ eventType: 'CLINICIAN_OVERRIDE' }),
      AuditLog.countDocuments({ eventType: 'ESCALATION' }),
      AuditLog.countDocuments({ eventType: 'QUEUE_REASSESSMENT' }),
      AuditLog.find().sort({ timestamp: -1 }).limit(20).lean()
    ]);

    return res.json({
      success: true,
      data: {
        overrides,
        escalations,
        reassessments,
        recent
      },
      message: 'Metrics',
      error: null
    });
  } catch (error) {
    next(error);
  }
});

export default router;
