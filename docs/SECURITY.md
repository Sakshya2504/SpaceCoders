# Security & Safety Notes

This repository is a synthetic-data prototype. It is not approved for real patient care.

## Authentication

- JWT is used for authenticated sessions.
- Passwords are hashed with bcryptjs.
- Protected API routes use server-side authentication middleware.
- Roles are checked on the server; the frontend is not trusted for authorization.

## Clinical safety controls

- Red-flag detection is independent of the general severity score.
- Positive red flags trigger immediate escalation.
- Low confidence or sparse/conflicting data uses an explicit abstain-and-escalate path.
- Engine failure uses fail-open behavior and preserves manual triage.
- Clinician acceptance and override are explicit actions.
- Overrides require a structured reason and are audited.

## Data handling

The demo uses synthetic records only. Do not place real PHI or production credentials in the repository.

For production, use secure secret storage, TLS, encryption at rest, strict database access controls, PHI-aware logging, retention policies and formal privacy/security review.

## Model governance

The XGBoost pipeline in `ml/` is a dataset-level prototype. Its evaluation metrics do not establish clinical validity. Production deployment would require local clinical validation, bias and calibration checks, model/version governance, monitoring, change control and human-factors validation.
