"""FastAPI wrapper around the final persisted triage ensemble.

The service receives the raw patient feature object from the Node API and uses
``model_runner.py`` to reproduce the exact feature engineering and five-fold
LightGBM + XGBoost stacking inference from the supplied notebook.

Safety logic, authorization, clinician decisions, queue monitoring and audit
logging remain in the Node service. This keeps the Python process focused on
model inference and allows the Node application to fail open when the service
is unavailable.

Prototype notice: the supplied model was trained on synthetic data and is not
clinically validated or intended for unsupervised patient care.
"""

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .model_runner import MODEL, MODEL_NAME, MODEL_VERSION

app = FastAPI(
    title="PatientTriage.ai Final Triage Ensemble",
    version="1.1.0",
)


class PredictionRequest(BaseModel):
    """Raw patient feature payload received from the Node application."""

    features: dict[str, Any] = Field(default_factory=dict)


@app.get("/health")
def health() -> dict[str, Any]:
    """Confirm that the final model artifact can be loaded successfully."""
    try:
        MODEL.load()
        return {
            "ok": True,
            "model": MODEL_NAME,
            "modelVersion": MODEL_VERSION,
            "featureCount": len(MODEL.features),
            "foldCount": len(MODEL.artifacts["lgb_models"]),
        }
    except Exception as exc:  # pragma: no cover - environment dependent
        return {
            "ok": False,
            "model": MODEL_NAME,
            "modelVersion": MODEL_VERSION,
            "error": str(exc),
        }


@app.post("/predict")
def predict(request: PredictionRequest) -> dict[str, Any]:
    """Return the final ensemble's ESI prediction and class probabilities."""
    if not request.features:
        raise HTTPException(
            status_code=422,
            detail={"message": "features must contain a patient feature object"},
        )

    try:
        return MODEL.predict_one(request.features)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail={"message": str(exc)}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc)}) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": "Final ensemble inference failed", "error": str(exc)},
        ) from exc
