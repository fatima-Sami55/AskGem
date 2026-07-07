"""
ai/app/agents/profile_extract_agent.py
Validates and corrects regex-drafted profile fields using Ollama structured JSON output.
"""
import json
import logging
from typing import Any, Dict

from app.services import ollama_service
from app.services.prompt_service import build_profile_extract_prompt

logger = logging.getLogger("profile_extract_agent")

CONFIDENCE_THRESHOLD = 0.75

ALLOWED_FIELDS = {
    "name", "gpa", "educationLevel", "targetDegree", "major",
    "preferredCountries", "maxBudget", "age", "englishTest",
    "workExperience", "researchExperience", "publications", "residency",
}


def _parse_json_response(raw: str) -> dict:
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


def _normalize_field_value(field: str, value: Any) -> Any:
    if value is None:
        return None
    if field == "gpa":
        try:
            gpa = round(float(value), 2)
            return gpa if 0 <= gpa <= 4.0 else None
        except (TypeError, ValueError):
            return None
    if field == "maxBudget":
        try:
            budget = int(float(value))
            return budget if 0 <= budget <= 999999 else None
        except (TypeError, ValueError):
            return None
    if field == "age":
        try:
            age = int(value)
            return age if 15 <= age <= 45 else None
        except (TypeError, ValueError):
            return None
    if field == "workExperience":
        try:
            exp = float(value)
            return exp if 0 <= exp <= 50 else None
        except (TypeError, ValueError):
            return None
    if field == "publications":
        try:
            pubs = int(value)
            return pubs if 0 <= pubs <= 100 else None
        except (TypeError, ValueError):
            return None
    if field == "researchExperience":
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ("true", "yes", "1")
        return bool(value)
    if field == "preferredCountries":
        if isinstance(value, str):
            return [value.strip()]
        if isinstance(value, list):
            return [str(c).strip() for c in value if c][:10]
        return None
    if field == "englishTest":
        if isinstance(value, dict):
            test_type = value.get("testType") or value.get("test_type") or "None"
            score = value.get("score")
            if score is not None and score != "":
                try:
                    score = float(score)
                except (TypeError, ValueError):
                    score = None
            else:
                score = None
            return {"testType": str(test_type), "score": score}
        return None
    if field in ("educationLevel", "targetDegree", "major", "name", "residency"):
        text = str(value).strip()
        return text if text else None
    return value


def validate_profile_extraction(
    message: str,
    current_context: dict,
    regex_draft: dict,
) -> dict:
    """Run LLM validation on a regex draft and return structured field results."""
    prompt = build_profile_extract_prompt(message, current_context or {}, regex_draft or {})
    logger.info("[PROFILE EXTRACT] Dispatching validation prompt to Ollama...")

    try:
        raw = ollama_service.generate(prompt, task_name="profile_extract")
        parsed = _parse_json_response(raw)
        fields_raw = parsed.get("fields") or parsed
        notes = parsed.get("notes")

        fields: Dict[str, dict] = {}
        for field_name, meta in fields_raw.items():
            if field_name not in ALLOWED_FIELDS:
                continue
            if not isinstance(meta, dict):
                continue
            confidence = float(meta.get("confidence", 0))
            confidence = max(0.0, min(1.0, confidence))
            action = str(meta.get("action", "skip")).lower()
            if action not in ("update", "skip", "conflict"):
                action = "skip"
            value = _normalize_field_value(field_name, meta.get("value"))
            fields[field_name] = {
                "value": value,
                "confidence": confidence,
                "action": action,
                "reason": meta.get("reason"),
            }

        return {"fields": fields, "notes": notes}
    except Exception as exc:
        logger.error(f"[PROFILE EXTRACT] LLM validation failed: {exc}")
        return {"fields": {}, "notes": f"Validation unavailable: {exc}"}


def merge_validated_fields(
    current_context: dict,
    regex_draft: dict,
    validation: dict,
) -> dict:
    """Apply validated fields; fall back to regex draft only when LLM unavailable."""
    merged = {}
    fields = (validation or {}).get("fields") or {}

    if not fields:
        return {}

    for field_name in ALLOWED_FIELDS:
        meta = fields.get(field_name)
        if not meta:
            continue
        action = meta.get("action", "skip")
        confidence = float(meta.get("confidence", 0))
        value = meta.get("value")

        if action == "skip" or confidence < CONFIDENCE_THRESHOLD:
            continue
        if action == "conflict":
            continue
        if value is None and field_name not in ("englishTest", "researchExperience", "workExperience", "publications"):
            continue

        if field_name == "preferredCountries" and isinstance(value, list):
            existing = list((current_context or {}).get("preferredCountries") or [])
            merged[field_name] = list(dict.fromkeys(existing + value))[:10]
        else:
            merged[field_name] = value

    return merged
