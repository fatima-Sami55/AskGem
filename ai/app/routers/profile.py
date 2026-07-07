"""
ai/app/routers/profile.py
FastAPI router for LLM-validated profile field extraction.
"""
import logging
from fastapi import APIRouter, HTTPException

from app.models.schemas import ProfileExtractRequest, ProfileExtractResponse, ProfileFieldResult
from app.agents import profile_extract_agent

logger = logging.getLogger("profile_router")
router = APIRouter(tags=["profile"])


@router.post("/profile/extract", response_model=ProfileExtractResponse)
def extract_profile_endpoint(request: ProfileExtractRequest):
    """Validates regex-drafted profile fields using Ollama structured JSON output."""
    try:
        result = profile_extract_agent.validate_profile_extraction(
            message=request.message,
            current_context=request.current_context or {},
            regex_draft=request.regex_draft or {},
        )
        fields = {
            k: ProfileFieldResult(**v)
            for k, v in (result.get("fields") or {}).items()
        }
        return ProfileExtractResponse(fields=fields, notes=result.get("notes"))
    except Exception as exc:
        logger.error(f"[PROFILE ROUTER] Extraction failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
