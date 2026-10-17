"""TrueReach local API. Routes from PLAN.md §16 are added by E3a (/health, /sessions, stub /classify)."""
from fastapi import FastAPI

app = FastAPI(title="TrueReach")


@app.get("/")
def root() -> dict:
    """Confirm the server is running."""
    return {"app": "truereach"}
