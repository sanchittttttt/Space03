import argparse
import csv
import json
import zipfile
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (accuracy_score, f1_score, precision_score,
                             recall_score)


def load_labels(path, channel_name, timestamps):
    labels = pd.read_csv(path)
    channel_labels = labels[labels["Channel"] == channel_name]
    anomaly_mask = np.zeros(len(timestamps), dtype=bool)
    timestamp_values = timestamps.asi8

    for row in channel_labels.itertuples(index=False):
        start = pd.Timestamp(row.StartTime).value
        end = pd.Timestamp(row.EndTime).value
        first = np.searchsorted(timestamp_values, start, side="left")
        last = np.searchsorted(timestamp_values, end, side="right")
        anomaly_mask[first:last] = True

    return anomaly_mask


def rolling_features(values, window_size):
    windows = np.lib.stride_tricks.sliding_window_view(values, window_size)
    starts = np.arange(len(windows))
    ends = starts + window_size - 1
    changes = np.diff(values)
    change_windows = np.lib.stride_tricks.sliding_window_view(
        changes, window_size - 1)
    features = np.column_stack((
        windows[:, -1],
        np.mean(windows, axis=1),
        np.std(windows, axis=1),
        windows[:, -1] - windows[:, 0],
        np.mean(np.abs(change_windows), axis=1),
        np.max(np.abs(change_windows), axis=1),
    ))
    return features, starts, ends


def train_channel(channel_id, labels_path, data_dir, output_dir, args):
    channel_name = "channel_{}".format(channel_id)
    archive_path = data_dir / "channels" / (channel_name + ".zip")
    with zipfile.ZipFile(archive_path) as channel_archive:
        member = channel_archive.namelist()[0]
        frame = pd.read_pickle(channel_archive.open(member))

    if frame.shape[1] != 1:
        raise ValueError("{} must contain one telemetry column".format(channel_name))
    values = frame.iloc[:, 0].to_numpy(dtype=np.float64)
    timestamps = pd.DatetimeIndex(frame.index)
    if timestamps.tz is None:
        timestamps = timestamps.tz_localize("UTC")
    else:
        timestamps = timestamps.tz_convert("UTC")
    if len(values) != len(timestamps) or not np.all(np.isfinite(values)):
        raise ValueError("{} contains invalid telemetry".format(channel_name))

    anomaly_mask = load_labels(labels_path, channel_name, timestamps)
    features, starts, ends = rolling_features(values, args.window_size)
    train_end = int(len(values) * args.train_fraction)
    calibration_end = int(len(values) *
                          (args.train_fraction + args.calibration_fraction))
    cumulative = np.concatenate(([0], np.cumsum(anomaly_mask, dtype=np.int64)))
    windows_touch_anomaly = cumulative[ends + 1] - cumulative[starts] > 0
    train_rows = (ends < train_end) & ~windows_touch_anomaly
    calibration_rows = (ends >= train_end) & (ends < calibration_end)
    test_rows = ends >= calibration_end
    if np.count_nonzero(train_rows) < 100:
        raise ValueError("{} has fewer than 100 normal training windows"
                         .format(channel_name))
    if not np.any(anomaly_mask[ends[calibration_rows]]):
        raise ValueError("{} has no labeled anomalies in calibration slice"
                         .format(channel_name))

    model = IsolationForest(
        n_estimators=args.n_estimators,
        max_samples=min(256, int(np.count_nonzero(train_rows))),
        contamination="auto",
        random_state=args.random_state,
        n_jobs=-1,
    )
    model.fit(features[train_rows])

    calibration_ends = ends[calibration_rows]
    calibration_truth = anomaly_mask[calibration_ends]
    calibration_scores = model.score_samples(features[calibration_rows])
    score_order = np.argsort(calibration_scores)
    sorted_scores = calibration_scores[score_order]
    sorted_truth = calibration_truth[score_order].astype(np.int64)
    cumulative_tp = np.concatenate(([0], np.cumsum(sorted_truth)))
    candidates = np.concatenate((
        [-np.inf], np.nextafter(np.unique(sorted_scores), np.inf), [np.inf]))
    predicted_count = np.searchsorted(sorted_scores, candidates, side="left")
    candidate_tp = cumulative_tp[predicted_count]
    candidate_fp = predicted_count - candidate_tp
    candidate_fn = int(np.count_nonzero(calibration_truth)) - candidate_tp
    candidate_f1 = (2 * candidate_tp /
                    np.maximum(1, 2 * candidate_tp + candidate_fp + candidate_fn))
    if args.threshold_objective == "accuracy":
        candidate_correct = (candidate_tp +
                             len(calibration_truth) -
                             int(np.count_nonzero(calibration_truth)) -
                             candidate_fp)
        best_threshold_index = int(np.argmax(candidate_correct))
    else:
        best_threshold_index = int(np.argmax(candidate_f1))
    threshold = float(candidates[best_threshold_index])
    calibration_predictions = calibration_scores < threshold

    test_ends = ends[test_rows]
    test_truth = anomaly_mask[test_ends]
    test_scores = model.score_samples(features[test_rows])
    test_predictions = test_scores < threshold

    model_path = output_dir / "models" / (channel_name + ".joblib")
    joblib.dump({
        "model": model,
        "threshold": threshold,
        "window_size": args.window_size,
        "channel": channel_name,
        "evaluation_start_fraction": (
            args.train_fraction + args.calibration_fraction),
    }, model_path)

    result = {
        "channel": channel_name,
        "samples": len(values),
        "train_normal_windows": int(np.count_nonzero(train_rows)),
        "calibration_samples": int(np.count_nonzero(calibration_rows)),
        "calibration_f1": f1_score(
            calibration_truth, calibration_predictions, zero_division=0),
        "calibration_accuracy": accuracy_score(
            calibration_truth, calibration_predictions),
        "test_samples": int(np.count_nonzero(test_rows)),
        "test_anomalies": int(np.count_nonzero(test_truth)),
        "test_accuracy": accuracy_score(test_truth, test_predictions),
        "test_precision": precision_score(
            test_truth, test_predictions, zero_division=0),
        "test_recall": recall_score(
            test_truth, test_predictions, zero_division=0),
        "test_f1": f1_score(test_truth, test_predictions, zero_division=0),
        "tp": int(np.count_nonzero(test_predictions & test_truth)),
        "fp": int(np.count_nonzero(test_predictions & ~test_truth)),
        "fn": int(np.count_nonzero(~test_predictions & test_truth)),
        "model_path": str(model_path),
    }
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Train and evaluate Isolation Forests on the ESA subset.")
    parser.add_argument("--data-dir", type=Path,
                        default=Path("datasets/esa-anomaly-dataset/data/mission1-subset/ESA-Mission1"))
    parser.add_argument("--output-dir", type=Path,
                        default=Path("artifacts/esa_isolation_forest"))
    parser.add_argument("--channels", default="61,62,63")
    parser.add_argument("--window-size", type=int, default=8)
    parser.add_argument("--train-fraction", type=float, default=0.6)
    parser.add_argument("--calibration-fraction", type=float, default=0.1)
    parser.add_argument("--threshold-objective", choices=("accuracy", "f1"),
                        default="f1")
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()

    if args.window_size < 2:
        parser.error("--window-size must be at least 2")
    if not 0.1 <= args.train_fraction < 0.9:
        parser.error("--train-fraction must be in [0.1, 0.9)")
    if not 0 < args.calibration_fraction < 1 - args.train_fraction:
        parser.error("--calibration-fraction must leave a test interval")
    if args.n_estimators < 1:
        parser.error("--n-estimators must be positive")
    if not (args.data_dir / "labels.csv").is_file():
        parser.error("ESA labels not found under {}".format(args.data_dir))

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "models").mkdir(exist_ok=True)
    results = []
    for channel_id in (int(value) for value in args.channels.split(",")):
        result = train_channel(channel_id, args.data_dir / "labels.csv",
                               args.data_dir, args.output_dir, args)
        results.append(result)
        print("{}: accuracy={:.4f}, precision={:.4f}, recall={:.4f}, F1={:.4f}"
              .format(result["channel"], result["test_accuracy"],
                      result["test_precision"], result["test_recall"],
                      result["test_f1"]))

    metrics_path = args.output_dir / "metrics.csv"
    with metrics_path.open("w", newline="", encoding="utf-8") as metrics_file:
        writer = csv.DictWriter(metrics_file, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    tp = sum(result["tp"] for result in results)
    fp = sum(result["fp"] for result in results)
    fn = sum(result["fn"] for result in results)
    samples = sum(result["test_samples"] for result in results)
    anomalies = sum(result["test_anomalies"] for result in results)
    tn = samples - tp - fp - fn
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = 2 * precision * recall / max(1e-12, precision + recall)
    accuracy = (tp + tn) / max(1, samples)

    print("\nChannels trained: {}".format(len(results)))
    print("Held-out accuracy: {:.4f} (all-normal baseline: {:.4f})".format(
        accuracy, (samples - anomalies) / max(1, samples)))
    print("Held-out precision/recall/F1: {:.4f}/{:.4f}/{:.4f}".format(
        precision, recall, f1))
    print("Metrics: {}".format(metrics_path))


if __name__ == "__main__":
    main()