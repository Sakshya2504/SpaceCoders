# Requirements & Implementation Checklist

This document maps the requested solution capabilities to the current repository implementation. It is a traceability document for the prototype and should be read alongside `README.md`, `ARCHITECTURE.md`, `API.md`, and the ML documentation.

| Capability | Implementation | Notes |
|---|---|---|
| Full-stack web application | `client/` + `server/` | React/Vite frontend with Node/Express backend and MongoDB. |
| 15–20 simulated records | `server/src/seed.js` | Seed script creates 18 synthetic patients and 4 demo users. |
| ESI 1–5 | `server/src/services/triageEngine.js` + XGBoost | Five-class recommendation is exposed as ESI 1–5. |
| Dataset-aligned intake | `client/src/pages/Intake.jsx` + `server/src/services/modelFeatures.js` | Intake stores the model feature contract using training column names. |
| XGBoost model | `ml/train_xgboost.py` | Reproducible five-class training pipeline. |
| XGBoost inference | `ml/inference_service.py` + Node scorer | Optional FastAPI service returns ESI probabilities; Node retains a deterministic fallback. |
| Confidence | `triage.confidence` + model probability | Confidence is displayed to the clinician and stored with assessments. |
| High-sensitivity red flags | `detectRedFlags()` | Prototype sepsis-like, MI-like, stroke-like and respiratory-risk detectors. |
| Immediate escalation | `IMMEDIATE_ESCALATION` | Positive safety signals can force escalation. |
| Ambiguous/sparse path | `ABSTAIN_AND_ESCALATE` | Low confidence or insufficient feature completeness moves the recommendation upward. |
| Fail-open | `FAIL_OPEN` / fallback scoring | Model unavailability does not become a hard blocker for the application workflow. |
| Pediatric/adolescent/adult/geriatric | `getAgeBand()` + `AGE_CONFIG` | Age band is derived and used for prototype vital interpretation. |
| Zero-history handling | `hasHistory` | Missing history reduces confidence and is visible during review. |
| Explainability | `reasons` + `featureContributions` | Clinicians can inspect the main signals supporting the recommendation. |
| Clinician acceptance | `/api/patients/:id/accept` | Acceptance is recorded separately from the model recommendation. |
| Clinician override | `/api/patients/:id/override` | Requires target ESI and structured reason; event is audited. |
| Manual triage | `/api/patients/:id/manual-triage` | Keeps workflow available when AI is unavailable. |
| Live waiting queue | `/api/queue` + Live Queue page | Position, ESI, confidence, wait time and flags are shown. |
| Continuous reassessment | `runQueueTick()` | Waiting patients are reassessed when due. |
| Surge behavior | `/api/queue/surge` | Prototype monitoring cadence becomes more frequent. |
| Realtime alerts | `AlertCenter.jsx` + Socket.IO | Escalation, deterioration, override, triage and system events are surfaced. |
| Dashboard KPIs | `/api/dashboard/summary` | Operational overview for the command centre. |
| Audit logging | `server/src/services/audit.js` | Important events are written with previous/current hashes. |
| Audit verification | `/api/audit/verify` | Verifies the linked SHA-256 chain and reports first broken event. |
| Authentication | JWT + bcryptjs | Login and signup return authenticated sessions. |
| Role-based access | `server/src/middleware/auth.js` | Permissions are enforced server-side. |
| Responsive frontend | `client/src/responsive.css` | Desktop, tablet and mobile layouts are supported. |
| Human-readable source | `client/src`, `server/src`, `ml/` | Files are formatted with normal indentation and comments explaining intent. |
| Documentation | `docs/` + `ml/` | Setup, architecture, API, security, testing, demo and ML guidance are documented. |

## Important prototype limitations

The checklist indicates implemented software capabilities, not clinical approval.

The current prototype still requires formal validation before any real-world deployment, including model calibration, subgroup evaluation, clinical workflow validation, privacy/security review, production infrastructure hardening and medical-device governance where applicable.
