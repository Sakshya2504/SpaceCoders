# XGBoost Triage-Acuity Pipeline

This folder contains the machine-learning pipeline for the Round 2 prototype. The attached reference dataset contains 80,000 rows and 40 columns, with `triage_acuity` as the 5-class target (ESI 1–5).

## Why XGBoost

XGBoost was selected for the prototype because the data mixes numeric bedside measurements with categorical operational/context fields, contains missing values, and includes nonlinear clinical relationships. The model is wrapped in a scikit-learn `Pipeline` so preprocessing and inference stay coupled.

## Leakage control

The training pipeline removes:

- `patient_id` — unique identifier.
- `disposition` — downstream outcome after the triage decision.
- `ed_los_hours` — downstream outcome that can leak post-triage information.
- `triage_acuity` — target itself.

Missing numeric values use median imputation. Missing categorical values use most-frequent imputation. Categorical variables are one-hot encoded with `handle_unknown='ignore'`.

## Model configuration

- Objective: `multi:softprob`
- Classes: 5
- Estimators: 300
- Max depth: 6
- Learning rate: 0.08
- Subsample: 0.85
- Column sampling: 0.85
- Regularization: L2 (`reg_lambda=2`)
- Tree method: histogram
- Random state: 42

## Reproduce the training run

```bash
pip install -r ml/requirements.txt
python ml/train_xgboost.py --data path/to/train.csv
```

The command creates `ml/artifacts/` locally with:

```text
triage_xgb_pipeline.joblib
metrics.json
confusion_matrix.csv
feature_importance.csv
```

The trained binary model is intentionally generated locally instead of committed to source control.

## Result on the attached `train.csv`

Using an 80/20 stratified split (64,000 train / 16,000 test), the trained XGBoost pipeline achieved:

| Metric | Result |
|---|---:|
| Accuracy | 85.26% |
| Balanced accuracy | 86.72% |
| Macro F1 | 86.95% |
| Weighted F1 | 85.31% |

Per-class F1:

| Class | F1 |
|---|---:|
| ESI 1 | 94.47% |
| ESI 2 | 97.27% |
| ESI 3 | 88.67% |
| ESI 4 | 76.55% |
| ESI 5 | 77.77% |

The strongest global model features in this run were `news2_score`, `gcs_total`, `pain_score`, mental-status indicators, `spo2`, prior ED visits, temperature, respiratory rate, and heart rate.

These metrics are dataset-level prototype results, not clinical validation. The model should remain decision support with explicit clinician override/fail-open behavior.
