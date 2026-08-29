# PatientTriage.ai — Code & UI Style Guide

The goal of this guide is simple: a teammate should be able to open a file and understand what it is doing without decoding clever one-liners.

## 1. JavaScript and React

Use two spaces for indentation and keep related logic visually grouped.

Prefer this:

```js
function getPatientName(patient) {
  if (!patient) {
    return 'Unknown patient';
  }

  return `${patient.firstName} ${patient.lastName}`.trim();
}
```

Avoid compressed code such as:

```js
const getPatientName = p => p ? `${p.firstName} ${p.lastName}`.trim() : 'Unknown patient';
```

A short helper is fine when it genuinely improves readability. The point is not to make every function long; it is to make the intent obvious.

## 2. JSX formatting

Expand JSX when an element has multiple props, children or conditional branches.

```jsx
<button
  type="button"
  className="primary-button"
  onClick={handleSubmit}
  disabled={saving}
>
  {saving ? 'Saving...' : 'Save assessment'}
</button>
```

Do not hide event handlers, conditional rendering and long class-name expressions inside a single line.

## 3. Comments: explain why

Comments should help the next developer understand an important decision.

Good comment:

```js
// Application IDs are human-readable values such as PT-2026-LWSBKX.
// Check them before ObjectId casting so patient links cannot fail with a
// Mongoose CastError.
```

Unhelpful comment:

```js
// Check if id is an application id.
```

The same rule applies to React, backend and Python code. Do not comment every obvious assignment.

## 4. Where comments matter most

Add a short explanation when the code involves:

```text
model/fallback boundaries
feature engineering
safety precedence
uncertainty handling
reassessment history
realtime lifecycle
legacy database compatibility
security-sensitive behavior
```

These are the places where a future refactor can accidentally change system behavior.

## 5. Clinical workflow separation

Keep these concepts separate:

```text
Model recommendation
        ↓
Safety / uncertainty layer
        ↓
Clinician review
        ↓
Final decision
```

Do not rename or collapse them into one generic “score”.

The patient's effective final priority may be different from the raw model recommendation after a clinician action or safety escalation.

## 6. Final model contract

The supplied final artifact is:

```text
ml/artifacts/triage_ensemble_model.pkl
```

Its runtime structure is:

```text
5 × LightGBM
+
5 × XGBoost
      ↓
LogisticRegression meta-model
      ↓
ESI 1–5 + probabilities + confidence
```

The runtime must read the artifact's saved feature order and categorical mappings. Do not create a second competing feature order in page components or unrelated server modules.

The older `ml/train_xgboost.py` file is reference/prototype training code, not the source of truth for the supplied artifact.

## 7. Data contract

The reference training dataset contains 40 columns. Keep these boundaries clear:

```text
patient_id      → identifier
triage_acuity   → target
disposition     → downstream outcome
ed_los_hours    → downstream outcome
```

The final artifact uses a 52-feature prediction representation after the supplied engineering steps.

Derived values such as BMI, mean arterial pressure, pulse pressure, shock index and arrival context belong in the feature-building layer. They should not be independently reimplemented across several UI pages.

## 8. Asynchronous UI actions

Every API-backed action should make its state obvious:

```text
idle
 ↓
loading
 ↓
success / error
```

While loading:

- prevent duplicate submissions;
- disable the relevant control;
- show a short readable status.

On failure, give the user a useful message and preserve the form state where possible.

## 9. API client usage

Use the shared API client for authentication headers, common error handling and request conventions. Do not create ad-hoc `fetch`/Axios configuration in every page unless there is a clear reason.

## 10. UI conventions

The portal uses a compact operations-dashboard visual language:

```text
consistent spacing
clear primary action
quiet secondary actions
readable status text
local scrolling for dense content
visible keyboard focus
```

Never make urgency understandable only through color. The text should still say `IMMEDIATE ESCALATION`, `CLEAR`, `FAIL-OPEN`, and similar states.

Use product/domain icons rather than browser glyphs where possible.

## 11. Long content and scrolling

Long lists should be bounded when a component is naturally a panel:

```text
alert center      → local vertical scroll
reassessment list → local vertical scroll
wide data table   → local horizontal scroll
```

Do not let repeated realtime alerts or reassessments expand the entire page indefinitely.

## 12. Realtime lifecycle

Socket.IO connections should normally be shared at the application shell level. Page components subscribe to events and clean up their listeners when unmounted.

Avoid opening a new connection every time a route renders.

## 13. Backend readability

Prefer small named helpers over deeply nested inline logic.

For request handlers, a useful pattern is:

```text
validate input
      ↓
load / identify resource
      ↓
run domain operation
      ↓
persist state
      ↓
audit important change
      ↓
emit realtime event when required
      ↓
return response
```

Keep database queries, safety decisions and HTTP response formatting conceptually separate.

## 14. Python / ML readability

Python inference code should make the data transformation stages visible:

```text
request payload
      ↓
base dataframe
      ↓
engineered features
      ↓
saved categorical mappings
      ↓
saved feature order
      ↓
base model probabilities
      ↓
stacking model
      ↓
ESI result
```

Avoid silently changing feature names, category vocabularies or class ordering during refactoring.

## 15. File organization

```text
client/src/components → reusable UI
client/src/pages      → route-level workflows
client/src/utils      → shared frontend helpers
server/src/routes     → HTTP boundary
server/src/services   → domain and triage logic
server/src/models     → MongoDB schemas
ml/                   → model runtime and verification
docs/                 → project documentation
```

Keep older files only when they are intentionally retained for reference, migration or testing. Active routes should point to the maintained implementation.

## 16. Before committing

Run the repository checks and a focused manual smoke test:

```text
backend tests
frontend production build
Python syntax checks
ML runtime/import checks
```

Then verify the main workflow:

```text
login
→ intake
→ create patient
→ patient review
→ reassess
→ accept / override
→ queue
→ mark service done
→ past patients
→ alerts
→ audit verification
```

A formatting-only change should still avoid accidental behavioral changes around model inference, safety logic or patient state.
