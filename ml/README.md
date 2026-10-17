# ml

Offline TRSP pipeline: download + loader (D1), features (D2), thresholds (D3), training (E1), evaluation (E2). Owner: Ehan. `data/` is gitignored.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## TRSP data (D1)

```bash
python download_trsp.py   # kagglehub → copies data_new/ into data/trsp/ (gitignored; research-use only)
python trsp.py            # loads every recording and writes the sanity checks to ../docs/results.md
```

`trsp.load_all()` returns one `Recording` per task folder: `joints` (frames × 25 Kinect v2 joints × xyz in body axes: x = subject's right, y = up, z = forward), `labels` (1 none, 2 shoulder elevation, 3 trunk rotation, 4 lean forward), `subject`, and `task`. Coordinates are scale-normalised, not metres. Frames are 30 fps.

## TRSP features (D2)

```bash
python features.py        # writes data/features.csv (gitignored) and the D2 summary to ../docs/results.md
```

`features.load_features(trsp.load_all())` returns one row per frame of every forward-reach recording: `subject`, `task`, `side`, `healthy`, `t` (ms), `label`, and the PLAN.md §6.1 features. Lean, hike, elbow and shoulder flexion are measured on the side-view (sagittal) plane to match the webcam; rotation uses the horizontal plane. Each feature is relative to the clean frames that open the recording. The math mirrors `web/src/lib/features.ts`; change both together.
