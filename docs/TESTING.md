# Testing & Verification Guide

This document is the final manual verification plan for PatientTriage.ai. It is intended for local development and demonstration. Passing these checks confirms that the implemented software behavior works as designed; it does not establish clinical validity.

## 1. Startup verification

From the repository root:

```powershell
npm install
npm run install:all
npm run dev
```

Confirm:

```text
Frontend  http://localhost:5173
Backend   http://localhost:3000
```

If model-backed inference is being tested, train the model and start the Python service separately:

```powershell
python -m pip install -r ml/requirements.txt
python -m pip install -r ml/requirements-inference.txt
python ml/train_xgboost.py --data train.csv
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

## 2. Health checks

Backend:

```text
http://localhost:3000/api/health
```

Verify that the API reports database, AI mode and realtime state.

ML service:

```text
http://127.0.0.1:8000/health
```

Verify that XGBoost reports `ok: true` and the expected model version.

## 3. Authentication

### Login

Use a seeded account:

```text
charge@patienttriage.demo
Password: demo123
```

Confirm that the protected application loads.

### Invalid login

Use an incorrect password. A readable error should appear without exposing stack traces or internal configuration.

### Signup

Open `/signup` and create a new account.

Verify that:

- required fields are enforced;
- invalid email is rejected by the browser;
- password confirmation is required;
- successful signup creates a session;
- the server assigns the default `triage_nurse` role.

## 4. Intake and data-contract verification

Open **Patient Intake**.

Complete identity, demographics, arrival context, complaint, history and measurements.

Verify the browser displays derived values for:

```text
BMI
Mean arterial pressure
Pulse pressure
Shock index
```

Verify the submitted `modelFeatures` uses the training dataset's feature names.

The following are intentionally not operator-entered model predictors:

```text
patient_id
disposition
ed_los_hours
triage_acuity
```

## 5. Patient creation

Submit a valid synthetic patient.

Expected sequence:

```text
POST /api/patients
     ↓
patient ID generated
     ↓
complaint signals extracted
     ↓
triage executed
     ↓
patient persisted
     ↓
audit events written
     ↓
realtime events emitted
     ↓
Patient Review opened
```

## 6. XGBoost verification

With the Python service available, create a patient and inspect the stored model metadata.

Verify:

- predicted ESI is 1–5;
- class probabilities are present;
- probability values are numeric;
- model name/version is recorded;
- Patient Review does not represent the recommendation as an autonomous final decision.

## 7. Red-flag verification

### Respiratory case

Use synthetic values such as:

```text
SpO₂: 82
Respiratory rate: 34
Complaint: severe shortness of breath and blue lips
```

Verify:

- respiratory detector is positive;
- immediate escalation is displayed;
- an alert is generated;
- audit activity is recorded.

### MI-like case

Use a complaint containing chest pressure, radiation, diaphoresis and nausea.

Verify the MI-like detector records the expected signals.

### Stroke-like case

Use sudden facial droop, speech difficulty and weakness.

Verify the stroke-like detector increases urgency.

### Sepsis-like case

Use synthetic fever/infection context with tachycardia, elevated respiratory rate, low systolic BP and altered mental status.

Verify the independent detector is represented in the recommendation.

## 8. Uncertainty and fail-open verification

Create a patient with complete information and one with `hasHistory = false`.

Verify that missing history reduces the confidence contribution.

Then stop the Python service and trigger triage/reassessment.

Expected behavior:

```text
XGBoost unavailable
      ↓
Node fallback scorer
      ↓
workflow remains available
      ↓
model source indicates fallback
```

The failure must not leave the browser request hanging indefinitely.

## 9. Patient identifier verification

Open a seeded patient by application ID:

```text
PT-2026-001
```

Verify that the route returns the patient without a Mongoose ObjectId cast error.

## 10. Clinician decision tests

### Accept

Click **Accept**.

Verify a clinician acceptance event is created and the final priority remains distinguishable from the model recommendation.

### Override

Choose **Override**.

Verify:

```text
Target ESI → required → 1–5
Reason     → required → structured option
Note       → optional
```

After saving, confirm `finalEsi` reflects the clinician selection and the override is audited.

### Reassess

Click **Reassess** and confirm the patient is scored again and the assessment history grows.

## 11. Queue verification

Open **Live Queue**.

Verify:

- waiting patients load;
- positions are shown;
- ESI and confidence are shown;
- wait time is visible;
- action state is visible;
- red-flag count is visible.

Click **Reassess now** and verify the queue refreshes.

Toggle **Surge mode** and verify its state changes.

## 12. Reassessment and deterioration

For a waiting synthetic patient, create a worsening condition through the reassessment workflow.

Verify:

```text
previous ESI
    ↓
new ESI
    ↓
deteriorationDetected
    ↓
realtime reassessment event
    ↓
alert / audit activity
```

## 13. Realtime alert testing

Keep the alert center visible and trigger events through the workflow.

At minimum verify:

```text
triage completion
immediate escalation
deterioration
override
fail-open
queue update
```

The alert center should update unread state without a full page reload.

## 14. Audit verification

Open **Audit Trail**.

Click **Verify chain**.

For a healthy seed/demo state, expect:

```text
CHAIN VALID
```

The result should include the number of verified events.

To test the invalid path in a controlled development environment, alter a test audit document and run verification. The service should report the first broken event rather than simply returning a generic failure.

## 15. Responsive verification

Test approximately:

```text
1440px  desktop
1200px  narrow desktop
900px   tablet
640px   phone
400px   small phone
```

Confirm:

- no page-wide horizontal overflow;
- forms collapse to available width;
- buttons remain usable;
- alert panel fits the viewport;
- navigation remains reachable;
- dense tables scroll locally when necessary.

## 16. Build verification

Run:

```powershell
npm run build
```

The Vite production build should complete without unresolved imports or syntax errors.

## 17. Regression checklist

```text
[ ] npm install succeeds
[ ] client/server dependencies install
[ ] MongoDB connects
[ ] backend starts on 3000
[ ] frontend starts on 5173
[ ] /api/health responds
[ ] ML /health responds when enabled
[ ] login works
[ ] signup works
[ ] seed works
[ ] patient intake renders correctly
[ ] derived metrics calculate
[ ] patient creation works
[ ] dataset-aligned model features are generated
[ ] XGBoost result is recorded when available
[ ] fallback works when XGBoost is unavailable
[ ] red flags work
[ ] confidence/uncertainty behavior works
[ ] application patient IDs work
[ ] patient review loads
[ ] accept works
[ ] override works
[ ] reassess works
[ ] queue works
[ ] surge mode works
[ ] realtime alerts appear
[ ] audit chain verifies
[ ] responsive layouts work
[ ] production build completes
```

## 18. Test-data safety

All functional testing in this repository should use synthetic data. Never run the destructive seed process against a production database.

## 19. Test-result interpretation

A passing software regression suite demonstrates implementation correctness for the current prototype. It does not prove clinical accuracy, safety, bias mitigation, effectiveness, regulatory compliance or suitability for unsupervised patient care.
