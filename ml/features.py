"""Per-frame §6.1 features on TRSP forward-reach recordings (D2).

Same definitions as web/src/lib/features.ts; if one changes, the other must change too (CLAUDE.md rule 18).
Lean, hike, elbow and shoulder flexion are computed on the sagittal (side-view) plane, the picture a webcam
beside the patient sees (PLAN.md §20, accepted). Rotation stays in the horizontal plane, since only the chest
IMU supplies it live. Each feature is relative to the clean frames that open the recording (up to 1 s), like
the live rest pose.

Usage: python ml/features.py   # writes ml/data/features.csv (gitignored) and a summary to docs/results.md
"""

import re

import numpy as np
import pandas as pd

import trsp

FEATURES_CSV = trsp.ML_DIR / "data" / "features.csv"
FEATURE_COLS = ["leanDeg", "hikeRatio", "rotDeg", "elbowDeg", "shoulderFlexDeg"]

# SOURCE: PLAN.md §5 step 4 ("change from the recording's first second at rest").
REST_FRAMES = trsp.FPS
# SOURCE: placeholder, hand-picked so the rest pose averages several frames (~170 ms); not data-validated.
# Scripted healthy tasks often start their compensation label within the first second, so the rest pose is
# the leading run of 'none' frames (up to REST_FRAMES), and a recording is dropped only if that run is shorter.
PLACEHOLDER_MIN_REST_FRAMES = 5

ARM_JOINTS = {
    "right": (trsp.SHOULDER_R, trsp.ELBOW_R, trsp.WRIST_R, trsp.HIP_R, trsp.SHOULDER_L),
    "left": (trsp.SHOULDER_L, trsp.ELBOW_L, trsp.WRIST_L, trsp.HIP_L, trsp.SHOULDER_R),
}


def is_forward_reach(task: str) -> bool:
    """True for Rch_Fwr_Bck tasks, including the healthy scripted variants (PLAN.md §5 step 3)."""
    return trsp.task_family(task).startswith("Rch_Fwr_Bck")


def arm_side(task: str) -> str:
    """Reaching arm from the task-name suffix (_L / _R, optional repeat), not from any 'L' in the name."""
    m = re.search(r"_(L|R)(_\d+)?$", task)
    if not m:
        raise ValueError(f"{task}: no _L/_R arm suffix")
    return "left" if m.group(1) == "L" else "right"


def sagittal(p: np.ndarray) -> np.ndarray:
    """Project body-axis points (..., 3) onto the side view as (forward, up)."""
    return p[..., [2, 1]]


def angle_between(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Unsigned angle between 2D vectors along the last axis, in degrees (0–180)."""
    cos = np.sum(u * v, axis=-1) / (np.linalg.norm(u, axis=-1) * np.linalg.norm(v, axis=-1))
    return np.degrees(np.arccos(np.clip(cos, -1.0, 1.0)))


def trunk_tilt_deg(j: np.ndarray) -> np.ndarray:
    """SpineBase→SpineShoulder tilt from vertical on the side view, forward = +."""
    v = sagittal(j[..., trsp.SPINE_SHOULDER, :] - j[..., trsp.SPINE_BASE, :])
    return np.degrees(np.arctan2(v[..., 0], v[..., 1]))


def shoulder_line_deg(j: np.ndarray, side: str) -> np.ndarray:
    """Heading of the other→reaching shoulder line in the horizontal plane; reaching shoulder forward = +."""
    shoulder, _, _, _, other = ARM_JOINTS[side]
    v = j[..., shoulder, :] - j[..., other, :]
    x = v[..., 0] * (1.0 if side == "right" else -1.0)  # mirror x for left-arm tasks (§5 step 3)
    return np.degrees(np.arctan2(v[..., 2], x))


def rest_frames(rec: trsp.Recording) -> int:
    """Length of the leading run of 'none' frames, capped at REST_FRAMES."""
    head = rec.labels[:REST_FRAMES] != 1
    return int(np.argmax(head)) if head.any() else min(REST_FRAMES, len(rec.labels))


def at_rest(rec: trsp.Recording) -> bool:
    """True if the recording starts with at least PLACEHOLDER_MIN_REST_FRAMES 'none' frames."""
    return rest_frames(rec) >= PLACEHOLDER_MIN_REST_FRAMES


def compute_features(rec: trsp.Recording) -> pd.DataFrame:
    """§6.1 features for every frame of one recording, relative to its leading rest frames."""
    side = arm_side(rec.task)
    shoulder, elbow, wrist, hip, _ = ARM_JOINTS[side]
    j = rec.joints
    rest = j[:rest_frames(rec)].mean(axis=0)
    s2, r2 = sagittal(j), sagittal(rest)
    rest_trunk = np.linalg.norm(r2[shoulder] - r2[hip])
    rest_head = np.linalg.norm(r2[trsp.HEAD] - r2[shoulder])
    return pd.DataFrame({
        "subject": rec.subject,
        "task": rec.task,
        "side": side,
        "healthy": rec.healthy,
        "t": np.arange(len(j)) * 1000.0 / trsp.FPS,
        "label": rec.labels,
        "leanDeg": trunk_tilt_deg(j) - trunk_tilt_deg(rest),
        "hikeRatio": (rest_head - np.linalg.norm(s2[:, trsp.HEAD] - s2[:, shoulder], axis=1)) / rest_trunk,
        "rotDeg": shoulder_line_deg(j, side) - shoulder_line_deg(rest, side),
        "elbowDeg": angle_between(s2[:, shoulder] - s2[:, elbow], s2[:, wrist] - s2[:, elbow]),
        "shoulderFlexDeg": angle_between(s2[:, hip] - s2[:, shoulder], s2[:, wrist] - s2[:, shoulder]),
    })


def load_features(recs: list[trsp.Recording]) -> tuple[pd.DataFrame, list[str]]:
    """Features for all forward-reach recordings that start at rest, plus the names of those dropped."""
    fwr = [r for r in recs if is_forward_reach(r.task)]
    dropped = [f"{r.subject}/{r.task}" for r in fwr if not at_rest(r)]
    kept = [compute_features(r) for r in fwr if at_rest(r)]
    return pd.concat(kept, ignore_index=True), dropped


def summary(df: pd.DataFrame, dropped: list[str]) -> str:
    """Markdown summary: what was kept and dropped, and median features per group and label."""
    groups = df.assign(group=np.where(df.healthy, "healthy", "patient"))
    med = groups.groupby(["group", "label"])[FEATURE_COLS].median()
    counts = groups.groupby(["group", "label"]).size()
    rows = [
        f"| {g} | {trsp.LABELS[lab]} | {counts[(g, lab)]} | "
        + " | ".join(f"{med.loc[(g, lab), c]:+.2f}" if c == "hikeRatio" else f"{med.loc[(g, lab), c]:+.1f}" for c in FEATURE_COLS)
        + " |"
        for g, lab in med.index
    ]
    n_rec = df.groupby(["subject", "task"]).ngroups
    out = [
        "## TRSP features (D2)",
        "",
        "Generated by `python ml/features.py`. Forward-reach tasks only; lean, hike, elbow and shoulder flexion on the"
        " sagittal plane, rotation in the horizontal plane; each relative to the recording's leading 'none' frames"
        f" (up to {REST_FRAMES}, at least {PLACEHOLDER_MIN_REST_FRAMES}).",
        "",
        f"- Kept {n_rec} recordings, {len(df)} frames"
        f" ({df[df.healthy].subject.nunique()} healthy, {df[~df.healthy].subject.nunique()} patients).",
        f"- Dropped {len(dropped)} without a clean start:"
        f" {', '.join(dropped) if dropped else 'none'}.",
        "",
        "Median per frame (lean, rotation, elbow, shoulder flexion in degrees; hike as a fraction of trunk length):",
        "",
        "| Group | Label | Frames | " + " | ".join(f"`{c}`" for c in FEATURE_COLS) + " |",
        "|---|---|---|" + "---|" * len(FEATURE_COLS),
        *rows,
    ]
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    features, dropped_recs = load_features(trsp.load_all())
    features.to_csv(FEATURES_CSV, index=False)
    report = summary(features, dropped_recs)
    trsp.write_results(report, section_id="D2")
    print(report)
