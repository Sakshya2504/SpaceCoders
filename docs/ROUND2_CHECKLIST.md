# PatientTriage.ai — Implementation Checklist

This document is a practical traceability checklist for the current prototype. It maps the requested product behavior to the maintained application rather than to an earlier prototype path.

| Capability | Current implementation | Verification point |
|---|---|---|
| Full-stack application | `client/` + `server/` + MongoDB | Start frontend and backend together. |
| Synthetic demo data | `server/src/seed.js` | Seed only the development database. |
| Dataset-aligned intake | Intake page + model feature builder | Confirm training-column vocabulary is represented. |
| ESI 1–5 recommendation | Final ensemble + triage orchestration | Patient Review shows recommendation and probabilities. |
| Final supplied model | `ml/artifacts/triage_ensemble_model.pkl` | Verify artifact checksum and model health. |
| Ensemble structure | 5 LightGBM + 5 XGBoost + LogisticRegression stack | `/health` reports ensemble metadata. |
| 52-feature inference contract | Artifact-saved feature order | Runtime reads canonical `features` from artifact. |
| Confidence | Ensemble probability + application uncertainty layer | Patient Review displays confidence/source. |
| Independent safety detectors | `server/src/services/redFlags.js` | Verify sepsis-like, MI-like, stroke-like and respiratory-risk signals. |
| Immediate escalation | `IMMEDIATE_ESCALATION` | Positive configured red flag takes precedence. |
| Abstain-and-escalate | `ABSTAIN_AND_ESCALATE` | Sparse/uncertain cases remain visibly uncertain. |
| Fail-open | Deterministic prototype fallback | Stop FastAPI and confirm workflow still functions. |
| Human-in-the-loop | Accept / Override | Clinician action remains separate from model recommendation. |
| Reassessment | Reassess workflow + assessment history | Previous assessments remain available. |
| Reassessment UI | Bounded scroll history | Large histories stay inside the review panel. |
| Patient completion | Mark service done | Completed patient leaves active workflow. |
| Past Patients | Historical patient view | Completed patient remains available for review. |
| Live waiting queue | Queue API + Queue page | Position, ESI, confidence, wait and flags are visible. |
| Queue monitoring | `runQueueTick()` | Due patients are re-evaluated using the same triage path. |
| Surge mode | Queue surge endpoint | Monitoring cadence becomes tighter. |
| Realtime alerts | Alert Center + Socket.IO | Triage, escalation, reassessment and workflow alerts appear live. |
| Alert scalability | Bounded scrollable alert panel | Large alert volumes do not cover the page. |
| Dashboard | Summary + metrics endpoints | KPIs reflect current synthetic data. |
| Audit logging | SHA-256 linked events | Important decisions are recorded. |
| Audit verification | `/api/audit/verify` | First broken event is identified when invalid. |
| Login | JWT + bcrypt | Seeded account signs in successfully. |
| Signup | Default clinical role | Browser cannot self-assign privileged roles. |
| Application IDs | Separate from MongoDB `_id` | `PT-YYYY-XXXXXX` routes do not trigger ObjectId casting. |
| Responsive UI | Responsive/refinement styles | Test desktop, tablet and phone widths. |
| Accessible controls | Labels + keyboard focus states | Verify focus, readable status text and disabled/loading states. |
| Readable code | Maintained formatting and intent-focused comments | Avoid compressed one-line JSX/functions. |
| Documentation | `docs/` + `ml/` | Setup, architecture, API, testing, demo and safety are documented. |

## Data-contract boundaries

The reference training dataset contains 40 columns. The application uses the clinician-relevant fields from that dataset and keeps downstream information out of predictive input.

```text
patient_id      → identifier
triage_acuity   → target
disposition     → downstream outcome
ed_los_hours    → downstream outcome
```

The supplied final artifact expands the relevant inputs into a 52-feature prediction representation. The runtime uses the artifact's saved feature list and categorical mappings.

## Source-of-truth model files

For the final application integration, the source of truth is:

```text
Train_Model_Code.ipynb
triage_ensemble_model.pkl
triage_predictions_output.csv
```

The repository runtime translation is:

```text
ml/model_runner.py
ml/inference_service.py
```

The earlier `ml/train_xgboost.py` remains reference/prototype training code; it is not the source of the supplied final artifact.

## Final regression smoke test

```text
[ ] MongoDB starts
[ ] FastAPI model service starts
[ ] Node starts on 3000
[ ] Vite starts on 5173
[ ] Login works
[ ] Signup works
[ ] Patient Intake renders every required field family
[ ] Derived fields are calculated
[ ] Patient creation opens Patient Review
[ ] Supplied ensemble source/version is visible
[ ] ESI 1–5 recommendation is shown with plain-language explanation
[ ] Red flags are shown separately
[ ] Accept records clinician agreement
[ ] Override records target ESI + reason
[ ] Reassess opens editable values and preserves history
[ ] Queue reassessment works
[ ] Alert center updates without refresh
[ ] Mark service done moves patient to Past Patients
[ ] Audit chain verifies
[ ] Large reassessment history scrolls locally
[ ] Mobile layout remains usable
[ ] Frontend production build passes
[ ] Backend tests pass
[ ] Python syntax / ML checks pass
```

## Prototype boundary

Passing this checklist confirms application behavior for the current software prototype. It does not prove clinical validity, effectiveness, fairness, regulatory compliance or suitability for unsupervised clinical use.
