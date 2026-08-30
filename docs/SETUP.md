# PatientTriage.ai — Local Setup Guide

This project runs locally as a small full-stack application plus a separate Python inference service.

```text
Browser
  │
  ├── React + Vite → http://localhost:5173
  │
  └── REST / Socket.IO
          ↓
      Node + Express → http://localhost:3000
          ↓
      MongoDB → localhost:27017

Python + FastAPI
  ↓
Final triage ensemble → http://127.0.0.1:8000
```

## 1. What you need

Install:

```text
Node.js 20+
npm
MongoDB
Python 3.10+
Git
```

Check the installations:

```powershell
node --version
npm --version
python --version
git --version
```

MongoDB needs to be running before the backend or seed script can use the database.

## 2. Get the repository

```powershell
git clone https://github.com/Sakshya2504/SpaceCoders.git
cd SpaceCoders
```

## 3. Install JavaScript dependencies

```powershell
npm install
npm run install:all
```

## 4. Configure the backend

Create `server/.env` from the example file and use local development values similar to:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/patienttriage
JWT_SECRET=change-this-in-production
CLIENT_URL=http://localhost:5173
TRIAGE_INTERVAL_MS=30000
MANUAL_MODE=false
ML_INFERENCE_URL=http://127.0.0.1:8000
```

Keep real credentials and secrets out of Git.

## 5. Install the supplied final model artifact

The final runtime artifact is:

```text
ml/artifacts/triage_ensemble_model.pkl
```

The expected SHA-256 is:

```text
8a22c60268cb26fab39935cbd087c74568658db32da26f99f662559288d06ccc
```

The binary is intentionally not stored in the source repository. Place the supplied artifact at the path above.

From the repository root, if the file is currently beside the repository folder:

```powershell
Copy-Item .\triage_ensemble_model.pkl .\ml\artifacts\triage_ensemble_model.pkl
```

## 6. Install Python inference dependencies

```powershell
python -m pip install -r ml/requirements-inference.txt
```

The persisted artifact requires the model libraries used by the supplied ensemble, including LightGBM, XGBoost and scikit-learn.

## 7. Verify the model artifact

Run:

```powershell
python ml/verify_model_artifact.py
```

When the supplied prediction CSV is available locally, it can also be used for a reference-output check:

```powershell
python ml/verify_model_artifact.py --predictions triage_predictions_output.csv
```

A healthy verification confirms the artifact structure, expected feature contract and reference prediction behavior.

## 8. Start the final model service

From the repository root:

```powershell
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Open:

```text
http://127.0.0.1:8000/health
```

The final model is:

```text
5 × LightGBM
+
5 × XGBoost
      ↓
LogisticRegression stacking model
      ↓
ESI 1–5 + probabilities + confidence
```

A healthy response reports the ensemble name, model version, 52-feature contract and five-fold structure.

## 9. Seed synthetic data

With MongoDB running:

```powershell
npm run seed
```

The seed process is for the synthetic development database. It recreates demo users, synthetic patients, queue state and audit events.

Demo password:

```text
demo123
```

Demo accounts:

```text
charge@patienttriage.demo
nurse@patienttriage.demo
admin@patienttriage.demo
system@patienttriage.demo
```

## 10. Start the MERN application

The root package exposes separate commands for the two JavaScript services.

### Run frontend and backend together

Use this when you want both services from one terminal:

```powershell
npm run dev
```

This starts:

```text
Frontend  → http://localhost:5173
Backend   → http://localhost:3000
```

### Run the frontend only

Use this when the backend is already running or when you want separate terminals:

```powershell
npm run client
```

`npm run client` starts the React/Vite development server on port `5173`.

### Run the backend only

```powershell
npm run server
```

`npm run server` starts the Node/Express API on port `3000`.

## 11. Recommended startup order

For demos and easier troubleshooting, use separate terminals.

### Terminal 1 — MongoDB

Start the local MongoDB service.

### Terminal 2 — supplied final model

```powershell
cd S:\Accenture_Hackathon\SpaceCoders
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

### Terminal 3 — backend

```powershell
cd S:\Accenture_Hackathon\SpaceCoders
npm run server
```

Expected:

```text
PatientTriage API listening on 3000
```

### Terminal 4 — frontend

```powershell
cd S:\Accenture_Hackathon\SpaceCoders
npm run client
```

Expected:

```text
Local: http://localhost:5173/
```

Keeping the frontend, backend and model logs in separate terminals makes it much easier to identify which service is having a problem during a demonstration.

## 12. End-to-end model-backed flow

```text
Patient Intake
      ↓
Node builds dataset-aligned features
      ↓
Node calls FastAPI /predict
      ↓
FastAPI loads supplied triage_ensemble_model.pkl
      ↓
52 saved prediction features
      ↓
5 LightGBM + 5 XGBoost folds
      ↓
LogisticRegression stacking model
      ↓
ESI 1–5 + class probabilities + confidence
      ↓
Node safety / uncertainty layer
      ↓
Clinician review
      ↓
Accept / Override / Reassess
```

The final ensemble is the source of truth for model-backed inference. The older `ml/train_xgboost.py` file is retained as reference/prototype training code and is not the artifact runtime.

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

## 14. Common problems

### Port 3000 is already in use

```powershell
netstat -ano | findstr :3000
taskkill /F /IM node.exe
```

Only run one backend instance.

### Port 5173 is already in use

Stop the existing Vite process or close the terminal running the frontend, then run:

```powershell
npm run client
```

### MongoDB connection fails

Check that MongoDB is running and that `MONGO_URI` points to the intended local database.

### `dbHealth` import error

Pull the latest repository source. The current database configuration exports the health helper used by the server.

### `patientCode_1` duplicate-key error

Older database versions may contain an obsolete unique index on `patientCode`. The current startup path contains compatibility handling, but a clean synthetic database can also be recreated with the seed command.

### `PT-2026-...` causes an ObjectId cast error

Patient routes recognize application IDs separately from MongoDB `_id` values. Pull the latest backend source if an older version is still running.

### Model service reports `ok: false`

Check that:

```text
ml/artifacts/triage_ensemble_model.pkl
```

exists and that its SHA-256 matches the documented value.

### Pickle/library compatibility warning

Use the dependencies in `ml/requirements-inference.txt`. Persisted model files depend on compatible Python and ML-library versions.

### Model service is offline

The Node workflow has an explicit fail-open fallback for the prototype. Patient Review should make the fallback source visible rather than presenting it as the supplied ensemble.

### Browser appears stuck on old UI

Restart the frontend with:

```powershell
npm run client
```

Then hard-refresh:

```text
Ctrl + Shift + R
```

## 15. Destructive reset

Use the seed command only against the synthetic development database:

```powershell
npm run seed
```

Never point the seed command at a production database.

## 16. Before a demo

Use this quick checklist:

```text
[ ] MongoDB is running
[ ] triage_ensemble_model.pkl is present
[ ] model artifact verification passes
[ ] FastAPI /health is healthy
[ ] Node /api/health is healthy
[ ] frontend opens on 5173
[ ] login works
[ ] create patient works
[ ] Patient Review loads
[ ] model source/version is visible
[ ] Reassess works
[ ] Accept / Override works
[ ] queue and alerts update
[ ] audit verification works
```

## 17. Prototype boundary

This is a synthetic-data demonstration environment. The model, thresholds and safety logic are not clinically validated and must not be used to make real patient-care decisions.
