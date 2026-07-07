"""
ai/app/agents/chat_agent.py
Agent orchestrating full end-to-end chat turn for AskPeri with hardened multi-layer topic guards and intent-based web search.
"""
import logging
from app.services.chroma_service import get_relevant_memories
from app.services.search_service import search_for_context, build_search_queries
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
    """Skip LLM classifier for greetings and benign short messages."""
    msg = message.strip().lower()
    if not msg:
        return True
    if msg in GREETING_PATTERNS:
        return True
    if len(msg.split()) <= 2 and not is_off_topic(message):
        return True
    return False


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
        result = ollama_service.generate(classification_prompt, task_name="topic_guard")
        return result.strip().upper() == "OFFTOPIC"
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
        'university', 'universities', 'scholarship', 'scholarships',
        'visa', 'apply', 'admission', 'recommend', 'suggest',
        'chances', 'eligible', 'program', 'funding', 'daad',
        'erasmus', 'requirements', 'gpa requirement', 'ielts requirement',
        'where should i', 'which university', 'can i', 'should i',
        'am i eligible', 'what are my chances', 'college',
    ]

    high_stakes = any(trigger in message_lower for trigger in HIGH_STAKES_TRIGGERS)

    if word_count < 5 and not high_stakes:
        return False, []

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
    logger.info(f"🧠 [CHAT AGENT] Starting orchestration for user_id='{user_id}', session_id='{session_id}'")
    
    # Layer 1: keyword guard (fast)
    if is_off_topic(user_message):
        logger.warning(f"🛡️ [TOPIC GUARD L1] Refused off-topic keyword query for user_id='{user_id}'")
        return get_refusal_response(user_message, profile), False, [], []

    # Layer 2: LLM classifier (catches sophisticated jailbreaks; skip for greetings)
    if not should_skip_llm_topic_guard(user_message) and is_off_topic_by_llm(user_message):
        logger.warning(f"🛡️ [TOPIC GUARD L2] Refused off-topic LLM classified query for user_id='{user_id}'")
        return get_refusal_response(user_message, profile), False, [], []
    
    # 1. Retrieve relevant memories from ChromaDB scoped to session
    logger.info(f"🔍 [CHAT AGENT] Step 1/4: Querying ChromaDB memory for user_id='{user_id}', session_id='{session_id}'...")
    memories = get_relevant_memories(user_id=user_id, session_id=session_id, query=user_message, n_results=3)
    logger.info(f"🧠 [CHAT AGENT] Retrieved {len(memories) if isinstance(memories, list) else 0} memory snippets.")
    
    # 2. Run intelligent web search
    do_search, queries = should_search(user_message, profile, conversation_history)
    search_results_list = []
    if do_search and queries:
        logger.info(f"🌐 [CHAT AGENT] Step 2/4: Executing targeted web searches for queries={queries}")
        search_results_list = search_for_context(queries)
        logger.info(f"🌐 [CHAT AGENT] Processed {len(search_results_list)} structured search results.")
    else:
        logger.info("🌐 [CHAT AGENT] Step 2/4: Skipping web search for this turn.")
    
    # 3. Build prompt for Ollama
    logger.info(f"📝 [CHAT AGENT] Step 3/4: Assembling multi-turn prompt payload for Ollama...")
    messages = build_prompt(
        user_message=user_message,
        profile=profile,
        memories=memories,
        search_results=search_results_list,
        conversation_history=conversation_history
    )
    logger.info(f"📝 [CHAT AGENT] Prompt payload assembled with {len(messages)} message blocks.")
    
    # 4. Call Ollama chat endpoint
    logger.info(f"🚀 [CHAT AGENT] Step 4/4: Dispatching request to Ollama LLM engine...")
    ai_response = ollama_service.chat(messages=messages)
    logger.info(f"🎉 [CHAT AGENT] Received completion response from Ollama!")
    
    searched = bool(do_search and queries and len(search_results_list) > 0)
    sources = [{"title": r["title"], "url": r["url"], "source": r["source"]} for r in search_results_list]
    
    return ai_response, searched, queries, sources

def stream_chat_turn(user_message: str, user_id: str, session_id: str = None, profile: dict = None, conversation_history: list = None) -> tuple:
    """Orchestrates memory retrieval, live web search, prompt assembly, and returns Ollama stream generator + metadata."""
    logger.info(f"🧠 [CHAT AGENT STREAM] Starting stream orchestration for user_id='{user_id}', session_id='{session_id}'")
    
    # Layer 1: keyword guard (fast)
    if is_off_topic(user_message):
        logger.warning(f"🛡️ [TOPIC GUARD STREAM L1] Refused off-topic keyword query for user_id='{user_id}'")
        def refusal_gen_l1():
            yield get_refusal_response(user_message, profile)
        return refusal_gen_l1(), {"searched": False, "queries_used": [], "sources": []}

    # Layer 2: LLM classifier (catches sophisticated jailbreaks; skip for greetings)
    if not should_skip_llm_topic_guard(user_message) and is_off_topic_by_llm(user_message):
        logger.warning(f"🛡️ [TOPIC GUARD STREAM L2] Refused off-topic LLM classified query for user_id='{user_id}'")
        def refusal_gen_l2():
            yield get_refusal_response(user_message, profile)
        return refusal_gen_l2(), {"searched": False, "queries_used": [], "sources": []}

    memories = get_relevant_memories(user_id=user_id, session_id=session_id, query=user_message, n_results=3)
    
    do_search, queries = should_search(user_message, profile, conversation_history)
    search_results_list = []
    if do_search and queries:
        logger.info(f"🌐 [CHAT AGENT STREAM] Executing targeted web searches for queries={queries}")
        search_results_list = search_for_context(queries)
    else:
        logger.info("🌐 [CHAT AGENT STREAM] Skipping web search for this turn.")

    messages = build_prompt(
        user_message=user_message,
        profile=profile,
        memories=memories,
        search_results=search_results_list,
        conversation_history=conversation_history
    )
    
    logger.info(f"🚀 [CHAT AGENT STREAM] Dispatching stream request to Ollama...")
    token_gen = ollama_service.stream_chat(messages=messages)
    
    searched = bool(do_search and queries and len(search_results_list) > 0)
    sources = [{"title": r["title"], "url": r["url"], "source": r["source"]} for r in search_results_list]
    metadata = {
        "searched": searched,
        "queries_used": queries if do_search else [],
        "sources": sources
    }
    
    return token_gen, metadata
