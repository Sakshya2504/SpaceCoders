/*
 * Build the raw feature contract expected by the final triage ensemble.
 *
 * The clinician-facing form uses friendly field names. This module translates
 * those fields into the training vocabulary and calculates values that are
 * stable enough to derive on every request.
 */

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstValue(value, fallback) {
  return value === undefined || value === null || value === ''
    ? fallback
    : value;
}

// The final model stores these four age-group labels.
function ageGroupForModel(age) {
  if (age <= 17) return 'pediatric';
  if (age <= 39) return 'young_adult';
  if (age <= 64) return 'middle_aged';
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

/**
 * Convert the stored patient document into the model's raw feature vocabulary.
 *
 * The Python inference layer performs the final engineered-feature calculation
 * because those transformations must exactly match the supplied training code.
 */
export function buildModelFeatures(patient) {
  const arrival = patient.arrivalTime
    ? new Date(patient.arrivalTime)
    : new Date();
  const arrivalHour = arrival.getHours();
  const arrivalMonth = arrival.getMonth() + 1;
  const vitals = patient.vitals || {};
  const supplied = patient.modelFeatures || {};

  const age = numberOrNull(patient.age);
  const systolic = numberOrNull(vitals.systolicBP);
  const diastolic = numberOrNull(vitals.diastolicBP);
  const heartRate = numberOrNull(vitals.heartRate);
  const respiratoryRate = numberOrNull(vitals.respiratoryRate);
  const temperature = numberOrNull(vitals.temperature);
  const spo2 = numberOrNull(vitals.spo2);
  const painScore = numberOrNull(vitals.painScore);

  const meanArterialPressure =
    systolic !== null && diastolic !== null
      ? diastolic + (systolic - diastolic) / 3
      : null;

  const pulsePressure =
    systolic !== null && diastolic !== null
      ? systolic - diastolic
      : null;

  const weightKg = numberOrNull(
    supplied.weight_kg ?? patient.weightKg
  );
  const heightCm = numberOrNull(
    supplied.height_cm ?? patient.heightCm
  );

  const bmi =
    weightKg !== null && heightCm !== null && heightCm > 0
      ? weightKg / ((heightCm / 100) ** 2)
      : null;

  const shockIndex =
    heartRate !== null && systolic !== null && systolic > 0
      ? heartRate / (systolic + 1e-5)
      : null;

  return {
    arrival_mode: firstValue(supplied.arrival_mode, 'walk-in'),
    arrival_hour: arrivalHour,
    arrival_day: firstValue(
      supplied.arrival_day,
      arrival.toLocaleDateString('en-US', { weekday: 'long' })
    ),
    arrival_month: arrivalMonth,
    arrival_season: firstValue(
      supplied.arrival_season,
      seasonForMonth(arrivalMonth)
    ),
    shift: firstValue(supplied.shift, shiftForHour(arrivalHour)),
    age,
    age_group: firstValue(
      supplied.age_group,
      ageGroupForModel(age ?? 0)
    ),
    sex: firstValue(
      supplied.sex,
      patient.sex === 'Male'
        ? 'M'
        : patient.sex === 'Female'
          ? 'F'
          : 'Other'
    ),
    language: firstValue(supplied.language, 'English'),
    insurance_type: firstValue(supplied.insurance_type, 'unknown'),
    transport_origin: firstValue(
      supplied.transport_origin,
      'home'
    ),
    pain_location: firstValue(
      supplied.pain_location,
      'unknown'
    ),
    mental_status_triage: firstValue(
      supplied.mental_status_triage,
      String(patient.mentalStatus || 'alert').toLowerCase()
    ),
    chief_complaint_system: firstValue(
      supplied.chief_complaint_system,
      'other'
    ),

    num_prior_ed_visits_12m: numberOrNull(
      supplied.num_prior_ed_visits_12m ?? patient.numPriorEdVisits
    ),
    num_prior_admissions_12m: numberOrNull(
      supplied.num_prior_admissions_12m ?? patient.numPriorAdmissions
    ),
    num_active_medications: numberOrNull(
      supplied.num_active_medications ?? patient.numActiveMedications
    ),
    num_comorbidities: numberOrNull(
      supplied.num_comorbidities ?? patient.numComorbidities
    ),

    systolic_bp: systolic,
    diastolic_bp: diastolic,
    mean_arterial_pressure: numberOrNull(
      supplied.mean_arterial_pressure ?? meanArterialPressure
    ),
    pulse_pressure: numberOrNull(
      supplied.pulse_pressure ?? pulsePressure
    ),
    heart_rate: heartRate,
    respiratory_rate: respiratoryRate,
    temperature_c: temperature,
    spo2,
    gcs_total: numberOrNull(
      supplied.gcs_total ?? patient.gcsTotal
    ),
    pain_score: painScore,
    weight_kg: weightKg,
    height_cm: heightCm,
    bmi: numberOrNull(supplied.bmi ?? bmi),
    shock_index: numberOrNull(
      supplied.shock_index ?? shockIndex
    ),
    news2_score: numberOrNull(
      supplied.news2_score ?? patient.news2Score
    ),

    // The supplied training code falls back to zero when it cannot build a
    // two-hour arrival stream from the request data.
    ed_volume_last_2h: numberOrNull(
      supplied.ed_volume_last_2h ?? 0
    )
  };
}
