# server

Local FastAPI server on :8000: `/health`, `/classify`, `/sessions`, `/report`. Contracts: PLAN.md §16.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Coach (F10)

`POST /coach` `{context}` → `{text, source}` and `POST /coach/voice` `{transcript, context}` → `{reply, buzzSensitivity, source}`, in `app/coach.py`. They call Gemini (`GEMINI_API_KEY` and optional `GEMINI_MODEL` in the repo-root `.env`) with a 5 s timeout. With no key, or on any error, they answer from server-side templates built from the same numbers and set `source: "template"`, so the routes never return a 500 for a model failure. CORS allows the Vite dev origin on :5173.
