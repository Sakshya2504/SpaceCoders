# PatientTriage.ai — Testing & Verification Guide

This guide verifies the software behavior of the prototype from startup through the complete clinician workflow. Passing these checks confirms the current implementation behaves as documented; it does not establish clinical validity.

## 1. Startup

Install dependencies:

```powershell
npm install
npm run install:all
```

Start MongoDB, then start the supplied model service:

```powershell
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Start the MERN application in another terminal:

```powershell
npm run dev
```

Expected endpoints:

```text
Frontend → http://localhost:5173
Backend  → http://localhost:3000
ML       → http://127.0.0.1:8000
```

## 2. Automated checks

The repository CI checks source-level health such as:

```text
Node dependency installation
Backend tests
Frontend production build
Python syntax/module compilation
```

These checks do not replace local MongoDB, model-service and Socket.IO integration testing.

## 3. Model artifact verification

Before model-backed tests:

```powershell
python ml/verify_model_artifact.py
```

Confirm the supplied artifact is:

```text
ml/artifacts/triage_ensemble_model.pkl
```

and that its recorded checksum matches the project documentation.

The final runtime ensemble is:

```text
5 × LightGBM
+
5 × XGBoost
      ↓
LogisticRegression stacking model
      ↓
ESI 1–5 + probabilities + confidence
```

Do not use the older prototype training script as evidence that the supplied final artifact has been loaded.

## 4. Authentication

### Login

Use a seeded synthetic account:

```text
charge@patienttriage.demo
Password: demo123
```

Confirm the protected application opens and the user/role are shown.

### Invalid login

Use an incorrect password. Verify that the browser shows a useful error without exposing stack traces or secrets.

### Signup

Open `/signup` and create a synthetic account.

Verify that required fields and password confirmation are enforced and that the server assigns the default `triage_nurse` role.

## 5. Intake and data contract

Open **Patient Intake** and complete the available training-aligned fields:

```text
identity / demographics
arrival context
complaint context
history
medication / comorbidity counts
vitals
GCS
pain score
weight / height
NEWS2
```

Verify calculated fields are displayed for:

```text
age group
arrival hour/day/month/season
shift
BMI
mean arterial pressure
pulse pressure
shock index
```

Confirm post-triage values are not required as predictive inputs:

```text
patient_id
disposition
ed_los_hours
triage_acuity
```

## 6. Patient creation

Submit a synthetic patient.

Expected sequence:

```text
intake submitted
    ↓
application ID generated
    ↓
feature contract built
    ↓
final ensemble called when available
    ↓
safety / uncertainty layer runs
    ↓
patient + assessment stored
    ↓
audit event written
    ↓
realtime event emitted
    ↓
Patient Review opens
```

Verify that the review page is not blank and that the recommendation is readable.

## 7. Model result

With FastAPI healthy, verify that Patient Review shows:

```text
AI recommended ESI
model/source
model version
confidence
five-class probabilities
supporting reasons
independent red flags
```

The model name should identify the supplied ensemble, not merely “XGBoost”.

## 8. ESI display

Verify the portal maps the numeric model output to the human-readable ESI descriptions:

```text
ESI 1 → Immediate intervention
ESI 2 → High-risk / time-sensitive
ESI 3 → Stable, but significant resource need
ESI 4 → Lower acuity
ESI 5 → Minimal acuity
```

These are prototype product explanations and should not be described as a clinically validated implementation.

## 9. Safety detectors

Use synthetic cases to exercise each detector family.

### Respiratory-risk example

```text
SpO₂: 82
Respiratory rate: 34
Complaint: severe shortness of breath
```

Verify the respiratory detector can raise the configured urgency and that a corresponding alert/audit event is visible.

### Other detector families

Also exercise synthetic examples for:

```text
MI-like
stroke-like
sepsis-like
```

Confirm each remains separate from the general model score.

## 10. Uncertainty and fail-open

Create a synthetic patient with limited history and verify uncertainty is visible.

Then stop the Python model service and trigger a triage/reassessment.

Expected behavior:

```text
FastAPI unavailable
      ↓
Node catches failure
      ↓
explicit prototype fallback
      ↓
workflow continues
      ↓
source metadata identifies fallback
```

The fallback must not be presented as the supplied ensemble result.

## 11. Reassess

Open Patient Review and click **Reassess**.

Verify that the reassessment window allows updated current values and that the action shows an explicit loading state.

After the request completes:

```text
new recommendation
new confidence
new assessment record
previous assessments retained
```

Add several reassessments and confirm the history is internally scrollable rather than expanding the whole page without bound.

## 12. Accept and Override

### Accept

Click **Accept**.

Verify a clinician action is recorded and the final state remains distinguishable from the raw model recommendation.

### Override

Click **Override** and verify:

```text
Target ESI → required, 1–5
Reason     → required
Note       → optional
```

After saving, verify the clinician-selected priority becomes the effective final state and the action is audited.

## 13. Live Queue

Open **Live Queue** and verify:

```text
position
patient identity
ESI
confidence
wait time
action state
red-flag state
reassessment timing
```

Click **Reassess now** and confirm the queue refreshes.

Toggle **Surge mode** and confirm the mode changes.

## 14. Alerts

Open the alert bell and trigger workflow events.

Verify that the alert center can show:

```text
new triage recommendation
immediate escalation
deterioration
clinician override
AI fail-open
surge activity
```

Add multiple alerts and confirm the menu remains bounded and scrollable.

## 15. Service completion and Past Patients

From Patient Review, click **Mark service done**.

Verify:

```text
patient leaves active workflow
      ↓
completion state is stored
      ↓
patient becomes visible in Past Patients
```

Historical assessments and audit information should remain reviewable.

## 16. Patient identifiers

Open a patient using a human-readable application ID such as:

```text
PT-2026-LWSBKX
```

Verify no Mongoose ObjectId cast error occurs.

Also verify a valid MongoDB `_id` works in a controlled development request if both formats are supported by the current route.

## 17. Realtime behavior

Keep the application open while creating or updating patients.

Verify that Socket.IO events update the relevant UI without requiring a full page reload:

```text
system:health
patient:created
triage:completed
escalation
reassessment
override
queue:updated
```

## 18. Audit verification

Open **Audit Trail** and click **Verify chain**.

Expected healthy state:

```text
CHAIN VALID
```

In a controlled test database, modifying one audit document should cause verification to identify the first broken event rather than returning a generic failure.

## 19. Dashboard

After creating several synthetic patients, verify Command Centre metrics are dynamic:

```text
patients today
waiting now
critical / high-risk counts
reassessment due
average confidence
active alerts
ESI distribution
```

Confirm values are derived from stored application state rather than fixed display constants.

## 20. Responsive verification

Test approximately:

```text
1440px  desktop
1200px  narrow desktop
900px   tablet
640px   phone
400px   small phone
```

Confirm:

```text
no page-wide horizontal overflow
forms fit available width
primary actions remain reachable
alert panel fits the viewport
reassessment history scrolls locally
data tables scroll locally when required
keyboard focus remains visible
```

## 21. Build verification

Run:

```powershell
npm run build
```

The frontend production build should finish without unresolved imports or syntax errors.

## 22. Final smoke-test checklist

```text
[ ] MongoDB connects
[ ] supplied model artifact verifies
[ ] FastAPI /health is healthy
[ ] Node /api/health is healthy
[ ] frontend runs on 5173
[ ] login works
[ ] signup works
[ ] intake renders all required field families
[ ] derived values calculate
[ ] patient creation works
[ ] Patient Review loads
[ ] supplied ensemble metadata is shown
[ ] ESI explanation is shown
[ ] safety detectors are shown separately
[ ] Accept works
[ ] Override works
[ ] Reassess works
[ ] reassessment history is retained
[ ] queue works
[ ] alerts update in realtime
[ ] Mark service done works
[ ] Past Patients contains completed patient
[ ] audit verification works
[ ] responsive layouts work
[ ] production build passes
```

## 23. Interpreting test results

A passing software test suite means the current prototype behaves as implemented. It does not demonstrate clinical accuracy, effectiveness, fairness, safety, regulatory compliance or suitability for unsupervised patient care.
