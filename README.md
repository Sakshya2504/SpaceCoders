# PatientTriage.ai

**PatientTriage.ai** is a safety-first emergency-department decision-support prototype built by **SpaceCoders, Indian Institute of Technology Indore**. It helps clinicians prioritise patients, surface safety signals, monitor waiting patients and retain a traceable decision history - while keeping the clinician in control of the final decision.

> **Prototype boundary:** This project uses synthetic/demo data. The model, safety thresholds and workflow logic are not clinically validated and must not be used for real patient care.

## Product in one sentence

**A second pair of eyes for emergency triage that surfaces acuity, risk and uncertainty early while keeping the clinician in control of the final decision.**

## Round 2: what the prototype demonstrates

The working prototype demonstrates the complete mechanism requested for an illustrative proof of concept:

```text
Sign in
   ↓
Patient Intake
   ↓
Dataset-aligned feature preparation
   ↓
Supplied final ML model
   ↓
ESI 1-5 + probabilities + confidence
   ↓
Independent safety / uncertainty layer
   ↓
Patient Review
   ↓
Accept / Override / Reassess
   ↓
Live Queue + Alerts
   ↓
Mark Service Done
   ↓
Past Patients + Audit Trail
```

The demo can also cover the requested edge cases: an ambiguous presentation, a pediatric patient, a geriatric patient, a zero-history first-time patient, a clinician override, and a simulated surge with approximately 3x normal volume.

## Why the problem matters

Emergency triage is a high-pressure workflow in which one clinician may need to interpret symptoms, vitals, history, documentation and the state of the waiting queue at the same time. The product concept from Round 1 focuses on three gaps:

1. **Cognitive overload** - too many decisions and documentation tasks at the same time.
2. **Hidden deterioration** - a patient can change after the first assessment while waiting.
3. **Fragmented context** - patient context, queue pressure, alerts and previous decisions are difficult to hold as one operational picture.

PatientTriage.ai is designed as a continuous **sense -> recommend -> monitor -> reassess** loop rather than a one-time score.

## Solution design

### Clinical intake

The intake page is aligned to the supplied training-data feature vocabulary and includes the major field families used by the model workflow:

- Patient identity and demographics
- Arrival mode and arrival date/time
- Site and triage-nurse context
- Language, insurance and transport origin
- Pain location and mental status
- Chief complaint and complaint system
- Prior ED visits and admissions
- Active medications and comorbidities
- Blood pressure, heart rate, respiratory rate and temperature
- SpO2, GCS and pain score
- Weight, height and NEWS2

The portal calculates derived values where appropriate, including:

- Age group
- Arrival hour, day, month and season
- Shift
- BMI
- Mean arterial pressure
- Pulse pressure
- Shock index

Downstream target/outcome fields are not treated as estimator inputs.

## Final model

The portal is designed around the **supplied final model artifact** rather than retraining a replacement model during inference.

```text
5 x LightGBM models
          +
5 x XGBoost models
          ↓
LogisticRegression stacking model
          ↓
ESI 1-5
+ class probabilities
+ confidence
```

The runtime follows the canonical feature contract stored with the model artifact. The model result is advisory evidence and remains separate from the application safety layer and the final clinician decision.

### Model output

For every model-backed assessment the portal should expose:

- Predicted ESI: **1, 2, 3, 4 or 5**
- Five-class probability distribution
- Confidence for the selected class
- Model/source metadata
- Human-readable ESI explanation

Example product wording:

```text
ESI 4 - Lower acuity

The current presentation appears stable with limited expected resource needs.
```

These explanations are **prototype product language**, not a claim that the project is an officially validated clinical ESI implementation.

## Safety and uncertainty layer

The model is not the only decision layer. The application separately evaluates prototype safety signals and uncertainty.

```text
                Model recommendation
                         ↓
        ┌────────────────┴────────────────┐
        ↓                                 ↓
  Confidence / uncertainty        Independent red flags
                                        ↓
                            Safety-aware recommendation
                                        ↓
                                Clinician review
```

The prototype includes independent detector families for:

- Sepsis-like risk
- MI-like risk
- Stroke-like risk
- Respiratory-failure-like risk

The workflow supports explicit **abstain/escalate** and **fail-open** behavior when configured conditions require it or model inference is unavailable.

## Human-in-the-loop workflow

The clinician remains the final decision-maker.

### Accept

Records explicit clinician acceptance of the current recommendation.

### Override

Allows a clinician to choose a different ESI and record a reason. The original model recommendation remains distinguishable from the final clinician-selected priority.

### Reassess

Opens a reassessment window for updated current values, runs a fresh assessment and retains previous assessments as history. Reassessment history is locally scrollable so large histories do not make the page unusable.

### Service completion

`Mark service done` moves the patient out of the active workflow while keeping the record available in **Past Patients**.

## Operations

### Live queue

The queue exposes operational context such as:

- Queue position
- Final ESI
- Model confidence
- Waiting time
- Reassessment timing
- Action state
- Red-flag state

### Surge mode

The prototype can simulate a surge with approximately **3x the normal arrival volume** and a tighter monitoring cadence. This is intended to demonstrate operational behaviour, not to claim validated capacity gains.

### Alerts

The alert centre surfaces events such as:

```text
New triage recommendation
Immediate escalation
Deterioration / reassessment
Clinician override
AI fail-open
Surge activity
```

The alert panel is bounded and scrollable so repeated events remain manageable.

## Auditability

Important workflow events are stored in an append-oriented audit trail. Events are linked using SHA-256 hashes and the Audit Trail screen can verify the chain.

The purpose is to preserve:

```text
who acted
when they acted
what the model recommended
what the clinician decided
what changed during reassessment
```

## Working prototype demonstration set

A strong five-case demonstration can cover the Round 2 expectations efficiently:

| Case | Scenario | Demonstrates |
|---|---|---|
| 1 | Critical respiratory presentation | High-risk model result, safety signal, escalation and alert |
| 2 | Ambiguous chest-pain presentation | Confidence/probabilities, clinician judgement, override and audit |
| 3 | Pediatric patient | Age-group handling and model workflow on a pediatric profile |
| 4 | Geriatric patient with weakness/confusion | Multi-factor risk context and prioritisation |
| 5 | Zero-history first-time patient | Missing historical context, explicit confidence and reassessment |

The remaining requirement of demonstrating **15-20 simulated records** can be shown through the seeded synthetic population and surge simulation while the five cases above are used for the detailed walkthrough.

## Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| UI | React + Vite | Clinical workspace |
| Routing | React Router | Application navigation |
| HTTP | Axios | REST communication |
| Realtime | Socket.IO client | Queue, alert and health updates |
| Icons | Lucide React | Consistent product iconography |
| API | Node.js + Express | Orchestration and application workflow |
| Database | MongoDB + Mongoose | Patient, user, assessment and audit persistence |
| Auth | JWT + bcryptjs | Authentication and server-side role enforcement |
| Realtime server | Socket.IO | Event broadcast |
| ML service | Python + FastAPI | Model inference endpoint |
| ML | LightGBM + XGBoost + LogisticRegression | Supplied stacked ensemble |
| ML preprocessing | pandas + scikit-learn | Feature validation/transformation |

## Repository structure

```text
SpaceCoders/
│
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── utils/
│       ├── App.jsx
│       ├── api.js
│       ├── main.jsx
│       ├── socket.js
│       ├── index.css
│       ├── responsive.css
│       └── portal-refinements.css
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
│   ├── artifacts/
│   │   └── triage_ensemble_model.pkl
│   ├── inference_service.py
│   ├── model_runner.py
│   ├── verify_model_artifact.py
│   ├── requirements.txt
│   ├── requirements-inference.txt
│   └── README_INFERENCE.md
│
├── docs/
│   ├── SETUP.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── TESTING.md
│   ├── DEMO_SCRIPT.md
│   ├── SECURITY.md
│   ├── STYLE_GUIDE.md
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

### 1. Install dependencies

```powershell
npm install
npm run install:all
```

### 2. Configure backend

```powershell
cd server
copy .env.example .env
cd ..
```

Recommended development values:

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

Start the local MongoDB service on port `27017`.

### 4. Seed synthetic demo data

```powershell
npm run seed
```

The seed script recreates four demo users, eighteen synthetic patients and the related queue/assessment/audit state.

> Running the seed script is a **reset** for the demo database. It clears existing seeded users, patients and audit events before recreating them.

### 5. Start the MERN application

```powershell
npm run dev
```

Expected:

```text
Frontend → http://localhost:5173
Backend  → http://localhost:3000
```

### 6. Start the supplied model service

Install Python dependencies:

```powershell
python -m pip install -r ml/requirements.txt
python -m pip install -r ml/requirements-inference.txt
```

Verify the model artifact:

```powershell
python ml/verify_model_artifact.py
```

Start FastAPI:

```powershell
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

The application uses the persisted supplied artifact at:

```text
ml/artifacts/triage_ensemble_model.pkl
```

## Demo accounts

All seeded demo accounts use the password `demo123`:

```text
Triage nurse    nurse@patienttriage.demo
Charge nurse    charge@patienttriage.demo
Clinical admin  admin@patienttriage.demo
System admin    system@patienttriage.demo
```

Self-service signup is available at `/signup`. New signup requests receive the default `triage_nurse` role; the browser cannot self-assign elevated privileges.

## Dataset contract

The supplied reference training set contains **80,000 rows and 40 columns**. The target is `triage_acuity` with five classes: 1, 2, 3, 4 and 5.

The following fields are kept out of estimator input:

| Field | Reason |
|---|---|
| `patient_id` | Identifier only |
| `disposition` | Downstream outcome |
| `ed_los_hours` | Downstream outcome / leakage risk |
| `triage_acuity` | Target label |

The remaining **36 fields** form the raw model-input vocabulary. The portal mirrors those fields semantically and derives the additional calculated values needed by the runtime feature contract.

## Model / product boundaries

Keep these concepts separate in code and in the UI:

```text
Raw patient data
      ↓
Feature preparation
      ↓
Supplied ensemble prediction
      ↓
Safety / uncertainty layer
      ↓
Clinician review
      ↓
Final clinician decision
```

The application should never silently turn a fallback score into a successful model result, and it should never interpret the model recommendation as an autonomous clinical action.

## Verification

Use the project testing guide for the full regression flow:

```text
Authentication
Patient intake
Patient creation
Model-backed prediction
Confidence display
Safety signals
Accept / Override
Reassess + history
Queue + surge
Alerts
Service completion
Past Patients
Audit verification
Responsive layouts
Production build
```

Run the core build checks with:

```powershell
npm run build
```

and follow `docs/TESTING.md` for the model and integration checks.

## Troubleshooting

### Backend port 3000 is already in use

```powershell
netstat -ano | findstr :3000
taskkill /F /IM node.exe
```

Then restart the application.

### MongoDB is disconnected

Verify MongoDB is running and `MONGO_URI` points to the expected database.

### Duplicate patient-code index error

If an older development database still contains the obsolete unique index, restart the backend so its database initialisation can remove the legacy index, or reset the local demo database with the seed script.

### Patient application ID causes ObjectId cast error

Routes recognise application IDs such as `PT-2026-LWSBKX` separately from MongoDB `_id` values.

### Model service is unavailable

Verify the artifact exists and FastAPI is healthy on port `8000`. The Node application follows the explicit fail-open path and records the fallback source.

### The browser shows an older UI build

Restart Vite and hard-refresh:

```text
Ctrl + Shift + R
```

## Documentation map

Use these documents when preparing the submission or onboarding a teammate:

1. `docs/SETUP.md` - environment and startup instructions.
2. `docs/ARCHITECTURE.md` - system boundaries and data flow.
3. `docs/API.md` - REST and realtime contracts.
4. `ml/README_INFERENCE.md` - supplied model service and artifact usage.
5. `docs/TESTING.md` - end-to-end verification.
6. `docs/DEMO_SCRIPT.md` - prototype demonstration flow.
7. `docs/SECURITY.md` - security posture and production gaps.
8. `docs/ROUND2_CHECKLIST.md` - requirement-to-feature mapping.
9. `docs/STYLE_GUIDE.md` - coding and UI readability conventions.

## Limitations

This repository is a hackathon-style proof of concept built for demonstration with synthetic data. The model and safety thresholds are not clinically validated. Dataset-level model metrics do not establish clinical accuracy, calibration, fairness, safety, efficacy or regulatory compliance.

A real deployment would require, at minimum, clinical validation, prospective evaluation, calibration and drift monitoring, subgroup analysis, security/privacy review, model governance, human-factors testing, operational integration and regulatory assessment where applicable.

## Team

**SpaceCoders**  
Indian Institute of Technology Indore  
B.Tech. Space Sciences and Engineering  
Graduation: June 2028

**Sakshya Singh Kasera**  
**Patel Devki**

## Live prototype

**Website:** `patienttriage.ai`

For evaluation, use the website together with this repository and the Round 2 pitch deck. The strongest demonstration path is the five-case walkthrough followed by the simulated surge and audit verification.