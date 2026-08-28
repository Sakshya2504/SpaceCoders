# Security, Safety and Governance

## 1. Scope

PatientTriage.ai is a synthetic-data prototype. The controls documented here describe the current software design and the hardening required before a production deployment.

The application must not be treated as a clinically validated medical device.

## 2. Security boundaries

```text
Browser
  → presentation + session token handling

Node / Express
  → authentication
  → authorization
  → input handling
  → safety orchestration
  → database access

MongoDB
  → persistent application records

Python ML service
  → model inference only
```

The browser is never the authorization boundary.

## 3. Authentication

The application uses JWT-based sessions.

Flow:

```text
email + password
      ↓
bcrypt verification
      ↓
JWT issued
      ↓
frontend stores token for demo session
      ↓
Axios sends Authorization: Bearer <token>
      ↓
Express validates token
```

Passwords are stored as bcrypt hashes rather than plaintext.

## 4. Authorization

Supported roles:

```text
triage_nurse
charge_nurse
clinical_admin
system_admin
```

Role checks are applied by backend middleware.

The signup endpoint does not allow a new browser client to self-assign an administrative role; new accounts receive the configured default clinical role.

## 5. API protection

The backend currently includes:

- JWT authentication for protected routes.
- Server-side role checks.
- CORS restricted to the configured client origin.
- Request rate limiting.
- JSON payload size limiting.
- Centralized error handling.
- Input validation for high-impact operations such as ESI override and manual triage.

Production should add stronger schema validation, request IDs, centralized observability and abuse monitoring.

## 6. Secrets

Local secrets belong in:

```text
server/.env
```

`.env` is ignored by Git. Never commit:

- production passwords;
- signing keys;
- database credentials;
- API keys;
- private certificates;
- real patient data.

`JWT_SECRET` in local documentation is a placeholder and must be replaced for any real environment.

## 7. Data handling

The repository uses synthetic records only. The seed command recreates demo users, patients and audit events.

Do not point the seed command at a production database.

A production system would require:

- encryption in transit;
- encryption at rest where appropriate;
- strict least-privilege database permissions;
- PHI-aware application logging;
- retention and deletion policy;
- access auditing;
- backup and recovery controls;
- privacy review.

## 8. ML safety boundary

The XGBoost service returns model evidence. It does not own final clinical authority.

```text
XGBoost
   ↓
Prediction + probabilities
   ↓
Node safety layer
   ├── independent red flags
   ├── uncertainty/confidence
   └── fallback handling
   ↓
Clinician decision
```

A model outage should not silently appear as a successful model prediction. The application exposes model source/fallback metadata for traceability.

## 9. Red-flag independence

The prototype keeps safety detector logic separate from the general model score. This creates a clear precedence path where a configured high-sensitivity detector can force immediate escalation.

Current detector families:

```text
Sepsis-like
MI-like
Stroke-like
Respiratory-failure-like
```

These are demonstration detectors and are not clinically validated diagnostic tools.

## 10. Uncertainty handling

The system deliberately reduces confidence for sparse or incomplete records, including cases where prior history is unavailable.

Low confidence or insufficient completeness can produce:

```text
ABSTAIN_AND_ESCALATE
```

This is safer for the prototype than silently assigning a low-risk interpretation to an uncertain record.

## 11. Human-in-the-loop controls

The application separates:

```text
Model recommendation
Clinician decision
```

Accepting a recommendation is explicit. Overriding it requires a target ESI and structured reason, with an optional note.

This preserves accountability and creates feedback data for later model review.

## 12. Audit integrity

Decision events are linked with SHA-256 hashes.

Each record includes:

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

Verification recalculates each hash and checks the previous-hash link. It reports the first mismatch.

This is an application-level integrity mechanism, not a certified immutable compliance log.

## 13. Legacy database migration protection

Older versions used a unique `patientCode_1` index. The current connection routine removes that obsolete index when present so old database state cannot reject new patients with duplicate `null` values.

This is a compatibility measure for the prototype and should be replaced with a formal migration strategy in production.

## 14. Logging

Morgan request logging is enabled for development visibility.

Do not log raw secrets or production patient identifiers unnecessarily.

A production service should use structured logs with:

- request ID;
- actor ID;
- route;
- latency;
- status;
- model version;
- safety outcome;
- error classification.

## 15. Model governance

The recorded XGBoost metrics are dataset-level model evaluation results. They are not evidence of clinical effectiveness.

Before production use, validate:

- calibration;
- subgroup performance;
- class imbalance effects;
- drift;
- false-negative behavior;
- sensitivity of safety detectors;
- threshold choices;
- model version changes;
- human-factors impact.

## 16. Frontend safety considerations

The interface should always communicate that AI output is advisory. Visual urgency should never depend on color alone; text labels and accessible states should remain available.

Responsive behavior must preserve access to accept, override, reassess and alert actions on smaller screens.

## 17. Production hardening checklist

```text
[ ] Replace demo JWT secret with managed secret storage
[ ] Enforce HTTPS / TLS
[ ] Add secure cookie or equivalent hardened session strategy
[ ] Add CSRF strategy where applicable
[ ] Add strict production CORS policy
[ ] Add stronger request schema validation
[ ] Add centralized structured logging
[ ] Add monitoring and alerting
[ ] Restrict MongoDB network access
[ ] Encrypt sensitive data as required
[ ] Define retention policy
[ ] Perform security testing and dependency scanning
[ ] Establish model registry/version control
[ ] Validate calibration and bias
[ ] Perform clinical validation
[ ] Establish governance and rollback procedures
[ ] Conduct privacy/regulatory review
```

## 18. Final safety statement

PatientTriage.ai is a prototype for demonstrating safe software architecture around decision support. It must not be used as an autonomous triage system or substituted for qualified clinical judgment.
