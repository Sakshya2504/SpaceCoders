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

Optional ML process:
Python + FastAPI + XGBoost → http://127.0.0.1:8000
```

The ML service is used for model-backed inference when available. The Node application retains a deterministic prototype fallback so an unavailable Python process does not block the workflow.

## 1. Prerequisites

Install the following locally:

```text
Node.js 20+ recommended
npm
MongoDB Community Server or another local MongoDB instance
Python 3.10+ recommended for model training/inference
Git
```

Verify the installations:

```powershell
node --version
npm --version
python --version
git --version
```

MongoDB must be running before the seed command or backend can use the database.

## 2. Clone the repository

```powershell
git clone https://github.com/Sakshya2504/SpaceCoders.git
cd SpaceCoders
```

## 3. Install JavaScript dependencies

From the repository root:

```powershell
npm install
npm run install:all
```

The root scripts install the server and client dependencies separately and use `concurrently` for the full development command.

## 4. Configure the Node backend

Create this file:

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

`.env` is intentionally ignored by Git. Never commit real credentials or production secrets.

## 5. Seed synthetic data

Make sure MongoDB is running, then execute:

```powershell
npm run seed
```

The seed operation recreates the demo collections used by the prototype. It creates four demo users and eighteen synthetic patients with triage assessments, queue state and audit events.

Default demo credentials:

```text
Charge nurse
charge@patienttriage.demo
Password: demo123

Triage nurse
nurse@patienttriage.demo
Password: demo123

Clinical admin
admin@patienttriage.demo
Password: demo123

System admin
system@patienttriage.demo
Password: demo123
```

## 6. Start the MERN application

### Option A — start frontend and backend together

From the root:

```powershell
npm run dev
```

Expected endpoints:

```text
Frontend  http://localhost:5173
Backend   http://localhost:3000
```

### Option B — start the processes separately

Backend terminal:

```powershell
cd server
npm run dev
```

Frontend terminal:

```powershell
cd client
npm run dev
```

## 7. Train the XGBoost model

Place the supplied reference dataset at:

```text
train.csv
```

from the repository root, or provide another path explicitly.

Install model dependencies:

```powershell
python -m pip install -r ml/requirements.txt
python -m pip install -r ml/requirements-inference.txt
```

Train:

```powershell
python ml/train_xgboost.py --data train.csv
```

The training pipeline performs preprocessing and writes the persisted model to:

```text
ml/artifacts/triage_xgb_pipeline.joblib
```

The binary model is ignored by Git because it is generated from the local training data.

## 8. Start XGBoost inference

Run from the repository root:

```powershell
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Verify:

```text
http://127.0.0.1:8000/health
```

A healthy response includes:

```json
{
  "ok": true,
  "model": "XGBoost",
  "modelVersion": "xgboost-multiclass-v1"
}
```

## 9. Recommended end-to-end startup

Use three terminals.

### Terminal 1 — MongoDB

Keep the MongoDB service running.

### Terminal 2 — XGBoost inference

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

## 10. Health checks

Backend:

```text
http://localhost:3000/api/health
```

ML service:

```text
http://127.0.0.1:8000/health
```

Frontend:

```text
http://localhost:5173
```

The backend health response reports database status, AI mode and realtime status.

## 11. Normal application workflow

1. Sign in.
2. Open Command Centre.
3. Open Patient Intake.
4. Enter a synthetic patient using the dataset-aligned fields.
5. Submit the patient.
6. Review the ESI recommendation, confidence, red flags and explanations.
7. Accept or override the recommendation.
8. Open Live Queue and use reassessment/surge controls.
9. Watch the alert center for realtime events.
10. Open Audit Trail and verify the SHA-256 chain.

## 12. Common errors

### Port 3000 already in use

Find the owning process:

```powershell
netstat -ano | findstr :3000
```

During local development, old Node processes can be stopped with:

```powershell
taskkill /F /IM node.exe
```

Then restart the backend.

### `EADDRINUSE` still appears

Make sure only one backend instance is running. The application intentionally uses port `3000`; do not switch the port in only one part of the stack.

### MongoDB connection fails

Check the MongoDB service and verify `MONGO_URI` in `server/.env`.

### `dbHealth` import error

Pull the latest repository. `server/src/config/db.js` exports both `connectDB` and `dbHealth`.

### `patientCode_1` duplicate-key error

The current database connection removes the legacy unique `patientCode_1` index left by an older schema.

### Synthetic patient ID causes ObjectId casting error

The patient route accepts both MongoDB `_id` values and application IDs such as `PT-2026-LWSBKX`.

### ML service is unavailable

The Node triage engine records the model outage and uses its deterministic prototype fallback. For model-backed inference, start FastAPI and verify `ML_INFERENCE_URL`.

### Frontend is not using the latest styles

Stop and restart Vite, then perform:

```text
Ctrl + Shift + R
```

## 13. Resetting demo data

Run:

```powershell
npm run seed
```

The seed command is destructive for the configured demo collections. Use it only with the synthetic development database.

## 14. Production boundary

This guide describes a local prototype setup. A production deployment would require secure secret management, TLS, hardened database access, centralized logging, monitoring, model governance, formal clinical validation, privacy controls and operational runbooks.
