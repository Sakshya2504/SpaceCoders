"""Small FastAPI inference service for the trained XGBoost triage model.

The service deliberately has one narrow responsibility: receive a patient feature
object with the same column names used during training, run the persisted pipeline,
and return ESI probabilities. Safety rules, clinician overrides, audit logging and
fail-open behavior stay in the Node application.

This is a prototype integration. The model is not a medical device and must not be
used for unsupervised clinical decision-making.
"""

from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "triage_xgb_pipeline.joblib"

FEATURE_COLUMNS = [
    "site_id",
    "triage_nurse_id",
    "arrival_mode",
    "arrival_hour",
    "arrival_day",
    "arrival_month",
    "arrival_season",
    "shift",
    "age",
    "age_group",
    "sex",
    "language",
    "insurance_type",
    "transport_origin",
    "pain_location",
    "mental_status_triage",
    "chief_complaint_system",
    "num_prior_ed_visits_12m",
    "num_prior_admissions_12m",
    "num_active_medications",
    "num_comorbidities",
    "systolic_bp",
    "diastolic_bp",
    "mean_arterial_pressure",
    "pulse_pressure",
    "heart_rate",
    "respiratory_rate",
    "temperature_c",
    "spo2",
    "gcs_total",
    "pain_score",
    "weight_kg",
    "height_cm",
    "bmi",
    "shock_index",
    "news2_score",
]

app = FastAPI(title="PatientTriage.ai XGBoost Inference", version="1.0.0")

_model = None


class PredictionRequest(BaseModel):
    """Request body that mirrors the model's training feature contract."""

    features: dict[str, Any] = Field(default_factory=dict)


def get_model():
    """Load the pipeline once and reuse it for subsequent requests."""
    global _model

    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model artifact not found at {MODEL_PATH}. "
                "Train the model first with ml/train_xgboost.py."
            )
        _model = joblib.load(MODEL_PATH)

    return _model


@app.get("/health")
def health():
    """Report whether the persisted model can be loaded."""
    try:
        get_model()
        return {"ok": True, "model": "XGBoost", "modelVersion": "xgboost-multiclass-v1"}
    except Exception as exc:  # pragma: no cover - startup environment dependent
        return {"ok": False, "model": "XGBoost", "error": str(exc)}


@app.post("/predict")
def predict(request: PredictionRequest):
    """Return class probabilities and the highest-probability ESI class."""
    missing = [column for column in FEATURE_COLUMNS if column not in request.features]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={"message": "Missing model features", "fields": missing},
        )

    try:
        model = get_model()
        frame = pd.DataFrame([{column: request.features.get(column) for column in FEATURE_COLUMNS}])
        probabilities = model.predict_proba(frame)[0].tolist()
        predicted_index = max(range(len(probabilities)), key=probabilities.__getitem__)

        return {
            "model": "XGBoost",
            "modelVersion": "xgboost-multiclass-v1",
            "esi": predicted_index + 1,
            "probabilities": {
                f"ESI {index + 1}": round(float(probability), 6)
                for index, probability in enumerate(probabilities)
            },
            "confidence": round(float(max(probabilities)) * 100, 2),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"message": "Inference failed", "error": str(exc)}) from exc
