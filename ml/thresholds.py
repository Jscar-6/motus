"""Compensation thresholds from TRSP healthy forward-reach frames (D3, PLAN.md §5 step 5).

For lean, hike and rotation, compares clean ('none') frames with frames labeled with that compensation and picks
the cutoff that maximises sensitivity + specificity − 1 (Youden's J). Values are measured the way web/src/lib/rules.ts
reads them: |leanDeg|, max(0, hikeRatio), |rotDeg|. minFlagMs is then picked on the same frames by replaying the
rules.ts hold timer (a flag needs the value over its cutoff for minFlagMs) and maximising the mean J of the three.
Patients are never used here; they are the E2 test set.

Usage: python ml/thresholds.py   # needs data/features.csv (python features.py); writes plots to ../docs/thresholds/
                                 # and the D3 summary to ../docs/results.md, and prints the config.ts values
"""

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import roc_curve

import trsp
from features import FEATURES_CSV

PLOTS_DIR = trsp.ML_DIR.parent / "docs" / "thresholds"
FRAME_MS = 1000.0 / trsp.FPS
# SOURCE: search range for minFlagMs, 0 to 1 s in whole frames; a hold over 1 s would miss short compensations.
HOLD_FRAMES = range(0, trsp.FPS + 1)

# check key → (feature column, TRSP label value, magnitude as rules.ts measures it, axis label)
CHECKS = {
    "lean": ("leanDeg", 4, np.abs, "|trunk lean| (deg)"),
    "hike": ("hikeRatio", 2, lambda v: np.maximum(0.0, v), "shoulder hike (fraction of trunk length)"),
    "rot": ("rotDeg", 3, np.abs, "|trunk rotation| (deg)"),
}


def youden_cutoff(clean: np.ndarray, comp: np.ndarray) -> dict:
    """Cutoff maximising sensitivity + specificity − 1 between clean and compensation magnitudes."""
    y = np.r_[np.zeros(len(clean)), np.ones(len(comp))]
    fpr, tpr, cut = roc_curve(y, np.r_[clean, comp])
    i = int(np.argmax(tpr - fpr))
    return {"cutoff": float(cut[i]), "sens": float(tpr[i]), "spec": float(1 - fpr[i]), "j": float(tpr[i] - fpr[i]),
            "n_clean": len(clean), "n_comp": len(comp)}


def held_flags(over: np.ndarray, hold_ms: float) -> np.ndarray:
    """Replay rules.ts: overMs grows by one frame per frame over the cutoff, resets otherwise; flag once ≥ hold_ms."""
    flags = np.zeros(len(over), dtype=bool)
    over_ms = 0.0
    for i, o in enumerate(over):
        over_ms = over_ms + FRAME_MS if o else 0.0
        flags[i] = o and over_ms >= hold_ms
    return flags


def hold_sweep(healthy: pd.DataFrame, cutoffs: dict[str, float]) -> pd.DataFrame:
    """Per-frame J of each check, and clean-frame false-alarm onsets, for every candidate minFlagMs."""
    recs = [r for _, r in healthy.groupby(["subject", "task"])]
    rows = []
    for n in HOLD_FRAMES:
        hold = round(n * FRAME_MS)
        row = {"hold_ms": hold}
        for key, (col, lab, mag, _) in CHECKS.items():
            tp = pos = fp = neg = onsets = 0
            for r in recs:
                labels = r.label.to_numpy()
                f = held_flags(mag(r[col].to_numpy()) >= cutoffs[key], hold)
                clean, comp = labels == 1, labels == lab
                tp, pos = tp + f[comp].sum(), pos + comp.sum()
                fp, neg = fp + f[clean].sum(), neg + clean.sum()
                onsets += (f & ~np.r_[False, f[:-1]] & clean).sum()
            row[f"j_{key}"] = tp / pos - fp / neg
            row[f"fa_{key}"] = int(onsets)
        row["j_mean"] = np.mean([row[f"j_{k}"] for k in CHECKS])
        rows.append(row)
    return pd.DataFrame(rows)


def plot_check(key: str, clean: np.ndarray, comp: np.ndarray, fit: dict) -> str:
    """Save a clean-vs-labeled histogram with the cutoff line; returns the file name."""
    col, lab, _, xlabel = CHECKS[key]
    hi = np.percentile(np.r_[clean, comp], 99.5)
    bins = np.linspace(0, hi, 60)
    fig, ax = plt.subplots(figsize=(6, 3.2), dpi=110)
    ax.hist(clean, bins=bins, density=True, alpha=0.55, label=f"none ({fit['n_clean']} frames)", color="#4b7bec")
    ax.hist(comp, bins=bins, density=True, alpha=0.55, label=f"{trsp.LABELS[lab]} ({fit['n_comp']} frames)", color="#eb3b5a")
    ax.axvline(fit["cutoff"], color="black", lw=1.2, ls="--", label=f"cutoff {fit['cutoff']:.3g} (J {fit['j']:.2f})")
    ax.set_xlabel(xlabel)
    ax.set_ylabel("density")
    ax.set_title(f"TRSP healthy forward reach: {col}", fontsize=10)
    ax.legend(fontsize=8, frameon=False)
    fig.tight_layout()
    name = f"{key}.png"
    fig.savefig(PLOTS_DIR / name)
    plt.close(fig)
    return name


def summary(fits: dict[str, dict], plots: dict[str, str], sweep: pd.DataFrame, best: pd.Series) -> str:
    """Markdown D3 section: cutoffs, hold sweep, and where each value goes in config.ts."""
    rows = [
        f"| {k} | `{CHECKS[k][0]}` | {trsp.LABELS[CHECKS[k][1]]} | {f['n_clean']} / {f['n_comp']} | "
        f"**{f['cutoff']:.3g}** | {f['sens']:.2f} | {f['spec']:.2f} | {f['j']:.2f} | ![{k}](thresholds/{plots[k]}) |"
        for k, f in fits.items()
    ]
    shown = sweep[sweep.hold_ms.isin([0, best.hold_ms, 100, 200, 300, 500, 1000])]
    sweep_rows = [
        f"| {int(r.hold_ms)}{' ←' if r.hold_ms == best.hold_ms else ''} | {r.j_lean:.3f} | {r.j_hike:.3f} | {r.j_rot:.3f} | "
        f"{r.j_mean:.3f} | {r.fa_lean} / {r.fa_hike} / {r.fa_rot} |"
        for r in shown.itertuples()
    ]
    return "\n".join([
        "## Thresholds (D3)",
        "",
        "Generated by `python ml/thresholds.py` from `data/features.csv` (D2). **Healthy participants only** (H01–H10);"
        " patients are held out for E2. Each cutoff maximises sensitivity + specificity − 1 between clean frames and"
        " frames labeled with that compensation, on the magnitude `rules.ts` checks (|lean|, raised-only hike, |rotation|).",
        "",
        "| Check | Feature | Label | Frames clean / labeled | Cutoff | Sens | Spec | J | Plot |",
        "|---|---|---|---|---|---|---|---|---|",
        *rows,
        "",
        "### Hold time (`minFlagMs`)",
        "",
        "Replays the `rules.ts` timer on every healthy recording (30 fps) with the cutoffs above. Per-frame J for each"
        " check, and the number of false-alarm onsets on clean frames (each would be one buzz):",
        "",
        "| Hold (ms) | J lean | J hike | J rot | Mean J | False-alarm onsets lean / hike / rot |",
        "|---|---|---|---|---|---|",
        *sweep_rows,
        "",
        f"→ `minFlagMs` = **{int(best.hold_ms)} ms** (highest mean J). Longer holds remove more clean-frame blips but"
        " miss more labeled frames; Kinect skeletons are smoother than the webcam, so E4's spot check may need a longer"
        " hold live. That would be a hand-tuned value, labeled as such in `config.ts`.",
        "",
        "**Caveats:** the healthy scripted compensations are acted and large (median lean +19.9°, D2), while TRSP"
        " patients lean much less (median +4.2°). E2 reports how these cutoffs do on patients. The live hike uses the"
        " ear where TRSP uses Head (§5 known limits).",
        "",
    ])


def config_snippet(fits: dict[str, dict], hold_ms: int) -> str:
    """The config.ts constants these results produce, for pasting with their source comments."""
    return (f"T_LEAN_DEG = {fits['lean']['cutoff']:.1f}\nT_HIKE_RATIO = {fits['hike']['cutoff']:.3f}\n"
            f"T_ROT_DEG = {fits['rot']['cutoff']:.1f}\nMIN_FLAG_MS = {hold_ms}")


if __name__ == "__main__":
    df = pd.read_csv(FEATURES_CSV)
    healthy = df[df.healthy]
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    fits, plots = {}, {}
    for key, (col, lab, mag, _) in CHECKS.items():
        clean = mag(healthy.loc[healthy.label == 1, col].to_numpy())
        comp = mag(healthy.loc[healthy.label == lab, col].to_numpy())
        fits[key] = youden_cutoff(clean, comp)
        plots[key] = plot_check(key, clean, comp, fits[key])
    sweep = hold_sweep(healthy, {k: f["cutoff"] for k, f in fits.items()})
    best = sweep.loc[sweep.j_mean.idxmax()]
    report = summary(fits, plots, sweep, best)
    trsp.write_results(report, section_id="D3")
    print(report)
    print(config_snippet(fits, int(best.hold_ms)))
