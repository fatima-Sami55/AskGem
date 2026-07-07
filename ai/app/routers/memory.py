"""
ai/app/routers/memory.py
Router exposing semantic memory storage and retrieval endpoints.
"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import MemoryRequest
from app.agents import memory_agent
from app.services import chroma_service

router = APIRouter(prefix="/memory", tags=["memory"])

@router.post("/summarize")
def summarize_memory(request: MemoryRequest):
    """Summarizes a completed conversation session and persists vector memory in ChromaDB."""
    try:
        history_list = [msg.model_dump() for msg in request.conversation]
        memory_agent.summarize_and_store(
            user_id=request.user_id,
            session_id=request.session_id,
            conversation=history_list
        )
        return {"status": "ok", "message": "Memory summarized and stored successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}")
def get_user_memories(user_id: str):
    """Retrieves stored memory summaries for a specific user ID."""
    try:
        memories = chroma_service.get_relevant_memories(user_id=user_id, query="academic profile goals scholarships", n_results=10)
        return {"user_id": user_id, "memories": memories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{user_id}/session/{session_id}")
def delete_session_memories(user_id: str, session_id: str):
    """Deletes vector memory entries for a specific chat session."""
    try:
        chroma_service.delete_session_memories(user_id=user_id, session_id=session_id)
        return {"status": "ok", "message": f"Memories for session {session_id} deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{user_id}")
def delete_user_memories(user_id: str):
    """Deletes all persistent vector memory entries for a user ID."""
    try:
        chroma_service.delete_user_memories(user_id=user_id)
        return {"status": "ok", "message": f"All memories for user {user_id} deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
