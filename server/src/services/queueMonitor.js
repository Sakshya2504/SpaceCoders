import Patient from '../models/Patient.js';
import { scorePatient } from './triageEngine.js';
import { appendAudit } from './audit.js';

// Prototype waiting windows in minutes. These are configurable assumptions,
// not clinical guidance; a production deployment would calibrate them locally.
export const WAIT_WINDOWS = { 1: 5, 2: 15, 3: 30, 4: 60, 5: 90 };

export const getSafeMaxWait = esi => WAIT_WINDOWS[Number(esi)] || 30;

export async function reorderQueue() {
  const patients = await Patient.find({ queueStatus: 'WAITING' });

  patients.sort(
    (a, b) =>
      (a.finalEsi || 5) - (b.finalEsi || 5) ||
      new Date(a.arrivalTime) - new Date(b.arrivalTime)
  );

  await Promise.all(
    patients.map((patient, index) =>
      Patient.updateOne(
        { _id: patient._id },
        { $set: { position: index + 1 } }
      )
    )
  );

  return patients.length;
}

/*
 * Reassess every waiting patient whose next check is due. XGBoost is reached
 * through scorePatient(), so queue reassessment uses the exact same inference
 * contract as new-arrival scoring and clinician-triggered reassessment.
 */
export async function runQueueTick({
  io,
  actorId = 'SYSTEM',
  actorRole = 'SYSTEM',
  force = false
} = {}) {
  const patients = await Patient.find({ queueStatus: 'WAITING' });
  const reassessed = [];

  for (const patient of patients) {
    const due =
      force ||
      !patient.nextReassessmentAt ||
      new Date(patient.nextReassessmentAt) <= new Date();

    if (!due) continue;

    const previousEsi = patient.finalEsi || patient.triage?.esi || 5;
    const scored = await scorePatient(patient.toObject());

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
    patient.safeMaxWaitMinutes = getSafeMaxWait(patient.finalEsi);
    patient.assessments.push({
      ...scored,
      generatedAt: new Date(scored.timestamp),
      trigger: 'QUEUE_TICK'
    });

    await patient.save();

    await appendAudit({
      eventType: 'QUEUE_REASSESSMENT',
      patientId: patient.patientId,
      actorId,
      actorRole,
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
        actorRole,
        payload: { newEsi: scored.esi }
      });
    }

    reassessed.push(patient.patientId);

    io?.emit('reassessment', {
      patientId: patient.patientId,
      esi: patient.finalEsi,
      deteriorationDetected: patient.deteriorationDetected
    });
  }

  await reorderQueue();
  io?.emit('queue:updated', { reason: 'tick', reassessed });

  return {
    total: patients.length,
    reassessed: reassessed.length,
    reassessedPatients: reassessed
  };
}
