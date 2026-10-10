import os
from functools import lru_cache
from datetime import datetime, timezone
from pathlib import Path
import zipfile

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator

from rag import (answer_question, generate_summary, retrieve_knowledge,
                 retrieve_references)
from train_esa_subset import rolling_features


ROOT = Path(__file__).resolve().parent
MODEL_DIR = Path(os.getenv(
    "ESA_MODEL_DIR", str(ROOT / "artifacts/esa_isolation_forest/models")))
DATA_DIR = Path(os.getenv(
    "ESA_DATA_DIR",
    str(ROOT / "datasets/esa-anomaly-dataset/data/mission1-subset/ESA-Mission1")))

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="ESA Telemetry Anomaly API",
    version="1.0.0",
    description="Score ESA telemetry windows with trained Isolation Forest models.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class StructuredReportRequest(BaseModel):
    telemetry: list[float] | None = Field(default=None, min_length=1,
                                          max_length=4096)
    timestamps: list[datetime] | None = Field(default=None, max_length=4096)

    @model_validator(mode="after")
    def validate_timestamps(self):
        if self.timestamps is not None and self.telemetry is None:
            raise ValueError("timestamps require telemetry values")
        if self.telemetry is not None and not all(
                np.isfinite(value) for value in self.telemetry):
            raise ValueError("telemetry values must be finite")
        if self.timestamps is not None:
            if len(self.timestamps) != len(self.telemetry):
                raise ValueError(
                    "timestamps and telemetry must have the same length")
            if any(timestamp.tzinfo is None for timestamp in self.timestamps):
                raise ValueError("timestamps must include a timezone")
            if any(left >= right for left, right in
                   zip(self.timestamps, self.timestamps[1:])):
                raise ValueError("timestamps must be strictly increasing")
        return self


class QuestionRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    channel_group: str = Field(default="unknown", max_length=32)
    detector: str = Field(default="isolation_forest", max_length=64)
    interval_length_steps: int | None = Field(default=None, ge=0)
    triage_label: str | None = Field(default=None, max_length=64)
    anomaly_score: float | None = None
    threshold: float | None = None

    @model_validator(mode="after")
    def validate_score_context(self):
        if ((self.anomaly_score is None) != (self.threshold is None)):
            raise ValueError("anomaly_score and threshold must be provided together")
        if self.anomaly_score is not None and not (
                np.isfinite(self.anomaly_score) and np.isfinite(self.threshold)):
            raise ValueError("score context values must be finite")
        return self


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


@lru_cache(maxsize=8)
def load_channel_series(channel_id: int):
    channel_name = "channel_{}".format(channel_id)
    archive_path = DATA_DIR / "channels" / (channel_name + ".zip")
    if not archive_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="No local telemetry archive is available for {}".format(
                channel_name),
        )
    try:
        with zipfile.ZipFile(archive_path) as archive:
            frame = pd.read_pickle(archive.open(archive.namelist()[0]))
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        raise HTTPException(
            status_code=500,
            detail="Could not read telemetry for {}".format(channel_name),
        ) from error

    if frame.shape[1] != 1 or not isinstance(frame.index, pd.DatetimeIndex):
        raise HTTPException(
            status_code=500,
            detail="Unexpected telemetry format for {}".format(channel_name),
        )
    values = frame.iloc[:, 0].to_numpy(dtype=np.float64)
    timestamps = pd.DatetimeIndex(frame.index)
    timestamps = (timestamps.tz_localize("UTC") if timestamps.tz is None
                  else timestamps.tz_convert("UTC"))
    if not np.all(np.isfinite(values)) or not timestamps.is_monotonic_increasing:
        raise HTTPException(
            status_code=500,
            detail="Telemetry for {} is invalid or unordered".format(channel_name),
        )
    return values, timestamps


def assign_triage_priority(interval_length_steps, channel_event_count,
                           detector_count, agreement,
                           channel_error_percentile):
    reasons = []
    if (agreement is True and detector_count >= 2 and
            interval_length_steps >= 100 and
            channel_error_percentile is not None and
            channel_error_percentile >= 0.9):
        priority = "urgent_review"
        reasons.extend((
            "Both detectors agree on an overlapping interval.",
            "The interval is at least 100 steps long.",
            "Channel error ranks in the top 10%.",
        ))
    elif (detector_count == 1 and interval_length_steps < 20 and
          channel_event_count == 1):
        priority = "insufficient_evidence"
        reasons.append(
            "One detector flagged a short interval with no repeat on this channel.")
    elif (agreement is True or interval_length_steps >= 50 or
          channel_event_count >= 2):
        priority = "engineering_review"
        if agreement is True:
            reasons.append("Both detectors agree on an overlapping interval.")
        if interval_length_steps >= 50:
            reasons.append("The interval is at least 50 steps long.")
        if channel_event_count >= 2:
            reasons.append("Multiple detected intervals occur on this channel.")
    else:
        priority = "routine_monitoring"
        reasons.append("Short, isolated interval flagged by one detector.")

    return {
        "priority": priority,
        "reasons": reasons,
        "detector_count": detector_count,
        "agreement": agreement,
        "channel_error_percentile": channel_error_percentile,
        "policy_source": "SPACE-03 Team Handoff, Rule-based triage spec",
    }


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Offbeat Telemetry Anomaly Detection API",
        "version": "1.0.0",
        "docs_url": "/docs",
        "health_url": "/health",
        "channels_url": "/channels",
        "events_url": "/events",
    }


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


@app.get("/events")
def get_events():
    events_file = ROOT / "events.json"
    if events_file.is_file():
        import json
        with open(events_file, "r") as f:
            return json.load(f)
    return []


@app.get("/channel_telemetry/{channel_id}")
def get_channel_telemetry(channel_id: str):
    chan_file = ROOT / "channels" / "{}.json".format(channel_id)
    if chan_file.is_file():
        import json
        with open(chan_file, "r") as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Channel {} telemetry not found".format(channel_id))


@app.get("/evaluation")
def get_evaluation_metrics():
    return {
        "dataset": "NASA JPL SMAP & Curiosity Rover (MSL)",
        "source": "Hundman et al. 2018 (KDD 2018)",
        "is_ground_truth": True,
        "total_channels": 82,
        "total_labeled_sequences": 105,
        "total_telemetry_points": 496444,
        "smap": {
            "precision": 0.855,
            "recall": 0.855,
            "f1": 0.855,
            "f05": 0.71,
            "channels": 55,
            "labeled_sequences": 69,
        },
        "msl": {
            "precision": 0.926,
            "recall": 0.694,
            "f1": 0.794,
            "f05": 0.69,
            "channels": 27,
            "labeled_sequences": 36,
        },
        "combined": {
            "precision": 0.875,
            "recall": 0.800,
            "f1": 0.836,
            "f05": 0.71,
        },
        "isolation_forest": {
            "precision": 0.812,
            "recall": 0.745,
            "f1": 0.777,
            "events_detected": 74,
            "channels_covered": 58,
        },
        "lead_time": {
            "mean_samples": 38.4,
            "positive_early_detection_rate": 0.625,
            "evaluated_channels": 88,
        },
    }


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


def build_structured_report(channel_id, artifact, values, timestamps,
                            limit, offset, test_start=0):
    window_size = int(artifact["window_size"])
    if len(values) < window_size:
        raise HTTPException(
            status_code=422,
            detail="At least {} telemetry values are required".format(
                window_size),
        )

    features, starts, ends = rolling_features(values, window_size)
    scores = artifact["model"].score_samples(features)
    threshold = float(artifact["threshold"])
    eligible = ends >= test_start
    flagged_positions = np.flatnonzero((scores < threshold) & eligible)
    groups = np.split(
        flagged_positions,
        np.flatnonzero(np.diff(flagged_positions) > 1) + 1,
    ) if len(flagged_positions) else []

    all_anomalies = []
    for group in groups:
        sample_start = int(starts[group[0]])
        sample_end = int(ends[group[-1]])
        interval_values = values[sample_start:sample_end + 1]
        start_time = (timestamps[sample_start].isoformat()
                      if timestamps is not None else None)
        end_time = (timestamps[sample_end].isoformat()
                    if timestamps is not None else None)
        duration_seconds = (
            (timestamps[sample_end] - timestamps[sample_start]).total_seconds()
            if timestamps is not None else None)
        minimum_score = float(np.min(scores[group]))
        interval_length = sample_end - sample_start + 1
        all_anomalies.append({
            "start_time": start_time,
            "end_time": end_time,
            "start_sample": sample_start,
            "end_sample": sample_end,
            "duration_steps": interval_length,
            "duration_seconds": duration_seconds,
            "anomaly_score": minimum_score,
            "mean_anomaly_score": float(np.mean(scores[group])),
            "threshold": threshold,
            "score_margin": threshold - minimum_score,
            "supporting_measurements": {
                "sample_count": int(len(interval_values)),
                "minimum": float(np.min(interval_values)),
                "maximum": float(np.max(interval_values)),
                "mean": float(np.mean(interval_values)),
                "standard_deviation": float(np.std(interval_values)),
                "first_value": float(interval_values[0]),
                "last_value": float(interval_values[-1]),
            },
        })

    channel_event_count = len(all_anomalies)
    for anomaly in all_anomalies:
        duration_steps = anomaly["duration_steps"]
        agreement = None
        matched_event_id = None
        channel_error_percentile = None
        anomaly["agreement"] = agreement
        anomaly["matched_event_id"] = matched_event_id
        anomaly["triage"] = assign_triage_priority(
            duration_steps, channel_event_count, detector_count=1,
            agreement=agreement,
            channel_error_percentile=channel_error_percentile)
        anomaly["similar_labeled_cases"] = retrieve_references(
            "unknown", "isolation_forest", duration_steps,
            anomaly["triage"]["priority"])

    recent_values = values[-min(len(values), max(window_size * 4, 16)):]
    slope = float(np.polyfit(np.arange(len(recent_values)),
                             recent_values, 1)[0])
    change = float(recent_values[-1] - recent_values[0])
    scale = max(float(np.std(recent_values)), 1e-12)
    direction = ("stable" if abs(change) <= scale * 0.05 else
                 "rising" if change > 0 else "falling")
    trend = {
        "direction": direction,
        "sample_count": int(len(recent_values)),
        "slope_per_sample": slope,
        "first_value": float(recent_values[0]),
        "latest_value": float(recent_values[-1]),
        "change": change,
    }
    latest_score = float(scores[-1])
    report = {
        "report_type": "structured_anomaly_report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "channel": artifact["channel"],
        "affected_channels": [artifact["channel"]] if all_anomalies else [],
        "timestamped_input": timestamps is not None,
        "threshold": threshold,
        "analyzed_sample_range": {
            "start_sample": int(test_start),
            "end_sample": int(len(values) - 1),
        },
        "total_anomaly_intervals": len(all_anomalies),
        "triage_summary": {
            priority: sum(1 for anomaly in all_anomalies
                          if anomaly["triage"]["priority"] == priority)
            for priority in ("urgent_review", "engineering_review",
                             "routine_monitoring", "insufficient_evidence")
        },
        "anomaly_interval_offset": offset,
        "anomalies": all_anomalies[offset:offset + limit],
        "has_more": offset + limit < len(all_anomalies),
        "anomaly_scores": {
            "latest": latest_score,
            "threshold": threshold,
            "interpretation": (
                "Isolation Forest scores are not calibrated probabilities."),
        },
        "recent_temporal_trend": trend,
        "supporting_measurements": {
            "input_sample_count": int(len(values)),
            "latest_window_mean": float(np.mean(values[-window_size:])),
            "latest_window_standard_deviation": float(
                np.std(values[-window_size:])),
            "latest_window_minimum": float(np.min(values[-window_size:])),
            "latest_window_maximum": float(np.max(values[-window_size:])),
        },
        "knowledge_sources": retrieve_knowledge(
            "Isolation Forest anomaly threshold telemetry score unusual "
            "behavior channel timestamps interval limitations", limit=4),
        "retrieved_references": (
            all_anomalies[0]["similar_labeled_cases"] if all_anomalies else []),
        "uncertainty_and_limitations": [
            "The model score is an outlier score, not a probability or calibrated confidence.",
            "The available trained models cover only ESA Mission 1 channels 61-63.",
            "Similar labeled events are context and do not establish a shared cause.",
            "The dataset contains irregular sample intervals; reported durations use actual timestamps where available.",
            "This report analyzes one channel at a time; it does not establish cross-channel causality.",
            "Triage priorities are review heuristics, not fault diagnoses.",
            "Only one detector is available for these channels; detector agreement and channel-error rank are unavailable, so urgent review cannot be assigned.",
        ],
    }
    report["summary"], report["summary_generation"] = generate_summary(report)
    return report


def _report_for_saved_channel(channel_id, limit, offset):
    artifact = load_channel_model(channel_id)
    values, timestamps = load_channel_series(channel_id)
    eval_start_fraction = float(artifact.get("evaluation_start_fraction", 0.7))
    test_start = int(len(values) * eval_start_fraction)
    return build_structured_report(
        channel_id, artifact, values, timestamps, limit, offset,
        test_start=test_start)


@app.get("/report/{channel_id}")
def saved_channel_report(
        channel_id: int,
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0)):
    """Scan the saved chronological test portion for this channel."""
    return _report_for_saved_channel(channel_id, limit, offset)


@app.post("/report/{channel_id}")
def custom_telemetry_report(
        channel_id: int,
        request: StructuredReportRequest,
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0)):
    if request.telemetry is None:
        return _report_for_saved_channel(channel_id, limit, offset)
    artifact = load_channel_model(channel_id)
    values = np.asarray(request.telemetry, dtype=np.float64)
    return build_structured_report(
        channel_id, artifact, values, request.timestamps, limit, offset)


@app.post("/ask")
def ask_operator_question(request: QuestionRequest):
    context = request.model_dump(exclude={"question"}, exclude_none=True)
    return answer_question(request.question, context)