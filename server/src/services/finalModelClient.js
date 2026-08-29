const DEFAULT_INFERENCE_URL = 'http://127.0.0.1:8000';
const MODEL_NAME = 'LightGBM + XGBoost Ensemble';
const MODEL_VERSION = 'triage-ensemble-v1';

/**
 * Thin client for the Python service that loads the user's supplied model
 * artifact. Keeping the HTTP call here makes the model boundary obvious and
 * prevents model-specific networking details from leaking into triage rules.
 */
export async function requestFinalModelPrediction(features) {
  const baseUrl = process.env.ML_INFERENCE_URL || DEFAULT_INFERENCE_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`${baseUrl}/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ features }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Final model service returned HTTP ${response.status}`);
    }

    const prediction = await response.json();

    if (!Number.isFinite(Number(prediction.esi))) {
      throw new Error('Final model service returned an invalid ESI prediction.');
    }

    // The Python service is the source of truth for model identity. These checks
    // make it difficult to accidentally connect the app to a different model.
    if (prediction.model !== MODEL_NAME || prediction.modelVersion !== MODEL_VERSION) {
      throw new Error(
        `Unexpected model response: ${prediction.model || 'unknown'} / ${prediction.modelVersion || 'unknown'}`
      );
    }

    return prediction;
  } finally {
    clearTimeout(timeout);
  }
}

export { MODEL_NAME, MODEL_VERSION };
