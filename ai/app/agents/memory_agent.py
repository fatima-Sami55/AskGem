"""
ai/app/agents/memory_agent.py
Agent summarizing completed conversation sessions and persisting vector snapshots in ChromaDB.
"""
from app.services.prompt_service import build_summary_prompt
from app.services import ollama_service
from app.services.chroma_service import save_memory

REFUSAL_INDICATORS = [
    "i'm only equipped", "i can only help",
    "that's outside my", "i'm strictly",
    "i can't help with that"
]

def summarize_and_store(user_id: str, session_id: str, conversation: list) -> None:
    """Summarizes a multi-turn conversation and stores it in vector memory."""
    if not conversation:
        return
    
    # Check if any messages in conversation were refusals
    for msg in conversation:
        content = ""
        if hasattr(msg, "content"):
            content = msg.content
        elif isinstance(msg, dict):
            content = msg.get("content", "")
        if any(ind in content.lower() for ind in REFUSAL_INDICATORS):
            return

    # 1. Build summary prompt
    prompt = build_summary_prompt(conversation)
    
    # 2. Call Ollama generate
    summary = ollama_service.generate(prompt, task_name="memory_summary")
    
    # 3. Save memory to ChromaDB if not refusal
    if summary and summary.strip():
        if any(ind in summary.lower() for ind in REFUSAL_INDICATORS):
            return
        save_memory(user_id=user_id, session_id=session_id, summary=summary.strip(), metadata={"source": "session_summary"})
