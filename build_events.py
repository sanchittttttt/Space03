import ast, json
import pandas as pd

df = pd.read_csv("results/2018-05-19_15.00.10.csv")

for col in ["anomaly_sequences", "tp_sequences", "fp_sequences"]:
    df[col] = df[col].apply(ast.literal_eval)

# 'class' is stored unquoted, e.g. [contextual, point], so split it by hand
df["class"] = df["class"].apply(
    lambda s: [x.strip() for x in s.strip("[]").split(",") if x.strip()]
)

# 1. Sequence-level metrics (compare with the README: SMAP 85.5/85.5, MSL 92.6/69.4)
g = df.groupby("spacecraft")[["true_positives", "false_positives", "false_negatives"]].sum()
g.loc["TOTAL"] = g.sum()
g["precision"] = g.true_positives / (g.true_positives + g.false_positives)
g["recall"] = g.true_positives / (g.true_positives + g.false_negatives)
print(g)

# 2. Lead time: true_start - detected_start (positive = flagged before the labeled start)
def overlap(a, b):
    return a[0] <= b[1] and b[0] <= a[1]

leads = []
for _, r in df.iterrows():
    for t in sorted(r.anomaly_sequences):
        hits = [p for p in r.tp_sequences if overlap(p, t)]
        if hits:
            p = min(hits, key=lambda x: x[0])
            leads.append({"chan_id": r.chan_id, "true_start": t[0],
                          "pred_start": p[0], "lead_steps": t[0] - p[0]})
leads = pd.DataFrame(leads)
print(leads.lead_steps.describe())
print("flagged before label start:", (leads.lead_steps > 0).mean())

# 3. Events, one per detected interval per channel
events = []
for _, r in df.iterrows():
    preds = [(tuple(s), True) for s in r.tp_sequences] + \
            [(tuple(s), False) for s in r.fp_sequences]
    for i, (s, matched) in enumerate(sorted(preds)):
        events.append({
            "event_id": f"{r.chan_id}-{i+1}",
            "spacecraft": r.spacecraft,
            "channel_id": r.chan_id,
            "channel_group": r.chan_id.split("-")[0],
            "start_index": int(s[0]),
            "end_index": int(s[1]),
            "channel_error": float(r.normalized_pred_error),
            "detector": "telemanom_lstm",
            "evaluation": {"matches_labeled_anomaly": matched},
        })
json.dump(events, open("events.json", "w"), indent=2)
leads.to_csv("lead_times.csv", index=False)
print(len(events), "events written")