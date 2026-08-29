# Security, Safety and Governance

## 1. Scope

PatientTriage.ai is a synthetic-data decision-support prototype. This document describes the controls present in the application and the additional controls that would be required before production use.

The system is not a clinically validated medical device and must not be used for autonomous patient-care decisions.

## 2. Security boundaries

```text
Browser
  → presentation + session state

Node / Express
  → authentication
  → authorization
  → request validation
  → triage orchestration
  → safety policy
  → database access

Python FastAPI
  → supplied model artifact inference

MongoDB
  → application persistence
```

The browser is never trusted to enforce permissions.

## 3. Authentication and roles

Authentication uses JWT-backed sessions with bcrypt password hashing.

Supported roles include:

```text
triage_nurse
charge_nurse
clinical_admin
system_admin
```

The signup workflow assigns the default `triage_nurse` role. A browser request cannot self-assign administrative privileges.

## 4. API protection

The backend includes controls for:

- JWT authentication on protected operations;
- server-side role checks;
- configured CORS policy;
- request rate limiting;
- JSON payload limits;
- centralized error handling;
- validation for high-impact operations such as override and manual triage.

Production should add stronger request schemas, request IDs, centralized monitoring and abuse detection.

## 5. Secrets and configuration

Local environment values belong in:

```text
server/.env
```

Never commit:

```text
production passwords
JWT signing secrets
database credentials
API keys
private certificates
real patient data
```

The example JWT secret is only a placeholder for local development.

## 6. Data handling

The repository is intended for synthetic data. The seed script recreates demo users, patients, queue state and audit records.

Destructive development commands must never target a production database.

A production deployment would also need appropriate controls for encryption, retention, deletion, access auditing, backups, recovery and privacy.

## 7. Model safety boundary

The supplied final model is a five-fold stacked ensemble:

```text
5 × LightGBM
+
5 × XGBoost
      ↓
LogisticRegression meta-model
      ↓
ESI 1–5 + probabilities + confidence
```

The model provides evidence. It does not own final clinical authority.

The Node layer then handles:

```text
model result
    ↓
independent safety detectors
    ↓
uncertainty / completeness
    ↓
operational recommendation
    ↓
clinician decision
```

## 8. Independent red flags

The prototype keeps its safety detector logic separate from the ensemble result. Current detector families include:

```text
sepsis-like
MI-like
stroke-like
respiratory-failure-like
```

A configured positive detector can force an immediate-escalation action. These detectors are demonstration logic and are not clinically validated diagnostic tools.

## 9. Uncertainty and fail-open behavior

Sparse or incomplete records can reduce confidence and lead to an explicit:

```text
ABSTAIN_AND_ESCALATE
```

When the FastAPI model service is unavailable, the Node workflow can use its deterministic prototype fallback. The fallback source is recorded so it cannot be mistaken for the supplied ensemble.

This design keeps model availability from becoming a single point of failure while preserving traceability.

## 10. Human-in-the-loop controls

The application keeps three concepts distinct:

```text
model recommendation
clinician-selected value
final effective priority
```

The available controls are:

```text
Accept
Override
Reassess
Mark service done
```

Override requires a target ESI and structured reason. Clinician decisions are recorded in the audit trail.

## 11. Reassessment history

A reassessment creates a new assessment record rather than deleting the previous result. This allows a reviewer to compare:

```text
previous ESI
new ESI
confidence
model source
supporting reasons
timestamp
```

The history view is locally scrollable so repeated reassessments do not make the entire review page unusable.

## 12. Patient lifecycle

When a service is completed:

```text
active patient
      ↓
Mark service done
      ↓
completion state
      ↓
removed from active queue
      ↓
available in Past Patients
```

Completion is a state transition, not deletion.

## 13. Audit integrity

Important decision events are linked with SHA-256 hashes.

Each audit record contains fields such as:

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

Verification walks the chain and reports the first mismatch when the chain is invalid.

This provides application-level tamper evidence for the prototype. It is not a certified immutable compliance logging platform.

## 14. Logging

Morgan request logging is useful for local debugging, but production logging should avoid unnecessarily exposing sensitive patient information.

Production observability should capture structured metadata such as:

```text
request ID
actor ID
route
latency
status
model version
model source
safety outcome
error category
```

## 15. Model governance

The supplied model artifact is a persisted experiment result, not evidence of clinical effectiveness.

Before production use, validate at minimum:

```text
calibration
external / temporal performance
subgroup performance
class imbalance behavior
drift
false-negative behavior
safety-detector sensitivity
threshold selection
version changes
human-factors impact
```

Model runtime dependencies should remain pinned so the persisted artifact does not unexpectedly change behavior after a library upgrade.

## 16. Frontend safety

The UI should always communicate that AI output is advisory.

Safety states should not depend on color alone; text labels and accessible states remain available. Critical actions must remain reachable on smaller screens.

Interactive controls should have visible keyboard focus and clear loading/disabled states to prevent duplicate submissions.

## 17. Legacy database compatibility

Older versions of the patient schema used a unique `patientCode_1` index. The current connection startup includes compatibility handling for that obsolete index so old local databases do not cause duplicate-null insertion failures.

This is migration protection for the prototype, not a substitute for a formal production migration system.

## 18. Production hardening checklist

```text
[ ] Managed secret storage
[ ] HTTPS / TLS everywhere
[ ] Hardened session strategy
[ ] Strict production CORS
[ ] Strong request schemas
[ ] Centralized structured logging
[ ] Monitoring and alerting
[ ] Restricted MongoDB network access
[ ] Encryption controls appropriate to deployment
[ ] Data retention and deletion policy
[ ] Security and dependency scanning
[ ] Model registry and version governance
[ ] Calibration monitoring
[ ] Bias / subgroup analysis
[ ] External and temporal validation
[ ] Formal clinical validation
[ ] Human-factors review
[ ] Privacy / regulatory assessment
```

## 19. Final safety statement

PatientTriage.ai demonstrates software architecture for emergency decision support. It is intentionally designed so the supplied model, safety layer and clinician decision remain distinguishable. The prototype must not be treated as an autonomous triage system or used as a substitute for qualified clinical judgment.
