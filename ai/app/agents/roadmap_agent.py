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

logger = logging.getLogger("roadmap_agent")

ROADMAP_LLM_TIMEOUT = float(
    os.getenv("ROADMAP_LLM_TIMEOUT")
    or os.getenv("OLLAMA_GENERATE_TIMEOUT", "600")
)
ROADMAP_NUM_PREDICT = int(os.getenv("ROADMAP_NUM_PREDICT", "1200"))
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
    test_type = english_test.get("testType") or "IELTS"
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
    test_type = english_test.get("testType") or "IELTS"

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


def _build_fallback_roadmap(profile: dict) -> dict:
    """Deterministic personalized fallback when LLM synthesis fails."""
    countries = profile.get("countries") or ["Germany"]
    country_str = ", ".join(countries[:3])
    major = profile["major"]
    target_degree = profile["target_degree"]
    nationality = profile["nationality"]
    english_test = profile.get("english_test") or {}
    test_type = english_test.get("testType") or "IELTS"
    cgpa = profile.get("cgpa")

    aps_steps = []
    if "Germany" in countries:
        aps_steps.append("Initiate APS Certificate application for German university verification.")
    blocked_steps = []
    if "Germany" in countries:
        blocked_steps.append("Open German blocked bank account (Fintiba/Expatrio) for visa proof.")

    gpa_ref = f" (GPA {cgpa})" if cgpa is not None else ""

    if target_degree == "PhD":
        phases = [
            {
                "phase": 1,
                "title": f"Research Proposal & Supervisor Outreach — {country_str}",
                "timeline": "Months 1-3",
                "description": (
                    f"Draft a {major} research proposal and contact potential PhD supervisors "
                    f"in {country_str}{gpa_ref}."
                ),
                "steps": [
                    f"Identify 10–15 {major} research groups in {country_str} aligned with your interests.",
                    "Draft a 2-page research proposal and updated academic CV.",
                    f"Send personalized outreach emails to supervisors in {country_str} with proposal attached.",
                ],
            },
            {
                "phase": 2,
                "title": f"Shortlist Labs & Secure Supervisor Match — {country_str}",
                "timeline": "Months 4-5",
                "description": f"Narrow universities in {country_str} and secure supervisor commitment.",
                "steps": [
                    f"Track responses from {country_str} supervisors and schedule interviews.",
                    "Obtain formal supervisor invitation or acceptance letters.",
                    f"Confirm program-specific deadlines on each {country_str} university portal.",
                ],
            },
            {
                "phase": 3,
                "title": f"Applications & Funding — {nationality} {major} PhD",
                "timeline": "Months 6-8",
                "description": f"Submit formal applications and scholarship proposals across {country_str}.",
                "steps": [
                    f"Submit university portal applications in {country_str}.",
                    f"Apply for DAAD, university scholarships, and country-specific funding for {nationality} students.",
                    "Request reference letters from academic referees.",
                ] + aps_steps,
            },
            {
                "phase": 4,
                "title": f"Visa & Pre-Departure — {country_str}",
                "timeline": "Months 9-12",
                "description": f"Complete visa, enrollment, and relocation steps for {country_str}.",
                "steps": [
                    "Receive formal PhD admission letter and funding confirmation.",
                    f"Prepare visa documents for {nationality} students applying to {country_str}.",
                    "Schedule embassy visa interview and arrange housing.",
                ] + blocked_steps,
            },
        ]
    else:
        phases = [
            {
                "phase": 1,
                "title": f"Profile Prep & {major} Program Research — {country_str}",
                "timeline": "Months 1-2",
                "description": f"Build your application profile for {target_degree} {major} in {country_str}{gpa_ref}.",
                "steps": [
                    f"Begin {test_type} preparation and register for a test date.",
                    "Collect official transcripts and degree certificates.",
                ] + aps_steps,
            },
            {
                "phase": 2,
                "title": f"Shortlist Universities & SOP — {country_str}",
                "timeline": "Months 3-4",
                "description": f"Select {target_degree} programs in {country_str} and draft application essays.",
                "steps": [
                    f"Shortlist 5–8 {major} programs across {country_str}.",
                    f"Draft Statement of Purpose tailored to {country_str} universities.",
                    "Request academic reference letters.",
                ],
            },
            {
                "phase": 3,
                "title": f"Applications & Scholarships — {nationality} Student",
                "timeline": "Months 5-8",
                "description": f"Submit applications and funding requests for {country_str}.",
                "steps": [
                    f"Submit portal applications before {country_str} university deadlines.",
                    f"Apply for scholarships available to {nationality} students in {country_str}.",
                    "Prepare financial proof and bank statements.",
                ],
            },
            {
                "phase": 4,
                "title": f"Visa & Departure — {country_str}",
                "timeline": "Months 9-12",
                "description": f"Secure admission and complete visa process for {country_str}.",
                "steps": [
                    "Receive university acceptance offer.",
                    f"Book visa appointment for {nationality} students — {country_str}.",
                ] + blocked_steps,
            },
        ]

    return {
        "title": f"{target_degree} {major} Roadmap — {country_str}",
        "overallTimeline": "12-Month Personalized Preparation Plan",
        "phases": phases,
        "gaps": _personalized_gaps(profile),
        "recommendations": _personalized_recommendations(profile),
    }


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
    """Coordinates search fact collection and LLM prompt assembly to synthesize a structured roadmap."""
    logger.info("📋 [ROADMAP AGENT] Starting roadmap generation for profile...")

    profile = _normalize_profile(profile_dict)
    countries = profile["countries"]

    queries = _build_search_queries(profile)
    logger.info(f"🔍 [ROADMAP AGENT] Step 1/3: Running context searches for queries: {queries}")
    search_results = search_service.search_for_context(queries)

    facts_list = []
    for i, r in enumerate(search_results[:MAX_SEARCH_FACTS], 1):
        facts_list.append(f"[{i}] {r['title']}\nURL: {r['url']}\n{r['snippet']}")
    search_context = "\n\n".join(facts_list) if facts_list else "No real-time facts found."

    opportunities = _build_opportunities_from_search(search_results, profile)
    phase_skeleton = _build_phase_skeleton(profile)

    system_prompt, user_prompt = prompt_service.build_roadmap_prompt(
        profile, search_context, phase_skeleton
    )

    logger.info("🚀 [ROADMAP AGENT] Step 2/3: Dispatching roadmap prompt to Ollama...")
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
        logger.info(f"🎉 [ROADMAP AGENT] Ollama response received in {time.time() - start_time:.2f}s")

        cleaned_res = raw_res.strip()
        if cleaned_res.startswith("```"):
            lines = cleaned_res.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned_res = "\n".join(lines).strip()

        start_idx = cleaned_res.find("{")
        end_idx = cleaned_res.rfind("}")
        if start_idx != -1 and end_idx != -1:
            cleaned_res = cleaned_res[start_idx:end_idx + 1]

        parsed_response = json.loads(cleaned_res)
        logger.info("✅ [ROADMAP AGENT] Successfully parsed LLM roadmap JSON.")
    except Exception as e:
        logger.error(f"❌ [ROADMAP AGENT] Failed to generate or parse LLM roadmap JSON: {str(e)}")

    if not parsed_response or not isinstance(parsed_response, dict) or "phases" not in parsed_response:
        logger.warning("⚠️ [ROADMAP AGENT] Utilizing fallback structured template.")
        parsed_response = _build_fallback_roadmap(profile)
    else:
        parsed_response = _enrich_llm_output(parsed_response, profile)

    parsed_response["opportunities"] = opportunities
    parsed_response["phases"] = _normalize_phases(parsed_response.get("phases", []))

    return parsed_response
