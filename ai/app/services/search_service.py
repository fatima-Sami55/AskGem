"""
ai/app/services/search_service.py
Service integrating web search via Tavily API with DuckDuckGo fallback and smart query generation.
"""
import os
import time
import logging
import re
import urllib.parse
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("search_service")

def extract_degree_from_message(message: str):
    """Extracts explicit degree intent directly from user message text."""
    message_lower = message.lower()
    if any(w in message_lower for w in ['phd', 'doctorate', 'doctoral']):
        return 'PhD'
    if any(w in message_lower for w in ['masters', 'master', 'ms ', 'msc', 'mba']):
        return 'Masters'
    if any(w in message_lower for w in ['bachelors', 'bachelor', 'bs ', 'undergraduate']):
        return 'Bachelors'
    return None

def extract_countries_from_message(message: str):
    """Extracts country mentions directly from user message text."""
    message_lower = message.lower()
    COUNTRIES = ['germany', 'netherlands', 'sweden', 'canada', 'australia', 'uk', 'usa', 'france', 'italy', 'switzerland']
    found = []
    for country in COUNTRIES:
        if country in message_lower:
            if country in ['uk', 'usa']:
                found.append(country.upper())
            else:
                found.append(country.title())
    return found if found else None


# Cities students commonly ask about → default country for search query building
CITY_TO_COUNTRY = {
    "frankfurt": "Germany",
    "berlin": "Germany",
    "munich": "Germany",
    "munchen": "Germany",
    "hamburg": "Germany",
    "cologne": "Germany",
    "koln": "Germany",
    "köln": "Germany",
    "stuttgart": "Germany",
    "heidelberg": "Germany",
    "dresden": "Germany",
    "leipzig": "Germany",
    "bonn": "Germany",
    "aachen": "Germany",
    "karlsruhe": "Germany",
    "darmstadt": "Germany",
    "freiburg": "Germany",
    "hanover": "Germany",
    "hannover": "Germany",
    "nuremberg": "Germany",
    "nurnberg": "Germany",
    "amsterdam": "Netherlands",
    "rotterdam": "Netherlands",
    "utrecht": "Netherlands",
    "paris": "France",
    "lyon": "France",
    "london": "UK",
    "manchester": "UK",
    "toronto": "Canada",
    "vancouver": "Canada",
    "montreal": "Canada",
    "melbourne": "Australia",
    "sydney": "Australia",
    "stockholm": "Sweden",
    "zurich": "Switzerland",
    "geneva": "Switzerland",
}


def extract_locations_from_message(message: str) -> list:
    """Extract city/location mentions from the user's message."""
    if not message:
        return []
    msg_lower = message.lower()
    found = []
    seen = set()
    for city_key, country in CITY_TO_COUNTRY.items():
        if city_key in msg_lower and city_key not in seen:
            seen.add(city_key)
            display_city = city_key.title().replace("Koln", "Cologne").replace("Munchen", "Munich")
            if city_key == "köln":
                display_city = "Cologne"
            found.append({"city": display_city, "country": country})
    return found


def message_has_location_intent(message: str) -> bool:
    """True when the student names a city/location in their message."""
    return len(extract_locations_from_message(message)) > 0

def _extract_profile_fields(message: str, profile: dict) -> dict:
    """Safely extracts normalized profile attributes prioritizing message intent."""
    if not profile:
        p = {}
    elif hasattr(profile, "model_dump"):
        p = profile.model_dump()
    elif isinstance(profile, dict):
        p = profile
    else:
        p = {}
        
    msg_degree = extract_degree_from_message(message)
    profile_target = p.get("target_degree") or p.get("targetDegree")
    target_degree = msg_degree or profile_target or "Masters"
    
    msg_countries = extract_countries_from_message(message)
    profile_countries = p.get("preferred_countries") or p.get("preferredCountries") or []
    if isinstance(profile_countries, str):
        profile_countries = [profile_countries]

    locations = extract_locations_from_message(message)
    location_countries = [loc["country"] for loc in locations]
    countries = msg_countries or location_countries or profile_countries
    
    majors = p.get("preferred_majors") or p.get("preferredMajors") or []
    if isinstance(majors, str):
        majors = [majors]
    elif not majors and p.get("major"):
        majors = [p.get("major")]
        
    major_str = majors[0] if majors else "Higher Education"
    gpa = p.get("cgpa") if p.get("cgpa") is not None else p.get("gpa")
    gpa_str = str(gpa) if gpa is not None else ""
    budget = p.get("budget") if p.get("budget") is not None else p.get("maxBudget")
    
    return {
        "target_degree": target_degree,
        "countries": countries,
        "locations": locations,
        "major": major_str,
        "gpa": gpa_str,
        "budget": budget
    }

def generalize_gpa(gpa_val: str) -> str:
    """Converts a specific GPA value into a generalized range band to protect student privacy in external queries."""
    if not gpa_val:
        return ""
    try:
        val = float(gpa_val)
        if val >= 3.5:
            return "3.5-4.0"
        elif val >= 3.0:
            return "3.0-3.5"
        elif val >= 2.5:
            return "2.5-3.0"
        else:
            return "under 2.5"
    except Exception:
        return gpa_val

def build_search_queries(message: str, profile: dict) -> list:
    """Generates 1-4 targeted search queries based on student profile and message intent."""
    msg_lower = message.lower()
    p = _extract_profile_fields(message, profile)
    current_year = str(datetime.now().year)
    
    university_keywords = [
        "university", "universities", "college", "program", "apply", 
        "application", "admission", "where should i", "which university", 
        "recommend", "suggest", "target", "chances", "eligible"
    ]
    scholarship_keywords = [
        "scholarship", "scholarships", "funding", "funded", "financial aid", 
        "stipend", "fellowship", "grant", "daad", "erasmus", "hec"
    ]
    visa_keywords = [
        "visa", "student visa", "permit", "residence", "how to go", 
        "process", "requirements", "documents", "blocked account", 
        "aufenthaltserlaubnis"
    ]
    
    has_uni = any(k in msg_lower for k in university_keywords)
    has_schol = any(k in msg_lower for k in scholarship_keywords)
    has_visa = any(k in msg_lower for k in visa_keywords)
    
    queries = []
    countries_to_use = p["countries"][:2] if p["countries"] else ["study abroad"]
    locations = p.get("locations") or []

    # City-specific queries take priority when the student names a place
    if locations:
        for loc in locations[:2]:
            city = loc["city"]
            country = loc.get("country") or (countries_to_use[0] if countries_to_use else "Germany")
            queries.append(
                f"universities in {city} {country} {p['major']} {p['target_degree']} programs admission requirements {current_year}"
            )
            queries.append(
                f"{city} {country} {p['major']} universities {p['target_degree']} international students {current_year}"
            )
            queries.append(f"Goethe University {city} {p['major']} admission" if city.lower() == "frankfurt" else f"top universities {city} {p['major']} {current_year}")

    if has_uni or (not has_schol and not has_visa):
        for country in countries_to_use:
            q1 = f"{p['target_degree']} programs in {country} for {p['major']}"
            if p['gpa']:
                q1 += f" with {generalize_gpa(p['gpa'])} GPA requirements"
            q1 += f" {current_year}"
            queries.append(q1)
            
            q2 = f"top universities {country} {p['major']} {p['target_degree']} admission requirements {current_year}"
            queries.append(q2)
            
    if has_schol:
        for country in countries_to_use:
            queries.append(f"{country} scholarships for Pakistani students {p['target_degree']} {current_year}")
            queries.append(f"fully funded {p['target_degree']} scholarships {country} {p['major']} {current_year}")
            
            if p['budget'] == 0 or p['budget'] == "0":
                queries.append(f"fully funded scholarships {country} {p['major']} no tuition fee {current_year}")
                
        if any("germany" in str(c).lower() for c in p["countries"]) or "germany" in msg_lower:
            queries.append(f"DAAD scholarship Pakistan {p['major']} {p['target_degree']} {current_year}")
        european_countries = ["germany", "france", "netherlands", "italy", "sweden", "spain", "poland", "austria", "belgium", "finland", "norway"]
        if any(any(ec in str(c).lower() for ec in european_countries) for c in p["countries"]) or "europe" in msg_lower:
            queries.append(f"Erasmus scholarship {p['major']} Masters {current_year}")
            
    if has_visa:
        for country in countries_to_use:
            queries.append(f"student visa {country} Pakistani students requirements {current_year}")
            queries.append(f"{country} student residence permit process documents {current_year}")
            
            if "germany" in str(country).lower() or "germany" in msg_lower:
                queries.append(f"Germany student visa blocked account requirement Pakistan {current_year}")
                queries.append(f"Germany aufenthaltserlaubnis student Pakistan process {current_year}")
            elif "netherlands" in str(country).lower() or "netherlands" in msg_lower:
                queries.append(f"Netherlands student visa MVV Pakistani students {current_year}")
                
    if not queries:
        for country in countries_to_use:
            queries.append(f"best universities {country} {p['major']} {p['target_degree']} {current_year}")
            q = f"{country} university admission requirements"
            if p['gpa']:
                q += f" GPA {generalize_gpa(p['gpa'])}"
            q += " international students"
            queries.append(q)

    # Cap queries — chat should stay responsive (search runs before first token).
    unique_queries = []
    seen = set()
    max_queries = 3 if locations else 4
    for q in queries:
        clean_q = re.sub(r'\s+', ' ', q).strip()
        if clean_q.lower() not in seen:
            seen.add(clean_q.lower())
            unique_queries.append(clean_q)
        if len(unique_queries) >= max_queries:
            break
            
    return unique_queries

def _search_duckduckgo(query: str, max_results: int) -> list:
    """Fallback search using DuckDuckGo search library."""
    logger.debug("[search] duckduckgo query=%s", query[:50])
    start = time.time()
    try:
        from duckduckgo_search import DDGS
        results = []
        proxy = os.getenv("DDG_PROXY") or os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
        with DDGS(proxy=proxy) as ddgs:
            ddg_gen = ddgs.text(query, max_results=max_results)
            for r in ddg_gen:
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", r.get("link", "")),
                    "content": r.get("body", r.get("snippet", ""))
                })
        duration = time.time() - start
        logger.debug("[search] duckduckgo done in %.2fs items=%s", duration, len(results))
        return results
    except Exception as e:
        logger.error("[search] duckduckgo failed: %s", str(e))
        return []

def search(query: str, max_results: int = 5) -> list:
    """Searches the web using Tavily API, falling back to DuckDuckGo if unavailable."""
    try:
        from app.routers.settings import get_tavily_api_key
        tavily_key = get_tavily_api_key()
    except Exception:
        tavily_key = os.getenv("TAVILY_API_KEY", "").strip()
    if not tavily_key:
        logger.warning("[search] TAVILY_API_KEY not set, using DuckDuckGo")
        return _search_duckduckgo(query, max_results)
    
    logger.debug("[search] tavily query=%s", query[:50])
    start = time.time()
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=tavily_key)
        response = client.search(query=query, max_results=max_results)
        raw_results = response.get("results", [])
        results = []
        for r in raw_results:
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")
            })
        duration = time.time() - start
        logger.debug("[search] tavily done in %.2fs items=%s", duration, len(results))
        return results
    except Exception as e:
        logger.warning("[search] tavily failed: %s, falling back to DuckDuckGo", str(e))
        return _search_duckduckgo(query, max_results)

def search_for_context(queries: list) -> list:
    """Executes searches for multiple queries, filters low-quality results, deduplicates by URL and returns max 8 clean dicts."""
    if not queries:
        return []
        
    all_raw_items = []
    low_quality_domains = [
        "reddit.com", "quora.com", "medium.com", "facebook.com", "twitter.com", "linkedin.com",
        "forums.", "forum.", "expatrio.com", "study.eu", "topuniversities.com", "mastersportal.com",
        "bachelorsportal.com", "studyportals.com", "niche.com", "usnews.com", "timeshighereducation.com",
        "yocket.com", "leverageedu.com", "shiksha.com", "collegedunia.com", "hotcourses",
    ]
    
    for q in queries:
        try:
            results = search(q, max_results=3)
            for r in results:
                url = r.get("url", "").strip()
                domain = urllib.parse.urlparse(url).netloc.replace("www.", "").lower() if url else ""
                
                if any(lqd in domain or lqd in url.lower() for lqd in low_quality_domains):
                    continue
                    
                snippet = (r.get("content") or "").strip()
                if len(snippet) > 300:
                    snippet = snippet[:297] + "..."
                    
                all_raw_items.append({
                    "query": q,
                    "title": r.get("title", "Untitled").strip(),
                    "url": url,
                    "snippet": snippet,
                    "source": domain or "web"
                })
        except Exception as e:
            logger.error(f"Error executing search for query '{q}': {str(e)}")

    # Deduplicate by URL
    seen_urls = set()
    deduped = []
    for item in all_raw_items:
        clean_url = item["url"].split("#")[0].rstrip("/")
        if clean_url and clean_url.lower() not in seen_urls:
            seen_urls.add(clean_url.lower())
            deduped.append(item)
            
    # Prioritize official university and government domains
    def domain_priority(item):
        src = item["source"].lower()
        title = item.get("title", "").lower()
        if any(block in title for block in ("top 10", "top 50", "best universities", "ranking")):
            return 3
        if ".edu" in src or ".gov" in src or ".ac." in src:
            return 0
        if "uni-" in src or src.startswith("tu-") or "tum.de" in src or "lmu.de" in src:
            return 0
        return 1
        
    deduped.sort(key=domain_priority)
    return deduped[:8]

def clean_results(results: list) -> str:
    """Legacy helper converting search results into text snippets."""
    if not results:
        return "No relevant web search results found."
    
    snippets = []
    for i, item in enumerate(results, start=1):
        title = item.get("title", "Untitled")
        url = item.get("url", "")
        content = item.get("content") or item.get("snippet", "")
        snippets.append(f"Source [{i}]: {title}\nURL: {url}\nSummary: {content}")
    
    return "\n\n".join(snippets)
