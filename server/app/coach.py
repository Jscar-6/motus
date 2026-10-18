"""F10 coach routes: Gemini notes for the therapist portal and voice-to-buzz-sensitivity, with template fallbacks."""
import json
import os
import re
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

router = APIRouter(prefix="/coach", tags=["coach"])

DEFAULT_MODEL = "gemini-2.5-flash"
TIMEOUT_MS = 10000  # the Gemini API rejects deadlines under 10 s
MAX_CONTEXT_CHARS = 4000

SYSTEM_PROMPT = (
    "You are an assistant to a physical therapist who is watching a patient do a seated forward-reach exercise. "
    "You receive a JSON summary of the last few seconds of measured movement. "
    "Use ONLY the numbers given and never invent any. Never diagnose. "
    "Reply in at most 2 sentences and 40 words, in a warm, plain voice: say what is going right, "
    "what is going wrong, and the suggested next move. "
    "If the thresholds are marked as placeholders and you mention them, say they are placeholders."
)

VOICE_PROMPT = (
    SYSTEM_PROMPT
    + " The therapist has just spoken an instruction. Answer it in the same 2-sentence limit. "
    "If they ask to change how sensitive the sleeve buzz is, set buzzSensitivity to low, medium or high "
    "(softer or fewer buzzes is low, stronger or more is high, default is medium); otherwise set it to none. "
    "Detection thresholds are not changed by voice; only the buzz."
)

VOICE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "reply": {"type": "STRING"},
        "buzzSensitivity": {"type": "STRING", "enum": ["low", "medium", "high", "none"]},
    },
    "required": ["reply", "buzzSensitivity"],
}

LABEL_WORDS = {
    "trunk_lean": "trunk lean",
    "shoulder_hike": "shoulder hike",
    "trunk_rotation": "trunk rotation",
    "incomplete_reach": "an incomplete reach",
    "uncertain": "low tracking confidence",
}

Sensitivity = Literal["low", "medium", "high"]


class CoachRequest(BaseModel):
    """Body of POST /coach."""

    context: dict


class CoachResponse(BaseModel):
    """Reply of POST /coach."""

    text: str
    source: Literal["gemini", "template"]


class VoiceRequest(BaseModel):
    """Body of POST /coach/voice."""

    transcript: str
    context: dict


class VoiceResponse(BaseModel):
    """Reply of POST /coach/voice."""

    reply: str
    buzzSensitivity: Optional[Sensitivity] = None
    source: Literal["gemini", "template"]


def _num(value: object) -> Optional[float]:
    """Return value as a float, or None when it is missing or not numeric."""
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def template_note(context: dict) -> str:
    """Write a short coach note from the measured numbers in the context, with no model call."""
    flags = [f for f in context.get("flags", []) if isinstance(f, str) and f in LABEL_WORDS]
    counts = context.get("windowFlagCounts") or {}
    max_lean = _num(context.get("maxLean"))
    if not _num(context.get("sampleCount")):
        return "Waiting for movement. Ask the patient to start a reach and I will comment as it happens."
    if flags:
        word = LABEL_WORDS[flags[0]]
        lean = f" Trunk lean reached {max_lean:.0f} degrees." if flags[0] == "trunk_lean" and max_lean is not None else ""
        return f"{word.capitalize()} is flagged right now.{lean} Cue the patient to reset before the next reach."
    recent = {k: v for k, v in counts.items() if k in LABEL_WORDS and isinstance(v, int) and v > 0}
    if recent:
        label, n = max(recent.items(), key=lambda kv: kv[1])
        return f"{LABEL_WORDS[label].capitalize()} showed up {n} time{'s' if n != 1 else ''} in the last few seconds. Cue the patient to settle before reaching."
    if max_lean is not None:
        return f"Clean reaches so far, with trunk lean peaking at {max_lean:.0f} degrees. Next: try a far-target set."
    return "Clean reaches so far. Next: try a far-target set."


def template_voice(transcript: str) -> tuple[str, Optional[Sensitivity]]:
    """Parse a spoken instruction into a reply and an optional buzz level using keywords."""
    text = transcript.lower()
    if re.search(r"\b(lower|softer|soft|gentle|gentler|less|reduce|decrease)\b", text):
        return "Okay, sleeve buzz set to low.", "low"
    if re.search(r"\b(stronger|more|higher|increase|louder)\b", text):
        return "Okay, sleeve buzz set to high.", "high"
    if re.search(r"\b(normal|default|medium|standard)\b", text):
        return "Okay, sleeve buzz set to medium.", "medium"
    return "I can change the sleeve buzz to low, medium or high. Just say which.", None


def _client():
    """Create a Gemini client from GEMINI_API_KEY, or None when no key is set."""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    from google import genai
    from google.genai import types

    return genai.Client(api_key=key, http_options=types.HttpOptions(timeout=TIMEOUT_MS))


def _no_thinking():
    """Thinking off: 2.5 models otherwise spend the 200-token output budget thinking and cut the reply short."""
    from google.genai import types

    return types.ThinkingConfig(thinking_budget=0)


def _model() -> str:
    """Model name from GEMINI_MODEL, defaulting to gemini-2.5-flash."""
    return os.getenv("GEMINI_MODEL") or DEFAULT_MODEL


def _context_json(context: dict) -> str:
    """Serialise the context for the prompt, truncated so a bad client cannot send a huge prompt."""
    return json.dumps(context, separators=(",", ":"))[:MAX_CONTEXT_CHARS]


def gemini_note(context: dict) -> Optional[str]:
    """Ask Gemini for a coach note; None on a missing key or any error."""
    try:
        client = _client()
        if client is None:
            return None
        from google.genai import types

        response = client.models.generate_content(
            model=_model(),
            contents=f"Measured summary:\n{_context_json(context)}",
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, max_output_tokens=200, thinking_config=_no_thinking()),
        )
        return (response.text or "").strip() or None
    except Exception:
        return None


def gemini_voice(transcript: str, context: dict) -> Optional[tuple[str, Optional[Sensitivity]]]:
    """Ask Gemini to answer a spoken instruction as JSON; None on a missing key or any error."""
    try:
        client = _client()
        if client is None:
            return None
        from google.genai import types

        response = client.models.generate_content(
            model=_model(),
            contents=f"Therapist said: {transcript[:500]}\nMeasured summary:\n{_context_json(context)}",
            config=types.GenerateContentConfig(
                system_instruction=VOICE_PROMPT,
                response_mime_type="application/json",
                response_schema=VOICE_SCHEMA,
                max_output_tokens=200,
                thinking_config=_no_thinking(),
            ),
        )
        data = json.loads(response.text or "")
        reply = str(data.get("reply", "")).strip()
        level = data.get("buzzSensitivity")
        if not reply:
            return None
        return reply, level if level in ("low", "medium", "high") else None
    except Exception:
        return None


@router.post("", response_model=CoachResponse)
def coach(req: CoachRequest) -> CoachResponse:
    """Return a one-to-two sentence coach note for the current movement summary."""
    text = gemini_note(req.context)
    if text:
        return CoachResponse(text=text, source="gemini")
    return CoachResponse(text=template_note(req.context), source="template")


@router.post("/voice", response_model=VoiceResponse)
def coach_voice(req: VoiceRequest) -> VoiceResponse:
    """Turn a spoken therapist instruction into a reply and an optional buzz-sensitivity level."""
    result = gemini_voice(req.transcript, req.context)
    if result:
        return VoiceResponse(reply=result[0], buzzSensitivity=result[1], source="gemini")
    reply, level = template_voice(req.transcript)
    return VoiceResponse(reply=reply, buzzSensitivity=level, source="template")
