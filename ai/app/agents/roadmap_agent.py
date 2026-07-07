"""
ai/app/agents/roadmap_agent.py
Agent orchestrating the generation of personalized academic roadmaps using live web search and local LLM synthesis.
"""
import os
import json
import logging
import re
import time
from datetime import datetime
from app.services import ollama_service, search_service, prompt_service
from app.services.roadmap_detailed_guide import build_detailed_roadmap

logger = logging.getLogger("roadmap_agent")

ROADMAP_LLM_TIMEOUT = float(
    os.getenv("ROADMAP_LLM_TIMEOUT")
    or os.getenv("OLLAMA_GENERATE_TIMEOUT", "600")
)
ROADMAP_NUM_PREDICT = int(os.getenv("ROADMAP_NUM_PREDICT", "1200"))
ROADMAP_USE_LLM = os.getenv("ROADMAP_USE_LLM", "").lower() in ("1", "true", "yes")
MAX_SEARCH_FACTS = int(os.getenv("ROADMAP_MAX_SEARCH_FACTS", "8"))
MAX_OPPORTUNITIES = int(os.getenv("ROADMAP_MAX_OPPORTUNITIES", "6"))


def _normalize_phase(value, fallback_idx: int) -> int:
    """Coerce LLM phase labels like 'Phase 1' into integer indices."""
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        match = re.search(r"\d+", value)
        if match:
            return int(match.group())
    return fallback_idx + 1


def _normalize_phases(phases: list) -> list:
    """Ensure every phase dict has an integer phase field for Pydantic validation."""
    normalized = []
    for idx, phase in enumerate(phases or []):
        if not isinstance(phase, dict):
            continue
        phase_copy = dict(phase)
        phase_copy["phase"] = _normalize_phase(phase_copy.get("phase"), idx)
        normalized.append(phase_copy)
    return normalized


def _extract_name_from_title(title: str) -> str:
    """Strip SEO suffixes from raw search titles."""
    name = re.split(r"\||–|—|:", title)[0].strip()
    name = re.sub(r"\s*\d{4}\s*$", "", name).strip()
    return name[:120] if name else title[:80]


def _guess_country(text: str, preferred_countries: list) -> str:
    """Match country from text against student's preferred countries."""
    text_lower = (text or "").lower()
    for country in preferred_countries:
        if country.lower() in text_lower:
            return country
    return preferred_countries[0] if preferred_countries else "International"


def _build_why_it_fits(
    opp_type: str,
    profile: dict,
    country: str,
    snippet: str,
) -> str:
    """One-sentence fit explanation tied to the student's profile."""
    nationality = profile.get("nationality") or "Pakistani"
    target_degree = profile.get("target_degree") or "Masters"
    major = profile.get("major") or "your field"
    cgpa = profile.get("cgpa")

    gpa_note = f"your {cgpa} GPA" if cgpa is not None else "your academic profile"
    if opp_type == "scholarship":
        base = (
            f"Potential funding for {nationality} students pursuing {target_degree} "
            f"in {major} in {country}, aligned with {gpa_note}."
        )
    else:
        base = (
            f"Relevant {target_degree} {major} option in {country} for "
            f"{nationality} international students at {gpa_note}."
        )

    if snippet:
        excerpt = snippet[:140].strip()
        if len(snippet) > 140:
            excerpt += "..."
        return f"{base} {excerpt}"
    return base


def _build_opportunities_from_search(search_results: list, profile: dict) -> list:
    """Normalize Tavily hits into curated roadmap opportunities (not raw title dumps)."""
    opportunities = []
    seen_urls = set()
    countries = profile.get("countries") or []

    for i, r in enumerate(search_results):
        title = (r.get("title") or "").strip()
        url = (r.get("url") or "").strip()
        snippet = (r.get("snippet") or r.get("content") or "").strip()

        if not title or not url.startswith("http") or url in seen_urls:
            continue
        seen_urls.add(url)

        combined = f"{title} {snippet}".lower()
        is_scholarship = any(kw in combined for kw in (
            "scholarship", "scholarships", "funding", "funded", "stipend",
            "fellowship", "daad", "erasmus", "grant",
        ))
        opp_type = "scholarship" if is_scholarship else "program"

        country = _guess_country(f"{title} {url} {snippet}", countries)
        clean_name = _extract_name_from_title(title)

        if opp_type == "scholarship":
            funding_type = "Fully Funded" if any(
                kw in combined for kw in ("fully funded", "full funding", "full scholarship")
            ) else "Scholarship / Grant"
        elif "germany" in combined or country == "Germany":
            funding_type = "Tuition-Free (Semester Fee Only)"
        else:
            funding_type = "Tuition / Program"

        why_it_fits = _build_why_it_fits(opp_type, profile, country, snippet)

        opportunities.append({
            "name": clean_name,
            "type": opp_type,
            "country": country,
            "url": url,
            "matchScore": max(60, 90 - i * 4),
            "keyDeadline": "Verify on official website",
            "fundingType": funding_type,
            "whyItFits": why_it_fits,
            "summary": why_it_fits,
        })

        if len(opportunities) >= MAX_OPPORTUNITIES:
            break

    if opportunities:
        logger.info("[ROADMAP AGENT] Built %d curated opportunities from search", len(opportunities))
    return opportunities


def _normalize_profile(profile_dict: dict) -> dict:
    """Flatten profile fields for prompts and post-processing."""
    p = profile_dict or {}
    countries = p.get("preferred_countries") or p.get("preferredCountries") or []
    if isinstance(countries, str):
        countries = [countries]
    majors = p.get("preferred_majors") or p.get("preferredMajors") or []
    if not majors and p.get("major"):
        majors = [p["major"]]
    english_test = p.get("english_test") or p.get("englishTest") or {}

    return {
        "nationality": p.get("nationality") or p.get("residency") or "Pakistani",
        "current_degree": p.get("current_degree") or p.get("educationLevel") or "",
        "target_degree": p.get("target_degree") or p.get("targetDegree") or "Masters",
        "cgpa": p.get("cgpa") if p.get("cgpa") is not None else p.get("gpa"),
        "preferred_countries": countries,
        "countries": countries,
        "preferred_majors": majors,
        "major": majors[0] if majors else "Computer Science",
        "budget": p.get("budget") if p.get("budget") is not None else p.get("maxBudget"),
        "english_test": english_test,
        "work_experience": p.get("work_experience") if p.get("work_experience") is not None else p.get("workExperience") or 0,
        "research_experience": p.get("research_experience") or p.get("researchExperience") or False,
        "publications": p.get("publications") or 0,
    }


def _build_search_queries(profile: dict) -> list:
    """Build multi-country search queries grounded in the student profile."""
    year = str(datetime.now().year)
    target_degree = profile["target_degree"]
    major = profile["major"]
    nationality = profile["nationality"]
    countries = profile["countries"]
    country_str = " ".join(countries[:3]) if countries else "Germany"

    queries = [
        f"{target_degree} {major} programs {country_str} international students admission {year}",
        f"scholarships {nationality} students {target_degree} {major} {country_str} {year}",
    ]
    if countries:
        queries.append(
            f"{target_degree} {major} {countries[0]} GPA requirements Pakistani students {year}"
        )
    return queries


def _build_phase_skeleton(profile: dict) -> str:
    """Adaptive phase outline — titles are hints, LLM must personalize further."""
    target_degree = profile["target_degree"]
    major = profile["major"]
    countries = profile["countries"]
    country_hint = ", ".join(countries[:3]) if countries else "target countries"
    nationality = profile["nationality"]

    if target_degree == "PhD":
        return (
            f"- Phase 1: Research proposal & supervisor outreach for {major} in {country_hint}\n"
            f"- Phase 2: Shortlist labs/universities & secure supervisor interest ({country_hint})\n"
            f"- Phase 3: Formal applications & funding ({nationality} student scholarships)\n"
            f"- Phase 4: Visa, enrollment & pre-departure for {country_hint}"
        )
    return (
        f"- Phase 1: Profile prep, {major} program research in {country_hint}\n"
        f"- Phase 2: University shortlisting & English test prep ({country_hint})\n"
        f"- Phase 3: Applications & scholarship submissions ({nationality} student)\n"
        f"- Phase 4: Visa & pre-departure for {country_hint}"
    )


def _personalized_gaps(profile: dict) -> list:
    """Profile-specific gap analysis when LLM output is missing or thin."""
    gaps = []
    english_test = profile.get("english_test") or {}
    test_type = _english_test_label(profile)
    test_score = english_test.get("score")
    cgpa = profile.get("cgpa")
    countries = profile.get("countries") or ["your target countries"]
    country_str = ", ".join(countries[:3])
    target_degree = profile["target_degree"]
    major = profile["major"]

    if not test_score:
        gaps.append(
            f"No verified {test_type} score — most {target_degree} programs in {country_str} require English proof."
        )
    elif test_score:
        gaps.append(
            f"Confirm whether {test_type} {test_score} meets minimums for {major} programs in {country_str}."
        )

    if cgpa is not None:
        if cgpa < 3.3:
            gaps.append(
                f"{cgpa} GPA may be below competitive cutoffs at top {country_str} universities — "
                f"prioritize programs with flexible admission or strong research fit."
            )
        else:
            gaps.append(
                f"With {cgpa} GPA, target universities in {country_str} that list minimums at or below your score."
            )

    if profile.get("budget") is None:
        gaps.append(
            f"Budget not set — map tuition and living costs across {country_str} before finalizing shortlist."
        )

    if target_degree == "PhD" and not profile.get("research_experience"):
        gaps.append(
            f"Limited research profile for {major} PhD — strengthen with publications, "
            f"lab projects, or a detailed research proposal before outreach."
        )

    if "Germany" in countries and profile["nationality"] == "Pakistani":
        gaps.append("APS certificate required for German universities — start early (processing takes weeks).")

    return gaps[:5]


def _personalized_recommendations(profile: dict) -> list:
    """Actionable recommendations tied to profile data."""
    countries = profile.get("countries") or ["Germany"]
    country_str = ", ".join(countries[:3])
    target_degree = profile["target_degree"]
    major = profile["major"]
    nationality = profile["nationality"]
    english_test = profile.get("english_test") or {}
    test_type = _english_test_label(profile)

    recs = [
        f"Shortlist 5–8 {target_degree} {major} programs across {country_str} and note each portal's deadlines.",
        f"Register for {test_type} if not yet taken — required for most programs in {country_str}.",
    ]

    if target_degree == "PhD":
        recs.append(
            f"Email 3–5 potential supervisors in {country_str} with a tailored research proposal and CV."
        )
    else:
        recs.append(
            f"Draft a Statement of Purpose highlighting {major} goals and why {country_str} fits your path."
        )

    if "Germany" in countries:
        recs.append("Begin APS certificate application and gather notarized transcripts for Germany.")
    if nationality == "Pakistani":
        recs.append(
            f"Check {nationality} student visa requirements and financial proof rules for {country_str}."
        )

    return recs[:5]


def _english_test_label(profile: dict) -> str:
    english = profile.get("english_test") or {}
    test_type = english.get("testType") or "IELTS"
    if test_type in ("None", "none", "", None):
        return "IELTS or TOEFL"
    return str(test_type)


def _sanitize_json_text(raw: str) -> str:
    """Normalize LLM output so json.loads can parse it."""
    text = raw.strip()
    smart_quotes = {
        "\u201c": '"', "\u201d": '"', "\u2018": "'", "\u2019": "'",
        "\u2013": "-", "\u2014": "-", "\u00a0": " ",
    }
    for bad, good in smart_quotes.items():
        text = text.replace(bad, good)
    # Strip illegal control characters (keep whitespace)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    # Remove trailing commas before } or ]
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    return text


def _extract_json_object(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1:
        cleaned = cleaned[start_idx:end_idx + 1]
    return _sanitize_json_text(cleaned)


def _parse_roadmap_json(raw: str) -> dict | None:
    """Parse roadmap JSON with sanitization; returns None on failure."""
    cleaned = _extract_json_object(raw)
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError as exc:
        logger.warning("[ROADMAP AGENT] JSON parse failed after sanitize: %s", exc)
        return None


def _merge_detailed_research_tasks(parsed: dict, profile: dict) -> dict:
    """Ensure every phase includes expandable step-by-step details."""
    detailed = build_detailed_roadmap(profile)
    detailed_phases = {p.get("phase"): p for p in detailed.get("phases", [])}

    merged_phases = []
    for idx, phase in enumerate(parsed.get("phases") or []):
        if not isinstance(phase, dict):
            continue
        phase_copy = dict(phase)
        phase_num = phase_copy.get("phase") or idx + 1
        detailed_phase = detailed_phases.get(phase_num) or detailed_phases.get(idx + 1)

        if detailed_phase:
            if detailed_phase.get("stepDetails"):
                phase_copy["stepDetails"] = detailed_phase["stepDetails"]
            if detailed_phase.get("steps"):
                phase_copy["steps"] = detailed_phase["steps"]
            if detailed_phase.get("description"):
                phase_copy["description"] = detailed_phase["description"]
            if detailed_phase.get("title"):
                phase_copy["title"] = detailed_phase["title"]

        merged_phases.append(phase_copy)

    if not merged_phases:
        merged_phases = detailed.get("phases", [])

    parsed["phases"] = merged_phases
    parsed["title"] = detailed.get("title") or parsed.get("title")
    parsed["overallTimeline"] = (
        parsed.get("overallTimeline")
        or "12-month step-by-step preparation roadmap"
    )
    return parsed


def _build_fallback_roadmap(profile: dict) -> dict:
    """Detailed step-by-step fallback when LLM synthesis fails."""
    parsed = build_detailed_roadmap(profile)
    parsed["gaps"] = _personalized_gaps(profile)
    parsed["recommendations"] = _personalized_recommendations(profile)
    return parsed


def _enrich_llm_output(parsed: dict, profile: dict) -> dict:
    """Fill thin LLM gaps/recommendations with profile-specific defaults."""
    gaps = parsed.get("gaps") or []
    recs = parsed.get("recommendations") or []

    if len(gaps) < 2:
        gaps = _personalized_gaps(profile)
    if len(recs) < 2:
        recs = _personalized_recommendations(profile)

    parsed["gaps"] = gaps[:5]
    parsed["recommendations"] = recs[:5]

    if not parsed.get("title"):
        countries = profile.get("countries") or ["your targets"]
        parsed["title"] = (
            f"{profile['target_degree']} {profile['major']} Roadmap — "
            f"{', '.join(countries[:3])}"
        )
    if not parsed.get("overallTimeline"):
        parsed["overallTimeline"] = "12-Month Personalized Preparation Plan"

    return parsed


def generate_personalized_roadmap(profile_dict: dict) -> dict:
    """Build a structured roadmap with pre-researched step details and live search opportunities."""
    logger.info("[roadmap] start")
    profile = _normalize_profile(profile_dict)

    queries = _build_search_queries(profile)
    logger.debug("[roadmap] search queries=%s", queries)
    search_results = search_service.search_for_context(queries)
    opportunities = _build_opportunities_from_search(search_results, profile)

    if not ROADMAP_USE_LLM:
        logger.debug("[roadmap] using curated guide (ROADMAP_USE_LLM off)")
        parsed_response = _build_fallback_roadmap(profile)
        parsed_response["opportunities"] = opportunities
        logger.info("[roadmap] done phases=%s", len(parsed_response.get("phases") or []))
        return parsed_response

    facts_list = []
    for i, r in enumerate(search_results[:MAX_SEARCH_FACTS], 1):
        facts_list.append(f"[{i}] {r['title']}\nURL: {r['url']}\n{r['snippet']}")
    search_context = "\n\n".join(facts_list) if facts_list else "No real-time facts found."
    phase_skeleton = _build_phase_skeleton(profile)

    system_prompt, user_prompt = prompt_service.build_roadmap_prompt(
        profile, search_context, phase_skeleton
    )

    logger.debug("[roadmap] LLM dispatch")
    start_time = time.time()

    parsed_response = None
    try:
        raw_res = ollama_service.generate(
            f"{system_prompt}\n\n{user_prompt}",
            timeout=ROADMAP_LLM_TIMEOUT,
            num_predict=ROADMAP_NUM_PREDICT,
            task_name="roadmap",
            use_lock=True,
        )
        logger.debug("[roadmap] LLM response in %.2fs", time.time() - start_time)
        parsed_response = _parse_roadmap_json(raw_res)
        if parsed_response:
            logger.debug("[roadmap] parsed LLM JSON")
    except Exception as e:
        logger.error("[roadmap] LLM failed: %s", str(e))

    if not parsed_response or not isinstance(parsed_response, dict) or "phases" not in parsed_response:
        logger.warning("[roadmap] using curated fallback guide")
        parsed_response = _build_fallback_roadmap(profile)
    else:
        parsed_response = _enrich_llm_output(parsed_response, profile)

    parsed_response["opportunities"] = opportunities
    parsed_response["phases"] = _normalize_phases(parsed_response.get("phases", []))
    parsed_response = _merge_detailed_research_tasks(parsed_response, profile)

    logger.info("[roadmap] done phases=%s", len(parsed_response.get("phases") or []))
    return parsed_response
