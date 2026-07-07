"""
Helpers for university recommendation quality: official URL detection,
listicle filtering, deduplication, and curated fallbacks.
"""
from __future__ import annotations

import re
from urllib.parse import urlparse

BLOCKED_HOSTS = frozenset({
    "expatrio.com",
    "study.eu",
    "studying-in-germany.org",
    "topuniversities.com",
    "mastersportal.com",
    "bachelorsportal.com",
    "studyportals.com",
    "studyportals.eu",
    "niche.com",
    "usnews.com",
    "timeshighereducation.com",
    "hotcoursesabroad.com",
    "hotcourses.com",
    "qs.com",
    "aralia.com",
    "best-masters.com",
    "bestmasters.com",
    "collegedunia.com",
    "shiksha.com",
    "yocket.com",
    "leverageedu.com",
    "idp.com",
    "gooverseas.com",
    "studyabroad.com",
    "internationalstudent.com",
    "scholars4dev.com",
    "wikipedia.org",
    "reddit.com",
    "quora.com",
    "medium.com",
    "youtube.com",
    "facebook.com",
    "linkedin.com",
    "pinterest.com",
    "forbes.com",
    "businessinsider.com",
    "blogspot.com",
    "wordpress.com",
    "wixsite.com",
})

LISTICLE_TITLE_RE = re.compile(
    r"\b("
    r"top\s*\d+|best\s*\d+|\d+\s+best|\d+\s+top|"
    r"rankings?|list of|ultimate guide|complete guide|"
    r"everything you need|should you study|why study"
    r")\b",
    re.I,
)

GPA_RE = re.compile(
    r"(?:gpa|grade|cgpa|grade point)\s*(?:of|>=|at least|:)?\s*([0-4]\.\d{1,2})",
    re.I,
)

IELTS_RE = re.compile(
    r"ielts\s*(?:of|>=|at least|:)?\s*([0-9](?:\.[05])?)",
    re.I,
)

TUITION_FREE_RE = re.compile(
    r"(tuition[- ]free|no tuition|free tuition|semester (?:fee|contribution) only|"
    r"no tuition fees|public university|€\s*0|0\s*eur)",
    re.I,
)

CURATED_UNIVERSITIES: dict[str, list[dict]] = {
    "Germany": [
        {
            "name": "Technical University of Munich",
            "sourceUrl": "https://www.tum.de/en/studies/degree-programs",
            "program": "Masters in Informatics / Computer Science",
            "tuition": "Semester contribution only",
            "minGpa": 2.7,
            "ieltsMin": 6.5,
            "whyItFits": "Top-ranked technical university with English-taught CS master's programs and strong industry links.",
        },
        {
            "name": "RWTH Aachen University",
            "sourceUrl": "https://www.rwth-aachen.de/en/studies/study-programs",
            "program": "Masters in Computer Science",
            "tuition": "Semester contribution only",
            "minGpa": 2.5,
            "ieltsMin": 6.5,
            "whyItFits": "Renowned engineering university with research-focused CS graduate programs.",
        },
        {
            "name": "Technical University of Berlin",
            "sourceUrl": "https://www.tu.berlin/en/studies/study-programs",
            "program": "Masters in Computer Science",
            "tuition": "Semester contribution only",
            "minGpa": 2.7,
            "ieltsMin": 6.5,
            "whyItFits": "Major Berlin tech hub university offering English-friendly CS master's pathways.",
        },
        {
            "name": "LMU Munich",
            "sourceUrl": "https://www.lmu.de/en/study/all-degrees-and-programs/",
            "program": "Masters in Computer Science",
            "tuition": "Semester contribution only",
            "minGpa": 2.7,
            "ieltsMin": 6.5,
            "whyItFits": "Leading research university in Munich with competitive graduate CS options.",
        },
        {
            "name": "University of Stuttgart",
            "sourceUrl": "https://www.uni-stuttgart.de/en/study/study-programs/",
            "program": "Masters in Computer Science",
            "tuition": "Semester contribution only",
            "minGpa": 2.5,
            "ieltsMin": 6.0,
            "whyItFits": "Strong engineering-focused programs including CS at a major Baden-Württemberg university.",
        },
        {
            "name": "Karlsruhe Institute of Technology",
            "sourceUrl": "https://www.kit.edu/english/study_at_kit_degree_courses.php",
            "program": "Masters in Computer Science",
            "tuition": "Semester contribution only",
            "minGpa": 2.7,
            "ieltsMin": 6.5,
            "whyItFits": "Elite STEM institute with rigorous CS master's programs and research opportunities.",
        },
        {
            "name": "University of Bonn",
            "sourceUrl": "https://www.uni-bonn.de/en/studying/degree-programs",
            "program": "Masters in Computer Science",
            "tuition": "Semester contribution only",
            "minGpa": 2.7,
            "ieltsMin": 6.5,
            "whyItFits": "Research university with solid graduate CS offerings in western Germany.",
        },
        {
            "name": "TU Dresden",
            "sourceUrl": "https://tu-dresden.de/studium/vor-dem-studium/studienangebot/sins/sins_studiengaenge?lang=en",
            "program": "Masters in Computer Science",
            "tuition": "Semester contribution only",
            "minGpa": 2.5,
            "ieltsMin": 6.0,
            "whyItFits": "Large technical university in eastern Germany with accessible public tuition.",
        },
    ],
}


def _host(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().replace("www.", "")
    except Exception:
        return ""


def is_blocked_host(host: str) -> bool:
    if not host:
        return True
    if host.endswith(".blog") or "blog." in host:
        return True
    for blocked in BLOCKED_HOSTS:
        if host == blocked or host.endswith(f".{blocked}"):
            return True
    return False


def is_listicle_result(title: str, snippet: str = "") -> bool:
    combined = f"{title} {snippet}".strip()
    return bool(LISTICLE_TITLE_RE.search(combined))


def is_official_university_url(url: str) -> bool:
    if not url or not url.startswith("http"):
        return False

    host = _host(url)
    if is_blocked_host(host):
        return False

    if any(marker in host for marker in (".edu", ".ac.uk", ".edu.au", ".ac.nz", ".ac.jp", ".ac.in")):
        return True

    if host.endswith(".ethz.ch") or host.endswith(".epfl.ch") or host.endswith(".eth.ch"):
        return True

    if "uni-" in host and host.endswith(".de"):
        return True

    if host.startswith("tu-") and ".de" in host:
        return True

    if host in {
        "tum.de",
        "lmu.de",
        "rwth-aachen.de",
        "kit.edu",
        "fau.de",
        "uni-heidelberg.de",
        "uni-bonn.de",
        "uni-freiburg.de",
        "uni-hamburg.de",
        "uni-koeln.de",
        "fu-berlin.de",
        "hu-berlin.de",
        "tu-dresden.de",
        "uni-stuttgart.de",
        "uni-muenster.de",
        "uni-goettingen.de",
    }:
        return True

    if host.endswith(".tum.de") or host.endswith(".kit.edu"):
        return True

    if host.endswith(".tu-berlin.de") or host == "tu.berlin":
        return True

    return False


def filter_official_search_results(results: list) -> list:
    clean = []
    seen = set()
    for item in results or []:
        url = (item.get("url") or "").strip()
        title = (item.get("title") or "").strip()
        snippet = (item.get("snippet") or item.get("content") or "").strip()
        if not url or url.lower() in seen:
            continue
        if is_listicle_result(title, snippet):
            continue
        if not is_official_university_url(url):
            continue
        seen.add(url.lower())
        clean.append(item)
    return clean


def canonical_url(url: str) -> str:
    host = _host(url)
    path = urlparse(url).path.rstrip("/").lower()
    return f"{host}{path}"


def normalize_uni_name(name: str) -> str:
    cleaned = re.sub(r"^(useful portal:\s*)", "", (name or "").lower())
    cleaned = re.sub(r"[^a-z0-9]", "", cleaned)
    return cleaned


def extract_min_gpa(text: str) -> float | None:
    match = GPA_RE.search(text or "")
    if not match:
        return None
    try:
        value = float(match.group(1))
        if 0 <= value <= 4.0:
            return value
    except (TypeError, ValueError):
        return None
    return None


def extract_ielts_min(text: str) -> float | None:
    match = IELTS_RE.search(text or "")
    if not match:
        return None
    try:
        return float(match.group(1))
    except (TypeError, ValueError):
        return None


def infer_tuition(text: str) -> str:
    if TUITION_FREE_RE.search(text or ""):
        return "Semester contribution only (public university)"
    return "Verify on official site"


def is_tuition_free_label(tuition: str | None) -> bool:
    return bool(TUITION_FREE_RE.search(tuition or ""))


def dedupe_universities(items: list) -> list:
    seen_urls: set[str] = set()
    seen_names: set[str] = set()
    deduped = []
    for item in items or []:
        url_key = canonical_url(item.get("sourceUrl") or "")
        name_key = normalize_uni_name(item.get("name") or "")
        if not url_key and not name_key:
            continue
        if url_key and url_key in seen_urls:
            continue
        if name_key and name_key in seen_names:
            continue
        if url_key:
            seen_urls.add(url_key)
        if name_key:
            seen_names.add(name_key)
        deduped.append(item)
    return deduped


def build_curated_universities(profile: dict, country: str, limit: int = 8) -> list:
    degree = profile.get("target_degree") or "Masters"
    major = profile.get("major") or "Computer Science"
    curated = CURATED_UNIVERSITIES.get(country, [])
    items = []
    for entry in curated[:limit]:
        items.append({
            "name": entry["name"],
            "country": country,
            "program": entry.get("program") or f"{degree} in {major}",
            "minGpa": entry.get("minGpa"),
            "ieltsMin": entry.get("ieltsMin"),
            "tuition": entry.get("tuition") or "Semester contribution only",
            "whyItFits": entry.get("whyItFits") or f"Accredited {major} option in {country}.",
            "sourceUrl": entry["sourceUrl"],
            "matchScore": None,
            "verified": True,
            "source": "curated",
        })
    return items


def supplement_with_curated(existing: list, profile: dict, country: str, target_count: int = 6) -> list:
    if len(existing) >= target_count:
        return existing

    seen_names = {normalize_uni_name(item.get("name") or "") for item in existing}
    merged = list(existing)

    for item in build_curated_universities(profile, country):
        name_key = normalize_uni_name(item["name"])
        if name_key in seen_names:
            continue
        seen_names.add(name_key)
        merged.append(item)
        if len(merged) >= target_count:
            break

    return merged
