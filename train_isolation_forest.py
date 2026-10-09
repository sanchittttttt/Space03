import argparse
import ast
import csv
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (accuracy_score, f1_score, precision_score,
                             recall_score)


def load_labels(path):
    labels = {}
    with path.open(newline="", encoding="utf-8") as label_file:
        for row in csv.DictReader(label_file):
            channel_id = row.get("chan_id") or row.get("channel_id")
            if channel_id:
                labels[channel_id] = ast.literal_eval(
                    row.get("anomaly_sequences", "[]") or "[]")
    return labels


def make_windows(values, window_size):
    starts = np.arange(len(values) - window_size + 1)
    windows = np.stack([values[start:start + window_size]
                        for start in starts])
    ends = starts + window_size - 1
    changes = np.diff(windows, axis=1)
    last = windows[:, -1]
    mean = np.mean(windows, axis=1)
    features = np.column_stack((
        last,
        mean,
        np.std(windows, axis=1),
        np.min(windows, axis=1),
        np.max(windows, axis=1),
        np.median(windows, axis=1),
        last - mean,
        windows[:, -1] - windows[:, 0],
        np.mean(np.abs(changes), axis=1),
        np.max(np.abs(changes), axis=1),
    ))
    return features, starts, ends


def build_anomaly_mask(length, sequences):
    mask = np.zeros(length, dtype=bool)
    for start, end in sequences:
        start = max(0, int(start))
        end = min(length - 1, int(end))
        if start <= end:
            mask[start:end + 1] = True
    return mask


def windows_touching_anomaly(mask, starts, ends):
    cumulative = np.concatenate(([0], np.cumsum(mask, dtype=np.int64)))
    return cumulative[ends + 1] - cumulative[starts] > 0


def consecutive_sequences(indices):
    if len(indices) == 0:
        return []
    breaks = np.where(np.diff(indices) > 1)[0] + 1
    groups = np.split(indices, breaks)
    return [(int(group[0]), int(group[-1])) for group in groups]


def evaluate_sequences(predicted, true_sequences, split_index):
    test_sequences = [
        (max(int(start), split_index), int(end))
        for start, end in true_sequences
        if int(end) >= split_index
    ]
    true_positives = 0
    false_positives = 0
    matched = set()

    for predicted_start, predicted_end in predicted:
        overlaps = [
            index for index, (true_start, true_end) in enumerate(test_sequences)
            if predicted_start <= true_end and true_start <= predicted_end
        ]
        if overlaps:
            unmatched = [index for index in overlaps if index not in matched]
            if unmatched:
                matched.add(unmatched[0])
                true_positives += 1
        else:
            false_positives += 1

    return true_positives, false_positives, len(test_sequences) - len(matched)


def train_channel(channel_path, labels, args, model_dir):
    channel = json.loads(channel_path.read_text(encoding="utf-8"))
    channel_id = channel["channel_id"]
    values = np.asarray(channel["telemetry"], dtype=np.float64)
    if values.ndim != 1 or not np.all(np.isfinite(values)):
        raise ValueError("{} telemetry must be a finite one-dimensional array"
                         .format(channel_id))
    if len(values) < args.window_size + 2:
        raise ValueError("{} has too few values for window_size={}"
                         .format(channel_id, args.window_size))

    split_index = int(len(values) * args.train_fraction)
    calibration_end = int(len(values) *
                          (args.train_fraction + args.calibration_fraction))
    windows, starts, ends = make_windows(values, args.window_size)
    anomaly_mask = build_anomaly_mask(len(values), labels)
    clean_windows = ~windows_touching_anomaly(anomaly_mask, starts, ends)
    train_rows = (ends < split_index) & clean_windows
    calibration_rows = (ends >= split_index) & (ends < calibration_end)
    test_rows = ends >= calibration_end
    if np.count_nonzero(train_rows) < 100:
        raise ValueError("{} has fewer than 100 normal training windows"
                         .format(channel_id))
    if not np.any(calibration_rows) or not np.any(test_rows):
        raise ValueError("{} has no calibration or held-out windows"
                         .format(channel_id))

    model = IsolationForest(
        n_estimators=args.n_estimators,
        max_samples=min(256, int(np.count_nonzero(train_rows))),
        contamination="auto",
        random_state=args.random_state,
        n_jobs=-1,
    )
    model.fit(windows[train_rows])
    calibration_scores = model.score_samples(windows[calibration_rows])
    calibration_ends = ends[calibration_rows]
    calibration_truth = anomaly_mask[calibration_ends]
    sorted_order = np.argsort(calibration_scores)
    sorted_scores = calibration_scores[sorted_order]
    sorted_truth = calibration_truth[sorted_order].astype(np.int64)
    cumulative_tp = np.concatenate(([0], np.cumsum(sorted_truth)))
    thresholds = np.concatenate(([-np.inf], np.unique(sorted_scores), [np.inf]))
    predicted_counts = np.searchsorted(sorted_scores, thresholds, side="left")
    true_positives = cumulative_tp[predicted_counts]
    negatives = len(calibration_truth) - int(np.count_nonzero(calibration_truth))
    correct = true_positives + negatives - (predicted_counts - true_positives)
    threshold = float(thresholds[int(np.argmax(correct))])
    calibration_predictions = calibration_scores < threshold

    test_scores = model.score_samples(windows[test_rows])
    predictions = test_scores < threshold

    test_ends = ends[test_rows]
    truth = anomaly_mask[test_ends]
    point_tp = int(np.count_nonzero(predictions & truth))
    point_fp = int(np.count_nonzero(predictions & ~truth))
    point_fn = int(np.count_nonzero(~predictions & truth))
    predicted_sequences = consecutive_sequences(test_ends[predictions])
    event_tp, event_fp, event_fn = evaluate_sequences(
        predicted_sequences, labels, split_index)

    model_path = model_dir / "{}.joblib".format(channel_id)
    joblib.dump({
        "model": model,
        "threshold": threshold,
        "window_size": args.window_size,
    }, model_path)

    return {
        "channel_id": channel_id,
        "train_values": int(np.count_nonzero(train_rows)),
        "calibration_values": int(np.count_nonzero(calibration_rows)),
        "calibration_accuracy": accuracy_score(
            calibration_truth, calibration_predictions),
        "test_values": int(np.count_nonzero(test_rows)),
        "test_accuracy": accuracy_score(truth, predictions),
        "point_precision": precision_score(truth, predictions, zero_division=0),
        "point_recall": recall_score(truth, predictions, zero_division=0),
        "point_f1": f1_score(truth, predictions, zero_division=0),
        "point_tp": point_tp,
        "point_fp": point_fp,
        "point_fn": point_fn,
        "event_tp": event_tp,
        "event_fp": event_fp,
        "event_fn": event_fn,
        "model_path": str(model_path),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Train per-channel Isolation Forests on channel telemetry.")
    parser.add_argument("--channels-dir", type=Path, default=Path("channels"))
    parser.add_argument("--labels", type=Path,
                        default=Path("labeled_anomalies.csv"))
    parser.add_argument("--output-dir", type=Path,
                        default=Path("artifacts/isolation_forest"))
    parser.add_argument("--window-size", type=int, default=32)
    parser.add_argument("--train-fraction", type=float, default=0.5)
    parser.add_argument("--calibration-fraction", type=float, default=0.1)
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()

    if args.window_size < 2:
        parser.error("--window-size must be at least 2")
    if not 0.1 <= args.train_fraction <= 0.9:
        parser.error("--train-fraction must be between 0.1 and 0.9")
    if not 0 < args.calibration_fraction < 1 - args.train_fraction:
        parser.error("--calibration-fraction must leave a non-empty test interval")
    if args.n_estimators < 1:
        parser.error("--n-estimators must be positive")

    if not args.channels_dir.is_dir():
        parser.error("channel directory not found: {}".format(args.channels_dir))
    if not args.labels.is_file():
        parser.error("labels file not found: {}".format(args.labels))

    labels_by_channel = load_labels(args.labels)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    model_dir = args.output_dir / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    results = []
    failed = []

    for channel_path in sorted(args.channels_dir.glob("*.json")):
        channel_id = channel_path.stem
        try:
            result = train_channel(
                channel_path, labels_by_channel.get(channel_id, []), args,
                model_dir)
            results.append(result)
            print("{}: point F1={:.3f}, event TP/FP/FN={}/{}/{}".format(
                channel_id, result["point_f1"], result["event_tp"],
                result["event_fp"], result["event_fn"]))
        except (KeyError, OSError, ValueError) as error:
            failed.append((channel_id, str(error)))
            print("Skipping {}: {}".format(channel_id, error))

    if not results:
        raise RuntimeError("no channel models were trained")

    metrics_path = args.output_dir / "metrics.csv"
    with metrics_path.open("w", newline="", encoding="utf-8") as metrics_file:
        writer = csv.DictWriter(metrics_file, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    totals = {
        key: sum(result[key] for result in results)
        for key in ("point_tp", "point_fp", "point_fn", "event_tp", "event_fp",
                    "event_fn")
    }
    point_precision = totals["point_tp"] / max(
        1, totals["point_tp"] + totals["point_fp"])
    point_recall = totals["point_tp"] / max(
        1, totals["point_tp"] + totals["point_fn"])
    point_f1 = (2 * point_precision * point_recall /
                max(1e-12, point_precision + point_recall))
    total_test_values = sum(result["test_values"] for result in results)
    point_accuracy = 1 - (totals["point_fp"] + totals["point_fn"]) / max(
        1, total_test_values)
    event_precision = totals["event_tp"] / max(
        1, totals["event_tp"] + totals["event_fp"])
    event_recall = totals["event_tp"] / max(
        1, totals["event_tp"] + totals["event_fn"])

    print("\nTrained {} channel models; skipped {}.".format(
        len(results), len(failed)))
    print("Held-out point precision/recall/F1: {:.3f}/{:.3f}/{:.3f}".format(
        point_precision, point_recall, point_f1))
    print("Held-out point accuracy: {:.3f}".format(point_accuracy))
    print("Held-out event precision/recall: {:.3f}/{:.3f}".format(
        event_precision, event_recall))
    print("Metrics: {}".format(metrics_path))
    print("Models: {}".format(model_dir))


if __name__ == "__main__":
    main()