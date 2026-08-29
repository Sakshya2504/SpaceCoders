# Final triage ensemble

This directory contains the runtime integration for the final model supplied with the project.

The supplied artifact is a **five-fold stacked ensemble** made from:

```text
5 × LightGBM classifiers
5 × XGBoost classifiers
          ↓
LogisticRegression meta-model
          ↓
       ESI 1–5
```

The ensemble is trained to predict `triage_acuity` and returns class probabilities plus the highest-probability ESI class.

> **Prototype boundary:** the supplied model uses synthetic/reference data and is not clinically validated. It must not be used for unsupervised patient-care decisions.

## 1. Supplied model artifact

Required local file:

```text
ml/artifacts/triage_ensemble_model.pkl
```

Expected SHA-256:

```text
8a22c60268cb26fab39935cbd087c74568658db32da26f99f662559288d06ccc
```

The source repository intentionally does not store this binary model. See `ml/artifacts/README.md` for installation instructions.

## 2. Source of truth for inference

The uploaded final notebook defines the production path used by the artifact:

```text
Raw patient dataframe
       ↓
Advanced clinical feature engineering
       ↓
Exact feature-column ordering from artifact
       ↓
Fold-specific categorical mappings
       ↓
5 LightGBM probabilities + 5 XGBoost probabilities
       ↓
LogisticRegression stacking model
       ↓
ESI + probability distribution + confidence
```

`ml/model_runner.py` is the application runtime implementation of that same inference flow.

## 3. Feature contract

The artifact contains **52 prediction columns**. The runtime does not maintain a competing hard-coded list; it reads the canonical order from:

```python
artifacts["features"]
```

The feature set includes the raw clinical/context fields plus engineered values such as:

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

The application excludes identifiers and post-triage outcomes before inference. The uploaded training code removes columns such as `patient_id`, `site_id`, `triage_nurse_id`, timestamps, `disposition`, `ed_los_hours` and `triage_acuity` from the estimator input.

## 4. Important categorical handling

Each training fold stores its own categorical vocabularies under `cat_mappings`.

During inference the runtime:

1. loads the fold's categories;
2. converts missing values to `Missing`;
3. converts unknown values to `Unseen`;
4. recreates a pandas categorical column with the saved categories;
5. predicts with both base-model families.

This is required for consistency with the supplied artifact.

## 5. Evaluation supplied with the model

The uploaded training/test output reports:

```text
Overall test accuracy:                 86.15%
High-confidence accuracy (>= 75%):    92.54%
High-confidence coverage:             81.79%
High-confidence cases:              13087 / 16000
```

These figures are reported from the supplied experiment and should not be interpreted as clinical validation.

## 6. Dependencies

Install the versions required to load the persisted estimators:

```powershell
python -m pip install -r ml/requirements-inference.txt
```

The runtime requires:

```text
FastAPI
Uvicorn
joblib
pandas
NumPy
scikit-learn
XGBoost
LightGBM
```

The scikit-learn version is constrained around the version used when the artifact was created to reduce pickle compatibility problems.

## 7. Start the inference service

From the repository root:

```powershell
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Health endpoint:

```text
GET http://127.0.0.1:8000/health
```

A healthy service reports:

```json
{
  "ok": true,
  "model": "LightGBM + XGBoost Ensemble",
  "modelVersion": "triage-ensemble-v1",
  "featureCount": 52,
  "foldCount": 5
}
```

## 8. Prediction endpoint

```text
POST http://127.0.0.1:8000/predict
```

Request:

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

The service adds the remaining engineered features before calling the persisted estimator.

Response:

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

## 9. Node.js integration

The Node triage engine calls:

```text
${ML_INFERENCE_URL}/predict
```

By default:

```env
ML_INFERENCE_URL=http://127.0.0.1:8000
```

The model result is stored with the patient assessment so the application can distinguish:

```text
model recommendation
model confidence
model probabilities
model version
model source
```

The clinician still controls the final decision through **Accept** or **Override**.

## 10. Safety boundary

The final ensemble is not the only triage signal. The Node service applies its independent safety layer after model inference:

```text
Final ensemble
      ↓
Independent red flags
      ↓
Confidence / completeness
      ↓
Recommendation
      ↓
Clinician decision
```

This preserves immediate escalation, uncertainty handling and fail-open behavior even when the model is unavailable.

## 11. Fail-open behavior

When FastAPI is unavailable, times out or cannot load the artifact:

```text
Model unavailable
      ↓
Node catches inference failure
      ↓
Deterministic prototype scorer
      ↓
Workflow remains available
```

The response records the source so a model result is not silently confused with a fallback result.

## 12. Consistency verification

The supplied `triage_predictions_output.csv` was generated with the uploaded artifact and feature builder. Re-running the same inference logic locally reproduced the reference predictions and confidence values for the provided sample rows.

That confirms implementation consistency with the supplied artifact; it does not establish model quality or clinical validity.

## 13. Compatibility note

Pickle/joblib model artifacts depend on compatible Python and ML-library versions. The supplied artifact was created with a scikit-learn 1.6.1 environment. Keep the inference environment pinned and avoid silently upgrading model-runtime dependencies.

If loading fails after dependency changes, restore the documented versions or deliberately rebuild/export the model with the new environment.

## 14. Training code

`ml/train_xgboost.py` is retained from the earlier prototype pipeline for reference. It is **not** the source of truth for the supplied `triage_ensemble_model.pkl` artifact.

For the final application integration, the source of truth is:

```text
Train_Model_Code.ipynb
triage_ensemble_model.pkl
triage_predictions_output.csv
```

and the executable runtime translation is:

```text
ml/model_runner.py
ml/inference_service.py
```

## 15. Production work still required

Before a real deployment, this prototype would require clinical validation, temporal and external validation, probability calibration, subgroup/fairness analysis, model governance, secure model distribution, monitoring, change control, human-factors review and any applicable regulatory assessment.
