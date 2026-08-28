import { extractClinicalSignals } from './nlp.js';

/*
 * These ranges are prototype assumptions used to demonstrate age-aware logic.
 * They are NOT clinical guidelines and must not be treated as validated thresholds.
 * Keeping them in one object makes hospital-specific calibration possible later.
 */
export const AGE_CONFIG = {
  PEDIATRIC: { hr: [70, 130], rr: [15, 30], temp: [36, 38], sbp: [80, 115], spo2: 95 },
  ADOLESCENT: { hr: [60, 110], rr: [12, 22], temp: [36, 38], sbp: [90, 125], spo2: 95 },
  ADULT: { hr: [55, 100], rr: [12, 20], temp: [36, 38], sbp: [95, 140], spo2: 95 },
  GERIATRIC: { hr: [50, 95], rr: [12, 20], temp: [36, 37.8], sbp: [100, 145], spo2: 94 }
};

// Confidence is intentionally explicit and configurable rather than random.
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

  if (number < range[0]) {
    return (range[0] - number) / Math.max(1, range[0]);
  }

  if (number > range[1]) {
    return (number - range[1]) / Math.max(1, range[1]);
  }

  return 0;
}

/*
 * Each detector is intentionally independent. A positive result is allowed to
 * interrupt the general severity score because catastrophic signals should not
 * be diluted by otherwise reassuring data.
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

  // Sepsis-like signal aggregation.
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
  if (
    signals.includes('infection') ||
    /infection|pneumonia|uti|cellulitis/.test(history)
  ) {
    sepsisScore += 25;
    sepsisReasons.push('Possible infection context');
  }

  // MI-like signal aggregation.
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

  // Stroke-like signal aggregation.
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

  // Respiratory-failure-like signal aggregation.
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
    sepsis: {
      positive: sepsisScore >= 55,
      score: clamp(sepsisScore, 0, 100),
      reasons: sepsisReasons
    },
    mi: {
      positive: miScore >= 55,
      score: clamp(miScore, 0, 100),
      reasons: miReasons
    },
    stroke: {
      positive: strokeScore >= 55,
      score: clamp(strokeScore, 0, 100),
      reasons: strokeReasons
    },
    respiratoryFailure: {
      positive: respiratoryScore >= 55,
      score: clamp(respiratoryScore, 0, 100),
      reasons: respiratoryReasons
    }
  };
}

function calculateCompleteness(vitals, mentalStatus) {
  const requiredValues = [
    vitals.heartRate,
    vitals.respiratoryRate,
    vitals.temperature,
    vitals.systolicBP,
    vitals.spo2,
    vitals.painScore,
    mentalStatus
  ];

  return requiredValues.filter(
    value => value !== undefined && value !== null && value !== ''
  ).length / requiredValues.length;
}

export function scorePatient(input = {}) {
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

    const redFlags = detectRedFlags(input, signals);
    const completeness = calculateCompleteness(vitals, input.mentalStatus);

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

    const flagScores = Object.values(redFlags).map(flag => flag.score);
    const maximumRedFlagScore = Math.max(...flagScores, 0);

    // A strong red-flag score must not be averaged away by the general score.
    if (maximumRedFlagScore >= 80) {
      risk = Math.max(risk, 90);
    } else if (maximumRedFlagScore >= 55) {
      risk = Math.max(risk, 70);
    }

    risk = clamp(risk, 0, 100);

    // Confidence follows the specification: completeness, signal consistency,
    // history, age normalization and agreement between scoring layers.
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

    const confidenceBand =
      confidence >= 80 ? 'HIGH' : confidence >= 60 ? 'MEDIUM' : 'LOW';

    let esi;
    if (risk >= 82) esi = 1;
    else if (risk >= 62) esi = 2;
    else if (risk >= 40) esi = 3;
    else if (risk >= 20) esi = 4;
    else esi = 5;

    const redFlagPositive = Object.values(redFlags).some(flag => flag.positive);
    let action = 'AUTO_CONTEXT';
    let escalation = false;

    const reasons = [`Age band ${ageBand.toLowerCase()} applied to vital interpretation.`];

    if (!input.hasHistory) {
      reasons.push('No prior history supplied; confidence intentionally reduced.');
    }

    if (redFlagPositive) {
      // High-sensitivity detectors always win over the general ranking score.
      action = 'IMMEDIATE_ESCALATION';
      escalation = true;
      esi = Math.min(esi, 2);
      reasons.unshift('A high-sensitivity red flag triggered immediate escalation.');
    } else if (confidence < 60 || completeness < 0.65) {
      // Uncertainty biases upward instead of silently selecting the lower-risk path.
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

    const featureContributions = [];

    if (vitals.spo2 != null) {
      featureContributions.push({
        feature: 'SpO₂ vs age band',
        value: vitals.spo2,
        impact: Math.abs(config.spo2 - vitals.spo2) * 2.5,
        direction: vitals.spo2 < config.spo2 ? 'INCREASES_RISK' : 'NEUTRAL'
      });
    }

    if (signals.includes('chestPain')) {
      featureContributions.push({
        feature: 'Chest pain/pressure',
        value: true,
        impact: 18,
        direction: 'INCREASES_RISK'
      });
    }

    if (signals.includes('dyspnea')) {
      featureContributions.push({
        feature: 'Breathing difficulty',
        value: true,
        impact: 18,
        direction: 'INCREASES_RISK'
      });
    }

    featureContributions.push({
      feature: 'History availability',
      value: input.hasHistory ? 'Present' : 'Zero-history',
      impact: 10,
      direction: input.hasHistory ? 'SUPPORTS_CONFIDENCE' : 'REDUCES_CONFIDENCE'
    });

    return {
      esi,
      confidence,
      confidenceBand,
      action,
      escalation,
      ageBand,
      redFlags,
      reasons: reasons.slice(0, 5),
      featureContributions: featureContributions
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 5),
      dataCompleteness: Math.round(completeness * 100),
      hasHistory: Boolean(input.hasHistory),
      modelVersion: 'prototype-v2',
      timestamp: new Date().toISOString(),
      extractedSymptoms: signals
    };
  } catch (error) {
    // Fail-open is a safety requirement: an engine error must never block manual triage.
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
      timestamp: new Date().toISOString(),
      extractedSymptoms: []
    };
  }
}
