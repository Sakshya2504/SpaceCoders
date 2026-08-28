# Local Setup Guide

This guide explains how to run PatientTriage.ai locally on Windows PowerShell and how the application components communicate.

## 1. Prerequisites

Install:

```text
Node.js 20+ recommended
npm
MongoDB
Python 3.10+ recommended for XGBoost inference
```

Confirm versions:

```powershell
node --version
npm --version
python --version
```

## 2. Clone the repository

```powershell
git clone https://github.com/Sakshya2504/SpaceCoders.git
cd SpaceCoders
```

## 3. Install Node dependencies

From the project root:

```powershell
npm install
npm run install:all
```

The root `package.json` starts the client and server with `concurrently`.

## 4. Start MongoDB

The local development configuration expects:

```text
mongodb://127.0.0.1:27017/patienttriage
```

Make sure the MongoDB service is running before seeding or starting the backend.

## 5. Configure the backend

Create:

```text
server/.env
```

Copy the values from `server/.env.example` and use:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/patienttriage
JWT_SECRET=change-this-in-production
CLIENT_URL=http://localhost:5173
TRIAGE_INTERVAL_MS=30000
MANUAL_MODE=false
ML_INFERENCE_URL=http://127.0.0.1:8000
```

Do not commit the `.env` file.

## 6. Seed synthetic demo data

From the root:

```powershell
npm run seed
```

The seed command clears the demo users, patients and audit records and recreates a repeatable synthetic dataset.

Expected demo accounts:

```text
charge@patienttriage.demo
nurse@patienttriage.demo
admin@patienttriage.demo
system@patienttriage.demo
```

Password:

```text
demo123
```

## 7. Run the MERN application

### Option A — one command

```powershell
npm run dev
```

This starts:

```text
Frontend → http://localhost:5173
Backend  → http://localhost:3000
```

### Option B — separate terminals

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

## 8. Run the XGBoost inference service

The model service is optional for basic application startup but is required for the complete model-backed demonstration.

Install dependencies:

```powershell
python -m pip install -r ml/requirements.txt
python -m pip install -r ml/requirements-inference.txt
```

Train the local model from the supplied dataset:

```powershell
python ml/train_xgboost.py --data train.csv
```

This generates:

```text
ml/artifacts/triage_xgb_pipeline.joblib
```

Start FastAPI:

```powershell
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Check:

```text
http://127.0.0.1:8000/health
```

## 9. Complete startup order

For an end-to-end demonstration, use three terminals:

### Terminal 1 — MongoDB

Keep the MongoDB service running.

### Terminal 2 — XGBoost service

```powershell
cd S:\Accenture_Hackathon\SpaceCoders
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

### Terminal 3 — MERN application

```powershell
cd S:\Accenture_Hackathon\SpaceCoders
npm run dev
```

Then open:

```text
http://localhost:5173
```

## 10. Health checks

### Backend

```text
http://localhost:3000/api/health
```

Expected fields include:

```text
ok
service
aiEngine
database
realtime
```

### ML service

```text
http://127.0.0.1:8000/health
```

Expected:

```json
{
  "ok": true,
  "model": "XGBoost",
  "modelVersion": "xgboost-multiclass-v1"
}
```

### Frontend

```text
http://localhost:5173
```

## 11. Common local problems

### Port 3000 is already in use

Find the process:

```powershell
netstat -ano | findstr :3000
```

Stop old Node processes during development if appropriate:

```powershell
taskkill /F /IM node.exe
```

Then restart the backend.

### MongoDB connection fails

Confirm MongoDB is running and that `MONGO_URI` points to the local instance.

### `dbHealth` import error

Pull the latest repository version. `server/src/config/db.js` exports both `connectDB` and `dbHealth`.

### Synthetic patient ID gives an ObjectId error

Use the latest `server/src/routes/patients.js`. The route recognizes application IDs such as `PT-2026-LWSBKX` without forcing them through MongoDB ObjectId casting.

### Duplicate `patientCode: null` error

The current database configuration removes the legacy `patientCode_1` index during connection when it still exists.

### XGBoost service unavailable

The Node application is designed to fall back to the deterministic prototype scorer rather than blocking the workflow. Start the Python service and ensure `ML_INFERENCE_URL` is correct for model-backed inference.

### Frontend looks stale after pulling

Restart the Vite process and use a hard refresh:

```text
Ctrl + Shift + R
```

## 12. Development reset

To rebuild the synthetic demo state:

```powershell
npm run seed
```

The seed operation is destructive for the configured demo database collections. Do not point it at a production database.

## 13. Windows note

PowerShell uses:

```powershell
copy .env.example .env
```

whereas Command Prompt uses the equivalent Windows copy command. The repository does not require a shell-specific build system beyond the normal npm/Python commands.

## 14. Production note

This setup is intended for local development and demonstrations only. Production deployment requires hardened secrets, TLS, authenticated infrastructure, controlled database access, observability, model governance and formal clinical validation.
