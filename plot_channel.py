import sys, ast
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

chan = sys.argv[1] if len(sys.argv) > 1 else "P-1"
run = "data/2018-05-19_15.00.10"

test = np.load(f"data/test/{chan}.npy")[:, 0]      # first column = the telemetry value
err = np.load(f"{run}/smoothed_errors/{chan}.npy").flatten()
yhat = np.load(f"{run}/y_hat/{chan}.npy").flatten()
print("test", test.shape, "| error", err.shape, "| y_hat", yhat.shape)

err_off = len(test) - len(err)
yhat_off = len(test) - len(yhat)
print("error offset:", err_off, "| y_hat offset:", yhat_off)

df = pd.read_csv("results/2018-05-19_15.00.10.csv")
row = df[df.chan_id == chan].iloc[0]
true_seqs = ast.literal_eval(row.anomaly_sequences)
pred_seqs = ast.literal_eval(row.tp_sequences) + ast.literal_eval(row.fp_sequences)

fig, ax = plt.subplots(3, 1, figsize=(14, 8), sharex=True)
ax[0].plot(test, lw=0.7)
ax[0].set_title(f"{chan}: telemetry (green = labeled anomaly, red = detected)")
ax[1].plot(test, lw=0.5, alpha=0.5, label="actual")
ax[1].plot(np.arange(len(yhat)) + yhat_off, yhat, lw=0.7, label="predicted")
ax[1].legend(loc="upper right")
ax[2].plot(np.arange(len(err)) + err_off, err, lw=0.8, color="darkorange")
ax[2].set_title("smoothed prediction error")
for a in ax:
    for s, e in true_seqs:
        a.axvspan(s, e, color="green", alpha=0.2)
    for s, e in pred_seqs:
        a.axvspan(s, e, color="red", alpha=0.2)
plt.tight_layout()
plt.savefig(f"check_{chan}.png", dpi=110)
plt.show()