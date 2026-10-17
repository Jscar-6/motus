# server

Local FastAPI server on :8000: `/health`, `/classify`, `/sessions`, `/report`. Contracts: PLAN.md §16.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
