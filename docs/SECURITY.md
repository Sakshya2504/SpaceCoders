# Security, Safety & Governance

PatientTriage.ai is a software prototype that uses synthetic records. It has not been clinically validated, approved as a medical device, or designed for unsupervised patient care.

## 1. Authentication

The application uses JSON Web Tokens (JWT) for authenticated sessions.

- Passwords are hashed with `bcryptjs` before storage.
- Protected endpoints require a bearer token.
- Tokens identify the authenticated user and role.
- The browser stores the demo session token locally for this prototype.
- A production system should use a stronger session strategy appropriate to its deployment and threat model.

## 2. Authorization and RBAC

The backend is authoritative for permissions. The frontend cannot grant itself a role.

Supported roles are:

```text
triage_nurse
charge_nurse
clinical_admin
system_admin
```

Signup defaults to `triage_nurse` so a new account does not receive administrative access from browser input.

Patient-changing actions are protected by server-side role checks.

## 3. API protection

The Express application includes:

- CORS configuration tied to the configured frontend origin;
- JSON request-size limits;
- request logging through Morgan;
- request rate limiting through `express-rate-limit`;
- centralized error handling;
- structured API responses.

A production deployment should additionally use TLS, reverse-proxy controls, stronger rate limits for authentication endpoints, secure headers, monitoring and secret management.

## 4. Secrets and environment variables

Do not commit production secrets.

The repository ignores `.env` files. Use `server/.env.example` as the starting point for local configuration.

Required local variables include:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/patienttriage
JWT_SECRET=change-this-in-production
CLIENT_URL=http://localhost:5173
ML_INFERENCE_URL=http://127.0.0.1:8000
```

Replace the development JWT secret before any real deployment.

## 5. Synthetic data boundary

Seed data is intentionally synthetic. The project documentation and demo accounts are for development/demo purposes only.

Do not paste:

- real patient names;
- real medical records;
- real identifiers;
- production credentials;
- secrets or tokens;

into this repository or its issue history.

## 6. Clinical safety controls

The decision-support workflow uses layered controls rather than treating a single model prediction as authoritative.

### Independent red flags

The Node application evaluates prototype red-flag detectors for:

- sepsis-like signals;
- myocardial-infarction-like signals;
- stroke-like signals;
- respiratory-failure-like signals.

A positive red flag can force the immediate-escalation path.

### Uncertainty handling

The application calculates confidence using data completeness, signal consistency, history availability, age normalization and agreement between scoring layers.

Sparse or conflicting information can trigger `ABSTAIN_AND_ESCALATE` instead of silently selecting a lower-risk interpretation.

### Fail-open behavior

The XGBoost service is intentionally optional from the perspective of the Node workflow. If the Python inference service is unavailable or returns an inference error, the application can use its deterministic prototype scorer and exposes the source of the resulting recommendation.

This prevents an unavailable model process from becoming a hard dependency that blocks the care workflow.

### Human authority

The model recommendation is advisory. Clinicians can explicitly accept or override it.

Overrides require:

- a target ESI;
- a structured reason;
- an optional explanatory note.

The override is recorded separately from the original recommendation.

## 7. Audit and traceability

Important workflow events are written to an application audit collection.

Each record contains the previous hash and its own SHA-256 hash. The verification endpoint recomputes the chain and identifies the first mismatch when verification fails.

The audit mechanism is an application-level traceability control. It is not a replacement for an independently secured, immutable production audit infrastructure.

## 8. ML governance

The XGBoost training pipeline is a dataset-level prototype.

Its recorded metrics describe performance on the supplied reference dataset and do not establish:

- clinical validity;
- generalizability to another hospital;
- calibration in a deployed population;
- absence of demographic bias;
- safe use in real clinical decisions.

A production model would require data governance, versioning, reproducible training, calibration analysis, subgroup evaluation, drift monitoring, change control, human-factors review and clinical validation.

## 9. Model/data leakage control

The training pipeline excludes:

```text
patient_id
```

because it is an identifier, and:

```text
disposition
ed_los_hours
```

because they occur after or are influenced by the triage decision. `triage_acuity` is the target and is therefore not an input.

This prevents obvious target leakage from post-triage outcomes.

## 10. Logging considerations

Morgan request logs are useful for this prototype but should be reviewed carefully before production deployment because URLs, request metadata and errors can accidentally expose sensitive information.

Production logging should:

- avoid PHI;
- redact secrets and credentials;
- define retention rules;
- separate application telemetry from clinical audit data;
- use controlled access.

## 11. Production hardening checklist

Before real deployment, add at minimum:

```text
[ ] TLS everywhere
[ ] Production secret manager
[ ] Strong session/cookie strategy
[ ] Database authentication and network isolation
[ ] Encryption at rest
[ ] Strict CORS policy
[ ] Security headers
[ ] Authentication-specific rate limits
[ ] Centralized monitoring and alerting
[ ] PHI-aware logs and retention policy
[ ] Backup and disaster recovery
[ ] Model registry/version control
[ ] Model calibration and drift monitoring
[ ] Bias/subgroup evaluation
[ ] Clinical validation
[ ] Formal risk management and governance
```

## 12. Prototype disclaimer

The software, thresholds, red-flag detectors, confidence calculation and XGBoost model are demonstration components. They must not be treated as medical guidance or as a substitute for professional clinical judgement.
