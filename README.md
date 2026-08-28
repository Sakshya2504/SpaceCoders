# PatientTriage.ai

PatientTriage.ai is a safety-first emergency-department decision-support prototype. It combines structured patient intake, XGBoost-assisted acuity prediction, independent red-flag detection, confidence-aware recommendations, live queue monitoring, realtime alerts and an auditable clinician decision trail in one workspace.

> **Prototype boundary:** the application uses synthetic data. The model, thresholds and decision logic have not been clinically validated and must not be used for real patient care.

## Product in one sentence

**A second pair of eyes for emergency triage that surfaces acuity, risk and uncertainty early while keeping the clinician in control of the final decision.**

## End-to-end workflow

```text
Clinician signs in
        ↓
Patient Intake
        ↓
Dataset-aligned feature builder
        ↓
XGBoost inference (preferred when available)
        ↓
ESI class + class probabilities
        │
        ├───────────────┐
        ↓               ↓
Confidence        Independent red flags
        │               │
        └───────┬───────┘
                ↓
     Safety / uncertainty layer
                ↓
     Recommendation + explanation
                ↓
       Clinician review
          ↙          ↘
      Accept        Override
          \          /
           ↓        ↓
         Final triage decision
                ↓
          Waiting queue
                ↓
       Reassessment loop
                ↓
     Realtime alerts + audit
```

The Node.js service is the orchestration and safety boundary. The Python service has one narrow responsibility: loading the trained XGBoost pipeline and returning a prediction. If the Python service is unavailable, the Node application uses its deterministic prototype scorer and exposes that fallback so the event can be reviewed rather than silently treated as a model result.

## Features

### Clinical intake

- Patient identity and synthetic patient ID generation.
- Demographics and age band.
- Arrival mode and operational context.
- Language, insurance type and transport origin.
- Complaint category and free-text chief complaint.
- Pain location and mental status.
- Prior ED visits, admissions, medications and comorbidities.
- Bedside vitals, GCS, pain score, weight and height.
- NEWS2 score.
- Automatic derived features such as BMI, mean arterial pressure, pulse pressure, shock index, age group, arrival context and shift.

### AI-assisted triage

- Five-class ESI recommendation.
- XGBoost class probabilities.
- Confidence and confidence band.
- Model version and model source metadata.
- Feature contribution/explanation layer.
- Deterministic fallback scorer when ML inference is unavailable.

### Safety and uncertainty

- Independent sepsis-like detector.
- Independent MI-like detector.
- Independent stroke-like detector.
- Independent respiratory-failure-like detector.
- Immediate escalation when configured red-flag thresholds are met.
- Explicit abstain-and-escalate behavior for incomplete/uncertain cases.
- Fail-open behavior when inference is unavailable.
- Human-in-the-loop acceptance and override.

### Operations

- Live waiting queue.
- Priority ordering by acuity and arrival time.
- Safe-max-wait calculation.
- Periodic reassessment.
- Surge mode with tighter monitoring cadence.
- Realtime Socket.IO updates.
- Alert center with unread counts, severity and toast notifications.

### Governance

- JWT authentication.
- Server-side role-based access control.
- Bcrypt password hashing.
- Structured clinician override reasons.
- Append-oriented SHA-256 linked audit events.
- Audit-chain verification.
- Responsive desktop/tablet/mobile interface.

## Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| UI | React + Vite | Clinical workspace and workflows |
| Routing | React Router | Protected product screens |
| HTTP client | Axios | REST API communication |
| Realtime | Socket.IO client | Queue, alert and health events |
| UI icons | Lucide React | Consistent iconography |
| API | Node.js + Express | Application orchestration |
| Database | MongoDB + Mongoose | Patient, user and audit persistence |
| Auth | JWT + bcryptjs | Authentication and role enforcement |
| Realtime server | Socket.IO | Event broadcast |
| ML | Python + XGBoost | Five-class ESI model |
| ML preprocessing | pandas + scikit-learn | Dataset validation and transformation |
| ML API | FastAPI + Uvicorn | Internal inference endpoint |

## Repository structure

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
│   └── vite.config.js
│
├── server/
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       ├── utils/
│       ├── seed.js
│       └── server.js
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
│   ├── SETUP.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── TESTING.md
│   ├── DEMO_SCRIPT.md
│   ├── SECURITY.md
│   └── ROUND2_CHECKLIST.md
│
└── package.json
```

## Local endpoints

```text
Frontend        http://localhost:5173
Node API        http://localhost:3000
ML inference    http://127.0.0.1:8000
MongoDB         mongodb://127.0.0.1:27017/patienttriage
```

## Quick start

### 1. Install JavaScript dependencies

```powershell
npm install
npm run install:all
```

### 2. Create the backend environment file

```powershell
cd server
copy .env.example .env
cd ..
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

### 3. Start MongoDB

Use the local MongoDB service on port `27017`.

### 4. Seed synthetic data

```powershell
npm run seed
```

The seed process recreates four demo users, eighteen synthetic patients, their initial triage records, queue state and audit events.

### 5. Start the MERN application

```powershell
npm run dev
```

The root development script starts both processes:

```text
Frontend → http://localhost:5173
Backend  → http://localhost:3000
```

### 6. Enable model-backed inference

Install Python dependencies:

```powershell
python -m pip install -r ml/requirements.txt
python -m pip install -r ml/requirements-inference.txt
```

Train from the supplied dataset:

```powershell
python ml/train_xgboost.py --data train.csv
```

Start FastAPI:

```powershell
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

## Demo accounts

All seeded demo accounts use `demo123`:

```text
Charge nurse   charge@patienttriage.demo
Triage nurse   nurse@patienttriage.demo
Clinical admin admin@patienttriage.demo
System admin   system@patienttriage.demo
```

Self-service signup is available at `/signup`. The backend assigns the default `triage_nurse` role rather than trusting a privilege level supplied by the browser.

## Dataset contract

The reference `train.csv` contains 80,000 rows and 40 columns. The prediction target is `triage_acuity` with five classes: 1, 2, 3, 4 and 5.

Four fields are excluded from model input:

| Field | Reason |
|---|---|
| `patient_id` | Identifier only |
| `disposition` | Downstream outcome |
| `ed_los_hours` | Downstream outcome and possible leakage |
| `triage_acuity` | Target label |

The remaining 36 fields form the model input contract. The intake page mirrors those fields semantically and automatically derives values that can be calculated reliably from entered measurements.

## Model behavior

The XGBoost model is trained as a five-class classifier wrapped in a scikit-learn preprocessing pipeline. Numeric values use median imputation; categorical values use most-frequent imputation with one-hot encoding that tolerates unknown categories.

The recorded dataset-level evaluation from the reference training run was:

| Metric | Result |
|---|---:|
| Accuracy | 85.26% |
| Balanced accuracy | 86.72% |
| Macro F1 | 86.95% |
| Weighted F1 | 85.31% |

These are prototype dataset metrics only. They are not evidence of clinical validity.

## Safety architecture

The model is not the only decision layer. The application also calculates independent safety signals and confidence.

```text
XGBoost prediction
       +
Independent red flags
       +
Data completeness / history / agreement
       ↓
Safety-aware recommendation
       ↓
Clinician decision
```

A positive configured red flag can force immediate escalation. Missing or conflicting information can trigger an explicit abstain-and-escalate path. Model-service failure uses fail-open behavior and keeps manual triage possible.

## Queue and alert behavior

Waiting patients have queue position, final ESI, safe-max-wait and reassessment timestamps. The queue monitor periodically evaluates patients and can run on a tighter cadence during surge mode.

Socket.IO events include:

```text
system:health
patient:created
triage:completed
escalation
reassessment
override
queue:updated
```

The alert center converts operational events into persistent in-app notifications, unread counts and critical toast messages.

## Audit chain

The audit service links each event to the previous event with a SHA-256 hash. Stored fields include event ID, type, patient, actor, role, timestamp, payload, previous hash and current hash.

The Audit Trail screen can verify the chain. When a mismatch is detected, the verification response identifies the first broken event.

## Responsive design

The UI is desktop-first but has dedicated responsive behavior:

```text
1440px+   Full navigation + dense dashboard
1180px    Reduced grid density
900px     Tablet navigation + stacked sections
640px     Mobile navigation + single-column forms
400px     Small-phone fallback layout
```

Dense tables use local horizontal scrolling instead of creating page-wide overflow.

## Verification and CI

The repository includes a GitHub Actions workflow at `.github/workflows/ci.yml`. On pushes and pull requests to `main`, it validates the application at three levels:

```text
Node dependencies
    ↓
Backend test suite
    ↓
Frontend production build
    ↓
Python module syntax compilation
```

This CI job is a fast source-level gate. It does not start MongoDB or the local XGBoost service, so environment-dependent integration behavior still needs the checks in `docs/TESTING.md`.

## Troubleshooting

### Backend says port 3000 is already in use

```powershell
netstat -ano | findstr :3000
taskkill /F /IM node.exe
```

Restart after the old process is gone.

### MongoDB is disconnected

Verify the MongoDB service is running and that `MONGO_URI` matches the local instance.

### `patientCode_1` duplicate-key error

The current database connection removes the obsolete index inherited from an older patient schema.

### Application ID causes MongoDB ObjectId cast error

Patient routes recognize application IDs such as `PT-2026-LWSBKX` separately from MongoDB `_id` values.

### XGBoost is unavailable

Confirm that the model artifact exists and FastAPI is running on port `8000`. The Node application falls back to its deterministic scorer if inference cannot be reached.

### Browser still shows an older frontend build

Restart Vite and hard-refresh the browser:

```text
Ctrl + Shift + R
```

## Documentation

Read these documents in order when onboarding to the repository:

1. `docs/SETUP.md` — get the system running.
2. `docs/ARCHITECTURE.md` — understand the boundaries and data flow.
3. `docs/API.md` — integrate with the REST/realtime contract.
4. `ml/README.md` — understand training and evaluation.
5. `ml/README_INFERENCE.md` — run the model service.
6. `docs/TESTING.md` — verify the full workflow.
7. `docs/DEMO_SCRIPT.md` — present the system.
8. `docs/SECURITY.md` — review security and production gaps.
9. `docs/ROUND2_CHECKLIST.md` — trace requirements to implementation.

## Limitations

This repository is a hackathon-style prototype built for demonstration with synthetic data. The clinical thresholds are demonstration assumptions, not clinical guidance. The XGBoost metrics are dataset-level results and do not establish safety, calibration, fairness or efficacy. Production use would require clinical validation, formal governance, security and privacy review, monitoring, model version control, human-factors evaluation and regulatory assessment where applicable.
