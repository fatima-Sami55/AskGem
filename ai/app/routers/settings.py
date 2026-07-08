"""Runtime settings for local single-user mode."""
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.utils.env_file import update_env_var

router = APIRouter(prefix="/settings", tags=["settings"])

_runtime_tavily_key: str | None = None


def get_tavily_api_key() -> str:
    global _runtime_tavily_key
    if _runtime_tavily_key:
        return _runtime_tavily_key
    return os.getenv("TAVILY_API_KEY", "").strip()


class TavilyKeyUpdate(BaseModel):
    tavily_api_key: str = ""


@router.put("/tavily")
def update_tavily_key(body: TavilyKeyUpdate):
    global _runtime_tavily_key
    key = (body.tavily_api_key or "").strip()
    try:
        update_env_var("TAVILY_API_KEY", key)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not update ai/.env: {exc}") from exc

    _runtime_tavily_key = key or None
    os.environ["TAVILY_API_KEY"] = key
    return {"status": "ok", "configured": bool(key)}
