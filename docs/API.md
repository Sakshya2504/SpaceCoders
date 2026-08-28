# API Reference

## Overview

The Node API runs on:

```text
http://localhost:3000
```

Every route below is prefixed with `/api` in the running application.

Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

JWTs are returned by login and signup.

## Standard response envelope

Successful responses follow the application's response helper format:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed",
  "error": null
}
```

Error responses use the same envelope with a useful message/code. HTTP status remains authoritative.

## Authentication

### POST `/api/auth/login`

Authenticate an existing account.

Request:

```json
{
  "email": "charge@patienttriage.demo",
  "password": "demo123"
}
```

Returns:

```json
{
  "token": "<JWT>",
  "user": {
    "id": "...",
    "name": "Charge Nurse",
    "email": "charge@patienttriage.demo",
    "role": "charge_nurse"
  }
}
```

### POST `/api/auth/signup`

Create a new account.

Request:

```json
{
  "name": "Demo Nurse",
  "email": "demo@example.org",
  "password": "example123"
}
```

The server assigns `triage_nurse` as the default role. The browser cannot self-assign administrative privileges.

## Patients

### GET `/api/patients`

Return patients. Optional filters:

```text
status=<status>
q=<patient id, name or chief complaint search>
```

### POST `/api/patients`

Create a patient and run the initial triage workflow.

Minimum clinician-facing fields:

```json
{
  "firstName": "Demo",
  "lastName": "Patient",
  "age": 42,
  "chiefComplaint": "Chest pressure after exertion"
}
```

The full application payload also contains demographics, arrival context, history, vitals and a dataset-aligned `modelFeatures` object.

The backend:

1. validates the request;
2. generates a `PT-YYYY-XXXXXX` application ID when one is not supplied;
3. extracts complaint signals;
4. builds/uses the model feature vector;
5. runs triage;
6. stores the recommendation and assessment;
7. appends audit events;
8. emits realtime events.

### GET `/api/patients/:id`

Accepts either:

```text
PT-2026-LWSBKX
```

or a valid MongoDB `_id`.

Application IDs are handled without forcing them through MongoDB ObjectId casting.

### POST `/api/patients/:id/triage`

Re-run triage for a patient. The request may optionally contain updated patient/vital fields and a trigger marker.

### POST `/api/patients/:id/accept`

Record explicit clinician acceptance of the current model recommendation.

The model result remains distinguishable from the final clinician decision.

### POST `/api/patients/:id/override`

Override the model recommendation.

Request:

```json
{
  "targetEsi": 2,
  "reason": "New vital signs",
  "note": "Patient reports worsening symptoms."
}
```

`targetEsi` must be 1–5 and `reason` must be present. The action is audited and the patient's `manualEsi` and `finalEsi` are updated.

### POST `/api/patients/:id/reassess`

Run a fresh patient reassessment.

The response updates:

```text
triage
finalEsi
assessments
deteriorationDetected
lastReassessmentAt
nextReassessmentAt
```

### POST `/api/patients/:id/manual-triage`

Set a manually selected ESI from 1–5.

Request:

```json
{
  "esi": 3
}
```

Used when the ML service is unavailable or a human selects the priority directly.

## Queue

### GET `/api/queue`

Return current waiting patients, including position, final ESI, confidence, action and red-flag state.

### POST `/api/queue/tick`

Run a queue-monitoring pass. Waiting patients whose reassessment is due are re-evaluated and the queue is re-ranked.

### POST `/api/queue/surge`

Enable or disable surge behavior.

Request:

```json
{
  "enabled": true
}
```

Surge mode uses a tighter reassessment interval.

## Dashboard

### GET `/api/dashboard/summary`

Returns operational KPIs including:

```text
patientsToday
waitingNow
criticalCases
highRisk
reassessmentDue
averageConfidence
activeAlerts
```

### GET `/api/dashboard/metrics`

Returns dashboard distributions and recent operational activity used by the Command Centre.

## Audit

### GET `/api/audit`

Return audit events ordered for display.

### GET `/api/audit/verify`

Verify the linked SHA-256 audit chain.

Valid result:

```json
{
  "valid": true,
  "events": 48,
  "firstBrokenEvent": null
}
```

Invalid result identifies the first broken event index/event ID and the reason for failure.

## Health

### GET `/api/health`

Returns API, database, realtime and AI-mode information.

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

The `aiEngine` value describes configured runtime mode; use the patient/model metadata to distinguish an actual XGBoost result from the deterministic fallback.

## XGBoost inference service

The Python service runs separately on:

```text
http://127.0.0.1:8000
```

### GET `/health`

Confirm that the persisted model artifact is available.

### POST `/predict`

Request:

```json
{
  "features": {
    "site_id": "SITE-DEMO-01",
    "triage_nurse_id": "NURSE-DEMO",
    "arrival_mode": "ambulance",
    "arrival_hour": 14,
    "arrival_day": "Thursday",
    "arrival_month": 8,
    "arrival_season": "summer",
    "shift": "afternoon",
    "age": 61,
    "age_group": "ADULT",
    "sex": "M",
    "language": "English",
    "insurance_type": "public",
    "transport_origin": "home",
    "pain_location": "chest",
    "mental_status_triage": "alert",
    "chief_complaint_system": "cardiovascular",
    "num_prior_ed_visits_12m": 1,
    "num_prior_admissions_12m": 0,
    "num_active_medications": 3,
    "num_comorbidities": 2,
    "systolic_bp": 128,
    "diastolic_bp": 78,
    "mean_arterial_pressure": 94.7,
    "pulse_pressure": 50,
    "heart_rate": 108,
    "respiratory_rate": 22,
    "temperature_c": 37.1,
    "spo2": 96,
    "gcs_total": 15,
    "pain_score": 7,
    "weight_kg": 74,
    "height_cm": 171,
    "bmi": 25.3,
    "shock_index": 0.84,
    "news2_score": 3
  }
}
```

The service requires all 36 model columns. Its response includes `esi`, class probabilities, confidence, model name and version.

## Socket.IO events

The React shell maintains one shared Socket.IO connection to:

```text
http://localhost:3000
```

Important events:

### `system:health`

```json
{
  "aiEngine": "ONLINE",
  "database": "ONLINE",
  "realtime": "CONNECTED"
}
```

### `patient:created`

```json
{
  "patientId": "PT-2026-LWSBKX"
}
```

### `triage:completed`

```json
{
  "patientId": "PT-2026-LWSBKX",
  "esi": 2,
  "action": "IMMEDIATE_ESCALATION"
}
```

### `escalation`

```json
{
  "patientId": "PT-2026-LWSBKX",
  "action": "IMMEDIATE_ESCALATION"
}
```

### `reassessment`

```json
{
  "patientId": "PT-2026-LWSBKX",
  "esi": 2,
  "deteriorationDetected": true
}
```

### `override`

Emitted when a clinician changes the final ESI.

### `queue:updated`

Sent when queue ordering/state has changed.

## Authorization model

Authentication is required for patient, dashboard, queue and audit operations. Role checks occur on the server through middleware.

Supported roles:

```text
triage_nurse
charge_nurse
clinical_admin
system_admin
```

The frontend only controls presentation. It is never trusted to grant a user permissions.

## Error handling

Common application codes include:

```text
VALIDATION_ERROR
PATIENT_NOT_FOUND
UNAUTHORIZED
FORBIDDEN
```

The patient route also handles invalid application identifiers without producing a Mongoose ObjectId cast exception.

## Data and safety boundary

API responses should be treated as decision-support data. The backend remains responsible for safety precedence, uncertainty handling, manual fallback and auditability. The frontend must not reinterpret an advisory model output as an autonomous clinical decision.
