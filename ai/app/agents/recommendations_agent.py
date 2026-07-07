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
from urllib.parse import urlparse

from app.services import ollama_service, search_service

logger = logging.getLogger("recommendations_agent")

LLM_NUM_PREDICT = int(os.getenv("RECOMMENDATIONS_NUM_PREDICT", "500"))
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
    if start != -1 and end != -1:
        cleaned = cleaned[start : end + 1]
    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            raise ValueError("Expected JSON array")
        return parsed
    except (json.JSONDecodeError, ValueError) as exc:
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
    return name[:120] if name else title[:80]


UNI_DOMAIN_RE = re.compile(r"\.(edu|ac\.|univ|uni-|tu-|ethz|tum|rwth)", re.I)
UNI_TITLE_RE = re.compile(
    r"\b(university|universität|institute of technology|technical university|college|TUM|ETH|RWTH)\b",
    re.I,
)


def _looks_like_university(url: str, title: str) -> bool:
    return bool(UNI_DOMAIN_RE.search(url or "") or UNI_TITLE_RE.search(title or ""))


def _display_name_from_search_result(title: str, url: str) -> str:
    if _looks_like_university(url, title):
        return _extract_name_from_title(title)
    host = urlparse(url).netloc.replace("www.", "") or "official site"
    return f"Useful portal: {host}"


def _build_university_fallback(search_results: list, profile: dict, country: str) -> list:
    """Heuristic university list from Tavily results when LLM synthesis fails."""
    universities = []
    seen_urls = set()
    degree = profile["target_degree"]
    major = profile["major"]

    for i, r in enumerate(search_results):
        url = (r.get("url") or "").strip()
        title = (r.get("title") or "").strip()
        snippet = (r.get("snippet") or r.get("content") or "").strip()

        if not title or not url.startswith("http") or url in seen_urls:
            continue
        seen_urls.add(url)

        snippet_lower = snippet.lower()
        tuition = "Verify on official site"
        if any(kw in snippet_lower for kw in ("tuition-free", "tuition free", "no tuition", "semester fee")):
            tuition = "Low / tuition-free (verify on site)"

        universities.append({
            "name": _display_name_from_search_result(title, url),
            "country": country,
            "program": f"{degree} in {major}",
            "minGpa": None,
            "ieltsMin": None,
            "tuition": tuition,
            "whyItFits": (
                snippet[:220] + ("..." if len(snippet) > 220 else "")
                if snippet
                else f"Relevant {major} option in {country} from live search — verify requirements on the official site."
            ),
            "sourceUrl": url,
            "matchScore": None,
            "verified": False,
            "source": "search_fallback",
        })
        if len(universities) >= 8:
            break

    if universities:
        logger.info("[RECOMMENDATIONS] Built %d university fallback items from search", len(universities))
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
        "program": item.get("program"),
        "minGpa": item.get("minGpa"),
        "ieltsMin": item.get("ieltsMin"),
        "tuition": item.get("tuition"),
        "whyItFits": str(item.get("whyItFits") or "Matches your academic profile.").strip(),
        "sourceUrl": url,
        "matchScore": match_score,
        "verified": item.get("verified", True),
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
    """Last-resort portal links when search and LLM both fail."""
    degree = profile["target_degree"]
    major = profile["major"]
    return [{
        "name": "Useful portal: daad.de",
        "country": country,
        "program": f"{degree} in {major}",
        "minGpa": None,
        "ieltsMin": None,
        "tuition": "Verify on official site",
        "whyItFits": f"Official portal to explore accredited {major} programs in {country}.",
        "sourceUrl": "https://www.daad.de/en/study-and-research-in-germany/",
        "matchScore": None,
        "verified": False,
        "source": "portal_fallback",
    }, {
        "name": "Useful portal: study.eu",
        "country": country,
        "program": f"{degree} in {major}",
        "minGpa": None,
        "ieltsMin": None,
        "tuition": "Verify on official site",
        "whyItFits": f"Browse English-taught {degree} options in {country} for international students.",
        "sourceUrl": "https://www.study.eu/",
        "matchScore": None,
        "verified": False,
        "source": "portal_fallback",
    }]


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
        logger.info("[RECOMMENDATIONS] Dispatching %s synthesis to Ollama (timeout=%ss)", label, LLM_TIMEOUT_SEC)
        raw = ollama_service.generate(
            prompt,
            timeout=LLM_TIMEOUT_SEC,
            num_predict=LLM_NUM_PREDICT,
            task_name=f"recommendations_{label}",
        )
        logger.info("[RECOMMENDATIONS] %s Ollama raw response (%d chars)", label, len(raw or ""))
        items = _parse_json_array(raw)
        logger.info("[RECOMMENDATIONS] %s parsed %d items from LLM JSON", label, len(items))
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
        f"best {profile['target_degree']} {profile['major']} universities {country} international students {year}",
        f"top {profile['major']} programs {country} admission GPA tuition {year}",
    ]

    logger.info("[RECOMMENDATIONS] Searching universities for %s in %s", profile["major"], country)
    try:
        search_results = search_service.search_for_context(queries)
    except Exception as exc:
        logger.error("[RECOMMENDATIONS] University search failed: %s", exc)
        search_results = []
    search_context = _format_search_context(search_results)

    english = profile["english_test"]
    ielts = english.get("score") if isinstance(english, dict) else None

    prompt = (
        "Output ONLY a JSON array of 5-6 universities. Each object: "
        "name, country, program, minGpa, ieltsMin, tuition, whyItFits (1 sentence), "
        "sourceUrl, matchScore (0-100). Use ONLY URLs from search facts. No markdown.\n\n"
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

    if not universities and search_results:
        logger.warning("[RECOMMENDATIONS] Using search fallback for universities (LLM empty or failed)")
        universities = _build_university_fallback(search_results, profile, country)
        used_fallback = True

    if not universities:
        logger.warning("[RECOMMENDATIONS] No university results — using generic portal fallback")
        universities = _generic_university_fallback(profile, country)
        used_fallback = True

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
