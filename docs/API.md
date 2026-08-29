# API Reference

PatientTriage.ai exposes a Node/Express API for the web application and a small FastAPI service for the supplied ML artifact.

## Runtime endpoints

```text
Frontend     http://localhost:5173
Node API     http://localhost:3000
ML service   http://127.0.0.1:8000
MongoDB      mongodb://127.0.0.1:27017/patienttriage
```

Node routes are prefixed with `/api`.

Protected Node routes expect:

```http
Authorization: Bearer <JWT>
```

## Response conventions

Successful API responses use the application's standard envelope where applicable:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed",
  "error": null
}
```

HTTP status remains authoritative. Error responses should contain a useful message/code without exposing stack traces.

---

## Authentication

### `POST /api/auth/login`

Authenticates an existing account.

```json
{
  "email": "charge@patienttriage.demo",
  "password": "demo123"
}
```

The response contains a JWT and the authenticated user.

### `POST /api/auth/signup`

Creates a new account.

```json
{
  "name": "Demo Nurse",
  "email": "demo@example.org",
  "password": "example123"
}
```

New self-service accounts receive the default `triage_nurse` role. Privileged roles are not accepted from the browser.

---

## Patients

### `GET /api/patients`

Returns patients. Supported filters include:

```text
status=<status>
q=<patient id, patient name or chief complaint>
```

### `POST /api/patients`

Creates a patient and executes the initial triage workflow.

The request contains the clinician-facing intake data plus the dataset-aligned feature contract. The server then performs validation, feature construction, triage, persistence, audit logging and realtime event publication.

Typical workflow:

```text
validate request
      ↓
generate PT-YYYY-XXXXXX application id
      ↓
build model features
      ↓
run supplied ensemble when available
      ↓
run safety / uncertainty layer
      ↓
persist patient + assessment
      ↓
write audit event
      ↓
emit realtime events
```

### `GET /api/patients/:id`

Accepts either a human-readable application ID such as:

```text
PT-2026-LWSBKX
```

or a valid MongoDB `_id`.

Application IDs are handled separately so they are not incorrectly cast as MongoDB ObjectIds.

### `POST /api/patients/:id/triage`

Runs the standard triage orchestration again. This is useful for operational reprocessing and queue-driven reassessment.

### `POST /api/patients/:id/accept`

Records explicit clinician acceptance of the current recommendation. The model recommendation remains distinguishable from the clinician's final decision.

### `POST /api/patients/:id/override`

Records a clinician override.

```json
{
  "targetEsi": 2,
  "reason": "New vital signs",
  "note": "Patient reports worsening symptoms."
}
```

`targetEsi` must be between 1 and 5, and a reason is required.

### `POST /api/patients/:id/reassess`

Runs a fresh assessment using the patient's current state.

The patient record can expose updated:

```text
triage
finalEsi
assessments
deteriorationDetected
lastReassessmentAt
nextReassessmentAt
```

The UI retains previous assessments so clinicians can review how the recommendation changed over time.

### `POST /api/patients/:id/manual-triage`

Stores a manually selected ESI between 1 and 5. This keeps the workflow available when a human needs to select acuity directly or when the ML service is unavailable.

```json
{
  "esi": 3
}
```

### `POST /api/patients/:id/complete`

Marks the operational patient service as completed. Completed patients are removed from the active waiting workflow and become available from the Past Patients view.

---

## Queue

### `GET /api/queue`

Returns the active waiting queue with operational information such as:

```text
position
patient id / name
final ESI
confidence
wait time
action state
red-flag state
next reassessment
```

### `POST /api/queue/tick`

Runs one queue-monitoring pass. Patients whose next reassessment is due can be re-evaluated using the same triage orchestration used at arrival.

### `POST /api/queue/surge`

Enables or disables prototype surge behavior.

```json
{
  "enabled": true
}
```

Surge mode shortens the configured reassessment interval.

---

## Dashboard

### `GET /api/dashboard/summary`

Returns operational KPIs such as:

```text
patientsToday
waitingNow
criticalCases
highRisk
reassessmentDue
averageConfidence
activeAlerts
```

### `GET /api/dashboard/metrics`

Returns distributions and recent operational activity used by the Command Centre.

---

## Audit

### `GET /api/audit`

Returns audit events for the Audit Trail screen.

### `GET /api/audit/verify`

Verifies the linked SHA-256 audit chain and identifies the first broken event when validation fails.

Example successful result:

```json
{
  "valid": true,
  "events": 48,
  "firstBrokenEvent": null
}
```

---

## Health

### `GET /api/health`

Reports application, database, realtime and model-mode information.

Example shape:

```json
{
  "success": true,
  "data": {
    "ok": true,
    "service": "PatientTriage.ai",
    "mode": "prototype",
    "aiEngine": "ONLINE",
    "database": "ONLINE",
    "realtime": "CONNECTED"
  }
}
```

The health state describes runtime availability. The patient assessment metadata is the source for the exact model source/version used for a specific prediction.

---

## Final model inference service

The final supplied model is a persisted stacked ensemble exposed through FastAPI.

```text
5 × LightGBM
+
5 × XGBoost
      ↓
LogisticRegression meta-model
      ↓
ESI 1–5 + class probabilities + confidence
```

### `GET /health`

Checks whether the persisted artifact can be loaded.

Expected healthy shape:

```json
{
  "ok": true,
  "model": "LightGBM + XGBoost Ensemble",
  "modelVersion": "triage-ensemble-v1",
  "featureCount": 52,
  "foldCount": 5
}
```

### `POST /predict`

Accepts the patient feature payload. The runtime builds the final engineered feature frame and follows the exact feature ordering stored inside the supplied artifact.

The final artifact contains **52 prediction columns**. The runtime uses the artifact's saved `features` list rather than maintaining a competing feature order.

Response shape:

```json
{
  "model": "LightGBM + XGBoost Ensemble",
  "modelVersion": "triage-ensemble-v1",
  "esi": 3,
  "confidence": 86.0,
  "probabilities": {
    "ESI 1": 0.01,
    "ESI 2": 0.05,
    "ESI 3": 0.86,
    "ESI 4": 0.06,
    "ESI 5": 0.02
  }
}
```

The model's numeric ESI output is presented in the portal as ESI 1–5. The application then applies its independent safety and uncertainty layer.

The supplied artifact is the source of truth for final inference. `ml/train_xgboost.py` is retained as earlier prototype/reference training code and is not the runtime source for the supplied `.pkl` artifact.

---

## Socket.IO events

The React shell maintains one shared Socket.IO connection to the Node application.

Important events include:

```text
system:health
patient:created
triage:completed
escalation
reassessment
override
queue:updated
```

A typical triage event is:

```json
{
  "patientId": "PT-2026-LWSBKX",
  "esi": 2,
  "action": "IMMEDIATE_ESCALATION"
}
```

Realtime events are operational notifications. They do not replace the persisted patient record or audit trail.

---

## Authorization model

Supported roles:

```text
triage_nurse
charge_nurse
clinical_admin
system_admin
```

Authentication and role authorization are enforced on the server. The frontend only controls presentation and navigation.

---

## Error handling

Common application errors include:

```text
VALIDATION_ERROR
PATIENT_NOT_FOUND
UNAUTHORIZED
FORBIDDEN
```

The patient lookup route explicitly handles application IDs and MongoDB IDs separately to avoid invalid ObjectId casting.

For model inference failures, the application records the fallback source and continues through its prototype fail-open workflow rather than presenting a fallback result as the supplied ensemble.

---

## Data and safety boundary

The API is part of a decision-support prototype. The backend owns safety precedence, confidence handling, model fallback, auditability and clinician-decision recording.

The model recommendation is advisory. The final patient priority is the clinician-controlled application state, and post-triage outcomes must not be fed back into inference.
