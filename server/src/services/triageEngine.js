import { extractClinicalSignals } from './nlp.js';
import { buildModelFeatures } from './modelFeatures.js';

/*
 * These ranges are prototype assumptions used to demonstrate age-aware logic.
 * They are NOT clinical guidelines. Keeping them in one structure makes later
 * hospital-specific calibration possible without scattering thresholds.
 */
export const AGE_CONFIG = {
  PEDIATRIC: { hr: [70, 130], rr: [15, 30], temp: [36, 38], sbp: [80, 115], spo2: 95 },
  ADOLESCENT: { hr: [60, 110], rr: [12, 22], temp: [36, 38], sbp: [90, 125], spo2: 95 },
  ADULT: { hr: [55, 100], rr: [12, 20], temp: [36, 38], sbp: [95, 140], spo2: 95 },
  GERIATRIC: { hr: [50, 95], rr: [12, 20], temp: [36, 37.8], sbp: [100, 145], spo2: 94 }
};

// The weights mirror the confidence model described in the product specification.
export const CONFIDENCE_WEIGHTS = {
  dataCompleteness: 0.30,
  signalConsistency: 0.25,
  historyAvailability: 0.20,
  ageNormalization: 0.15,
  modelAgreement: 0.10
};

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

export function getAgeBand(age) {
  if (age <= 12) return 'PEDIATRIC';
  if (age <= 17) return 'ADOLESCENT';
  if (age <= 64) return 'ADULT';
  return 'GERIATRIC';
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function deviation(value, range) {
  const number = safeNumber(value);
  if (number === null) return 0;
  if (number < range[0]) return (range[0] - number) / Math.max(1, range[0]);
  if (number > range[1]) return (number - range[1]) / Math.max(1, range[1]);
  return 0;
}

/*
 * The red-flag layer is deliberately separate from the XGBoost score.
 * A high-sensitivity safety detector can therefore interrupt normal model ranking.
 */
function detectRedFlags(input, signals) {
  const vitals = input.vitals || {};
  const mentalStatus = String(input.mentalStatus || '').toLowerCase();
  const history = String(input.historySummary || '').toLowerCase();

  let sepsisScore = 0;
  const sepsisReasons = [];
  let miScore = 0;
  const miReasons = [];
  let strokeScore = 0;
  const strokeReasons = [];
  let respiratoryScore = 0;
  const respiratoryReasons = [];

  // Sepsis-like aggregation: infection context plus physiological instability.
  if (signals.includes('fever') || vitals.temperature >= 38.5 || vitals.temperature <= 35) {
    sepsisScore += 25;
    sepsisReasons.push('Temperature trigger');
  }
  if (vitals.heartRate >= 120) {
    sepsisScore += 20;
    sepsisReasons.push('Marked tachycardia');
  }
  if (vitals.respiratoryRate >= 24) {
    sepsisScore += 20;
    sepsisReasons.push('Elevated respiratory rate');
  }
  if (vitals.systolicBP < 90) {
    sepsisScore += 25;
    sepsisReasons.push('Low systolic blood pressure');
  }
  if (/confused|altered|disoriented/.test(mentalStatus)) {
    sepsisScore += 20;
    sepsisReasons.push('Altered mental status');
  }
  if (signals.includes('infection') || /infection|pneumonia|uti|cellulitis/.test(history)) {
    sepsisScore += 25;
    sepsisReasons.push('Possible infection context');
  }

  // MI-like aggregation: symptom pattern is more important than a single vital.
  if (signals.includes('chestPain')) {
    miScore += 35;
    miReasons.push('Chest pain or pressure');
  }
  if (signals.includes('radiation')) {
    miScore += 20;
    miReasons.push('Radiation pattern');
  }
  if (signals.includes('diaphoresis')) {
    miScore += 20;
    miReasons.push('Diaphoresis');
  }
  if (signals.includes('nausea')) {
    miScore += 10;
    miReasons.push('Nausea');
  }
  if (/cardiac|coronary|heart attack|mi/.test(history)) {
    miScore += 20;
    miReasons.push('Cardiac history');
  }

  // Stroke-like aggregation emphasizes focal neurological symptoms.
  if (signals.includes('facialDroop')) {
    strokeScore += 40;
    strokeReasons.push('Facial droop');
  }
  if (signals.includes('speechDifficulty')) {
    strokeScore += 35;
    strokeReasons.push('Speech difficulty');
  }
  if (signals.includes('weakness')) {
    strokeScore += 15;
    strokeReasons.push('Weakness');
  }
  if (signals.includes('severeHeadache')) {
    strokeScore += 20;
    strokeReasons.push('Severe headache');
  }

  // Respiratory-failure-like aggregation emphasizes oxygenation and distress.
  if (vitals.spo2 < 90) {
    respiratoryScore += 50;
    respiratoryReasons.push('Critically low SpO₂');
  } else if (vitals.spo2 < 93) {
    respiratoryScore += 30;
    respiratoryReasons.push('Low SpO₂');
  }
  if (signals.includes('dyspnea') || signals.includes('severeRespiratoryDistress')) {
    respiratoryScore += 25;
    respiratoryReasons.push('Breathing difficulty');
  }
  if (vitals.respiratoryRate >= 30) {
    respiratoryScore += 30;
    respiratoryReasons.push('Severely elevated respiratory rate');
  }
  if (signals.includes('cyanosis')) {
    respiratoryScore += 35;
    respiratoryReasons.push('Possible cyanosis');
  }

  return {
    sepsis: { positive: sepsisScore >= 55, score: clamp(sepsisScore, 0, 100), reasons: sepsisReasons },
    mi: { positive: miScore >= 55, score: clamp(miScore, 0, 100), reasons: miReasons },
    stroke: { positive: strokeScore >= 55, score: clamp(strokeScore, 0, 100), reasons: strokeReasons },
    respiratoryFailure: {
      positive: respiratoryScore >= 55,
      score: clamp(respiratoryScore, 0, 100),
      reasons: respiratoryReasons
    }
  };
}

function calculateCompleteness(vitals, mentalStatus, modelFeatures) {
  const requiredValues = [
    modelFeatures.arrival_mode,
    modelFeatures.age,
    modelFeatures.sex,
    modelFeatures.pain_location,
    modelFeatures.mental_status_triage,
    modelFeatures.chief_complaint_system,
    vitals.heartRate,
    vitals.respiratoryRate,
    vitals.temperature,
    vitals.systolicBP,
    vitals.spo2,
    vitals.painScore,
    mentalStatus,
    modelFeatures.gcs_total,
    modelFeatures.news2_score
  ];

  return requiredValues.filter(
    value => value !== undefined && value !== null && value !== ''
  ).length / requiredValues.length;
}

async function requestXgboostPrediction(modelFeatures) {
  const inferenceUrl = process.env.ML_INFERENCE_URL || 'http://127.0.0.1:8000';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`${inferenceUrl}/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ features: modelFeatures }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Inference service returned ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function buildFeatureContributions(vitals, signals, config, modelPrediction) {
  const contributions = [];

  if (vitals.spo2 != null) {
    contributions.push({
      feature: 'SpO₂ vs age band',
      value: vitals.spo2,
      impact: Math.abs(config.spo2 - vitals.spo2) * 2.5,
      direction: vitals.spo2 < config.spo2 ? 'INCREASES_RISK' : 'NEUTRAL'
    });
  }

  if (signals.includes('chestPain')) {
    contributions.push({
      feature: 'Chest pain/pressure',
      value: true,
      impact: 18,
      direction: 'INCREASES_RISK'
    });
  }

  if (signals.includes('dyspnea')) {
    contributions.push({
      feature: 'Breathing difficulty',
      value: true,
      impact: 18,
      direction: 'INCREASES_RISK'
    });
  }

  if (modelPrediction?.probabilities) {
    contributions.push({
      feature: 'XGBoost top probability',
      value: `ESI ${modelPrediction.esi}`,
      impact: Number(modelPrediction.confidence || 0),
      direction: 'MODEL_SUPPORT'
    });
  }

  return contributions.slice(0, 5);
}

function scoreWithPrototype(input, signals, ageBand, config, redFlags, completeness) {
  const vitals = input.vitals || {};
  let risk =
    deviation(vitals.heartRate, config.hr) * 8 +
    deviation(vitals.respiratoryRate, config.rr) * 10 +
    deviation(vitals.temperature, config.temp) * 7;

  if (vitals.systolicBP < config.sbp[0]) {
    risk += ((config.sbp[0] - vitals.systolicBP) / config.sbp[0]) * 35;
  }

  if (vitals.spo2 < config.spo2) {
    risk += ((config.spo2 - vitals.spo2) / 10) * 70;
  }

  if (signals.includes('chestPain')) risk += 18;
  if (signals.includes('dyspnea')) risk += 18;
  if (signals.includes('facialDroop') || signals.includes('speechDifficulty')) risk += 30;
  if (signals.includes('seizure')) risk += 22;
  risk += Number(vitals.painScore || 0) * 2;

  if (/confused|altered|unresponsive/i.test(input.mentalStatus || '')) {
    risk += 25;
  }

  const maximumRedFlagScore = Math.max(
    ...Object.values(redFlags).map(flag => flag.score),
    0
  );

  if (maximumRedFlagScore >= 80) risk = Math.max(risk, 90);
  else if (maximumRedFlagScore >= 55) risk = Math.max(risk, 70);

  risk = clamp(risk, 0, 100);

  const esi = risk >= 82 ? 1 : risk >= 62 ? 2 : risk >= 40 ? 3 : risk >= 20 ? 4 : 5;
  const historyConfidence = input.hasHistory ? 100 : 45;
  const ageNormalizationConfidence = completeness > 0.8 ? 92 : 72;
  const modelAgreement = maximumRedFlagScore > 0 && risk < 55 ? 45 : 90;

  const confidence = clamp(
    Math.round(
      CONFIDENCE_WEIGHTS.dataCompleteness * completeness * 100 +
      CONFIDENCE_WEIGHTS.signalConsistency * 88 +
      CONFIDENCE_WEIGHTS.historyAvailability * historyConfidence +
      CONFIDENCE_WEIGHTS.ageNormalization * ageNormalizationConfidence +
      CONFIDENCE_WEIGHTS.modelAgreement * modelAgreement
    ),
    0,
    100
  );

  return { esi, confidence, risk, source: 'PROTOTYPE' };
}

/*
 * XGBoost is preferred when the local inference service is available. The
 * deterministic prototype remains the fail-open fallback, so a missing Python
 * process never prevents staff from continuing with manual triage.
 */
export async function scorePatient(input = {}) {
  try {
    const age = safeNumber(input.age);
    if (age === null || age < 0 || age > 120) {
      throw new Error('Invalid age');
    }

    const ageBand = getAgeBand(age);
    const config = AGE_CONFIG[ageBand];
    const signals = input.extractedSymptoms?.length
      ? input.extractedSymptoms
      : extractClinicalSignals(input.chiefComplaint || '');
    const vitals = input.vitals || {};
    const modelFeatures = buildModelFeatures(input);
    const redFlags = detectRedFlags(input, signals);
    const completeness = calculateCompleteness(vitals, input.mentalStatus, modelFeatures);

    let modelPrediction = null;
    let prototypeScore = scoreWithPrototype(
      input,
      signals,
      ageBand,
      config,
      redFlags,
      completeness
    );

    try {
      modelPrediction = await requestXgboostPrediction(modelFeatures);
    } catch {
      // The caller receives a normal triage response; the model outage is exposed
      // through modelSource so the UI/audit layer can make the fallback visible.
    }

    const selectedEsi = modelPrediction?.esi || prototypeScore.esi;
    const modelConfidence = modelPrediction?.confidence ?? prototypeScore.confidence;
    const historyConfidence = input.hasHistory ? 100 : 45;
    const ageNormalizationConfidence = completeness > 0.8 ? 92 : 72;
    const redFlagAgreement = Object.values(redFlags).some(flag => flag.positive)
      ? 55
      : 92;

    // The model probability is useful evidence, but safety rules still participate
    // in the displayed confidence calculation rather than replacing them blindly.
    const confidence = clamp(
      Math.round(
        CONFIDENCE_WEIGHTS.dataCompleteness * completeness * 100 +
        CONFIDENCE_WEIGHTS.signalConsistency * Math.min(100, modelConfidence) +
        CONFIDENCE_WEIGHTS.historyAvailability * historyConfidence +
        CONFIDENCE_WEIGHTS.ageNormalization * ageNormalizationConfidence +
        CONFIDENCE_WEIGHTS.modelAgreement * redFlagAgreement
      ),
      0,
      100
    );

    const confidenceBand = confidence >= 80 ? 'HIGH' : confidence >= 60 ? 'MEDIUM' : 'LOW';
    let esi = selectedEsi;
    let action = 'AUTO_CONTEXT';
    let escalation = false;

    const reasons = [`Age band ${ageBand.toLowerCase()} applied to vital interpretation.`];

    if (!input.hasHistory) {
      reasons.push('No prior history supplied; confidence intentionally reduced.');
    }

    const redFlagPositive = Object.values(redFlags).some(flag => flag.positive);

    if (redFlagPositive) {
      // A positive safety detector overrides whatever the general model predicted.
      action = 'IMMEDIATE_ESCALATION';
      escalation = true;
      esi = Math.min(esi, 2);
      reasons.unshift('A high-sensitivity red flag triggered immediate escalation.');
    } else if (confidence < 60 || completeness < 0.65) {
      // Under uncertainty we deliberately move toward higher acuity.
      action = 'ABSTAIN_AND_ESCALATE';
      escalation = true;
      esi = Math.max(1, esi - 1);
      reasons.unshift('The system abstained because missing or conflicting data may conceal higher acuity.');
    } else if (esi <= 2) {
      action = 'IMMEDIATE_ESCALATION';
      escalation = true;
    }

    if (signals.length) {
      reasons.push(`Extracted signals: ${signals.slice(0, 5).join(', ')}.`);
    }

    const featureContributions = buildFeatureContributions(
      vitals,
      signals,
      config,
      modelPrediction
    );

    return {
      esi,
      confidence,
      confidenceBand,
      action,
      escalation,
      ageBand,
      redFlags,
      reasons: reasons.slice(0, 5),
      featureContributions,
      dataCompleteness: Math.round(completeness * 100),
      hasHistory: Boolean(input.hasHistory),
      modelVersion: modelPrediction?.modelVersion || 'prototype-v2',
      modelSource: modelPrediction ? 'XGBOOST' : 'PROTOTYPE_FALLBACK',
      modelConfidence: Number(modelConfidence),
      modelProbabilities: modelPrediction?.probabilities || null,
      timestamp: new Date().toISOString(),
      extractedSymptoms: signals
    };
  } catch (error) {
    // Fail-open: model/engine failure must never block the manual triage path.
    return {
      esi: null,
      confidence: 0,
      confidenceBand: 'LOW',
      action: 'FAIL_OPEN',
      escalation: true,
      ageBand: null,
      redFlags: {},
      reasons: ['Triage engine failed safely; manual ESI is required.'],
      featureContributions: [],
      dataCompleteness: 0,
      hasHistory: false,
      modelVersion: 'prototype-v2',
      modelSource: 'FAIL_OPEN',
      modelConfidence: 0,
      modelProbabilities: null,
      timestamp: new Date().toISOString(),
      extractedSymptoms: []
    };
  }
}
