/*
 * Build the model input from the patient object stored by MongoDB.
 *
 * Keeping this mapping on the server is important: the browser is allowed to
 * display and submit the intake form, but the backend owns the final feature
 * contract sent to the inference service.
 */

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ageGroupForModel(age) {
  if (age <= 12) return 'pediatric';
  if (age <= 17) return 'adolescent';
  if (age <= 64) return 'young_adult';
  return 'elderly';
}

function seasonForMonth(month) {
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'autumn';
}

function shiftForHour(hour) {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18) return 'evening';
  return 'night';
}

function firstValue(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : value;
}

export function buildModelFeatures(patient) {
  const arrival = patient.arrivalTime ? new Date(patient.arrivalTime) : new Date();
  const arrivalHour = arrival.getHours();
  const arrivalMonth = arrival.getMonth() + 1;
  const vitals = patient.vitals || {};
  const age = numberOrNull(patient.age);

  const systolic = numberOrNull(vitals.systolicBP);
  const diastolic = numberOrNull(vitals.diastolicBP);
  const heartRate = numberOrNull(vitals.heartRate);
  const weight = numberOrNull(patient.weightKg ?? patient.modelFeatures?.weight_kg);
  const height = numberOrNull(patient.heightCm ?? patient.modelFeatures?.height_cm);

  const meanArterialPressure = systolic !== null && diastolic !== null
    ? (systolic + 2 * diastolic) / 3
    : null;
  const pulsePressure = systolic !== null && diastolic !== null
    ? systolic - diastolic
    : null;
  const bmi = weight !== null && height > 0
    ? weight / ((height / 100) ** 2)
    : null;
  const shockIndex = systolic !== null && systolic > 0 && heartRate !== null
    ? heartRate / systolic
    : null;

  // Values supplied by the intake form retain the exact training vocabulary.
  const supplied = patient.modelFeatures || {};

  return {
    site_id: firstValue(supplied.site_id, 'SITE-DEMO-01'),
    triage_nurse_id: firstValue(supplied.triage_nurse_id, 'NURSE-DEMO'),
    arrival_mode: firstValue(supplied.arrival_mode, 'walk-in'),
    arrival_hour: arrivalHour,
    arrival_day: firstValue(
      supplied.arrival_day,
      arrival.toLocaleDateString('en-US', { weekday: 'long' })
    ),
    arrival_month: arrivalMonth,
    arrival_season: firstValue(supplied.arrival_season, seasonForMonth(arrivalMonth)),
    shift: firstValue(supplied.shift, shiftForHour(arrivalHour)),
    age,
    age_group: firstValue(supplied.age_group, ageGroupForModel(age ?? 0)),
    sex: firstValue(
      supplied.sex,
      patient.sex === 'Male' ? 'M' : patient.sex === 'Female' ? 'F' : 'Other'
    ),
    language: firstValue(supplied.language, 'English'),
    insurance_type: firstValue(supplied.insurance_type, 'unknown'),
    transport_origin: firstValue(supplied.transport_origin, 'home'),
    pain_location: firstValue(supplied.pain_location, 'unknown'),
    mental_status_triage: firstValue(supplied.mental_status_triage, patient.mentalStatus || 'alert'),
    chief_complaint_system: firstValue(supplied.chief_complaint_system, 'other'),
    num_prior_ed_visits_12m: numberOrNull(supplied.num_prior_ed_visits_12m ?? patient.numPriorEdVisits),
    num_prior_admissions_12m: numberOrNull(supplied.num_prior_admissions_12m ?? patient.numPriorAdmissions),
    num_active_medications: numberOrNull(supplied.num_active_medications ?? patient.numActiveMedications),
    num_comorbidities: numberOrNull(supplied.num_comorbidities ?? patient.numComorbidities),
    systolic_bp: systolic,
    diastolic_bp: diastolic,
    mean_arterial_pressure: numberOrNull(supplied.mean_arterial_pressure ?? meanArterialPressure),
    pulse_pressure: numberOrNull(supplied.pulse_pressure ?? pulsePressure),
    heart_rate: heartRate,
    respiratory_rate: numberOrNull(vitals.respiratoryRate),
    temperature_c: numberOrNull(vitals.temperature),
    spo2: numberOrNull(vitals.spo2),
    gcs_total: numberOrNull(supplied.gcs_total ?? patient.gcsTotal),
    pain_score: numberOrNull(vitals.painScore),
    weight_kg: numberOrNull(supplied.weight_kg ?? patient.weightKg),
    height_cm: numberOrNull(supplied.height_cm ?? patient.heightCm),
    bmi: numberOrNull(supplied.bmi ?? bmi),
    shock_index: numberOrNull(supplied.shock_index ?? shockIndex),
    news2_score: numberOrNull(supplied.news2_score ?? patient.news2Score)
  };
}
