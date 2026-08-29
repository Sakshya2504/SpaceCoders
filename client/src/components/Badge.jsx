// Small, reusable status badges used throughout the clinical workspace.
// Keeping the display logic here avoids repeating ESI/action/flag styling in every page.

const ACTION_LABELS = {
  AUTO_CONTEXT: 'AUTO-CONTEXT',
  IMMEDIATE_ESCALATION: 'IMMEDIATE ESCALATION',
  ABSTAIN_AND_ESCALATE: 'ABSTAIN & ESCALATE',
  FAIL_OPEN: 'FAIL-OPEN'
};

const ACTION_CLASSES = {
  AUTO_CONTEXT: 'action-auto',
  IMMEDIATE_ESCALATION: 'action-critical',
  ABSTAIN_AND_ESCALATE: 'action-warning',
  FAIL_OPEN: 'action-manual'
};

// These short descriptions translate the numeric ESI output into language that
// is easier to scan during a clinical review. They describe the prototype's
// intended interpretation and are not a substitute for the official ESI manual.
const ESI_DESCRIPTIONS = {
  1: 'Immediate intervention: assess for a critical presentation requiring life-saving care.',
  2: 'High-risk and time-sensitive: prompt clinician review is recommended.',
  3: 'Currently stable, but significant evaluation or treatment resources may be needed.',
  4: 'Lower acuity: the current presentation appears stable with limited expected resource needs.',
  5: 'Minimal acuity: the available information suggests a stable presentation with minimal expected resource needs.'
};

/**
 * Shows the Emergency Severity Index recommendation.
 * Unknown/null values intentionally render as an em dash instead of
 * suggesting that the application has a valid acuity score.
 */
export function EsiBadge({ esi }) {
  const value = Number.isFinite(Number(esi)) ? Number(esi) : null;
  const className = value ? `esi-badge esi-${value}` : 'esi-badge esi-na';
  const description = value ? ESI_DESCRIPTIONS[value] : 'Acuity is not available yet.';

  return (
    <span
      className={className}
      aria-label={value ? `ESI ${value}. ${description}` : 'ESI not available'}
    >
      <span>ESI {value ?? '—'}</span>
      {value && (
        <span className="esi-description" aria-hidden="true">
          {description}
        </span>
      )}
    </span>
  );
}

/**
 * Explains how the recommendation should be surfaced to the clinician.
 * The badge is informational only; the final clinical decision stays with the nurse.
 */
export function ActionBadge({ action }) {
  const label = ACTION_LABELS[action] || action || '—';
  const className = ACTION_CLASSES[action] || 'action-manual';

  return (
    <span className={`action-badge ${className}`}>
      {label}
    </span>
  );
}

/**
 * Displays the state of one of the independent red-flag detectors.
 * We include text as well as the visual state so urgency is never conveyed by color alone.
 */
export function FlagBadge({ positive, label }) {
  return (
    <span
      className={`flag-badge ${positive ? 'positive' : 'negative'}`}
      aria-label={`${label}: ${positive ? 'positive' : 'clear'}`}
    >
      <span className="flag-dot" aria-hidden="true" />
      {label}: {positive ? 'POSITIVE' : 'CLEAR'}
    </span>
  );
}
