"""TrueReach local API. Routes from PLAN.md §16 are added by E3a (/health, /sessions, stub /classify); F10 adds /coach."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import coach

app = FastAPI(title="TrueReach")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(coach.router)


@app.get("/")
def root() -> dict:
    """Confirm the server is running."""
    return {"app": "truereach"}
