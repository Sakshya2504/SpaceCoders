# XGBoost Inference Service

The PatientTriage.ai application can call the trained XGBoost pipeline through the small FastAPI service in `ml/inference_service.py`.

The service is intentionally narrow. It does not own patient workflow, clinician permissions, safety escalation or audit logging.

## Responsibility split

```text
React frontend
     ↓
Node / Express
     ├── authentication + RBAC
     ├── patient workflow
     ├── red-flag safety checks
     ├── confidence handling
     ├── clinician accept/override
     ├── queue monitoring
     └── audit trail
              ↓
       FastAPI / XGBoost
              ↓
       prediction probabilities
```

This separation makes the model replaceable and prevents a Python process from becoming a hard dependency for basic workflow continuity.

## Prerequisites

Install Python and the inference dependencies:

```bash
python -m pip install -r ml/requirements-inference.txt
```

A trained model artifact must exist at:

```text
ml/artifacts/triage_xgb_pipeline.joblib
```

Generate it with:

```bash
python ml/train_xgboost.py --data train.csv
```

The `.joblib` artifact is not committed to Git.

## Start the service

From the repository root:

```bash
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

The service should then be available at:

```text
http://127.0.0.1:8000
```

## Health check

Open:

```text
http://127.0.0.1:8000/health
```

A healthy response looks like:

```json
{
  "ok": true,
  "model": "XGBoost",
  "modelVersion": "xgboost-multiclass-v1"
}
```

If the model artifact is missing, health returns `ok: false` with the load error.

## Prediction endpoint

### POST `/predict`

The request contains a `features` object with all 36 model input fields.

```json
{
  "features": {
    "site_id": "SITE-DEMO-01",
    "triage_nurse_id": "NURSE-DEMO",
    "arrival_mode": "walk-in",
    "arrival_hour": 14,
    "arrival_day": "Thursday",
    "arrival_month": 8,
    "arrival_season": "summer",
    "shift": "afternoon",
    "age": 42,
    "age_group": "young_adult",
    "sex": "M",
    "language": "English",
    "insurance_type": "unknown",
    "transport_origin": "home",
    "pain_location": "chest",
    "mental_status_triage": "alert",
    "chief_complaint_system": "cardiovascular",
    "num_prior_ed_visits_12m": 0,
    "num_prior_admissions_12m": 0,
    "num_active_medications": 0,
    "num_comorbidities": 0,
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "mean_arterial_pressure": 93.3,
    "pulse_pressure": 40,
    "heart_rate": 90,
    "respiratory_rate": 18,
    "temperature_c": 37,
    "spo2": 98,
    "gcs_total": 15,
    "pain_score": 3,
    "weight_kg": 70,
    "height_cm": 170,
    "bmi": 24.2,
    "shock_index": 0.75,
    "news2_score": 0
  }
}
```

The service validates that every expected feature is present before calling the persisted pipeline.

## Response

The response contains:

```text
model
modelVersion
esi
probabilities
confidence
```

Example:

```json
{
  "model": "XGBoost",
  "modelVersion": "xgboost-multiclass-v1",
  "esi": 3,
  "probabilities": {
    "ESI 1": 0.01,
    "ESI 2": 0.05,
    "ESI 3": 0.86,
    "ESI 4": 0.06,
    "ESI 5": 0.02
  },
  "confidence": 86.0
}
```

The returned confidence is the maximum class probability expressed as a percentage. The Node application can then apply its own confidence policy.

## Configuration

The Node service uses:

```env
ML_INFERENCE_URL=http://127.0.0.1:8000
```

Change this value when the inference service runs elsewhere.

## Failure behavior

The Node application uses a bounded request timeout when calling the inference service.

When inference is unavailable:

1. the request does not hang indefinitely;
2. the Node scorer falls back to its deterministic prototype scoring path;
3. the response exposes the model source for traceability;
4. manual clinician workflow remains available.

This is an intentional fail-open design for the prototype.

## Development notes

The inference service loads the joblib model lazily and reuses it across requests. The training and inference pipelines use the same persisted preprocessing pipeline so categorical encoding and numeric imputation remain consistent.

For production, serve the model behind authenticated internal networking, add model/version metadata, monitor latency and errors, and never expose the inference service directly to an untrusted network.

## Prototype disclaimer

The model and inference service are experimental software components trained on the supplied reference dataset. They are not clinically validated and must not be used for unsupervised patient-care decisions.
