"""Runtime wrapper for the supplied final triage ensemble.

The uploaded ``triage_ensemble_model.pkl`` contains five LightGBM models,
five XGBoost models, their fold-specific categorical mappings, and a
LogisticRegression stacking model. This module reproduces the feature
engineering and fold-by-fold inference from the supplied notebook.

Prototype notice: the model was trained on synthetic data and is not
clinically validated or intended for unsupervised patient care.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

MODEL_PATH = (
    Path(__file__).resolve().parent
    / "artifacts"
    / "triage_ensemble_model.pkl"
)

MODEL_NAME = "LightGBM + XGBoost Ensemble"
MODEL_VERSION = "triage-ensemble-v1"


def build_advanced_clinical_features(df_in: pd.DataFrame) -> pd.DataFrame:
    """Reproduce the feature engineering used by the supplied model."""
    df_out = df_in.copy()

    # The training pipeline derives a rolling two-hour arrival volume feature.
    # For a single live request, the caller may supply a precomputed value.
    if "arrival_time" in df_out.columns:
        df_out["arrival_time"] = pd.to_datetime(
            df_out["arrival_time"], errors="coerce"
        )
        df_out = df_out.sort_values("arrival_time")
        df_temp = df_out.set_index("arrival_time")
        df_out["ed_volume_last_2h"] = (
            df_temp.index.to_series().rolling("2h").count().values
        )
        df_out = df_out.sort_index()
    else:
        df_out["ed_volume_last_2h"] = df_out.get(
            "ed_volume_last_2h",
            pd.Series(0, index=df_out.index),
        )

    # Hemodynamic and respiratory indices.
    if "heart_rate" in df_out.columns and "systolic_bp" in df_out.columns:
        df_out["shock_index"] = df_out["heart_rate"] / (
            df_out["systolic_bp"] + 1e-5
        )

    if "systolic_bp" in df_out.columns and "diastolic_bp" in df_out.columns:
        df_out["pulse_pressure"] = (
            df_out["systolic_bp"] - df_out["diastolic_bp"]
        )
        df_out["mean_arterial_pressure"] = (
            df_out["diastolic_bp"] + df_out["pulse_pressure"] / 3.0
        )

    if "respiratory_rate" in df_out.columns and "spo2" in df_out.columns:
        df_out["rox_index"] = df_out["spo2"] / (
            df_out["respiratory_rate"] + 1e-5
        )

    if "height_cm" in df_out.columns and "weight_kg" in df_out.columns:
        height = np.maximum(0, df_out["height_cm"])
        weight = np.maximum(0, df_out["weight_kg"])
        df_out["bsa"] = np.sqrt((height * weight) / 3600.0)
        df_out["bmi"] = df_out["weight_kg"] / (
            ((df_out["height_cm"] / 100.0) ** 2) + 1e-5
        )

    # Baseline-deviation features.
    if "heart_rate" in df_out.columns:
        df_out["hr_dev"] = np.abs(df_out["heart_rate"] - 80)
    if "systolic_bp" in df_out.columns:
        df_out["sys_bp_dev"] = np.abs(df_out["systolic_bp"] - 120)
    if "temperature_c" in df_out.columns:
        df_out["temp_dev"] = np.abs(df_out["temperature_c"] - 37.0)
    if "spo2" in df_out.columns:
        df_out["spo2_deficit"] = np.maximum(0, 98.0 - df_out["spo2"])

    if all(
        column in df_out.columns
        for column in ["hr_dev", "sys_bp_dev", "temp_dev"]
    ):
        df_out["composite_vital_deviation"] = (
            df_out["hr_dev"]
            + df_out["sys_bp_dev"]
            + (df_out["temp_dev"] * 10.0)
        )

    # SIRS-style features.
    temperature = df_out.get(
        "temperature_c", pd.Series(37.0, index=df_out.index)
    )
    heart_rate = df_out.get(
        "heart_rate", pd.Series(80, index=df_out.index)
    )
    respiratory_rate = df_out.get(
        "respiratory_rate", pd.Series(16, index=df_out.index)
    )

    sirs_temp = ((temperature > 38.0) | (temperature < 36.0)).astype(int)
    sirs_hr = (heart_rate > 90).astype(int)
    sirs_rr = (respiratory_rate > 20).astype(int)
    df_out["sirs_score"] = sirs_temp + sirs_hr + sirs_rr

    if "age" in df_out.columns:
        if "shock_index" in df_out.columns:
            df_out["age_shock_risk"] = df_out["age"] * df_out["shock_index"]
        df_out["age_sirs_risk"] = df_out["age"] * df_out["sirs_score"]

    # Basic red-flag features used by the trained ensemble.
    spo2 = df_out.get("spo2", pd.Series(100, index=df_out.index))
    heart_rate = df_out.get("heart_rate", pd.Series(80, index=df_out.index))
    systolic_bp = df_out.get(
        "systolic_bp", pd.Series(120, index=df_out.index)
    )
    temperature = df_out.get(
        "temperature_c", pd.Series(37.0, index=df_out.index)
    )

    df_out["flag_hypoxia"] = (spo2 < 92).astype(int)
    df_out["flag_tachycardia"] = (heart_rate > 110).astype(int)
    df_out["flag_hypotension"] = (systolic_bp < 90).astype(int)
    df_out["flag_fever"] = (temperature > 38.0).astype(int)

    flag_columns = [
        column
        for column in df_out.columns
        if column.startswith("flag_")
    ]
    df_out["total_red_flags"] = df_out[flag_columns].sum(axis=1)

    if "arrival_hour" in df_out.columns:
        df_out["hour_sin"] = np.sin(
            2 * np.pi * df_out["arrival_hour"] / 24.0
        )
        df_out["hour_cos"] = np.cos(
            2 * np.pi * df_out["arrival_hour"] / 24.0
        )

    # Remove identifiers, timestamps, and post-triage outcomes before inference.
    post_triage_leaks = [
        "disposition",
        "ed_los_hours",
        "triage_acuity",
        "length_of_stay",
        "admit_time",
        "discharge_time",
        "icu_admission",
        "mortality",
    ]
    dynamic_leaks = [
        column
        for column in df_out.columns
        if column.endswith("_id")
        or "time" in column.lower()
        or "date" in column.lower()
    ]

    return df_out.drop(
        columns=set(post_triage_leaks + dynamic_leaks),
        errors="ignore",
    )


class FinalTriageEnsemble:
    """Lazy-loading wrapper around the supplied persisted ensemble."""

    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        self.model_path = Path(model_path)
        self.artifacts: dict[str, Any] | None = None

    def load(self) -> None:
        """Load and validate the saved ensemble artifact exactly once."""
        if self.artifacts is not None:
            return

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Model artifact not found at {self.model_path}. "
                "Copy triage_ensemble_model.pkl into ml/artifacts/."
            )

        artifacts = joblib.load(self.model_path)
        required = {
            "lgb_models",
            "xgb_models",
            "cat_mappings",
            "features",
            "meta_model",
        }
        missing = required.difference(artifacts.keys())
        if missing:
            raise ValueError(
                "Invalid ensemble artifact; missing: "
                + ", ".join(sorted(missing))
            )

        fold_count = len(artifacts["lgb_models"])
        if not (
            fold_count == len(artifacts["xgb_models"])
            == len(artifacts["cat_mappings"])
        ):
            raise ValueError("Ensemble fold counts do not match.")

        self.artifacts = artifacts

    @property
    def features(self) -> list[str]:
        """Return the exact feature order embedded in the artifact."""
        self.load()
        assert self.artifacts is not None
        return list(self.artifacts["features"])

    def predict_one(self, raw_features: dict[str, Any]) -> dict[str, Any]:
        """Run the supplied five-fold ensemble for one patient."""
        self.load()
        assert self.artifacts is not None

        frame = pd.DataFrame([raw_features])
        engineered = build_advanced_clinical_features(frame)

        # The saved estimators expect exactly the same 52-column order used at
        # training time. Missing numeric values remain NaN for model handling.
        for column in set(self.features).difference(engineered.columns):
            engineered[column] = np.nan
        engineered = engineered[self.features]

        n_splits = len(self.artifacts["lgb_models"])
        n_classes = self.artifacts["meta_model"].classes_.shape[0]
        lgb_probabilities = np.zeros((1, n_classes))
        xgb_probabilities = np.zeros((1, n_classes))

        for fold in range(n_splits):
            fold_frame = engineered.copy()
            fold_categories = self.artifacts["cat_mappings"][fold]

            # Use the exact categorical vocabulary captured by that fold.
            for column, categories in fold_categories.items():
                values = fold_frame[column].astype(str).fillna("Missing")
                values = values.where(
                    values.isin(categories),
                    "Unseen",
                )
                fold_frame[column] = pd.Categorical(
                    values,
                    categories=categories,
                )

            lgb_probabilities += (
                self.artifacts["lgb_models"][fold].predict_proba(fold_frame)
                / n_splits
            )
            xgb_probabilities += (
                self.artifacts["xgb_models"][fold].predict_proba(fold_frame)
                / n_splits
            )

        # Stack the base-model probabilities and let the trained meta-model
        # produce the final normalized class probabilities.
        stacked = np.hstack([lgb_probabilities, xgb_probabilities])
        probabilities = self.artifacts["meta_model"].predict_proba(stacked)[0]
        classes = self.artifacts["meta_model"].classes_
        predicted_index = int(np.argmax(probabilities))
        predicted_esi = int(classes[predicted_index]) + 1
        confidence = float(probabilities[predicted_index] * 100.0)

        return {
            "model": MODEL_NAME,
            "modelVersion": MODEL_VERSION,
            "esi": predicted_esi,
            "confidence": round(confidence, 2),
            "probabilities": {
                f"ESI {int(label) + 1}": round(float(probability), 6)
                for label, probability in zip(classes, probabilities)
            },
        }


MODEL = FinalTriageEnsemble()
