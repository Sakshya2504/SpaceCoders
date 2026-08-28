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

/**
 * Shows the Emergency Severity Index recommendation.
 * Unknown/null values intentionally render as an em dash instead of
 * suggesting that the application has a valid acuity score.
 */
export function EsiBadge({ esi }) {
  const value = Number.isFinite(Number(esi)) ? Number(esi) : null;
  const className = value ? `esi-badge esi-${value}` : 'esi-badge esi-na';

  return (
    <span className={className} aria-label={value ? `ESI ${value}` : 'ESI not available'}>
      ESI {value ?? '—'}
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
