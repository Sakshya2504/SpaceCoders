# XGBoost inference service

The MERN application can optionally call the trained XGBoost pipeline through the small FastAPI service in `ml/inference_service.py`.

## First-time setup

From the repository root:

```bash
python -m pip install -r ml/requirements-inference.txt
python ml/train_xgboost.py --data path/to/train.csv
```

Then start the service:

```bash
uvicorn ml.inference_service:app --host 127.0.0.1 --port 8000
```

The service exposes:

- `GET /health` — model availability.
- `POST /predict` — XGBoost ESI probabilities and predicted class.

The Node API uses `ML_INFERENCE_URL=http://127.0.0.1:8000` by default. If the model service is unavailable, the Node triage engine uses its documented prototype scorer and records the model source accordingly; a model outage therefore does not block the clinical workflow.

The model service expects the exact 36 feature columns produced from the intake form. Training and inference share the same scikit-learn preprocessing pipeline, including numeric imputation and categorical one-hot encoding.
