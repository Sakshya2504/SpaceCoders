# XGBoost Triage-Acuity Pipeline

This folder contains the reproducible machine-learning pipeline used to explore `triage_acuity` prediction from the attached reference dataset.

## Reference dataset

`train.csv` contains 80,000 rows and 40 columns.

The target is:

```text
triage_acuity
```

with classes 1–5.

### Full dataset schema

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

## Leakage control

The model excludes four columns:

- `patient_id` — unique identifier.
- `disposition` — post-triage outcome.
- `ed_los_hours` — post-triage outcome.
- `triage_acuity` — target.

The remaining columns are model inputs.

## Why XGBoost

XGBoost is a practical fit for this prototype because the data combines numeric and categorical features, contains missing clinical measurements, and can contain nonlinear relationships. The model is wrapped in a scikit-learn `Pipeline` so preprocessing and inference stay together.

## Preprocessing

Numeric columns use median imputation.
Categorical columns use most-frequent imputation and one-hot encoding with unknown-category handling.

## Model configuration

- Objective: `multi:softprob`
- Classes: 5
- Estimators: 300
- Max depth: 6
- Learning rate: 0.08
- Subsample: 0.85
- Column sampling: 0.85
- L2 regularization: 2.0
- Tree method: histogram
- Random state: 42

## Reproduce

```bash
pip install -r ml/requirements.txt
python ml/train_xgboost.py --data path/to/train.csv
```

Artifacts are written to `ml/artifacts/`:

```text
triage_xgb_pipeline.joblib
metrics.json
confusion_matrix.csv
feature_importance.csv
```

The trained binary artifact is intentionally not committed to source control.

## Dataset-aligned frontend contract

The Patient Intake page stores `modelFeatures` with the same names as the training columns. The application generates `patient_id` and derives time context and arithmetic features such as:

- `arrival_hour`
- `arrival_day`
- `arrival_month`
- `arrival_season`
- `shift`
- `age_group`
- `mean_arterial_pressure`
- `pulse_pressure`
- `bmi`
- `shock_index`

This avoids asking an operator to manually calculate values that can be derived from entered measurements.

## Prototype result

Using an 80/20 stratified split (64,000 train / 16,000 test), the recorded run achieved:

| Metric | Result |
|---|---:|
| Accuracy | 85.26% |
| Balanced accuracy | 86.72% |
| Macro F1 | 86.95% |
| Weighted F1 | 85.31% |

These are dataset-level prototype metrics, not clinical validation.

## Safety note

The model is decision support only. Clinical thresholds, labels and recommendations require clinical validation before any real-world use.
