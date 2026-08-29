# Final Triage Ensemble Inference

The application now uses the supplied `triage_ensemble_model.pkl` as its model artifact. It is **not** a single XGBoost pipeline: the artifact contains a five-fold ensemble of LightGBM and XGBoost base models followed by a LogisticRegression stacking model.

## Responsibility split

```text
React frontend
     ↓
Node / Express
     ├── authentication + RBAC
     ├── patient workflow
     ├── safety / red-flag checks
     ├── confidence handling
     ├── clinician accept / override
     ├── queue monitoring
     └── audit trail
             ↓
       FastAPI / final ensemble
             ↓
   LightGBM + XGBoost folds
             ↓
      LogisticRegression
             ↓
     ESI + probabilities
```

The Node application remains the safety and workflow boundary. The Python service only loads the supplied model artifact, reproduces its feature engineering, runs the ensemble, and returns the model result.

## Model artifact

Required file:

```text
ml/artifacts/triage_ensemble_model.pkl
```

Expected SHA-256 for the supplied artifact:

```text
8a22c60268cb26fab39935cbd087c74568658db32da26f99f662559288d06ccc
```

The binary model is intentionally not stored in this source repository. See `ml/artifacts/README.md` for the local copy step.

## Runtime dependencies

Install the dependencies used by the persisted estimators:

```powershell
python -m pip install -r ml/requirements-inference.txt
```

The runtime includes LightGBM because the artifact contains five `LGBMClassifier` models, alongside five `XGBClassifier` models and a scikit-learn `LogisticRegression` meta-model.

## Start the service

From the repository root:

```powershell
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Service URL:

```text
http://127.0.0.1:8000
```

## Health check

```text
GET http://127.0.0.1:8000/health
```

Expected shape:

```json
{
  "ok": true,
  "model": "LightGBM + XGBoost Ensemble",
  "modelVersion": "triage-ensemble-v1",
  "featureCount": 52,
  "foldCount": 5
}
```

## Feature engineering contract

The uploaded inference notebook defines the same feature builder used here. The runtime derives the following engineered features before prediction:

```text
ed_volume_last_2h
shock_index
pulse_pressure
mean_arterial_pressure
rox_index
bsa
bmi
hr_dev
sys_bp_dev
temp_dev
spo2_deficit
composite_vital_deviation
sirs_score
age_shock_risk
age_sirs_risk
flag_hypoxia
flag_tachycardia
flag_hypotension
flag_fever
total_red_flags
hour_sin
hour_cos
```

The final artifact contains **52 prediction columns**. The runtime reads the canonical order directly from `artifacts["features"]` so the service does not maintain a conflicting hard-coded feature list.

The training notebook also removes identifiers, timestamps and post-triage outcomes before fitting. In particular, `patient_id`, `site_id`, `triage_nurse_id`, timestamps and downstream fields such as `disposition`, `ed_los_hours` and `triage_acuity` do not reach the estimators.

## Prediction endpoint

### POST `/predict`

The Node service sends the patient feature object under `features`.

```json
{
  "features": {
    "arrival_mode": "walk-in",
    "arrival_hour": 14,
    "arrival_day": "Thursday",
    "arrival_month": 8,
    "arrival_season": "summer",
    "shift": "afternoon",
    "age": 42,
    "age_group": "middle_aged",
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
    "heart_rate": 90,
    "respiratory_rate": 18,
    "temperature_c": 37,
    "spo2": 98,
    "gcs_total": 15,
    "pain_score": 3,
    "weight_kg": 70,
    "height_cm": 170,
    "news2_score": 0,
    "ed_volume_last_2h": 0
  }
}
```

The runtime adds engineered values such as BMI, mean arterial pressure and shock index using the same formulas as the supplied notebook, fills any remaining artifact columns with `NaN`, and applies each fold's saved categorical vocabulary.

## Response

The service returns the final stacked prediction:

```json
{
  "model": "LightGBM + XGBoost Ensemble",
  "modelVersion": "triage-ensemble-v1",
  "esi": 3,
  "confidence": 86.0,
  "probabilities": {
    "ESI 1": 0.01,
    "ESI 2": 0.05,
    "ESI 3": 0.86,
    "ESI 4": 0.06,
    "ESI 5": 0.02
  }
}
```

The ESI class is converted back from the artifact's zero-based meta-model class to the application's 1–5 ESI scale.

## Model result reference

The supplied notebook reports:

```text
Overall test accuracy:              86.15%
High-confidence accuracy (>= 75%): 92.54%
High-confidence coverage:           81.79%
High-confidence cases:              13087 / 16000
```

These are the supplied model's dataset-level test results and are not evidence of clinical validity.

## Node integration

The Node triage service calls:

```text
${ML_INFERENCE_URL}/predict
```

with a short timeout. A successful response contributes the model's ESI, probabilities and confidence to the application recommendation.

The Node service still owns the independent safety layer. A configured red flag can force immediate escalation regardless of the model's predicted class, and model-service failure keeps the deterministic fallback path available.

## Verifying the supplied artifact

A quick consistency check can be performed against `triage_predictions_output.csv` using the uploaded artifact and the supplied feature builder. The first reference predictions are reproduced exactly by the current runtime logic, including confidence values.

This is a software consistency check, not a clinical validation test.

## Failure behavior

If the artifact is missing or cannot be loaded, `/health` returns `ok: false` and `/predict` returns a service error. The Node application catches that failure and uses its documented fail-open fallback rather than blocking patient workflow.

## Production notes

The persisted pickle depends on compatible Python, scikit-learn, LightGBM and XGBoost versions. Keep the inference environment pinned and rebuild/re-export the artifact deliberately when dependency versions change. Never expose this prototype inference endpoint directly to an untrusted network.

## Prototype disclaimer

This model and application are demonstration software trained on synthetic data. They are not clinically validated and must not be used for unsupervised patient-care decisions.
