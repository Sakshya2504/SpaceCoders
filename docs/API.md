# API Reference

The API runs on `http://localhost:3000` by default.

Protected endpoints require a bearer token returned by `/api/auth/login` or `/api/auth/signup`.

## Authentication

### POST `/api/auth/login`

Request:

```json
{
  "email": "charge@patienttriage.demo",
  "password": "demo123"
}
```

Returns a JWT and the authenticated user.

### POST `/api/auth/signup`

Creates a new demo triage-nurse account. The server assigns the default `triage_nurse` role rather than trusting a client-supplied privilege level.

## Patients

### GET `/api/patients`

Returns patient records. Optional query parameters include `status` and `q` for filtering/search.

### POST `/api/patients`

Creates a patient, extracts complaint signals, scores triage and places the patient into the queue.

The request contains clinician-facing fields plus `modelFeatures`, which follows the training dataset column names.

### GET `/api/patients/:id`

Fetches a patient by either the synthetic `patientId` or MongoDB `_id`.

### POST `/api/patients/:id/triage`

Re-runs the decision engine for the patient.

### POST `/api/patients/:id/accept`

Records explicit clinician acceptance of the current recommendation.

### POST `/api/patients/:id/override`

Requires `targetEsi` and a structured `reason`. The override is persisted and audited.

### POST `/api/patients/:id/reassess`

Re-runs triage and records a queue reassessment event.

### POST `/api/patients/:id/manual-triage`

Records a manually selected ESI from 1–5 when the model is unavailable or clinical workflow requires manual entry.

## Queue

### GET `/api/queue`

Returns the current waiting queue.

### POST `/api/queue/tick`

Runs a queue-monitoring pass and reassesses eligible waiting patients.

### POST `/api/queue/surge`

Enables or disables surge behavior.

```json
{
  "enabled": true
}
```

## Dashboard

### GET `/api/dashboard/summary`

Returns operational KPIs including patients today, waiting volume, critical cases, high-risk cases, reassessment due, confidence and active alerts.

### GET `/api/dashboard/metrics`

Returns risk distribution and recent audit activity.

## Audit

### GET `/api/audit`

Returns audit events.

### GET `/api/audit/verify`

Walks the linked SHA-256 chain and reports whether it is valid.

## Health

### GET `/api/health`

Returns service, database and model-mode health information.

## Safety contract

The frontend presents recommendations but does not authorize actions. Authorization is enforced by server-side JWT/RBAC middleware. Red-flag escalation, low-confidence abstention and fail-open behavior are server-side concerns, not cosmetic UI states.
