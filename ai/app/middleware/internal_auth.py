"""
Shared-secret middleware for Node ↔ FastAPI internal calls.
"""
import os
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("internal_auth")

INTERNAL_API_KEY = os.getenv("AI_SERVER_SECRET") or os.getenv("INTERNAL_API_KEY")
_IS_DEV = os.getenv("NODE_ENV", "development").lower() in ("development", "dev", "test")
_DOCS_ENABLED = _IS_DEV and os.getenv("ASKPERI_ENABLE_API_DOCS", "1").lower() in ("1", "true", "yes")
PUBLIC_PATHS = {"/health", "/health/ping"}
if _DOCS_ENABLED:
    PUBLIC_PATHS.update({"/docs", "/openapi.json", "/redoc"})


class InternalAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" or request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        if not INTERNAL_API_KEY:
            logger.error("AI_SERVER_SECRET / INTERNAL_API_KEY is not configured")
            return JSONResponse(
                status_code=503,
                content={"detail": "AI server internal auth is not configured"},
            )

        provided = (
            request.headers.get("X-Internal-Api-Key")
            or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        )
        if provided != INTERNAL_API_KEY:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

        return await call_next(request)
