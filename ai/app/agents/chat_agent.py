"""
ai/app/agents/chat_agent.py
Agent orchestrating full end-to-end chat turn for AskPeri with hardened multi-layer topic guards and intent-based web search.
"""
import logging
import time
from app.services.chroma_service import get_relevant_memories
from app.services.search_service import search_for_context, build_search_queries, message_has_location_intent
from app.services.prompt_service import build_prompt
from app.services import ollama_service

logger = logging.getLogger("chat_agent")

OFF_TOPIC_KEYWORDS = [
    "biryani", "food", "recipe", "cook", "cuisine", "restaurant",
    "clothes", "fashion", "outfit", "dress", "style", "wear",
    "movie", "film", "song", "music", "album", "artist", "singer",
    "game", "gaming", "sports", "cricket", "football",
    "politics", "religion", "joke", "funny", "meme",
    "relationship", "girlfriend", "boyfriend", "love", "dating",
    "weather", "news", "stock", "crypto", "investment"
]

EDUCATION_OVERRIDE_PHRASES = [
    "university", "scholarship", "admission", "gpa", "cgpa",
    "ielts", "toefl", "gre", "visa", "masters", "bachelor",
    "phd", "application", "study abroad", "tuition", "deadline",
    "research", "internship", "sop", "recommendation letter",
    "culinary arts"  # Legitimate academic program edge case override
]

# Greetings and short openers — gemma3:4b often misclassifies these as OFFTOPIC.
GREETING_PATTERNS = (
    "hi", "hello", "hey", "hiya", "howdy", "good morning", "good afternoon",
    "good evening", "greetings", "salam", "assalam", "asalam", "aoa",
    "thanks", "thank you", "ok", "okay", "yes", "no", "sure", "please",
    "help", "start", "begin",
)


def should_skip_llm_topic_guard(message: str) -> bool:
    """Skip LLM classifier for greetings, education-intent, and benign short messages."""
    msg = message.strip().lower().rstrip("!.?,")
    if not msg:
        return True
    if msg in GREETING_PATTERNS:
        return True
    if any(edu in msg for edu in EDUCATION_OVERRIDE_PHRASES):
        return True
    if message_has_location_intent(message):
        return True
    if len(msg.split()) <= 2 and not is_off_topic(message):
        return True
    return False


def is_greeting(message: str) -> bool:
    """Detect simple greetings and openers."""
    msg = message.strip().lower().rstrip("!.?,")
    if not msg:
        return False
    if msg in GREETING_PATTERNS:
        return True
    words = msg.split()
    if len(words) <= 3 and any(w in msg for w in ("hi", "hello", "hey", "salam", "assalam", "aoa")):
        return True
    return False


def get_greeting_response(profile: dict) -> str:
    """Warm, profile-aware reply for greetings — no LLM wait."""
    p_dict = profile if isinstance(profile, dict) else (profile.model_dump() if hasattr(profile, "model_dump") else {})
    name = p_dict.get("name") or "there"
    if name.lower() in ("student", "there"):
        name = "there"

    major = p_dict.get("major") or (p_dict.get("preferred_majors") or [None])[0] if isinstance(p_dict.get("preferred_majors"), list) else p_dict.get("preferred_majors")
    major = major or "your field"

    countries = p_dict.get("preferred_countries") or p_dict.get("preferredCountries") or []
    country = countries[0] if isinstance(countries, list) and countries else "abroad"

    target = p_dict.get("target_degree") or p_dict.get("targetDegree") or "Masters"
    gpa = p_dict.get("cgpa") if p_dict.get("cgpa") is not None else p_dict.get("gpa")
    gpa_bit = f" With your **{gpa} CGPA**, we can narrow down realistic programs." if gpa is not None else ""

    return (
        f"Hey {name}! 👋 Good to see you.\n\n"
        f"I'm Peri — your study abroad advisor. I see you're planning **{target} in {major}** "
        f"with **{country}** on your list.{gpa_bit}\n\n"
        f"What would you like to work on today?\n"
        f"- 🎓 **Universities** that match your profile\n"
        f"- 💰 **Scholarships** you might qualify for\n"
        f"- 🗺️ Your **roadmap** and next steps\n"
        f"- Or just ask me anything about applications, tests, or visas!"
    )


def is_off_topic(message: str) -> bool:
    """Fast Layer 1 keyword guard."""
    msg_lower = message.lower()
    
    if any(edu in msg_lower for edu in EDUCATION_OVERRIDE_PHRASES):
        return False
    
    if any(kw in msg_lower for kw in OFF_TOPIC_KEYWORDS):
        return True
    
    return False

def get_refusal_response(user_message: str, profile: dict) -> str:
    """Generates a warm, firm, and profile-personalized off-topic refusal."""
    p_dict = profile if isinstance(profile, dict) else (profile.model_dump() if hasattr(profile, "model_dump") else {})
    major = p_dict.get("preferred_majors") or p_dict.get("preferredMajors") or ["your field"]
    if isinstance(major, list) and len(major) > 0:
        major_str = major[0]
    elif isinstance(major, str) and major.strip():
        major_str = major
    else:
        major_str = "your field"
        
    countries = p_dict.get("preferred_countries") or p_dict.get("preferredCountries") or ["abroad"]
    if isinstance(countries, list) and len(countries) > 0:
        country_str = countries[0]
    elif isinstance(countries, str) and countries.strip():
        country_str = countries
    else:
        country_str = "abroad"
    
    return (
        f"Ha, I appreciate the curiosity — but I'm Peri, strictly "
        f"your education advisor! 😊 I'm only equipped to help with "
        f"universities, scholarships, and study abroad planning. "
        f"No matter how the question is framed, topics outside "
        f"education are beyond what I can help with. "
        f"You're targeting {major_str} in {country_str} — "
        f"want to continue working on your application strategy?"
    )

def is_off_topic_by_llm(user_message: str) -> bool:
    """Layer 2 LLM classifier guard for sophisticated jailbreaks."""
    classification_prompt = (
        "You are a strict topic classifier for an education advisor chatbot. "
        "Classify if the following message is related to education, "
        "universities, scholarships, study abroad, academic planning, "
        "or career goals.\n\n"
        f"Message: \"{user_message}\"\n\n"
        "Reply with ONLY one word: EDUCATION or OFFTOPIC"
    )
    try:
        result = ollama_service.generate(classification_prompt, task_name="topic_guard", num_predict=16)
        label = result.strip().upper()
        logger.debug("[chat] topic_guard label=%s", label)
        return label == "OFFTOPIC"
    except Exception as e:
        logger.warning(f"LLM classifier check failed: {str(e)}")
        return False

def should_search(message: str, profile: dict, conversation_history: list = None) -> tuple:
    """Intelligently determines whether to trigger search and generates queries."""
    message_lower = message.lower()
    word_count = len(message.split())

    HIGH_STAKES_TRIGGERS = [
        'eligible', 'eligibility', 'requirement', 'requirements', 'deadline', 'deadlines',
        'admission', 'admit', 'eth', 'tum', 'rwth', 'mit', 'stanford', 'heidelberg',
        'tuition', 'cutoff', 'cut-off', 'minimum gpa', 'ielts requirement',
    ]

    SEARCH_TRIGGERS = [
        'university', 'universities', 'college', 'scholarship', 'scholarships',
        'visa', 'apply', 'admission', 'recommend', 'suggest', 'looking', 'explore',
        'chances', 'eligible', 'program', 'funding', 'daad',
        'erasmus', 'requirements', 'gpa requirement', 'ielts requirement',
        'where should i', 'which university', 'can i', 'should i',
        'am i eligible', 'what are my chances', 'search', 'find',
    ]

    high_stakes = any(trigger in message_lower for trigger in HIGH_STAKES_TRIGGERS)
    has_location = message_has_location_intent(message)

    if word_count < 5 and not high_stakes and not has_location:
        return False, []

    if has_location and any(trigger in message_lower for trigger in SEARCH_TRIGGERS + ['in ']):
        queries = build_search_queries(message, profile)
        return True, queries

    if high_stakes or any(trigger in message_lower for trigger in SEARCH_TRIGGERS):
        queries = build_search_queries(message, profile)
        return True, queries

    ADVICE_TRIGGERS = [
        'what should i', 'what do you think',
        'help me', 'guide me', 'plan', 'roadmap',
        'focus on', 'improve', 'chances',
    ]

    p_dict = profile if isinstance(profile, dict) else (profile.model_dump() if hasattr(profile, "model_dump") else {})
    has_profile = bool(p_dict.get('cgpa') or p_dict.get('gpa') or p_dict.get('preferred_countries') or p_dict.get('preferredCountries'))
    is_first_msg = not conversation_history or len(conversation_history) == 0

    if (has_profile and any(t in message_lower for t in ADVICE_TRIGGERS)) or is_first_msg:
        queries = build_search_queries(message, profile)
        return True, queries

    return False, []

def process_chat_turn(user_message: str, user_id: str, session_id: str = None, profile: dict = None, conversation_history: list = None) -> tuple:
    """Orchestrates memory retrieval, live web search, prompt assembly, and LLM chat generation."""
    logger.info("[chat] start user_id=%s session_id=%s", user_id, session_id)

    if is_greeting(user_message):
        logger.debug("[chat] greeting fast-path")
        return get_greeting_response(profile), False, [], []
    
    # Layer 1: keyword guard (fast)
    if is_off_topic(user_message):
        logger.warning("[chat] refused off-topic keyword user_id=%s", user_id)
        return get_refusal_response(user_message, profile), False, [], []

    # Layer 2: LLM classifier (catches sophisticated jailbreaks; skip for greetings)
    if not should_skip_llm_topic_guard(user_message) and is_off_topic_by_llm(user_message):
        logger.warning("[chat] refused off-topic LLM user_id=%s", user_id)
        return get_refusal_response(user_message, profile), False, [], []
    
    memories = get_relevant_memories(user_id=user_id, session_id=session_id, query=user_message, n_results=3)
    logger.debug("[chat] memories=%s", len(memories) if isinstance(memories, list) else 0)
    
    do_search, queries = should_search(user_message, profile, conversation_history)
    search_results_list = []
    if do_search and queries:
        logger.debug("[chat] search queries=%s", queries)
        search_results_list = search_for_context(queries)
        logger.debug("[chat] search results=%s", len(search_results_list))
    
    messages = build_prompt(
        user_message=user_message,
        profile=profile,
        memories=memories,
        search_results=search_results_list,
        conversation_history=conversation_history
    )
    
    ai_response = ollama_service.chat(messages=messages)
    logger.info("[chat] done user_id=%s chars=%s", user_id, len(ai_response))
    
    searched = bool(do_search and queries and len(search_results_list) > 0)
    sources = [{"title": r["title"], "url": r["url"], "source": r["source"]} for r in search_results_list]
    
    return ai_response, searched, queries, sources

def stream_chat_events(user_message: str, user_id: str, session_id: str = None, profile: dict = None, conversation_history: list = None):
    """Yields stream events (status, sources, chunks) so SSE can start before slow search/LLM work."""
    logger.info("[chat] stream start user_id=%s session_id=%s", user_id, session_id)

    if is_greeting(user_message):
        logger.debug("[chat] stream greeting fast-path")
        yield {"type": "chunk", "text": get_greeting_response(profile)}
        return

    if is_off_topic(user_message):
        logger.warning("[chat] stream refused off-topic keyword user_id=%s", user_id)
        yield {"type": "chunk", "text": get_refusal_response(user_message, profile)}
        return

    if not should_skip_llm_topic_guard(user_message) and is_off_topic_by_llm(user_message):
        logger.warning("[chat] stream refused off-topic LLM user_id=%s", user_id)
        yield {"type": "chunk", "text": get_refusal_response(user_message, profile)}
        return

    memories = get_relevant_memories(user_id=user_id, session_id=session_id, query=user_message, n_results=3)

    do_search, queries = should_search(user_message, profile, conversation_history)
    search_results_list = []
    if do_search and queries:
        yield {"type": "status", "phase": "searching", "message": "Searching universities and programs…"}
        logger.info("[chat] stream search start queries=%s", len(queries))
        search_results_list = search_for_context(queries)
        logger.info("[chat] stream search done results=%s", len(search_results_list))

    sources = [{"title": r["title"], "url": r["url"], "source": r["source"]} for r in search_results_list]
    if sources:
        yield {"type": "sources", "sources": sources}

    yield {"type": "status", "phase": "generating", "message": "Composing your answer…"}

    messages = build_prompt(
        user_message=user_message,
        profile=profile,
        memories=memories,
        search_results=search_results_list,
        conversation_history=conversation_history,
    )

    logger.info("[chat] stream llm start (waiting for Gemma...)")
    llm_start = time.time()
    chars_out = 0
    for chunk in ollama_service.stream_chat(messages=messages):
        if chunk:
            chars_out += len(chunk)
            yield {"type": "chunk", "text": chunk}
    logger.info(
        "[chat] stream llm done in %.2fs chars=%s",
        time.time() - llm_start,
        chars_out,
    )


def stream_chat_turn(user_message: str, user_id: str, session_id: str = None, profile: dict = None, conversation_history: list = None) -> tuple:
    """Legacy wrapper — prefer stream_chat_events for SSE."""
    events = list(stream_chat_events(user_message, user_id, session_id, profile, conversation_history))
    chunks = [e["text"] for e in events if e.get("type") == "chunk" and e.get("text")]
    sources = next((e["sources"] for e in events if e.get("type") == "sources"), [])
    def chunk_gen():
        for text in chunks:
            yield text
    metadata = {"searched": bool(sources), "queries_used": [], "sources": sources}
    return chunk_gen(), metadata
