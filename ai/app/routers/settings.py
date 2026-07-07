"""Runtime settings for local single-user mode."""
import json
import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/settings", tags=["settings"])

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parents[3] / "data"))
SETTINGS_FILE = DATA_DIR / "settings.json"

_runtime_tavily_key: str | None = None


def _read_file_key() -> str:
    try:
        if SETTINGS_FILE.exists():
            data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
            return str(data.get("tavilyApiKey") or "").strip()
    except Exception:
        pass
    return ""


def get_tavily_api_key() -> str:
    global _runtime_tavily_key
    if _runtime_tavily_key:
        return _runtime_tavily_key
    env_key = os.getenv("TAVILY_API_KEY", "").strip()
    if env_key:
        return env_key
    return _read_file_key()


class TavilyKeyUpdate(BaseModel):
    tavily_api_key: str = ""


@router.put("/tavily")
def update_tavily_key(body: TavilyKeyUpdate):
    global _runtime_tavily_key
    key = (body.tavily_api_key or "").strip()
    _runtime_tavily_key = key or None
    os.environ["TAVILY_API_KEY"] = key
    return {"status": "ok", "configured": bool(key)}
