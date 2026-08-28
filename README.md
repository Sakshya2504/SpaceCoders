# PatientTriage.ai

PatientTriage.ai is a safety-first emergency-department decision-support platform. It brings patient context, triage acuity, high-sensitivity red-flag detection, confidence, queue monitoring and clinician review into one workspace.

The current application uses synthetic data. AI recommendations are advisory; the clinician remains responsible for the final triage decision.

## Stack

- React + Vite
- Node.js + Express
- MongoDB + Mongoose
- JWT + bcryptjs
- Socket.IO for realtime events
- XGBoost training pipeline under `ml/`

## Local setup

```bash
npm install
npm run install:all
cd server
copy .env.example .env
cd ..
npm run seed
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:3000`
Health check: `http://localhost:3000/api/health`

For Windows PowerShell, the `.env` file should contain:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/patienttriage
JWT_SECRET=change-this-in-production
CLIENT_URL=http://localhost:5173
TRIAGE_INTERVAL_MS=30000
MANUAL_MODE=false
```

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

These accounts and all seeded patients are synthetic demo data.

## Core workflow

1. Sign in.
2. Open **Command Centre** for the operational overview.
3. Use **Patient Intake** to capture the model-aligned feature set.
4. Review the recommendation, confidence and independent red-flag results.
5. Accept or override the recommendation.
6. Use **Live Queue** for continuous ranking and reassessment.
7. Use **Audit Trail** to trace and verify the SHA-256 linked event chain.

## Dataset alignment

The attached reference dataset contains 80,000 rows and 40 columns. The target is `triage_acuity` with values 1–5.

The ML training pipeline excludes `patient_id`, `disposition`, `ed_los_hours` and `triage_acuity` from model inputs. `patient_id` is an identifier, `disposition` and `ed_los_hours` are downstream outcomes, and `triage_acuity` is the target.

The intake page captures the corresponding feature families and stores a `modelFeatures` object using the training column names. Derived fields such as age group, arrival context, BMI, mean arterial pressure, pulse pressure and shock index are calculated from the entered information.

## Safety behavior

- Red-flag positive → immediate escalation.
- Low confidence or sparse/conflicting information → abstain and escalate.
- Engine failure → fail open to manual triage.
- Clinician override is explicit and audited.
- Age-aware thresholds are prototype assumptions, not clinical guidance.

## Model

`ml/train_xgboost.py` trains a reproducible five-class XGBoost pipeline with preprocessing, missing-value handling and categorical encoding. See `ml/README.md` for the evaluation results and reproduction command.

The current MERN runtime keeps the inference contract behind `scorePatient()`. A future internal XGBoost/SHAP service can replace that implementation without changing the React workflow.

## Documentation

- `docs/ARCHITECTURE.md` — system and decision flow
- `docs/DEMO_SCRIPT.md` — presentation walkthrough
- `docs/API.md` — API contract
- `docs/SECURITY.md` — security and production considerations
- `docs/ROUND2_CHECKLIST.md` — traceability matrix for the original challenge requirements

## Disclaimer

This is a hackathon prototype using synthetic data. The model, thresholds and decision logic have not been clinically validated and must not be used for real patient care.
