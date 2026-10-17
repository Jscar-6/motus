"""Download TRSP from Kaggle and copy its data_new/ tree into ml/data/trsp/ (D1).

Usage: python ml/download_trsp.py

kagglehub fetches this public dataset anonymously; if Kaggle asks for auth, it reads
~/.kaggle/kaggle.json or KAGGLE_USERNAME / KAGGLE_KEY from the environment (never commit either).
"""

import pathlib
import shutil

import kagglehub

DATASET = "derekdb/toronto-robot-stroke-posture-dataset"
DEST = pathlib.Path(__file__).resolve().parent / "data" / "trsp"
# Stray duplicate label files in P05/Rch_Fwr_Bck_L and P08/Rch_Fwr_Bck_L_1 (PLAN.md §20).
SKIP = shutil.ignore_patterns("Labels - Copy.csv")


def download() -> pathlib.Path:
    """Download TRSP to the kagglehub cache and copy only data_new/ (not robot/data_new/) to DEST."""
    cache = pathlib.Path(kagglehub.dataset_download(DATASET))
    src = cache / "data_new"
    if not src.is_dir():
        raise FileNotFoundError(f"expected {src}; the Kaggle layout may have changed")
    if DEST.exists():
        shutil.rmtree(DEST)
    shutil.copytree(src, DEST, ignore=SKIP)
    return DEST


if __name__ == "__main__":
    print(f"TRSP copied to {download()}")
