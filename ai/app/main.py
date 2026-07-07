"""
ai/app/main.py
FastAPI application entry point.
Registers API routers, CORS middleware, startup lifecycle checks, and smoke test endpoints
"""
import os
import logging
import httpx
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models.schemas import HealthResponse, PingOllamaResponse
from app.routers import chat, memory, search, roadmap, profile, recommendations, settings
from app.services.ollama_service import check_model_available, get_queue_status
from app.middleware.internal_auth import InternalAuthMiddleware

_log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, _log_level, logging.INFO))
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("main")

app = FastAPI(title="AskPeri AI Server", version="1.0.0")

# CORS Middleware Setup
origins = [
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5000",
    "http://localhost:5173",
    "http://localhost:5000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(InternalAuthMiddleware)

# Register Routers
app.include_router(chat.router)
app.include_router(memory.router)
app.include_router(search.router)
app.include_router(roadmap.router)
app.include_router(profile.router)
app.include_router(recommendations.router)
app.include_router(settings.router)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "gemma3:4b")
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_DEFAULT_CHROMA = os.path.join(_REPO_ROOT, "data", "chroma_data")
_chroma_env = os.getenv("CHROMA_PATH", _DEFAULT_CHROMA)
CHROMA_PATH = os.path.abspath(_chroma_env) if not os.path.isabs(_chroma_env) else _chroma_env

@app.on_event("startup")
def startup_event():
    """Startup event checking Ollama service connectivity and model availability."""
    logger.info("Initializing AskPeri AI Server...")
    os.makedirs(CHROMA_PATH, exist_ok=True)
    if not os.getenv("AI_SERVER_SECRET"):
        logger.warning("AI_SERVER_SECRET is unset — internal API routes are unauthenticated.")
    try:
        is_available = check_model_available()
        if is_available:
            logger.info(f"Ollama is reachable and target model '{MODEL_NAME}' is ready.")
        else:
            logger.warning(f"Ollama is reachable but target model '{MODEL_NAME}' was not found in model list.")
    except Exception as e:
        logger.warning(f"Startup check: Ollama is unreachable. {str(e)}")

def _check_chroma_writable() -> bool:
    try:
        os.makedirs(CHROMA_PATH, exist_ok=True)
        test_file = os.path.join(CHROMA_PATH, ".health_check")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write("ok")
        os.remove(test_file)
        return True
    except OSError:
        return False


def _check_ollama_reachable() -> bool:
    try:
        with httpx.Client(timeout=5.0) as client:
            res = client.get(f"{OLLAMA_URL}/api/tags")
            return res.status_code == 200
    except Exception:
        return False


@app.get("/health", response_model=HealthResponse)
def health_check():
    """Returns operational status: Ollama reachability, model availability, Chroma writability."""
    ollama_ok = _check_ollama_reachable()
    model_ok = False
    if ollama_ok:
        try:
            model_ok = check_model_available()
        except Exception:
            model_ok = False
    chroma_ok = _check_chroma_writable()
    all_ok = ollama_ok and model_ok and chroma_ok
    return {
        "status": "ok" if all_ok else "degraded",
        "ollama": ollama_ok,
        "model": model_ok,
        "chroma": chroma_ok,
    }

@app.get("/health/ping")
def health_ping():
    """Lightweight liveness probe (no Ollama/Chroma checks)."""
    return {"ok": True}


@app.get("/health/queue")
def health_queue():
    """Returns Ollama inference queue status (single-job lock)."""
    return get_queue_status()


@app.post("/ping-ollama", response_model=PingOllamaResponse)
async def ping_ollama():
    """Sends 'say hello' prompt to local Ollama instance and returns raw response."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "model": MODEL_NAME,
                "prompt": "say hello",
                "stream": False
            }
            res = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            if res.status_code == 200:
                return {"response": res.json()}
            else:
                return {"response": {"error": f"Ollama returned status {res.status_code}", "detail": res.text}}
    except Exception as e:
        return {"response": {"error": "Failed to connect to Ollama", "detail": str(e)}}
