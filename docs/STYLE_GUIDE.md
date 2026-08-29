# PatientTriage.ai — Code & UI Style Guide

This guide keeps the project readable as more clinical workflows are added. The goal is straightforward code that a teammate can understand without needing to decode clever one-liners.

## JavaScript and React

Use two spaces for indentation and one clear statement per line. Prefer early returns for validation and small helper functions for repeated transformations.

```js
function getPatientName(patient) {
  if (!patient) return 'Unknown patient';

  return `${patient.firstName} ${patient.lastName}`.trim();
}
```

Keep React markup expanded when it contains more than one meaningful prop or child. Avoid compressed JSX that hides event handlers and conditional rendering on the same line.

Comments should explain **why** a piece of code exists, especially around safety boundaries, model fallback behavior, derived features, and realtime lifecycle. Do not add comments that merely repeat the syntax.

## Clinical workflow code

Keep model recommendation, safety detection, and clinician decision as separate concepts.

```text
model recommendation
        ↓
safety / uncertainty layer
        ↓
clinician review
        ↓
final decision
```

Do not silently turn a fallback model result into a successful ensemble result. Always preserve the model source/version metadata.

## Data contract

The 40-column training dataset is the source of truth for the portal-facing raw feature vocabulary. `patient_id` is an application identifier. `triage_acuity` is the target. `disposition` and `ed_los_hours` are downstream outcomes and must never be fed back into inference.

Derived features belong in the feature-building layer, not scattered through unrelated UI components.

## API handling

Every asynchronous UI action should have:

- a clear loading state;
- a visible error state;
- a success state where useful;
- prevention of duplicate submissions while busy.

Prefer one shared API client so authorization and error handling remain consistent.

## UI principles

The portal uses a compact operations-dashboard style:

- use a consistent spacing rhythm;
- keep primary actions visually obvious;
- do not rely on color alone for safety states;
- preserve readable labels on smaller screens;
- allow wide tables to scroll inside their own region;
- provide keyboard focus states for interactive controls.

Icons should reinforce meaning. Avoid generic browser or placeholder glyphs when a product or domain-specific icon is available.

## File organization

Reusable UI belongs in `client/src/components`. Route-level workflows belong in `client/src/pages`. Cross-page helpers belong in `client/src/utils`. Backend feature construction and triage orchestration stay in `server/src/services`.

Keep the legacy and V2 workflow files only when they are deliberately retained for migration/testing. The active routes should point to the maintained implementation.

## Before committing

Run the same checks used by CI:

```text
Backend tests
Frontend production build
Python syntax check
ML Python compilation
```

Then perform a quick manual smoke test of login, intake, patient review, reassessment, accept/override, queue, completion, past patients, alerts, and audit verification.
