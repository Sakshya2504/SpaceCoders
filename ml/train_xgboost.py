"""Train and evaluate the PatientTriage ESI classifier.

Usage:
    python ml/train_xgboost.py --data path/to/train.csv

The script intentionally excludes post-triage outcomes (disposition and ED LOS)
and the unique patient identifier to avoid obvious target leakage.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

TARGET = "triage_acuity"
DROP_COLUMNS = ["patient_id", "disposition", "ed_los_hours", TARGET]
CLASS_NAMES = ["ESI 1", "ESI 2", "ESI 3", "ESI 4", "ESI 5"]
RANDOM_STATE = 42


def build_pipeline(X: pd.DataFrame) -> Pipeline:
    categorical = X.select_dtypes(include=["object"]).columns.tolist()
    numeric = X.select_dtypes(exclude=["object"]).columns.tolist()

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline([("imputer", SimpleImputer(strategy="median"))]),
                numeric,
            ),
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "onehot",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=True),
                        ),
                    ]
                ),
                categorical,
            ),
        ]
    )

    model = XGBClassifier(
        objective="multi:softprob",
        num_class=5,
        n_estimators=300,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=2.0,
        min_child_weight=2,
        eval_metric="mlogloss",
        tree_method="hist",
        random_state=RANDOM_STATE,
        n_jobs=4,
    )

    return Pipeline([(\"preprocess\", preprocessor), (\"model\", model)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Path to train.csv")
    parser.add_argument(
        "--output-dir", default="ml/artifacts", help="Directory for model artifacts"
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.data)
    if TARGET not in df.columns:
        raise ValueError(f"Missing target column: {TARGET}")

    X = df.drop(columns=DROP_COLUMNS)
    y = df[TARGET].astype(int) - 1

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=RANDOM_STATE
    )

    pipeline = build_pipeline(X_train)
    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test).astype(int)
    probabilities = pipeline.predict_proba(X_test)

    metrics = {
        "model": "XGBoost",
        "version": "xgboost-multiclass-v1",
        "dataset_rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "target": TARGET,
        "excluded_columns": DROP_COLUMNS,
        "accuracy": float(accuracy_score(y_test, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, predictions)),
        "macro_f1": float(f1_score(y_test, predictions, average="macro")),
        "weighted_f1": float(f1_score(y_test, predictions, average="weighted")),
        "classification_report": classification_report(
            y_test, predictions, target_names=CLASS_NAMES, output_dict=True
        ),
        "confusion_matrix": confusion_matrix(y_test, predictions).tolist(),
    }

    preprocessor = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]
    feature_names = preprocessor.get_feature_names_out()
    importances = model.feature_importances_
    order = np.argsort(importances)[::-1]
    top_features = [
        {
            "feature": str(feature_names[i]),
            "importance": float(importances[i]),
        }
        for i in order[:30]
        if importances[i] > 0
    ]
    metrics["top_features"] = top_features

    joblib.dump(pipeline, output_dir / "triage_xgb_pipeline.joblib", compress=3)
    (output_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )
    pd.DataFrame(
        confusion_matrix(y_test, predictions), index=CLASS_NAMES, columns=CLASS_NAMES
    ).to_csv(output_dir / "confusion_matrix.csv")
    pd.DataFrame(top_features).to_csv(output_dir / "feature_importance.csv", index=False)

    print(json.dumps({
        "accuracy": metrics["accuracy"],
        "balanced_accuracy": metrics["balanced_accuracy"],
        "macro_f1": metrics["macro_f1"],
        "weighted_f1": metrics["weighted_f1"],
        "artifacts": str(output_dir.resolve()),
    }, indent=2))


if __name__ == "__main__":
    main()
