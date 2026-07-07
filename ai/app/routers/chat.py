"""
ai/app/routers/chat.py
Router exposing chat capabilities.
"""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.schemas import ChatRequest, ChatResponse, SearchSource
from app.agents import chat_agent

logger = logging.getLogger("chat_router")
router = APIRouter(tags=["chat"])

@router.post("/chat", response_model=ChatResponse)
def handle_chat(request: ChatRequest):
    """Processes incoming chat messages through memory, search, and Ollama reasoning pipeline."""
    logger.info("[chat] request user_id=%s session_id=%s", request.user_id, request.session_id)
    try:
        profile_dict = request.profile.model_dump() if request.profile else {}
        history_list = [msg.model_dump() for msg in request.conversation_history] if request.conversation_history else []
        
        response_text, searched, queries_used, sources = chat_agent.process_chat_turn(
            user_message=request.message,
            user_id=request.user_id,
            session_id=request.session_id,
            profile=profile_dict,
            conversation_history=history_list
        )
        
        search_sources = [SearchSource(**s) for s in sources] if sources else []
        return ChatResponse(
            response=response_text,
            user_id=request.user_id,
            searched=searched,
            queries_used=queries_used,
            sources=search_sources
        )
    except Exception as e:
        logger.error("[chat] error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/stream")
def handle_chat_stream(request: ChatRequest):
    """Streams token chunks for incoming chat requests via Server-Sent Events (SSE)."""
    logger.info("[chat] stream request user_id=%s session_id=%s", request.user_id, request.session_id)
    try:
        profile_dict = request.profile.model_dump() if request.profile else {}
        history_list = [msg.model_dump() for msg in request.conversation_history] if request.conversation_history else []
        
        def event_stream():
            for event in chat_agent.stream_chat_events(
                user_message=request.message,
                user_id=request.user_id,
                session_id=request.session_id,
                profile=profile_dict,
                conversation_history=history_list,
            ):
                event_type = event.get("type")
                if event_type == "chunk" and event.get("text"):
                    clean_chunk = event["text"].replace("\n", "\\n")
                    yield f"data: {json.dumps({'chunk': clean_chunk})}\n\n"
                elif event_type == "sources":
                    yield f"data: {json.dumps({'type': 'sources', 'sources': event.get('sources', [])})}\n\n"
                elif event_type == "status":
                    yield f"data: {json.dumps(event)}\n\n"

            yield "data: [DONE]\n\n"
            
        return StreamingResponse(event_stream(), media_type="text/event-stream")
    except Exception as e:
        logger.error("[chat] stream error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
