# SPACE-03 Team Handoff: Satellite Health Anomaly Detection

FUSION 2026 · ISRO problem SPACE-03 · Written for teammates, and for pasting into other LLMs as context

**Read this first.** Sections 15 to 22 were added last and carry the newest decisions: the rule-based triage, the combined event format, which documents RAG should use, the GitHub setup and the next-steps checklist. The layer flow diagram sits right after section 1. Where the later sections differ from sections 9 and 10, the later ones win.

## 1. The problem in one paragraph

ISRO asks for a system that, using a public or simulated satellite telemetry dataset, does three things: (1) flags early deviations in specific subsystems, (2) explains which telemetry channels triggered each flag, and (3) visualizes health trends over the mission timeline. The reference material is NASA Telemanom and the ESA anomaly dataset. Judges will score those three things. Everything else (RAG, Jev, databases, uploads) is optional and only gets built if the core is finished and evaluated.

## The layer flow

&#91;embedded content: layer flow · 2 detectors, 1 event stream, rules, dashboard\]

Read it top to bottom. The first demo needs only the Telemanom path: its results go through the event builder and the rule-based triage into the dashboard. Isolation Forest joins the same event stream when your teammate finishes it. Evaluation compares each detector with the labeled anomalies, and its numbers appear in the dashboard's evaluation view. The dashed boxes are optional and are built last.

## 2. Where we are

**Done**

- Telemanom repo and the NASA SMAP/MSL data are set up locally.
- We are using the pretrained results that ship with the data (run folder `2018-05-19_15.00.10`). We did not train anything ourselves.
- Results were converted into a clean events file, and we computed precision, recall and lead time.
- On channel P-1 we plotted telemetry, prediction and error, and confirmed the detected intervals line up with real deviations.

**In progress**

- Dashboard (dashboard teammate).
- Isolation Forest baseline (baseline teammate).

**Not started**

- Health-trend view polish, final testing, demo video, slides.
- Optional extras: RAG evidence retrieval and a Jev/Laya decision layer. Last priority.

## 3. Who does what

| Role | Job | Needs |
| --- | --- | --- |
| Pipeline owner | Telemanom results, events.json, metrics, channel export | Nothing, this is finished apart from small fixes |
| Dashboard teammate | Web dashboard reading static JSON files | events.json, lead\_times.csv, the channels/ folder |
| Baseline teammate | Isolation Forest detector, same output format, same evaluation | The repo, the data/ folder, build\_events.py (metrics code) |
| Everyone | Demo cases, slides, rehearsal | Final outputs from the above |

## 4. The data in plain words

- NASA telemetry from two spacecraft: SMAP and MSL (Curiosity rover). 82 channels in total (55 SMAP, 27 MSL) and 105 labeled anomaly sequences.
- Each channel is its own stream. Time is anonymized, and the channels cannot be aligned on a common timeline. All positions are **timestep indices, not hours or minutes**. Never write a real time unit in the slides.
- Values are already scaled to the range -1 to 1 using the test set's min and max. We cannot undo this. Mention it under limitations.
- Files: `data/train/<channel>.npy` and `data/test/<channel>.npy`, shape (n\_steps, n\_features). **Column 0 is the telemetry value.** The other columns are one-hot command flags.
- The first letter of a channel ID is its type. The Telemanom README only documents P = power and R = radiation. Do not name other letters until they are verified from the paper.
- How Telemanom works: one LSTM per channel is trained on normal data to predict the next value. The prediction error is smoothed, a dynamic threshold is applied, and stretches of high error become anomaly intervals. It is unsupervised and never sees labels while training.

## 5. Files and folders

The repo root is the folder that contains `example.py`.

| Path | What it is |
| --- | --- |
| `labeled_anomalies.csv` | True labeled anomaly intervals per channel |
| `results/2018-05-19_15.00.10.csv` | Telemanom results, one row per channel (82 rows) |
| `data/train`, `data/test` | Raw telemetry per channel |
| `data/2018-05-19_15.00.10/` | Pretrained models, `y_hat` predictions, `smoothed_errors` per channel |
| `build_events.py` | Computes metrics and lead times, writes events.json and lead\_times.csv |
| `events.json` | 112 detected anomaly events (one per flagged interval per channel) |
| `lead_times.csv` | Lead time for every labeled anomaly that was detected |
| `plot_channel.py` | Plots one channel with labeled and detected intervals |
| `export_channel.py` | Writes `channels/<channel>.json` for the dashboard |
| `channels/` | Per-channel telemetry and error series |

## 6. Event format (events.json)

One event is one detected interval on one channel. Example:

```
{
  "event_id": "P-1-1",
  "spacecraft": "SMAP",
  "channel_id": "P-1",
  "channel_group": "P",
  "start_index": 2130,
  "end_index": 2349,
  "channel_error": 0.085043,
  "detector": "telemanom_lstm",
  "evaluation": {"matches_labeled_anomaly": true}
}
```

- `start_index` and `end_index` are on the **test axis** (0 to length of the test array minus 1). This was checked on the P-1 plot: no offset is needed.
- `channel_group` is only the first letter of the channel ID, not a verified subsystem name.
- `channel_error` is one number per channel (normalized prediction error), usable as a baseline for health views.
- `evaluation.matches_labeled_anomaly` exists only for the evaluation view. A real engineer would not know it, so do not present it as known truth in the main UI.
- Every detector, including Isolation Forest, must write this same format. Only `detector` changes.

## 7. Channel files (channels/\<channel>.json)

```
{
  "channel_id": "P-1",
  "n_steps": 8505,
  "telemetry": [ ... n_steps numbers ... ],
  "error": [ null, null, ..., 0.16, ... ]
}
```

The error series is shorter than the telemetry because the model needs an input window first (for P-1: telemetry 8505 steps, error 8245 steps, offset 260). The export pads the front of `error` with nulls so telemetry and error share one x-axis. The offset is computed per channel from the array shapes. The cause of the 260 (probably input window plus prediction steps) is not verified.

## 8. Current results

Sequence-level metrics, computed from the shipped Telemanom run:

|  | Precision | Recall |
| --- | --- | --- |
| SMAP | 83.8% | 89.9% |
| MSL | 96.2% | 69.4% |
| Total | 87.0% | 82.9% |

Totals: 87 true positives, 13 false positives. The Telemanom README reports 87.5% precision and 80.0% recall for the default setup. Ours is close but not identical, and the reason is unknown. Report ours as computed and cite the README numbers as a reference.

**Lead time** (labeled start minus detected start, in timesteps; positive means flagged before the labeled start), over 87 detected anomalies:

- Median 0. Middle half between -50 and +35. 47% start strictly before the labeled start. The earliest detection is 94 steps ahead.
- The mean (-73) and worst case (-3311) come from very long labeled intervals that were only caught part of the way in. Quote median and quartiles, not the mean.

**What we can honestly claim:** Telemanom detects near the labeled onset, not far ahead of it. The early-warning story comes from the health-trend view (error rising before a flag), backed by the lead-time numbers.

**Origin of the numbers:** these are the original authors' pretrained results. We evaluated them, built the event pipeline, the channel-level explanations and the dashboard on top, and compare against our own baseline. We did not train Telemanom ourselves, and the slides must not imply that.

## 9. Dashboard spec (minimum viable)

No database and no backend training. Serve static JSON.

1. Event list: sortable and filterable by spacecraft and channel group, showing channel, interval and channel error.
2. Click an event: load `channels/<channel_id>.json` and show two stacked panels on one shared x-axis, telemetry on top and smoothed error below. Highlight the event interval, and optionally the labeled anomaly bands in another colour.
3. Health trend view (required by the problem statement): per channel, the smoothed error over time. Add an overview of all channels (for example per-channel `channel_error` as a bar chart or heatmap) so someone can see which channels look unhealthy.
4. Detector toggle between Telemanom and Isolation Forest once the baseline exists.
5. Evaluation overlay toggle that shows labeled anomalies and which detections matched them.
6. A visible note that an anomaly is evidence of unusual behaviour, not proof of a particular fault.

Use P-1 and E-1 as the first demo channels. P-1 has a clear true detection, a visible false alarm and a detection the error curve does not explain, which makes it a good honest example.

## 10. Isolation Forest baseline spec

Purpose: a simple second detector for a comparison table, and a fallback if anything breaks on the Telemanom side.

1. Input: `data/train/<channel>.npy` and `data/test/<channel>.npy`, **column 0 only**.
2. Build features per timestep from rolling windows: mean, standard deviation, min, max and slope or difference. Window sizes are a starting suggestion and should be tuned (try 50 and 250 steps).
3. Fit `IsolationForest` on **training features only**. Score the test features. Never fit anything on test data.
4. Choose the threshold from the training score distribution (a high percentile). If you tune it against labels, tune on a subset of channels, say so, and do not call it unbiased.
5. Turn consecutive flagged steps into intervals. Merge intervals with small gaps and drop very short ones. Report the gap and length rules you used.
6. Write `events_iforest.json` in the exact format of section 6 with `detector` set to `isolation_forest`. Also save each channel's score series so the dashboard can plot it.
7. Evaluate with the same logic as `build_events.py`: a detected interval that overlaps a labeled interval is a true positive, one that overlaps nothing is a false positive, and a labeled interval with no overlapping detection is a false negative. Lead time is labeled start minus detected start.
8. Order of work: P-1 and E-1 first, then about 10 channels, then all 82 if it runs quickly.
9. Deliverable: a table of precision, recall and median lead time for Telemanom and Isolation Forest, per spacecraft and in total.

A simpler baseline that performs similarly is still a valid finding. Report whatever comes out.

## 11. Rules for what we claim

- Anomaly means unusual behaviour. It is not proof of a failing component.
- Do not label a channel as battery, thermal or any subsystem unless the dataset documents it.
- Do not call lead time an early-warning guarantee. Report the real distribution including late detections.
- Say clearly which results are from the shipped pretrained run and which are ours.
- Mention the pre-scaled data and the anonymized time axis as limitations.
- Everyone should be able to explain, in plain words, how Isolation Forest and Telemanom work, what the threshold means and why a channel was flagged.

## 12. Known issues and open questions

- The `scores` and `anom_scores` columns hold one severity score per detected interval, but the CSV does not say which score belongs to which interval. Do not attach scores to events until this is checked.
- The P-1 detection at about 4520 to 4589 sits where the error dips to its lowest value on the channel, not where it spikes. The reason is unknown, so the event view should show raw telemetry next to the error curve.
- The README and our metrics differ slightly (see section 8).
- There are 112 events but only 100 true plus false positives, so some labeled anomalies are probably covered by more than one detected interval.
- The ESA dataset is not used. One dataset done well is the plan.

## 13. How to run things (Windows PowerShell, from the repo root)

```
python build_events.py          # metrics, events.json, lead_times.csv
python plot_channel.py P-1      # check plot saved as check_P-1.png
python export_channels.py       # writes the channels/ folder
```

If matplotlib is missing, run `pip install matplotlib`. Do not put API keys or tokens in the repo or in chat.

## 14. Context block to paste into any LLM

Copy everything in the block below at the start of a new LLM session, then add your task.

```
Project: hackathon (FUSION 2026), ISRO problem SPACE-03, satellite health anomaly detection from telemetry. Must (1) flag early deviations in specific subsystems, (2) explain which channels triggered a flag, (3) visualize health trends over time.

Data: NASA SMAP and MSL telemetry, 82 channels, one stream per channel, time anonymized (all positions are timestep indices, channels cannot be aligned on a common timeline), values pre-scaled to [-1,1]. Files data/train/<chan>.npy and data/test/<chan>.npy have shape (n_steps, n_features); column 0 is the telemetry, other columns are one-hot command flags. labeled_anomalies.csv has true anomaly intervals. Channel ID first letter is the type; only P=power and R=radiation are documented.

Detector 1: NASA Telemanom, pretrained results shipped with the data (run 2018-05-19_15.00.10): per-channel LSTM, smoothed prediction error, dynamic threshold. We did not train it. Results are in results/2018-05-19_15.00.10.csv and data/2018-05-19_15.00.10/{models,y_hat,smoothed_errors}. Smoothed error and y_hat are shorter than the test series (offset = len(test) - len(error), 260 for P-1) and must be shifted to align. Detected interval indices are already on the test axis.

Event format (events.json, one per detected interval per channel): event_id, spacecraft, channel_id, channel_group (first letter only), start_index, end_index, channel_error, detector, evaluation.matches_labeled_anomaly. Every detector must output this same format.

Metrics logic: a detected interval overlapping any labeled interval is a true positive, otherwise a false positive; a labeled interval with no overlapping detection is a false negative. Lead time = labeled start minus detected start (steps). Current Telemanom results: precision 87.0%, recall 82.9% (SMAP 83.8/89.9, MSL 96.2/69.4); lead time median 0 steps, quartiles -50 and +35, 47% flagged before labeled start.

Rules: anomaly is evidence of unusual behaviour, not proof of a fault; do not name subsystems that the data does not document; fit anything on train data only; do not invent results; report limitations honestly.

Stack: Python, pandas, numpy, scikit-learn, matplotlib; dashboard reads static JSON (events.json, channels/<chan>.json), no database.
```

## 15. Decisions and status

- Core detector: the pretrained Telemanom results, used as shipped. Isolation Forest is a second detector for comparison and cross-checking, not a replacement.
- The first demo includes a rule-based triage layer. RAG and Jev or Laya are optional and are added only after the core is built and evaluated.
- Data: NASA SMAP and MSL only. The ESA dataset is a stretch goal, and it is unverified whether its documentation gives better subsystem labels.
- First demo path: Telemanom results, event builder, triage, dashboard. Isolation Forest, evaluation and the extras attach to the same event stream afterwards.

| Item | Status | Owner |
| --- | --- | --- |
| Telemanom results to events.json, metrics, lead times | Done | Pipeline owner |
| export\_channels.py (channels/ folder) | Script written; confirm it was run and handed over | Pipeline owner |
| Dashboard | In progress | Dashboard teammate |
| Isolation Forest baseline | In progress | Baseline teammate |
| Combined events and agreement flag | Not started | Pipeline owner |
| Rule-based triage | Not started | Pipeline owner |
| GitHub repository | Not started | Pipeline owner |
| RAG, Jev or Laya | Not started, optional | Anyone with spare time |

How the plan covers the three things ISRO asks for:

| ISRO requirement | How we cover it | Honest limit |
| --- | --- | --- |
| Flag early deviations in specific subsystems | Per-channel detections from two detectors | Subsystem is only the first letter of the channel ID (P = power and R = radiation are documented); median lead time is 0 steps |
| Explain which channels triggered the flag | Each event belongs to one channel; the event view shows its telemetry and error curve | The error curve does not always explain a flag (P-1, about 4520 to 4589) |
| Visualize health trends over the mission timeline | Smoothed error over time per channel, plus an overview of all channels | The time axis is the test index, not real time |

## 16. Rule-based triage spec

Purpose: turn each detected event into a review priority with reasons. It detects nothing and diagnoses nothing. The output is a triage priority for an engineer, never a statement that a component is failing.

Inputs per event, all available today: interval length, the number of events on the same channel, the channel's `channel_error` rank among all channels, and whether the other detector flagged an overlapping interval (agreement, section 17). Do not use the `scores` column until it is verified which score belongs to which interval. Do not use the labeled anomaly class (point or contextual): it comes from the labels, which a real engineer would not have.

First matching rule wins:

1. insufficient\_evidence: one detector only, interval shorter than 20 steps, and no other event on the channel.
2. urgent\_review: both detectors agree, interval of at least 100 steps, and the channel's error is in the top 10% of channels.
3. engineering\_review: both detectors agree, or the interval is at least 50 steps, or the channel has two or more events.
4. routine\_monitoring: everything else.

The numbers 20, 100, 50 and 10% are starting values. Choose the final ones by looking at the duration distribution in events.json, write them down, and say in the slides that they are judgement calls without ground truth. Every result carries a reasons list so the dashboard can show why.

```python
def triage(ev, n_channel_events, error_pct):
    dur = ev['end_index'] - ev['start_index'] + 1
    agree = ev.get('agreement', False)
    if not agree and dur < 20 and n_channel_events == 1:
        return 'insufficient_evidence', ['one detector, short interval, no repeat on this channel']
    if agree and dur >= 100 and error_pct >= 0.9:
        return 'urgent_review', ['both detectors agree', 'long interval', 'channel error in the top 10%']
    reasons = []
    if agree:
        reasons.append('both detectors agree')
    if dur >= 50:
        reasons.append('interval of 50 steps or more')
    if n_channel_events >= 2:
        reasons.append('repeated events on this channel')
    if reasons:
        return 'engineering_review', reasons
    return 'routine_monitoring', ['short, isolated, flagged by one detector']
```

`error_pct` is the fraction of channels whose `channel_error` is lower than this channel's (0 to 1).

## 17. Combining the detectors

Each detector writes its own events file in the section 6 format: events.json for Telemanom, events\_iforest.json for Isolation Forest. The pipeline owner then adds three fields to every event:

- `agreement`: true when the other detector has an event on the same `channel_id` whose interval overlaps (start\_a <= end\_b and start\_b <= end\_a).
- `matched_event_id`: the id of that event, or null.
- `triage`: an object with `priority` and `reasons`, from section 16.

Events stay separate per detector. The dashboard shows Telemanom events by default with an agreement badge, and a toggle switches to the Isolation Forest events. Do not average scores or build a combined model. The comparison table (precision, recall, median lead time) is computed per detector with the same evaluation code. The dashboard must tolerate events without the new fields, so the first demo works before Isolation Forest exists.

## 18. RAG: which documents to use

RAG is optional. Build it only after the core, the evaluation and the triage are finished. Its job is the evidence panel under an event: explain in plain words what a flag, a channel type or a triage label means. It cannot tell us what an anonymized channel physically measures, and it must never claim that.

Documents for the knowledge base, most valuable first:

1. The Telemanom paper (Hundman et al., 2018, arXiv 1802.04431): how detection works, the dynamic threshold, point and contextual anomalies.
2. The Telemanom README and the column definitions of labeled\_anomalies.csv: data layout, anonymization, channel-type letters.
3. Our own one-page glossary: anomaly, point and contextual anomaly, prediction error, threshold, lead time, and the four triage labels with what each means. This is the most useful document and it is entirely under our control.
4. The NASA SMAP and MSL dataset description (the Kaggle dataset page).
5. Optional: the ESA anomaly dataset documentation, only if the ESA slice is used.
6. Optional: public, properly licensed background on spacecraft power, thermal, attitude and communications subsystems, used only to explain what a documented channel type usually represents (P = power). Check the license; do not scrape pages.

Do not include anything that states the physical meaning of an anonymized channel, random web pages, or ISRO documents we do not hold.

How to build it: split each document by section into passages, index them in a local vector index (no database service), and query with detection-time information only: channel group letter, detector, interval length, triage label. Show the source title and the passage with every answer. When the best match is weak, show 'no supporting documentation' instead of a guess. Test it on ten example events and check by hand that the passages are relevant.

## 19. Dashboard additions

On top of section 9: a triage badge with its reasons on every event, an agreement badge, a detector toggle (Telemanom or Isolation Forest), the evidence panel if RAG exists, and an always-visible note that an anomaly is evidence of unusual behaviour, not proof of a fault. A first version needs only the event list, the event view and the health-trend view. Everything else comes later.

## 20. GitHub setup

1. Create a new empty repository on GitHub. The local clone points at the original Telemanom repository, which cannot be pushed to. In PowerShell from the repo root:

```
git remote -v
git remote rename origin upstream
git remote add origin https://github.com/<you>/<new-repo>.git
git push -u origin main
```

Check the branch name with `git branch` first and use it instead of main if it differs.

2. Make .gitignore cover data/, \*.zip, kaggle.json, .env and **pycache**/. Run `git status` before the first commit and look at what will be added.
3. Keep LICENSE.txt (Telemanom is Apache 2.0). In the README, say the detector comes from NASA JPL's Telemanom and cite Hundman et al., 2018.
4. Leave data/ out. The README gives the Kaggle download command so others fetch the data themselves.
5. Commit the small outputs: events.json, lead\_times.csv, results/, the scripts, and docs/HANDOFF.md (this doc exported as Markdown). Commit channels/ only if it is under about 50 MB; otherwise ignore it and regenerate it with `python export_channels.py`.
6. One branch per person (dashboard, baseline), pull before pushing, merge into main every few hours. Keep baseline code in its own folder, baseline/.
7. Keep the repository private until submission. Never commit tokens or API keys.

## 21. Next steps checklist

- [ ] Pipeline owner: confirm export\_channels.py was run, and hand events.json, lead\_times.csv and channels/ to the dashboard teammate.
- [ ] Pipeline owner: create the GitHub repository and push (section 20).
- [ ] Dashboard teammate: event list, then the event view with telemetry and error panels, then the health-trend view.
- [ ] Baseline teammate: Isolation Forest per section 10; deliver events\_iforest.json, per-channel score files and the comparison table.
- [ ] Pipeline owner: write the agreement merge and triage.py (sections 16 and 17) and regenerate the combined events.
- [ ] Everyone: pick 2 to 3 demo cases and check them end to end. P-1 offers a true detection (about 2130 to 2349), a false alarm (about 3190 to 3329) and an unexplained detection (about 4520 to 4589); E-1 is a second candidate.
- [ ] Everyone: record a backup demo video and prepare slides: problem, pipeline, Telemanom vs Isolation Forest table, honest limitations.
- [ ] Optional, only if time remains: RAG (section 18), then Jev or Laya compared with the rules on 20 to 30 events labeled by hand.

## 22. Context addendum to paste after section 14

Paste this block after the section 14 block when starting a new LLM session. It overrides section 14 where they differ.

```
Update to the project context.

Layer flow (top to bottom): data -> detectors (Telemanom pretrained results; Isolation Forest baseline) -> event builder -> rule-based triage (+ evaluation on the side) -> optional extras (RAG evidence, Jev or Laya) -> dashboard. First demo = Telemanom -> event builder -> triage -> dashboard. Isolation Forest, evaluation, RAG and Jev or Laya attach to the same event stream afterwards.

Event additions: agreement (true when the other detector has an overlapping event on the same channel_id), matched_event_id, triage {priority, reasons}. Events stay separate per detector. Do not average scores or build a combined model.

Triage rules, first match wins: insufficient_evidence (one detector, interval < 20 steps, no other event on the channel); urgent_review (both detectors agree, interval >= 100 steps, channel error in the top 10%); engineering_review (both agree, or interval >= 50, or 2+ events on the channel); routine_monitoring (otherwise). Thresholds are placeholders to tune from the duration distribution and document. Triage is a priority heuristic, not a diagnosis. Do not use the scores column (unpaired) or the labeled anomaly class as inputs.

RAG (optional): documents = Telemanom paper (Hundman et al. 2018), Telemanom README and labeled_anomalies.csv column definitions, our own one-page glossary, the NASA SMAP/MSL dataset description; optional ESA docs and licensed spacecraft-subsystem background. Never claim what an anonymized channel physically measures. Query with detection-time information only. Show sources; say 'no supporting documentation' when the match is weak.

Status: detector results, events, metrics and lead times done; dashboard and Isolation Forest in progress; agreement, triage, GitHub, RAG not started. Repo: private until submission; do not commit data/ or tokens.
```
