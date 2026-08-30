// Simple keyword groups used by the prototype to extract clinically relevant
// signals from the free-text chief complaint. This is intentionally lightweight
// and should not be treated as a clinical NLP model.
const signalGroups = {
  chestPain: [
    'chest pain',
    'chest pressure',
    'chest tightness',
    'chest discomfort'
  ],
  radiation: [
    'radiating to',
    'radiates to',
    'left arm',
    'right arm',
    'jaw pain'
  ],
  diaphoresis: ['sweating', 'diaphoresis', 'clammy'],
  dyspnea: [
    'shortness of breath',
    'breathing difficulty',
    'difficulty breathing',
    'dyspnea',
    'cannot breathe',
    "can't breathe"
  ],
  weakness: ['weakness', 'weak'],
  facialDroop: ['facial droop', 'face droop'],
  speechDifficulty: [
    'speech difficulty',
    'slurred speech',
    'trouble speaking'
  ],
  confusion: ['confusion', 'confused', 'altered mental status'],
  fever: ['fever', 'febrile'],
  chills: ['chills', 'rigors'],
  nausea: ['nausea', 'nauseated'],
  severeHeadache: [
    'severe headache',
    'worst headache',
    'thunderclap headache'
  ],
  seizure: ['seizure', 'convulsion'],
  syncope: [
    'syncope',
    'fainted',
    'fainting',
    'passed out'
  ],
  bleeding: ['bleeding', 'blood loss', 'hemorrhage'],
  trauma: [
    'trauma',
    'fall',
    'accident',
    'laceration',
    'injury'
  ],
  infection: [
    'infection',
    'infected',
    'pneumonia',
    'uti',
    'urinary infection',
    'cellulitis'
  ],
  cyanosis: ['blue lips', 'cyanosis', 'blue fingers'],
  inabilitySpeak: [
    'unable to speak',
    'cannot speak',
    "can't speak"
  ],
  severeRespiratoryDistress: [
    'severe respiratory distress',
    'gasping',
    'air hunger'
  ]
};

/**
 * Convert a chief-complaint sentence into the small set of signals consumed
 * by the prototype safety and triage logic.
 */
export function extractClinicalSignals(complaint = '') {
  const text = String(complaint).toLowerCase();

  return Object.entries(signalGroups)
    .filter(([, phrases]) => phrases.some(phrase => text.includes(phrase)))
    .map(([signal]) => signal);
}

// Small helper for callers that need to check one extracted signal.
export const hasSignal = (signals, name) =>
  Array.isArray(signals) && signals.includes(name);
