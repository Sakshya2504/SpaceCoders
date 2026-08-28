# PatientTriage.ai

PatientTriage.ai is a safety-first emergency-department decision-support platform built as a full-stack MERN application with an optional XGBoost inference service.

The product is designed around one principle: **surface acuity, risk and uncertainty early while keeping the clinician in control of the final decision.**

> **Prototype notice:** the project uses synthetic data. The model, thresholds and decision logic are not clinically validated and must not be used for real patient care.

## 1. What the application does

The application provides a shared workspace for emergency-department intake, triage review, queue monitoring and auditability.

### Main workflow

```text
Sign in
   ↓
Patient Intake
   ↓
Build dataset-aligned feature vector
   ↓
XGBoost inference (when available)
   +
Independent red-flag checks
   +
Confidence / completeness checks
   ↓
ESI recommendation + explanation
   ↓
Clinician accepts or overrides
   ↓
Patient enters / remains in live queue
   ↓
Periodic reassessment
   ↓
Alerts + deterioration handling
   ↓
SHA-256 linked audit trail
```

The Node.js service owns authorization, patient workflow, safety rules, queue logic and audit records. The optional Python service owns only XGBoost inference. This keeps the ML boundary small and allows the application to fail open when the model service is unavailable.

## 2. Technology stack

### Frontend

- React
- Vite
- React Router
- Axios
- Socket.IO client
- Lucide React icons
- Responsive CSS for desktop, tablet and mobile layouts

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- JWT authentication
- bcryptjs password hashing
- Socket.IO
- express-rate-limit
- Morgan request logging

### Machine learning

- Python
- pandas
- scikit-learn preprocessing
- XGBoost
- joblib
- FastAPI
- Uvicorn

## 3. Repository structure

```text
SpaceCoders/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AlertCenter.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── TopBar.jsx
│   │   ├── pages/
│   │   │   ├── Audit.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Intake.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── PatientDetail.jsx
│   │   │   ├── Queue.jsx
│   │   │   └── Signup.jsx
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── index.css
│   │   ├── main.jsx
│   │   ├── responsive.css
│   │   └── socket.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── seed.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
├── ml/
│   ├── train_xgboost.py
│   ├── inference_service.py
│   ├── requirements.txt
│   ├── requirements-inference.txt
│   ├── README.md
│   └── README_INFERENCE.md
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEMO_SCRIPT.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   ├── SETUP.md
│   └── ROUND2_CHECKLIST.md
│
└── package.json
```

## 4. Local setup

### Prerequisites

Install the following before starting:

- Node.js 20+ recommended
- npm
- MongoDB running locally on port `27017`
- Python 3.10+ recommended for the XGBoost service

### Install JavaScript dependencies

From the repository root:

```bash
npm install
npm run install:all
```

### Configure the backend

Copy the example environment file:

```powershell
cd server
copy .env.example .env
cd ..
```

Use these local values:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/patienttriage
JWT_SECRET=change-this-in-production
CLIENT_URL=http://localhost:5173
TRIAGE_INTERVAL_MS=30000
MANUAL_MODE=false
ML_INFERENCE_URL=http://127.0.0.1:8000
```

### Seed the demo database

```bash
npm run seed
```

The seed command clears the demo collections and creates synthetic users and patients for a repeatable local demonstration.

### Start the application

For the MERN application only:

```bash
npm run dev
```

This starts:

```text
Frontend → http://localhost:5173
Backend  → http://localhost:3000
```

For the complete application including XGBoost inference, follow `docs/SETUP.md` for the Python service and then run the Node application.

## 5. Demo accounts

All seeded accounts use the same demo password:

```text
Password: demo123
```

Available accounts:

```text
Charge nurse
charge@patienttriage.demo

Triage nurse
nurse@patienttriage.demo

Clinical admin
admin@patienttriage.demo

System admin
system@patienttriage.demo
```

Signup is also available from `/signup`; new accounts are assigned the least-privileged `triage_nurse` role by the server.

## 6. Machine-learning dataset contract

The reference `train.csv` contains **80,000 rows and 40 columns**. The target column is `triage_acuity` with classes `1` through `5`.

The application intentionally excludes these four columns from inference:

| Column | Reason |
|---|---|
| `patient_id` | Identifier, not a clinical predictor |
| `disposition` | Downstream outcome after triage |
| `ed_los_hours` | Downstream outcome that can leak post-triage information |
| `triage_acuity` | Prediction target |

The remaining 36 fields form the model input contract.

The intake page collects those feature families and calculates derived fields such as age group, arrival timing context, BMI, mean arterial pressure, pulse pressure and shock index automatically.

## 7. Model and safety boundary

The XGBoost pipeline predicts the five ESI classes and returns class probabilities. The Node.js triage service then combines that model evidence with independent safety detectors and confidence checks.

The important distinction is:

```text
Model recommendation ≠ final clinical decision
```

A model prediction can be overridden by a red-flag safety signal or by the clinician. A model outage does not block the workflow; the Node service uses the documented deterministic fallback and exposes the fallback source for traceability.

## 8. Alerts and continuous monitoring

The application uses Socket.IO for realtime operational events. The alert center can surface:

- Immediate escalation
- Deterioration detection
- New triage recommendation
- Clinician override
- AI fail-open
- Surge-mode completion

Waiting patients are periodically reassessed. Surge mode shortens the reassessment cadence from the normal prototype interval to a more frequent interval.

## 9. Auditability

Decision events are written to an append-only application audit collection. Each event contains the previous event hash and its own SHA-256 hash. The Audit page can verify the chain and identify the first broken event when verification fails.

## 10. Responsive interface

The frontend uses a desktop-first layout with explicit tablet and phone breakpoints. Forms collapse from multi-column layouts to one column, data tables scroll horizontally on small screens, alerts become full-width mobile panels, and navigation changes from a sidebar to compact mobile navigation.

## 11. Documentation index

- `docs/SETUP.md` — exact local setup and troubleshooting.
- `docs/ARCHITECTURE.md` — system design, data flow and safety boundary.
- `docs/API.md` — endpoint reference with request/response examples.
- `docs/SECURITY.md` — authentication, data handling and safety considerations.
- `docs/TESTING.md` — validation checklist and manual end-to-end tests.
- `docs/DEMO_SCRIPT.md` — short presentation flow.
- `docs/ROUND2_CHECKLIST.md` — requirement-to-implementation traceability.
- `ml/README.md` — model training, schema and evaluation results.
- `ml/README_INFERENCE.md` — running the XGBoost inference service.

## 12. Product statement

PatientTriage.ai is intended to act as a **second pair of eyes for emergency triage**: it organizes patient context, highlights risk, makes uncertainty explicit, continuously watches the waiting queue and records how the final decision was made.

The platform is a prototype using synthetic data and should be treated as a software demonstration, not as a clinically validated decision system.
