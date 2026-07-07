"""
ai/app/agents/recommendations_agent.py
Generates personalized university and scholarship recommendations via web search + LLM synthesis.
Falls back to heuristic results from Tavily search when LLM synthesis fails or times out.
"""
import json
import logging
import os
import re
from datetime import datetime

from app.services import ollama_service, search_service
from app.services.university_sources import (
    build_curated_universities,
    dedupe_universities,
    extract_ielts_min,
    extract_min_gpa,
    filter_official_search_results,
    infer_tuition,
    is_listicle_result,
    is_official_university_url,
    normalize_uni_name,
    supplement_with_curated,
)

logger = logging.getLogger("recommendations_agent")

LLM_NUM_PREDICT = int(os.getenv("RECOMMENDATIONS_NUM_PREDICT", "1200"))
LLM_TIMEOUT_SEC = float(
    os.getenv("RECOMMENDATIONS_LLM_TIMEOUT")
    or os.getenv("OLLAMA_GENERATE_TIMEOUT", "600")
)
MAX_SEARCH_FACTS = int(os.getenv("RECOMMENDATIONS_MAX_SEARCH_FACTS", "6"))

DEFAULT_UNIVERSITY_DISCLAIMER = "Verify all details on official university websites."
DEFAULT_SCHOLARSHIP_DISCLAIMER = "Verify eligibility and deadlines on official scholarship portals."
FALLBACK_DISCLAIMER = (
    "Results compiled from live web search. AI synthesis was unavailable — "
    "verify all details on official sites."
)


def _repair_truncated_json_array(cleaned: str) -> list | None:
    """Best-effort repair when the model truncates mid-JSON."""
    if not cleaned.startswith("["):
        return None

    last_object = cleaned.rfind("},")
    if last_object != -1:
        attempt = cleaned[: last_object + 1] + "]"
        try:
            parsed = json.loads(attempt)
            if isinstance(parsed, list) and parsed:
                logger.warning(
                    "[RECOMMENDATIONS] Recovered %d items from truncated JSON array",
                    len(parsed),
                )
                return parsed
        except json.JSONDecodeError:
            pass

    last_object = cleaned.rfind("}")
    if last_object != -1:
        attempt = cleaned[: last_object + 1] + "]"
        try:
            parsed = json.loads(attempt)
            if isinstance(parsed, list) and parsed:
                logger.warning(
                    "[RECOMMENDATIONS] Recovered %d items from truncated JSON array",
                    len(parsed),
                )
                return parsed
        except json.JSONDecodeError:
            pass

    return None


def _parse_json_array(raw: str) -> list:
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]
    elif start != -1:
        cleaned = cleaned[start:]

    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            raise ValueError("Expected JSON array")
        return parsed
    except (json.JSONDecodeError, ValueError) as exc:
        repaired = _repair_truncated_json_array(cleaned)
        if repaired is not None:
            return repaired
        logger.error(
            "[RECOMMENDATIONS] JSON parse failed: %s | raw snippet: %s",
            exc,
            (raw or "")[:400],
        )
        raise


def _profile_summary(profile: dict) -> str:
    countries = profile.get("preferred_countries") or profile.get("preferredCountries") or []
    if isinstance(countries, str):
        countries = [countries]
    major = profile.get("preferred_majors") or profile.get("preferredMajors") or []
    if isinstance(major, list):
        major = major[0] if major else profile.get("major") or "your field"
    elif not major:
        major = profile.get("major") or "your field"
    gpa = profile.get("cgpa") if profile.get("cgpa") is not None else profile.get("gpa")
    degree = profile.get("target_degree") or profile.get("targetDegree") or "Masters"
    country_str = ", ".join(countries[:3]) if countries else "your target countries"
    gpa_str = f"{gpa} GPA" if gpa is not None else "GPA pending"
    return f"Based on your profile: {gpa_str}, {degree} in {major}, {country_str}"


def _normalize_profile(profile_dict: dict) -> dict:
    p = profile_dict or {}
    countries = p.get("preferred_countries") or p.get("preferredCountries") or []
    if isinstance(countries, str):
        countries = [countries]
    majors = p.get("preferred_majors") or p.get("preferredMajors") or []
    if not majors and p.get("major"):
        majors = [p.get("major")]
    return {
        "nationality": p.get("nationality") or p.get("residency") or "Pakistani",
        "target_degree": p.get("target_degree") or p.get("targetDegree") or "Masters",
        "major": majors[0] if majors else "Computer Science",
        "countries": countries,
        "cgpa": p.get("cgpa") if p.get("cgpa") is not None else p.get("gpa"),
        "budget": p.get("budget") if p.get("budget") is not None else p.get("maxBudget"),
        "english_test": p.get("english_test") or p.get("englishTest") or {},
        "name": p.get("name"),
    }


def _format_search_context(search_results: list) -> str:
    facts = []
    for i, r in enumerate(search_results[:MAX_SEARCH_FACTS], 1):
        facts.append(f"[{i}] {r['title']}\nURL: {r['url']}\nSnippet: {r['snippet']}")
    return "\n\n".join(facts) if facts else "No live search results."


def _extract_name_from_title(title: str) -> str:
    name = re.split(r"\||–|—|-", title)[0].strip()
    name = re.sub(r"^\d+\.\s*", "", name)
    return name[:120] if name else title[:80]


def _display_name_from_search_result(title: str, url: str) -> str:
    return _extract_name_from_title(title)


def _build_university_fallback(search_results: list, profile: dict, country: str) -> list:
    """Build university cards from official search hits only."""
    universities = []
    seen_urls: set[str] = set()
    degree = profile["target_degree"]
    major = profile["major"]

    for r in search_results:
        url = (r.get("url") or "").strip()
        title = (r.get("title") or "").strip()
        snippet = (r.get("snippet") or r.get("content") or "").strip()

        if not title or not url.startswith("http"):
            continue
        if is_listicle_result(title, snippet):
            continue
        if not is_official_university_url(url):
            continue
        if url.lower() in seen_urls:
            continue
        seen_urls.add(url.lower())

        combined = f"{title} {snippet}"
        min_gpa = extract_min_gpa(combined)
        ielts_min = extract_ielts_min(combined)
        tuition = infer_tuition(combined)

        universities.append({
            "name": _display_name_from_search_result(title, url),
            "country": country,
            "program": f"{degree} in {major}",
            "minGpa": min_gpa,
            "ieltsMin": ielts_min,
            "tuition": tuition,
            "whyItFits": (
                snippet[:220] + ("..." if len(snippet) > 220 else "")
                if snippet
                else f"Official {major} program page in {country} — verify admission requirements on the site."
            ),
            "sourceUrl": url,
            "matchScore": None,
            "verified": True,
            "source": "search_fallback",
        })
        if len(universities) >= 8:
            break

    if universities:
        logger.info("[RECOMMENDATIONS] Built %d official university fallback items from search", len(universities))
    return universities


def _build_scholarship_fallback(search_results: list, profile: dict, country: str) -> list:
    """Heuristic scholarship list from Tavily results when LLM synthesis fails."""
    scholarships = []
    seen_urls = set()
    nationality = profile["nationality"]
    degree = profile["target_degree"]
    major = profile["major"]

    for i, r in enumerate(search_results):
        url = (r.get("url") or "").strip()
        title = (r.get("title") or "").strip()
        snippet = (r.get("snippet") or r.get("content") or "").strip()
        combined = f"{title} {snippet}".lower()

        if not title or not url.startswith("http") or url in seen_urls:
            continue
        if not any(kw in combined for kw in (
            "scholarship", "funding", "funded", "stipend", "fellowship", "daad", "erasmus", "grant"
        )):
            continue
        seen_urls.add(url)

        funding_type = "Fully Funded" if any(
            kw in combined for kw in ("fully funded", "full funding", "full scholarship")
        ) else "Partial"

        scholarships.append({
            "name": _display_name_from_search_result(title, url),
            "country": country,
            "fundingType": funding_type,
            "coverage": "Verify coverage on official site",
            "eligibility": f"{nationality} students pursuing {degree} in {major}",
            "deadline": "Verify on official site",
            "amount": None,
            "whyItFits": (
                snippet[:220] + ("..." if len(snippet) > 220 else "")
                if snippet
                else f"Potential funding opportunity for {nationality} students in {country}."
            ),
            "sourceUrl": url,
            "matchScore": None,
            "verified": False,
            "source": "search_fallback",
        })
        if len(scholarships) >= 8:
            break

    if not scholarships:
        scholarships = _build_scholarship_fallback_relaxed(search_results, profile, country)

    if scholarships:
        logger.info("[RECOMMENDATIONS] Built %d scholarship fallback items from search", len(scholarships))
    return scholarships


def _build_scholarship_fallback_relaxed(search_results: list, profile: dict, country: str) -> list:
    """Include any search hit if strict scholarship filter found nothing."""
    scholarships = []
    seen_urls = set()
    for i, r in enumerate(search_results):
        url = (r.get("url") or "").strip()
        title = (r.get("title") or "").strip()
        snippet = (r.get("snippet") or "").strip()
        if not title or not url.startswith("http") or url in seen_urls:
            continue
        seen_urls.add(url)
        scholarships.append({
            "name": _display_name_from_search_result(title, url),
            "country": country,
            "fundingType": "Partial",
            "coverage": "Verify on official site",
            "eligibility": f"International students — {profile['target_degree']} in {profile['major']}",
            "deadline": "Verify on official site",
            "amount": None,
            "whyItFits": snippet[:220] if snippet else "Funding-related result from live search.",
            "sourceUrl": url,
            "matchScore": None,
            "verified": False,
            "source": "search_fallback",
        })
        if len(scholarships) >= 6:
            break
    return scholarships


def _normalize_university_item(item: dict, country: str) -> dict | None:
    if not isinstance(item, dict):
        return None
    name = str(
        item.get("name") or item.get("universityName") or item.get("university") or ""
    ).strip()
    if not name or name.lower().startswith("useful portal:"):
        return None
    url = str(item.get("sourceUrl") or item.get("url") or "").strip()
    if not url.startswith("http"):
        return None
    if is_listicle_result(name, item.get("whyItFits") or ""):
        return None
    if not is_official_university_url(url):
        return None

    score_raw = item.get("matchScore") if item.get("matchScore") is not None else item.get("score")
    match_score = None
    if score_raw is not None and score_raw != "":
        try:
            match_score = min(100, max(0, int(score_raw)))
        except (TypeError, ValueError):
            match_score = None

    why_text = str(item.get("whyItFits") or "Matches your academic profile.").strip()
    min_gpa = item.get("minGpa")
    if min_gpa in (None, ""):
        min_gpa = extract_min_gpa(why_text)
    ielts_min = item.get("ieltsMin")
    if ielts_min in (None, ""):
        ielts_min = extract_ielts_min(why_text)
    tuition = item.get("tuition") or infer_tuition(why_text)

    return {
        "name": name,
        "country": str(item.get("country") or country).strip(),
        "program": item.get("program"),
        "minGpa": min_gpa,
        "ieltsMin": ielts_min,
        "tuition": tuition,
        "whyItFits": why_text,
        "sourceUrl": url,
        "matchScore": match_score,
        "verified": True,
        "source": item.get("source", "llm"),
    }


def _normalize_scholarship_item(item: dict, country: str) -> dict | None:
    if not isinstance(item, dict):
        return None
    name = str(item.get("name") or item.get("scholarshipName") or item.get("title") or "").strip()
    if not name:
        return None
    url = str(item.get("sourceUrl") or item.get("url") or "").strip()
    if not url.startswith("http"):
        return None
    score_raw = item.get("matchScore") if item.get("matchScore") is not None else item.get("score")
    match_score = None
    if score_raw is not None and score_raw != "":
        try:
            match_score = min(100, max(0, int(score_raw)))
        except (TypeError, ValueError):
            match_score = None
    return {
        "name": name,
        "country": str(item.get("country") or country).strip(),
        "fundingType": str(item.get("fundingType") or "Partial").strip(),
        "coverage": item.get("coverage"),
        "eligibility": item.get("eligibility"),
        "deadline": item.get("deadline") or "Verify on official site",
        "amount": item.get("amount"),
        "whyItFits": str(item.get("whyItFits") or "Potential match for your profile.").strip(),
        "sourceUrl": url,
        "matchScore": match_score,
        "verified": item.get("verified", True),
        "source": item.get("source", "llm"),
    }


def _generic_university_fallback(profile: dict, country: str) -> list:
    """Curated official universities when search and LLM both fail."""
    return build_curated_universities(profile, country)


def _generic_scholarship_fallback(profile: dict, country: str) -> list:
    nationality = profile["nationality"]
    degree = profile["target_degree"]
    major = profile["major"]
    return [{
        "name": "Useful portal: daad.de",
        "country": country,
        "fundingType": "Fully Funded",
        "coverage": "Verify coverage on official site",
        "eligibility": f"{nationality} students pursuing {degree} in {major}",
        "deadline": "Verify on official site",
        "amount": None,
        "whyItFits": "Official DAAD listing of scholarships for international students in Germany and beyond.",
        "sourceUrl": "https://www.daad.de/en/study-and-research-in-germany/scholarships/",
        "matchScore": None,
        "verified": False,
        "source": "portal_fallback",
    }, {
        "name": "Useful portal: scholars4dev.com",
        "country": country,
        "fundingType": "Partial",
        "coverage": "Verify on official site",
        "eligibility": f"International students — {degree} in {major}",
        "deadline": "Verify on official site",
        "amount": None,
        "whyItFits": "Curated scholarship opportunities searchable by country and degree level.",
        "sourceUrl": "https://www.scholars4dev.com/",
        "matchScore": None,
        "verified": False,
        "source": "portal_fallback",
    }]


def _synthesize_with_llm(prompt: str, label: str) -> list | None:
    try:
        logger.debug("[recommendations] dispatch %s synthesis timeout=%ss", label, LLM_TIMEOUT_SEC)
        raw = ollama_service.generate(
            prompt,
            timeout=LLM_TIMEOUT_SEC,
            num_predict=LLM_NUM_PREDICT,
            task_name=f"recommendations_{label}",
        )
        logger.debug("[recommendations] %s raw response (%d chars)", label, len(raw or ""))
        items = _parse_json_array(raw)
        logger.info("[recommendations] %s done items=%d", label, len(items))
        return items
    except Exception as exc:
        logger.error("[RECOMMENDATIONS] %s LLM synthesis failed: %s", label, exc)
        return None


def get_university_recommendations(profile_dict: dict) -> dict:
    """Search and synthesize personalized university recommendations."""
    profile = _normalize_profile(profile_dict)
    summary = _profile_summary({**profile_dict, **profile})
    year = str(datetime.now().year)
    country = profile["countries"][0] if profile["countries"] else "Germany"
    queries = [
        (
            f"{profile['major']} {profile['target_degree']} program admission requirements "
            f"site:tum.de OR site:tu-berlin.de OR site:rwth-aachen.de OR site:kit.edu {country} {year}"
        ),
        (
            f"official {profile['major']} master program {country} "
            f"site:uni-*.de OR site:tu-*.de international students english {year}"
        ),
    ]

    logger.info("[RECOMMENDATIONS] Searching universities for %s in %s", profile["major"], country)
    try:
        search_results = search_service.search_for_context(queries)
    except Exception as exc:
        logger.error("[RECOMMENDATIONS] University search failed: %s", exc)
        search_results = []

    official_results = filter_official_search_results(search_results)
    context_results = official_results or search_results
    search_context = _format_search_context(context_results)

    english = profile["english_test"]
    ielts = english.get("score") if isinstance(english, dict) else None

    prompt = (
        "Output ONLY a JSON array of 5-6 real universities. Each object: "
        "name, country, program, minGpa, ieltsMin, tuition, whyItFits (1 sentence), "
        "sourceUrl, matchScore (0-100).\n"
        "CRITICAL RULES:\n"
        "- sourceUrl MUST be an official university domain (e.g. tum.de, uni-*.de, tu-*.de, .edu, .ac.uk).\n"
        "- NEVER use blogs, rankings, or list articles (top 10, best universities, guides).\n"
        "- Use ONLY URLs from the search facts below.\n"
        "- No markdown.\n\n"
        f"Student: {profile['target_degree']} {profile['major']}, GPA {profile['cgpa'] or 'unknown'}, "
        f"countries {', '.join(profile['countries']) or country}, IELTS {ielts or 'N/A'}\n\n"
        f"Search facts:\n{search_context}\n"
    )

    universities = []
    used_fallback = False

    items = _synthesize_with_llm(prompt, "university")
    if items:
        for item in items[:8]:
            normalized = _normalize_university_item(item, country)
            if normalized:
                universities.append(normalized)

    if len(universities) < 4 and search_results:
        logger.warning("[RECOMMENDATIONS] Using official search fallback for universities")
        fallback_items = _build_university_fallback(search_results, profile, country)
        existing_names = {normalize_uni_name(u["name"]) for u in universities}
        for item in fallback_items:
            if normalize_uni_name(item["name"]) in existing_names:
                continue
            universities.append(item)
            existing_names.add(normalize_uni_name(item["name"]))
        used_fallback = True

    if len(universities) < 4:
        logger.warning("[RECOMMENDATIONS] Supplementing with curated official universities")
        universities = supplement_with_curated(universities, profile, country, target_count=6)
        used_fallback = True

    universities = dedupe_universities(universities)

    return {
        "universities": universities,
        "profileSummary": summary,
        "source": "fallback" if used_fallback else "llm",
        "disclaimer": FALLBACK_DISCLAIMER if used_fallback else DEFAULT_UNIVERSITY_DISCLAIMER,
    }


def get_scholarship_recommendations(profile_dict: dict) -> dict:
    """Search and synthesize personalized scholarship recommendations."""
    profile = _normalize_profile(profile_dict)
    summary = _profile_summary({**profile_dict, **profile})
    year = str(datetime.now().year)
    country = profile["countries"][0] if profile["countries"] else "Germany"
    nationality = profile["nationality"]

    queries = [
        f"{country} scholarships {nationality} students {profile['target_degree']} {profile['major']} {year}",
        f"fully funded scholarships {profile['major']} {country} international {year}",
    ]

    logger.info("[RECOMMENDATIONS] Searching scholarships for %s students", nationality)
    try:
        search_results = search_service.search_for_context(queries)
    except Exception as exc:
        logger.error("[RECOMMENDATIONS] Scholarship search failed: %s", exc)
        search_results = []
    search_context = _format_search_context(search_results)

    prompt = (
        "Output ONLY a JSON array of 5-6 scholarships. Each object: "
        "name, country, fundingType, coverage, eligibility, deadline, amount, whyItFits, "
        "sourceUrl, matchScore (0-100). Use ONLY URLs from search facts. No markdown.\n\n"
        f"Student: {nationality}, {profile['target_degree']} {profile['major']}, "
        f"GPA {profile['cgpa'] or 'unknown'}, countries {', '.join(profile['countries']) or country}\n\n"
        f"Search facts:\n{search_context}\n"
    )

    scholarships = []
    used_fallback = False

    items = _synthesize_with_llm(prompt, "scholarship")
    if items:
        for item in items[:8]:
            normalized = _normalize_scholarship_item(item, country)
            if normalized:
                scholarships.append(normalized)

    if not scholarships and search_results:
        logger.warning("[RECOMMENDATIONS] Using search fallback for scholarships (LLM empty or failed)")
        scholarships = _build_scholarship_fallback(search_results, profile, country)
        used_fallback = True

    if not scholarships:
        logger.warning("[RECOMMENDATIONS] No scholarship results — using generic portal fallback")
        scholarships = _generic_scholarship_fallback(profile, country)
        used_fallback = True

    return {
        "scholarships": scholarships,
        "profileSummary": summary,
        "source": "fallback" if used_fallback else "llm",
        "disclaimer": FALLBACK_DISCLAIMER if used_fallback else DEFAULT_SCHOLARSHIP_DISCLAIMER,
    }
