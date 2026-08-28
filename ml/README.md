# XGBoost Triage-Acuity Pipeline

This directory contains the reproducible training and inference components for the PatientTriage.ai prototype.

The machine-learning workflow uses the supplied `train.csv` reference dataset to predict `triage_acuity` classes 1–5. The trained model is used as decision-support evidence; it is not a clinically validated triage system.

## 1. Reference dataset

The supplied dataset contains:

```text
Rows:    80,000
Columns: 40
Target:  triage_acuity
Classes: 1, 2, 3, 4, 5
```

### Dataset columns

```text
patient_id
site_id
triage_nurse_id
arrival_mode
arrival_hour
arrival_day
arrival_month
arrival_season
shift
age
age_group
sex
language
insurance_type
transport_origin
pain_location
mental_status_triage
chief_complaint_system
num_prior_ed_visits_12m
num_prior_admissions_12m
num_active_medications
num_comorbidities
systolic_bp
diastolic_bp
mean_arterial_pressure
pulse_pressure
heart_rate
respiratory_rate
temperature_c
spo2
gcs_total
pain_score
weight_kg
height_cm
bmi
shock_index
news2_score
disposition
ed_los_hours
triage_acuity
```

## 2. Leakage control

The training script deliberately removes four fields before fitting the model:

| Column | Treatment | Reason |
|---|---|---|
| `patient_id` | Excluded | Identifier only. |
| `disposition` | Excluded | Outcome generated after/around the triage process. |
| `ed_los_hours` | Excluded | Post-triage outcome with leakage risk. |
| `triage_acuity` | Target | This is what the model predicts. |

This leaves 36 feature columns for model inference.

## 3. Preprocessing

The training script keeps preprocessing inside the same scikit-learn pipeline as the classifier so training and inference use identical transformations.

### Numeric features

- Missing values are median-imputed.

### Categorical features

- Missing values are filled with the most frequent category.
- Categories are one-hot encoded.
- Unknown categories encountered during inference are ignored rather than causing a crash.

The persisted `joblib` artifact therefore contains both preprocessing and the XGBoost model.

## 4. Model choice

The prototype uses XGBoost as a five-class classifier.

The dataset contains a mixture of numeric and categorical variables and can contain nonlinear relationships among clinical and contextual features. XGBoost provides a practical tree-based baseline while keeping the inference API straightforward.

## 5. Model configuration

Current training configuration:

```text
Objective:           multi:softprob
Number of classes:   5
Estimators:          300
Max depth:           6
Learning rate:       0.08
Subsample:           0.85
Column sampling:     0.85
L2 regularization:   2.0
Tree method:         histogram
Random state:        42
```

The exact values are prototype settings and are not presented as optimal clinical-model parameters.

## 6. Train the model

From the repository root:

```bash
python -m pip install -r ml/requirements.txt
python ml/train_xgboost.py --data train.csv
```

The script should create the following artifacts under `ml/artifacts/`:

```text
triage_xgb_pipeline.joblib
metrics.json
confusion_matrix.csv
feature_importance.csv
```

The binary model artifact is ignored by Git and should be generated locally from the reference dataset.

## 7. Recorded prototype evaluation

The recorded experiment used an 80/20 stratified split:

```text
Training set: 64,000
Test set:      16,000
```

Recorded metrics:

| Metric | Result |
|---|---:|
| Accuracy | 85.26% |
| Balanced accuracy | 86.72% |
| Macro F1 | 86.95% |
| Weighted F1 | 85.31% |

Per-class results from the recorded run:

| ESI class | Precision | Recall | F1 |
|---|---:|---:|---:|
| 1 | 96.14% | 92.86% | 94.47% |
| 2 | 97.25% | 97.28% | 97.27% |
| 3 | 89.49% | 87.86% | 88.67% |
| 4 | 75.75% | 77.37% | 76.55% |
| 5 | 77.30% | 78.25% | 77.77% |

These figures describe the supplied dataset experiment only. They do not establish clinical accuracy, safety or generalization to another institution.

## 8. Feature importance

The recorded model run highlighted features such as:

```text
news2_score
gcs_total
pain_score
mental_status_triage
spo2
num_prior_ed_visits_12m
temperature_c
respiratory_rate
heart_rate
mean_arterial_pressure
```

Feature importance is model evidence, not a causal explanation of patient risk.

## 9. Dataset-aligned application contract

The React Patient Intake page captures the feature families needed by the model and stores them under `modelFeatures`.

Derived values include:

```text
age_group
arrival_hour
arrival_day
arrival_month
arrival_season
shift
mean_arterial_pressure
pulse_pressure
bmi
shock_index
```

The application generates the patient identifier rather than asking staff to enter `patient_id` manually.

## 10. Inference service

`ml/inference_service.py` wraps the persisted pipeline in a small FastAPI application.

Start it with:

```bash
python -m pip install -r ml/requirements-inference.txt
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

Endpoints:

```text
GET  /health
POST /predict
```

`POST /predict` expects all 36 model feature columns. It returns:

```text
model
modelVersion
esi
probabilities
confidence
```

## 11. Runtime safety boundary

The Node application calls the inference service through `scorePatient()` when it is available.

The result is then subject to application-level safety logic:

```text
XGBoost evidence
      ↓
Independent red-flag detectors
      ↓
Confidence / completeness checks
      ↓
Final recommendation state
```

Possible application actions include:

```text
AUTO_CONTEXT
IMMEDIATE_ESCALATION
ABSTAIN_AND_ESCALATE
FAIL_OPEN
```

The model itself does not write the final clinician decision.

## 12. Inference failure

The Python service is deliberately not a single point of failure for the Node workflow.

If the service is offline, times out or rejects inference, the Node application can use the deterministic prototype scorer and expose the recommendation source for traceability.

This architecture keeps model availability separate from core workflow availability.

## 13. Future model governance

Before a real deployment, the training process should be expanded to include:

- clinical validation;
- probability calibration;
- subgroup and bias analysis;
- temporal validation;
- drift monitoring;
- model registry/versioning;
- reproducibility metadata;
- approval/change-control workflow;
- SHAP or another validated explanation layer where appropriate.

## 14. Safety notice

This XGBoost pipeline is a technical prototype trained on synthetic/reference data. It must not be used to make unsupervised medical decisions.
