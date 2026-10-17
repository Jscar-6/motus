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
