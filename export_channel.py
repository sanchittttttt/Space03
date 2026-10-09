import json, os
import numpy as np
import pandas as pd

run = "data/2018-05-19_15.00.10"
df = pd.read_csv("results/2018-05-19_15.00.10.csv")
os.makedirs("channels", exist_ok=True)

for chan in df.chan_id:
    test = np.load(f"data/test/{chan}.npy")[:, 0]
    err = np.load(f"{run}/smoothed_errors/{chan}.npy").flatten()
    off = len(test) - len(err)
    out = {
        "channel_id": chan,
        "n_steps": int(len(test)),
        "telemetry": [round(float(v), 4) for v in test],
        # padded with nulls so telemetry and error share one x-axis
        "error": [None] * off + [round(float(v), 4) for v in err],
    }
    with open(f"channels/{chan}.json", "w") as f:
        json.dump(out, f)
print("wrote", len(df), "channel files")