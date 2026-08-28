import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Patient from './models/Patient.js';
import AuditLog from './models/AuditLog.js';
import { scorePatient } from './services/triageEngine.js';
import { getSafeMaxWait } from './services/queueMonitor.js';
import { appendAudit } from './services/audit.js';

const complaints = [
  'Severe shortness of breath and blue lips',
  'Chest pressure radiating to left arm with sweating and nausea',
  'Sudden facial droop and trouble speaking with weakness',
  'Fever chills infection and confusion',
  'Fever and cough, playful child',
  'New weakness and confusion after poor intake',
  'Dizziness and fatigue; no prior history',
  'Chest discomfort with mild shortness of breath',
  'Small superficial hand wound after minor cut',
  'Abdominal pain with repeated vomiting',
  'Fainted briefly, now awake',
  'Asthma flare with wheezing and difficulty breathing',
  'Sudden severe headache and dizziness',
  'Diarrhea, vomiting and poor intake',
  'Fall with painful ankle injury',
  'Cough and fever with fatigue',
  'Intermittent chest tightness after exertion',
  'Stable chronic knee pain'
];

const ages = [42, 61, 69, 55, 3, 75, 28, 47, 39, 52, 26, 58, 67, 31, 22, 44, 72, 19];

await connectDB();
await User.deleteMany({});
await Patient.deleteMany({});
await AuditLog.deleteMany({});

const passwordHash = await bcrypt.hash('demo123', 10);

await User.create([
  { name: 'Triage Nurse', email: 'nurse@patienttriage.demo', passwordHash, role: 'triage_nurse' },
  { name: 'Charge Nurse', email: 'charge@patienttriage.demo', passwordHash, role: 'charge_nurse' },
  { name: 'Clinical Admin', email: 'admin@patienttriage.demo', passwordHash, role: 'clinical_admin' },
  { name: 'System Admin', email: 'system@patienttriage.demo', passwordHash, role: 'system_admin' }
]);

for (let i = 0; i < complaints.length; i += 1) {
  const age = ages[i];
  const vitals = {
    heartRate: 78 + (i * 7) % 55,
    respiratoryRate: 16 + (i * 3) % 16,
    temperature: 36.7 + (i % 5) * 0.35,
    systolicBP: 105 + (i * 7) % 55,
    diastolicBP: 65 + (i * 3) % 20,
    spo2: 90 + (i * 3) % 10,
    painScore: 2 + (i % 8)
  };

  if (i === 0) {
    vitals.spo2 = 82;
    vitals.respiratoryRate = 34;
  }

  if (i === 1) vitals.heartRate = 112;

  if (i === 3) {
    vitals.temperature = 39.2;
    vitals.heartRate = 128;
    vitals.systolicBP = 84;
  }

  const modelFeatures = {
    site_id: 'SITE-DEMO-01',
    triage_nurse_id: 'NURSE-DEMO',
    arrival_mode: i < 4 ? 'ambulance' : i % 3 === 0 ? 'walk-in' : 'brought_by_family',
    arrival_hour: 9 + (i % 12),
    arrival_day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i % 7],
    arrival_month: 1 + (i % 12),
    arrival_season: ['winter', 'spring', 'summer', 'autumn'][i % 4],
    shift: ['morning', 'afternoon', 'evening', 'night'][i % 4],
    age,
    age_group: age <= 12 ? 'pediatric' : age <= 17 ? 'adolescent' : age <= 64 ? 'young_adult' : 'elderly',
    sex: i % 2 ? 'F' : 'M',
    language: i % 5 === 0 ? 'Finnish' : 'English',
    insurance_type: ['public', 'private', 'none', 'military'][i % 4],
    transport_origin: ['home', 'public_space', 'nursing_home', 'outdoor'][i % 4],
    pain_location: ['chest', 'abdomen', 'head', 'extremity'][i % 4],
    mental_status_triage: i === 3 || i === 5 ? 'confused' : 'alert',
    chief_complaint_system: ['respiratory', 'cardiovascular', 'neurological', 'infectious'][i % 4],
    num_prior_ed_visits_12m: i % 5,
    num_prior_admissions_12m: i % 4,
    num_active_medications: 1 + (i % 7),
    num_comorbidities: i % 4,
    systolic_bp: vitals.systolicBP,
    diastolic_bp: vitals.diastolicBP,
    mean_arterial_pressure: (vitals.systolicBP + 2 * vitals.diastolicBP) / 3,
    pulse_pressure: vitals.systolicBP - vitals.diastolicBP,
    heart_rate: vitals.heartRate,
    respiratory_rate: vitals.respiratoryRate,
    temperature_c: vitals.temperature,
    spo2: vitals.spo2,
    gcs_total: i === 3 ? 13 : 15,
    pain_score: vitals.painScore,
    weight_kg: 20 + (age * 0.7),
    height_cm: age < 12 ? 105 + age * 6 : 150 + (i % 20),
    bmi: null,
    shock_index: vitals.heartRate / vitals.systolicBP,
    news2_score: i === 0 ? 8 : i === 3 ? 7 : i % 4
  };

  modelFeatures.bmi = modelFeatures.weight_kg / ((modelFeatures.height_cm / 100) ** 2);

  const input = {
    firstName: `Demo${i + 1}`,
    lastName: 'Patient',
    age,
    sex: i % 2 ? 'Female' : 'Male',
    chiefComplaint: complaints[i],
    vitals,
    mentalStatus: i === 3 || i === 5 ? 'Confused' : 'Alert and oriented',
    hasHistory: i % 4 !== 2,
    historySummary: i % 4 !== 2 ? 'Synthetic prior history' : '',
    modelFeatures
  };

  const scored = await scorePatient(input);
  const arrival = new Date(Date.now() - (i + 2) * 4 * 60000);

  await Patient.create({
    patientId: `PT-2026-${String(i + 1).padStart(3, '0')}`,
    ...input,
    extractedSymptoms: scored.extractedSymptoms,
    arrivalTime: arrival,
    triage: { ...scored, generatedAt: new Date(scored.timestamp) },
    finalEsi: scored.esi,
    safeMaxWaitMinutes: getSafeMaxWait(scored.esi),
    lastReassessmentAt: arrival,
    nextReassessmentAt: new Date(Date.now() + 120000),
    assessments: [{ ...scored, generatedAt: new Date(scored.timestamp), trigger: 'ARRIVAL' }],
    status: scored.action === 'FAIL_OPEN' ? 'MANUAL_TRIAGE_REQUIRED' : 'WAITING',
    queueStatus: 'WAITING',
    position: i + 1
  });
}

await appendAudit({
  eventType: 'SEED_DATA_LOADED',
  actorId: 'SYSTEM',
  actorRole: 'SYSTEM',
  payload: { patients: complaints.length, users: 4 }
});

console.log('Seed complete: 18 synthetic patients + 4 users');
await mongoose.disconnect();
