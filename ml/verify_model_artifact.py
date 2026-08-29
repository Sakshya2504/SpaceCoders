"""Verify that the supplied final ensemble artifact is installed correctly.

Run this after copying ``triage_ensemble_model.pkl`` into ``ml/artifacts/``.
The script validates the artifact structure and can optionally compare model
outputs with the supplied prediction CSV.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from model_runner import MODEL, MODEL_NAME, MODEL_VERSION


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--predictions",
        type=Path,
        help="Optional triage_predictions_output.csv for a reference-output check.",
    )
    args = parser.parse_args()

    MODEL.load()

    print(f"Model: {MODEL_NAME}")
    print(f"Version: {MODEL_VERSION}")
    print(f"Feature count: {len(MODEL.features)}")
    print(f"Fold count: {len(MODEL.artifacts['lgb_models'])}")
    print("Artifact structure: PASS")

    if args.predictions:
        reference = pd.read_csv(args.predictions)
        required = {"predicted_acuity", "model_confidence_pct"}
        missing = required.difference(reference.columns)
        if missing:
            raise ValueError(
                "Reference CSV is missing columns: "
                + ", ".join(sorted(missing))
            )

        # Use the first reference row as an end-to-end consistency check.
        raw = reference.drop(
            columns=["predicted_acuity", "model_confidence_pct"],
            errors="ignore",
        ).iloc[0].to_dict()
        result = MODEL.predict_one(raw)

        expected_esi = int(reference.iloc[0]["predicted_acuity"])
        expected_confidence = float(reference.iloc[0]["model_confidence_pct"])

        if result["esi"] != expected_esi:
            raise AssertionError(
                f"Reference ESI mismatch: {result['esi']} != {expected_esi}"
            )

        if abs(result["confidence"] - expected_confidence) > 0.01:
            raise AssertionError(
                "Reference confidence mismatch: "
                f"{result['confidence']} != {expected_confidence}"
            )

        print("Reference prediction check: PASS")
        print(
            f"First row → ESI {result['esi']} at "
            f"{result['confidence']:.2f}% confidence"
        )


if __name__ == "__main__":
    main()
