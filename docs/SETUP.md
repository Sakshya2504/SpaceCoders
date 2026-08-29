# Local Setup Guide

PatientTriage.ai is a local development prototype composed of three application processes plus MongoDB:

```text
Browser
  │
  ├── Frontend: React + Vite → http://localhost:5173
  │
  └── REST / Socket.IO → Node + Express → http://localhost:3000
                                      │
                                      └── MongoDB → localhost:27017

ML process:
Python + FastAPI + final triage ensemble → http://127.0.0.1:8000
```

The final model supplied with the project is a five-fold LightGBM + XGBoost ensemble with a LogisticRegression stacking model. The Node application keeps a deterministic fallback so an unavailable Python process does not block the prototype workflow.

## 1. Prerequisites

Install:

```text
Node.js 20+ recommended
npm
MongoDB Community Server or another local MongoDB instance
Python 3.10+ recommended
Git
```

Verify:

```powershell
node --version
npm --version
python --version
git --version
```

MongoDB must be running before the seed command or backend can access the database.

## 2. Clone the repository

```powershell
git clone https://github.com/Sakshya2504/SpaceCoders.git
cd SpaceCoders
```

## 3. Install JavaScript dependencies

```powershell
npm install
npm run install:all
```

## 4. Configure the Node backend

Create:

```text
server/.env
```

Recommended local values:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/patienttriage
JWT_SECRET=change-this-in-production
CLIENT_URL=http://localhost:5173
TRIAGE_INTERVAL_MS=30000
MANUAL_MODE=false
ML_INFERENCE_URL=http://127.0.0.1:8000
```

`.env` is ignored by Git. Do not commit real secrets.

## 5. Install the supplied final model artifact

The final model artifact is:

```text
triage_ensemble_model.pkl
```

Copy it into:

```text
ml/artifacts/triage_ensemble_model.pkl
```

From the repository root, when the uploaded/local file is available in the root:

```powershell
Copy-Item .\triage_ensemble_model.pkl .\ml\artifacts\triage_ensemble_model.pkl
```

Expected SHA-256:

```text
8a22c60268cb26fab39935cbd087c74568658db32da26f99f662559288d06ccc
```

The artifact is intentionally excluded from Git because it is a large binary model. The repository contains `ml/artifacts/README.md` with the same checksum and placement instructions.

## 6. Seed synthetic data

With MongoDB running:

```powershell
npm run seed
```

The seed operation recreates the demo collections, four demo users, synthetic patients, triage assessments, queue state and audit events.

Demo password:

```text
demo123
```

Accounts:

```text
charge@patienttriage.demo
nurse@patienttriage.demo
admin@patienttriage.demo
system@patienttriage.demo
```

## 7. Install ML runtime dependencies

```powershell
python -m pip install -r ml/requirements-inference.txt
```

The runtime needs LightGBM and XGBoost because the supplied pickle contains both model families, plus scikit-learn for the stacking model.

## 8. Verify the supplied model

From the repository root:

```powershell
python ml/verify_model_artifact.py
```

With the supplied prediction output CSV also present locally:

```powershell
python ml/verify_model_artifact.py --predictions triage_predictions_output.csv
```

The reference check should reproduce the first prediction/confidence pair from the supplied output.

## 9. Start the final model inference service

```powershell
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Check:

```text
http://127.0.0.1:8000/health
```

Expected healthy shape:

```json
{
  "ok": true,
  "model": "LightGBM + XGBoost Ensemble",
  "modelVersion": "triage-ensemble-v1",
  "featureCount": 52,
  "foldCount": 5
}
```

## 10. Start the MERN application

In a second terminal:

```powershell
npm run dev
```

Expected endpoints:

```text
Frontend  → http://localhost:5173
Backend   → http://localhost:3000
ML        → http://127.0.0.1:8000
```

## 11. Full startup order

### Terminal 1 — MongoDB

Keep the MongoDB service running.

### Terminal 2 — final model service

```powershell
cd S:\Accenture_Hackathon\SpaceCoders
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

### Terminal 3 — MERN application

```powershell
cd S:\Accenture_Hackathon\SpaceCoders
npm run dev
```

Open:

```text
http://localhost:5173
```

## 12. Model-backed patient flow

1. Sign in.
2. Open Patient Intake.
3. Enter the dataset-aligned patient information.
4. Submit the patient.
5. Node builds the model feature contract.
6. Node calls `/predict` on FastAPI.
7. FastAPI reproduces the supplied notebook feature engineering.
8. Five LightGBM and five XGBoost folds produce probabilities.
9. LogisticRegression stacks those probabilities.
10. The final ESI and confidence return to Node.
11. Node applies independent safety/red-flag rules.
12. The clinician accepts or overrides the recommendation.
13. The decision is written to the audit trail and queue workflow.

## 13. Health checks

Backend:

```text
http://localhost:3000/api/health
```

Model:

```text
http://127.0.0.1:8000/health
```

Frontend:

```text
http://localhost:5173
```

## 14. Common errors

### Port 3000 already in use

```powershell
netstat -ano | findstr :3000
taskkill /F /IM node.exe
```

Only run one backend instance.

### MongoDB connection fails

Check the MongoDB service and `MONGO_URI` in `server/.env`.

### `dbHealth` import error

Pull the latest source. The database configuration exports `dbHealth`.

### `patientCode_1` duplicate-key error

The current database startup removes the obsolete unique `patientCode_1` index from older schema versions.

### Patient ID causes an ObjectId cast error

Routes recognize both MongoDB `_id` values and human-readable patient IDs such as `PT-2026-LWSBKX`.

### Model health reports `ok: false`

Verify that:

```text
ml/artifacts/triage_ensemble_model.pkl
```

exists and that its SHA-256 matches the documented checksum.

### Model loading reports sklearn/XGBoost compatibility warnings

Use the versions defined by `ml/requirements-inference.txt`. Persisted pickle artifacts depend on compatible Python and ML-library versions.

### Model service is offline

The Node application uses its deterministic fail-open scorer instead of blocking the patient workflow. Patient Review records the fallback model source.

### Frontend is stale

Restart Vite and hard-refresh:

```text
Ctrl + Shift + R
```

## 15. Destructive reset

The seed command clears and recreates the configured demo data. Use it only against the synthetic development database:

```powershell
npm run seed
```

Never point this command at a production database.

## 16. Production boundary

This guide describes a demonstration environment. Production use would require formal clinical validation, external/temporal validation, model calibration, subgroup analysis, secure artifact distribution, monitoring, privacy controls, clinical governance, change control and any applicable regulatory assessment.
