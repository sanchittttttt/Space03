import os
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from train_esa_subset import rolling_features


MODEL_DIR = Path(os.getenv(
    "ESA_MODEL_DIR", "artifacts/esa_isolation_forest/models"))

app = FastAPI(
    title="ESA Telemetry Anomaly API",
    version="1.0.0",
    description="Score ESA telemetry windows with trained Isolation Forest models.",
)


class PredictionRequest(BaseModel):
    telemetry: list[float] = Field(min_length=1, max_length=4096)

    @field_validator("telemetry")
    @classmethod
    def require_finite_values(cls, values):
        if not all(np.isfinite(value) for value in values):
            raise ValueError("telemetry values must be finite")
        return values


class PredictionResponse(BaseModel):
    channel: str
    is_anomaly: bool
    anomaly_score: float
    threshold: float
    window_size: int


@lru_cache(maxsize=64)
def load_channel_model(channel_id: int):
    model_path = MODEL_DIR / "channel_{}.joblib".format(channel_id)
    if not model_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="No trained model is available for channel_{}".format(
                channel_id),
        )

    artifact = joblib.load(model_path)
    required_keys = {"model", "threshold", "window_size", "channel"}
    if not isinstance(artifact, dict) or not required_keys.issubset(artifact):
        raise HTTPException(
            status_code=500,
            detail="Invalid model artifact for channel_{}".format(channel_id),
        )
    return artifact


@app.get("/health")
def health():
    available_channels = sorted(
        path.stem.removeprefix("channel_")
        for path in MODEL_DIR.glob("channel_*.joblib")
    ) if MODEL_DIR.is_dir() else []
    return {
        "status": "ok" if available_channels else "models_unavailable",
        "available_channels": available_channels,
    }


@app.get("/channels")
def channels():
    return {"channels": health()["available_channels"]}


@app.post("/predict/{channel_id}", response_model=PredictionResponse)
def predict(channel_id: int, request: PredictionRequest):
    artifact = load_channel_model(channel_id)
    window_size = int(artifact["window_size"])
    if len(request.telemetry) < window_size:
        raise HTTPException(
            status_code=422,
            detail="At least {} telemetry values are required".format(
                window_size),
        )

    values = np.asarray(request.telemetry[-window_size:], dtype=np.float64)
    features, _, _ = rolling_features(values, window_size)
    anomaly_score = float(artifact["model"].score_samples(features[-1:])[0])
    threshold = float(artifact["threshold"])
    return PredictionResponse(
        channel=artifact["channel"],
        is_anomaly=anomaly_score < threshold,
        anomaly_score=anomaly_score,
        threshold=threshold,
        window_size=window_size,
    )