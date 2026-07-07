"""
ai/app/services/ollama_service.py
Service for interacting directly with the local Ollama LLM engine with resilient response parsing.
"""
import os
import re
import time
import logging
import threading
from contextlib import contextmanager
from typing import Optional
import httpx

logger = logging.getLogger("ollama_service")

# Only one Ollama inference at a time — concurrent calls queue instead of competing.
_generate_semaphore = threading.Semaphore(1)
_queue_lock = threading.Lock()
_current_task: Optional[str] = None

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "gemma3:4b")
DEFAULT_GENERATE_TIMEOUT = float(os.getenv("OLLAMA_GENERATE_TIMEOUT", "600"))
DEFAULT_CHAT_TIMEOUT = float(os.getenv("OLLAMA_CHAT_TIMEOUT", "300"))


def get_queue_status() -> dict:
    """Return whether Ollama is busy and which task holds the lock."""
    with _queue_lock:
        return {"busy": _current_task is not None, "current_task": _current_task}


@contextmanager
def _inference_slot(task_name: str):
    _generate_semaphore.acquire()
    with _queue_lock:
        global _current_task
        _current_task = task_name
    logger.info(f"🦙 [OLLAMA QUEUE] Acquired slot for task='{task_name}'")
    try:
        yield
    finally:
        with _queue_lock:
            _current_task = None
        _generate_semaphore.release()
        logger.info(f"🦙 [OLLAMA QUEUE] Released slot for task='{task_name}'")


def check_model_available() -> bool:
    """Checks if the target model is available on the local Ollama instance."""
    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.get(f"{OLLAMA_URL}/api/tags")
            if res.status_code == 200:
                models = res.json().get("models", [])
                for m in models:
                    name = m.get("name", "")
                    model_tag = m.get("model", "")
                    if name == MODEL_NAME or model_tag == MODEL_NAME or name.startswith(MODEL_NAME):
                        return True
            return False
    except Exception as e:
        raise RuntimeError(f"Ollama server is unreachable at {OLLAMA_URL}. Error: {str(e)}")


def _clean_reasoning_text(text: str) -> str:
    """Removes <think>...</think> tags and internal reasoning monologues from Qwen3."""
    if not text:
        return ""
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    if "We are given:" in cleaned[:300] or "Important:" in cleaned[:300]:
        lines = cleaned.split("\n")
        filtered = []
        skip = False
        for line in lines:
            l = line.strip()
            if l.startswith(("We are given:", "Important:", "Real-time web search", "- Source", "Key facts about", "Let's check")):
                skip = True
                continue
            if skip and l.startswith(("Hi", "Hello", "Dear", "###", "1.", "2.", "-", "*", "Since", "Regarding", "For Germany:", "For Pakistan:")):
                skip = False
            if not skip:
                filtered.append(line)
        reconstructed = "\n".join(filtered).strip()
        if len(reconstructed) > 30:
            return reconstructed
    return cleaned if cleaned else text.strip()


def _do_generate(prompt: str, timeout: float, num_predict: int = 1200) -> str:
    """Core Ollama /api/generate call with configurable timeout."""
    logger.info(
        f"🦙 [OLLAMA SERVICE] Sending POST to {OLLAMA_URL}/api/generate | "
        f"Model: '{MODEL_NAME}' | timeout={timeout}s | num_predict={num_predict}"
    )
    start = time.time()
    try:
        with httpx.Client(timeout=timeout) as client:
            payload = {
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_ctx": 4096,
                    "num_predict": num_predict,
                    "temperature": 0.4
                }
            }
            res = client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            duration = time.time() - start
            logger.info(f"🦙 [OLLAMA SERVICE] Generate HTTP status: {res.status_code} in {duration:.2f}s")

            if res.status_code == 200:
                data = res.json()
                raw_response = data.get("response", "")
                cleaned = _clean_reasoning_text(raw_response)
                logger.info(
                    f"🦙 [OLLAMA SERVICE] Generate completed ({len(cleaned)} chars): "
                    f"'{cleaned[:80]}...'"
                )
                return cleaned
            logger.error(f"❌ [OLLAMA SERVICE] Error status {res.status_code}: {res.text}")
            raise RuntimeError(f"Ollama returned HTTP status {res.status_code}: {res.text}")
    except httpx.TimeoutException as e:
        duration = time.time() - start
        logger.error(f"⏱️ [OLLAMA SERVICE] Generate timed out after {duration:.2f}s: {str(e)}")
        raise RuntimeError(f"Ollama generate timed out after {timeout}s") from e
    except httpx.RequestError as e:
        logger.error(f"💥 [OLLAMA SERVICE] HTTP Request failed to {OLLAMA_URL}: {str(e)}")
        raise RuntimeError(
            f"Failed to communicate with Ollama server at {OLLAMA_URL}. Is Ollama running? Error: {str(e)}"
        ) from e


def generate(
    prompt: str,
    timeout: Optional[float] = None,
    num_predict: int = 1200,
    use_lock: bool = True,
    task_name: str = "generate",
) -> str:
    """Sends a raw prompt to Ollama /api/generate endpoint and returns the generated text."""
    effective_timeout = timeout if timeout is not None else DEFAULT_GENERATE_TIMEOUT
    if use_lock:
        with _inference_slot(task_name):
            return _do_generate(prompt, effective_timeout, num_predict)
    return _do_generate(prompt, effective_timeout, num_predict)


def _do_chat(messages: list) -> str:
    logger.info(f"🦙 [OLLAMA SERVICE] Sending POST to {OLLAMA_URL}/api/chat | Model: '{MODEL_NAME}' | Messages count: {len(messages)}")
    start = time.time()
    try:
        with httpx.Client(timeout=DEFAULT_CHAT_TIMEOUT) as client:
            payload = {
                "model": MODEL_NAME,
                "messages": messages,
                "stream": False,
                "options": {
                    "num_ctx": 8192,
                    "num_predict": 1200,
                    "temperature": 0.4
                }
            }
            res = client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            duration = time.time() - start
            logger.info(f"🦙 [OLLAMA SERVICE] Chat HTTP status: {res.status_code} in {duration:.2f}s")

            if res.status_code == 200:
                data = res.json()
                msg = data.get("message", {})
                content = msg.get("content", "").strip()
                if not content:
                    logger.warning("⚠️ [OLLAMA SERVICE] 'content' field was empty! Checking for 'thinking' or 'reasoning' keys...")
                    content = msg.get("thinking", "") or msg.get("reasoning", "")
                    if not content and "thinking" in data:
                        content = data.get("thinking", "")
                cleaned_content = _clean_reasoning_text(content)
                logger.info(f"🦙 [OLLAMA SERVICE] Retrieved final content snippet ({len(cleaned_content)} chars): '{cleaned_content[:80]}...'")
                return cleaned_content
            logger.error(f"❌ [OLLAMA SERVICE] Error status {res.status_code}: {res.text}")
            raise RuntimeError(f"Ollama returned HTTP status {res.status_code}: {res.text}")
    except httpx.RequestError as e:
        logger.error(f"💥 [OLLAMA SERVICE] HTTP Request failed to {OLLAMA_URL}: {str(e)}")
        raise RuntimeError(f"Failed to communicate with Ollama server at {OLLAMA_URL}. Is Ollama running? Error: {str(e)}")


def chat(messages: list) -> str:
    """Sends multi-turn chat messages to Ollama /api/chat endpoint and returns response content."""
    with _inference_slot("chat"):
        return _do_chat(messages)


def _iter_stream_chat(messages: list):
    logger.info(f"🦙 [OLLAMA SERVICE STREAM] Initiating stream POST to {OLLAMA_URL}/api/chat | Model: '{MODEL_NAME}'")
    try:
        with httpx.Client(timeout=DEFAULT_CHAT_TIMEOUT) as client:
            payload = {
                "model": MODEL_NAME,
                "messages": messages,
                "stream": True,
                "options": {
                    "num_ctx": 8192,
                    "num_predict": 1200,
                    "temperature": 0.4
                }
            }
            with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as response:
                if response.status_code != 200:
                    logger.error(f"❌ [OLLAMA SERVICE STREAM] Status {response.status_code}")
                    raise RuntimeError(f"Ollama returned HTTP status {response.status_code}")

                import json
                for line in response.iter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            msg = data.get("message", {})
                            chunk = msg.get("content", "")
                            if chunk:
                                yield chunk
                            if data.get("done", False):
                                break
                        except Exception:
                            continue
    except httpx.RequestError as e:
        logger.error(f"💥 [OLLAMA SERVICE STREAM] Stream failed: {str(e)}")
        raise RuntimeError(f"Failed to communicate with Ollama server at {OLLAMA_URL}. Error: {str(e)}") from e
    except Exception as e:
        logger.error(f"💥 [OLLAMA SERVICE STREAM] Stream failed: {str(e)}")
        raise RuntimeError(f"Ollama stream failed: {str(e)}") from e


def stream_chat(messages: list):
    """Streams multi-turn chat message tokens directly from Ollama /api/chat endpoint."""
    with _inference_slot("chat"):
        yield from _iter_stream_chat(messages)
