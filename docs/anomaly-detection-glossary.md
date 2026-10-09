# Satellite Anomaly Detection Glossary

## Anomaly

An anomaly is telemetry behavior that differs from the behavior learned or expected by a detector. A detector flag is evidence of unusual behavior, not proof of a failed component or a confirmed root cause.

Sources: [Telemanom paper, Abstract](https://arxiv.org/abs/1802.04431); [SPACE-03 Team Handoff, Rules for what we claim](SPACE-03%20Team%20Handoff%20Satellite%20Health%20Anomaly%20Detection.md#11-rules-for-what-we-claim).

## Prediction error and threshold

Telemanom predicts telemetry values with an LSTM and uses prediction errors with nonparametric dynamic thresholding to identify anomalous sequences. Its score and threshold are detector signals; they are not calibrated probabilities.

Sources: [Telemanom paper, Abstract](https://arxiv.org/abs/1802.04431); [Telemanom README, Anomaly Detection in Time Series Data Using LSTMs and Automatic Thresholding](../README.md).

## Isolation Forest score decision

For this project's Isolation Forest API, a window is flagged when its `score_samples` result is lower than the stored validation threshold. This score is an outlier score and is not a probability. The implementation returns both values so an operator can inspect the comparison.

Source: [Space03 FastAPI implementation, prediction and report routes](../api.py).

## Point and contextual anomalies

The NASA SMAP/MSL dataset describes point anomalies as cases that may be detected by methods that ignore temporal context. Contextual anomalies depend on sequence behavior and can require temporal methods such as LSTMs.

Source: [NASA Anomaly Detection Dataset SMAP & MSL, About this file](https://www.kaggle.com/datasets/patrickfleith/nasa-anomaly-detection-dataset-smap-msl).

## Telemetry channels and time axis

SMAP/MSL channel identifiers are anonymized. The first letter documents only a channel type where stated by the dataset documentation; it does not identify the physical component. In the original experiment, indices are time steps and must not be presented as clock time.

Sources: [Telemanom README, Raw experiment data](../README.md); [SPACE-03 Team Handoff, The data in plain words](SPACE-03%20Team%20Handoff%20Satellite%20Health%20Anomaly%20Detection.md#4-the-data-in-plain-words).

## Lead time

Lead time is the labeled anomaly start index minus the detector's start index. Positive values mean the detector flagged before the label; negative values mean it flagged later. It is measured in steps for the anonymized SMAP/MSL data, not a guaranteed warning duration.

Source: [SPACE-03 Team Handoff, Current results](SPACE-03%20Team%20Handoff%20Satellite%20Health%20Anomaly%20Detection.md#8-current-results).

## Triage labels

Triage priorities (`insufficient_evidence`, `urgent_review`, `engineering_review`, and `routine_monitoring`) are review-priority heuristics. They do not diagnose a fault. Their thresholds are judgement calls and must be shown with their reasons.

Source: [SPACE-03 Team Handoff, Rule-based triage spec](SPACE-03%20Team%20Handoff%20Satellite%20Health%20Anomaly%20Detection.md#16-rule-based-triage-spec).

## ESA anomaly labels

ESA Mission 1 labels provide event IDs, channels, and start/end timestamps. The taxonomy file maps event IDs to documented category, locality, dimensionality, and length fields. A similar labeled event is context only; it does not establish a shared cause.

Sources: [ESA Anomaly Dataset, Zenodo record](https://zenodo.org/records/15237121); local `labels.csv` and `anomaly_types.csv`.

## Limitations

The current Isolation Forest artifacts cover ESA Mission 1 channels 61–63 only. A channel is analyzed independently; the current model does not establish cross-channel agreement or physical subsystem identity. ESA labels are used to calibrate thresholds, so evaluation must remain on a later untouched time interval.

Source: [SPACE-03 Team Handoff, Rules for what we claim](SPACE-03%20Team%20Handoff%20Satellite%20Health%20Anomaly%20Detection.md#11-rules-for-what-we-claim); local ESA training configuration and metrics.
