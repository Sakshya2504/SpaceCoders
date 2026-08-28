# API Reference

PatientTriage.ai exposes a Node/Express application API for the web client and a small FastAPI service for XGBoost inference.

## Base URLs

```text
Frontend:     http://localhost:5173
Node API:     http://localhost:3000/api
ML service:   http://127.0.0.1:8000
```

The Node service owns authentication, authorization, patient workflow, safety logic, queue monitoring, alerts and audit records. The Python service has one responsibility: load the trained XGBoost pipeline and return class probabilities.

## Authentication

Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

Tokens are returned by the login and signup endpoints.

### POST `/auth/login`

Authenticates an existing account.

Request:

```json
{
  "email": "charge@patienttriage.demo",
  "password": "demo123"
}
```

The response contains a JWT and the authenticated user profile.

### POST `/auth/signup`

Creates a new account.

Request:

```json
{
  "name": "Demo Nurse",
  "email": "demo@example.com",
  "password": "demo123"
}
```

The server assigns the default `triage_nurse` role. Client input cannot be used to self-assign a privileged role.

## Patients

### GET `/patients`

Returns patient records.

Optional query parameters:

```text
status  Filter by patient status.
q       Search patient ID, first name, last name or chief complaint.
```

### POST `/patients`

Creates a patient and performs the initial triage assessment.

The normal intake payload includes:

- patient identity;
- age and sex;
- arrival and presentation context;
- chief complaint;
- mental status;
- history and utilization information;
- bedside measurements;
- dataset-aligned `modelFeatures`.

The backend generates `patientId` when it is not supplied by the client.

### GET `/patients/:id`

Fetches a patient using either the application-level `patientId` (for example `PT-2026-LWSBKX`) or a valid MongoDB `_id`.

The route only attempts MongoDB ObjectId casting when the supplied value is actually an ObjectId. This prevents synthetic patient identifiers from producing a Mongoose cast error.

### POST `/patients/:id/triage`

Runs another triage assessment for the specified patient.

If manual mode is enabled, the endpoint returns the fail-open/manual-triage response rather than attempting model inference.

### POST `/patients/:id/accept`

Stores explicit clinician acceptance of the current recommendation.

The model recommendation and clinician decision are kept as separate fields for traceability.

### POST `/patients/:id/override`

Stores an explicit clinician override.

Request:

```json
{
  "targetEsi": 2,
  "reason": "New vital signs",
  "note": "Repeat measurement showed lower SpO2."
}
```

Validation:

- `targetEsi` must be an integer from 1 to 5.
- `reason` is required.
- the event is written to the audit chain.

### POST `/patients/:id/reassess`

Re-runs the triage flow and records a reassessment event.

This endpoint is used by clinician-triggered reassessment and the live-monitoring workflow.

### POST `/patients/:id/manual-triage`

Records a manual ESI value from 1 through 5.

Request:

```json
{
  "esi": 2
}
```

This path keeps the care workflow available when AI inference is unavailable or manual triage is required.

## Queue

### GET `/queue`

Returns currently waiting patients with queue position and triage context.

### POST `/queue/tick`

Runs the queue monitor. Patients whose next reassessment is due are re-scored, deterioration is checked, audit events are recorded and the queue is reordered.

### POST `/queue/surge`

Enables or disables surge behavior.

Request:

```json
{
  "enabled": true
}
```

Surge mode uses the shorter prototype reassessment interval.

## Dashboard

### GET `/dashboard/summary`

Returns operational summary values such as:

- patients today;
- waiting volume;
- critical cases;
- high-risk cases;
- reassessment due;
- confidence information;
- active alerts.

### GET `/dashboard/metrics`

Returns additional metrics used by the Command Centre, including acuity distribution and recent activity.

## Audit

### GET `/audit`

Returns recent audit events.

An event can contain:

```text
eventId
eventType
patientId
actorId
actorRole
timestamp
payload
previousHash
hash
```

### GET `/audit/verify`

Recomputes the SHA-256 linked chain from `GENESIS` and reports whether every stored event matches its expected previous hash and current hash.

When invalid, the response identifies the first broken event where available.

## Health

### GET `/health`

Returns service and infrastructure status.

Example:

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
  },
  "message": "Health status",
  "error": null
}
```

## XGBoost inference API

The Python inference service normally listens on `127.0.0.1:8000`.

### GET `/health`

Checks whether the persisted XGBoost pipeline can be loaded.

### POST `/predict`

Request:

```json
{
  "features": {
    "site_id": "SITE-DEMO-01",
    "triage_nurse_id": "NURSE-DEMO",
    "arrival_mode": "walk-in",
    "arrival_hour": 14,
    "arrival_day": "Thursday",
    "arrival_month": 8,
    "arrival_season": "summer",
    "shift": "afternoon",
    "age": 42,
    "age_group": "young_adult",
    "sex": "M",
    "language": "English",
    "insurance_type": "unknown",
    "transport_origin": "home",
    "pain_location": "chest",
    "mental_status_triage": "alert",
    "chief_complaint_system": "cardiovascular",
    "num_prior_ed_visits_12m": 0,
    "num_prior_admissions_12m": 0,
    "num_active_medications": 0,
    "num_comorbidities": 0,
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "mean_arterial_pressure": 93.3,
    "pulse_pressure": 40,
    "heart_rate": 90,
    "respiratory_rate": 18,
    "temperature_c": 37,
    "spo2": 98,
    "gcs_total": 15,
    "pain_score": 3,
    "weight_kg": 70,
    "height_cm": 170,
    "bmi": 24.2,
    "shock_index": 0.75,
    "news2_score": 0
  }
}
```

Response:

```json
{
  "model": "XGBoost",
  "modelVersion": "xgboost-multiclass-v1",
  "esi": 3,
  "probabilities": {
    "ESI 1": 0.01,
    "ESI 2": 0.05,
    "ESI 3": 0.86,
    "ESI 4": 0.06,
    "ESI 5": 0.02
  },
  "confidence": 86.0
}
```

The Node decision engine does not blindly expose this prediction as the final outcome. It applies its independent safety and uncertainty rules after the model response.

## Socket.IO events

The web client listens for realtime operational events including:

```text
system:health
patient:created
triage:completed
escalation
deterioration
reassessment
override
queue:updated
surge:completed
```

These events update the live queue, system health state and alert center without requiring a page refresh.

## Standard error shape

The application uses a consistent response format:

```json
{
  "success": false,
  "data": null,
  "message": "Patient not found",
  "error": "PATIENT_NOT_FOUND"
}
```

Typical HTTP status codes:

```text
200  Successful read/update.
201  Successful create.
401  Authentication missing or invalid.
403  Authenticated but not authorized for the action.
404  Resource not found.
422  Validation error.
429  Rate limit exceeded.
500  Unexpected server error.
```

## Authorization contract

The browser is not trusted to enforce clinical permissions. JWT authentication and role checks are performed on the server. The frontend may hide or show controls for usability, but the backend remains authoritative.

## Safety contract

The following are server-side application behaviors:

1. Independent red-flag detection can force immediate escalation.
2. Low confidence or incomplete/conflicting information can enter `ABSTAIN_AND_ESCALATE`.
3. Model/inference failure can enter `FAIL_OPEN` and preserve manual triage.
4. Clinician acceptance and overrides are explicitly recorded.
5. Audit events are chained for later verification.

These are prototype software behaviors and are not substitutes for clinical validation or medical-device governance.
