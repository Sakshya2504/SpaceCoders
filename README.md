# PatientTriage.ai

PatientTriage.ai is a safety-first emergency-department decision-support platform. It brings patient context, triage acuity, high-sensitivity red-flag detection, confidence, queue monitoring and clinician review into one workspace.

The current application uses synthetic data. AI recommendations are advisory; the clinician remains responsible for the final triage decision.

## Stack

- React + Vite
- Node.js + Express
- MongoDB + Mongoose
- JWT + bcryptjs
- Socket.IO for realtime events
- XGBoost + scikit-learn for the trained acuity model
- FastAPI + Uvicorn for local XGBoost inference

## Local setup

### 1. Install the JavaScript application

```bash
npm install
npm run install:all
```

Create `server/.env` from `server/.env.example` and make sure these values are present:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/patienttriage
JWT_SECRET=change-this-in-production
CLIENT_URL=http://localhost:5173
TRIAGE_INTERVAL_MS=30000
MANUAL_MODE=false
ML_INFERENCE_URL=http://127.0.0.1:8000
```

### 2. Prepare the XGBoost model

Place the supplied reference `train.csv` in the repository root. The dataset is intentionally ignored by Git because it is local training data.

```bash
npm run ml:install
npm run ml:train
```

This creates the local artifact:

```text
ml/artifacts/triage_xgb_pipeline.joblib
```

### 3. Start the application

The easiest full-stack option is:

```bash
npm run dev:full
```

That starts:

```text
XGBoost inference → http://127.0.0.1:8000
Backend API       → http://localhost:3000
Frontend          → http://localhost:5173
```

For debugging, the services can also be started separately:

```bash
npm run ml:serve
npm run server
npm run client
```

### 4. Seed synthetic demo data

With MongoDB running:

```bash
npm run seed
```

The seed is compatible with both XGBoost inference and the deterministic fallback.

## Demo accounts

```text
Charge nurse
charge@patienttriage.demo
 demo123

Triage nurse
nurse@patienttriage.demo
 demo123

Clinical admin
admin@patienttriage.demo
 demo123
```

These accounts and seeded patients are synthetic demo data.

## Core workflow

1. Sign in.
2. Open **Command Centre** for the operational overview.
3. Use **Patient Intake** to capture the dataset-aligned feature set.
4. The backend builds the canonical model feature vector.
5. XGBoost returns the predicted ESI and class probabilities.
6. Independent safety detectors can override the model and escalate immediately.
7. The UI shows confidence, evidence and the model source.
8. A clinician can accept or override the recommendation.
9. **Live Queue** reuses the same scoring contract during reassessment.
10. **Audit Trail** records the decision flow and verifies the SHA-256 chain.

## Dataset alignment

The reference dataset contains 80,000 rows and 40 columns. The target is `triage_acuity` with values 1–5.

The training pipeline excludes `patient_id`, `disposition`, `ed_los_hours` and `triage_acuity` from model inputs. The intake page creates the corresponding 36 model features using the same training column names. Derived values such as age group, arrival context, BMI, mean arterial pressure, pulse pressure and shock index are calculated before inference.

The Python inference service validates that all expected feature columns are present and reuses the persisted scikit-learn preprocessing pipeline used during training, so training-time transformations remain coupled to prediction-time transformations.

## XGBoost result

On the attached dataset using an 80/20 stratified split:

| Metric | Result |
|---|---:|
| Accuracy | 85.26% |
| Balanced accuracy | 86.72% |
| Macro F1 | 86.95% |
| Weighted F1 | 85.31% |

See `ml/README.md` for per-class results and model configuration.

## Safety behavior

- Red-flag positive → immediate escalation.
- Low confidence or sparse/conflicting information → abstain and escalate.
- XGBoost service unavailable → deterministic application fallback; the clinical workflow is not blocked.
- Engine failure → fail open to manual triage.
- Clinician override is explicit and audited.
- Age-aware thresholds are prototype assumptions, not clinical guidance.

## Documentation

- `docs/ARCHITECTURE.md` — system and decision flow
- `docs/DEMO_SCRIPT.md` — presentation walkthrough
- `docs/API.md` — API contract
- `docs/SECURITY.md` — security and production considerations
- `docs/ROUND2_CHECKLIST.md` — traceability matrix for the original challenge requirements
- `ml/README.md` — training and evaluation
- `ml/README_INFERENCE.md` — local XGBoost inference service

## Disclaimer

This is a prototype using synthetic data. The model, thresholds and decision logic have not been clinically validated and must not be used for real patient care.
