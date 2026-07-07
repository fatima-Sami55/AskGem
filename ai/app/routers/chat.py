"""
ai/app/routers/chat.py
Router exposing chat capabilities with detailed BTS logging and search metadata.
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
    logger.info(f"📥 [CHAT ROUTER] Incoming request for user_id='{request.user_id}', session_id='{request.session_id}' | Message: '{request.message}'")
    try:
        profile_dict = request.profile.model_dump() if request.profile else {}
        history_list = [msg.model_dump() for msg in request.conversation_history] if request.conversation_history else []
        
        logger.info(f"🔄 [CHAT ROUTER] Forwarding request to chat_agent orchestrator...")
        response_text, searched, queries_used, sources = chat_agent.process_chat_turn(
            user_message=request.message,
            user_id=request.user_id,
            session_id=request.session_id,
            profile=profile_dict,
            conversation_history=history_list
        )
        
        logger.info(f"✅ [CHAT ROUTER] Successfully generated response for user_id='{request.user_id}' ({len(response_text)} chars)")
        
        search_sources = [SearchSource(**s) for s in sources] if sources else []
        return ChatResponse(
            response=response_text,
            user_id=request.user_id,
            searched=searched,
            queries_used=queries_used,
            sources=search_sources
        )
    except Exception as e:
        logger.error(f"💥 [CHAT ROUTER] Error handling chat turn: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/stream")
def handle_chat_stream(request: ChatRequest):
    """Streams token chunks for incoming chat requests via Server-Sent Events (SSE)."""
    logger.info(f"📥 [CHAT ROUTER STREAM] Incoming stream request for user_id='{request.user_id}', session_id='{request.session_id}'")
    try:
        profile_dict = request.profile.model_dump() if request.profile else {}
        history_list = [msg.model_dump() for msg in request.conversation_history] if request.conversation_history else []
        
        token_generator, metadata = chat_agent.stream_chat_turn(
            user_message=request.message,
            user_id=request.user_id,
            session_id=request.session_id,
            profile=profile_dict,
            conversation_history=history_list
        )
        
        def event_stream():
            sources = metadata.get("sources") or []
            if sources:
                yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

            for chunk in token_generator:
                if chunk:
                    clean_chunk = chunk.replace("\n", "\\n")
                    yield f"data: {json.dumps({'chunk': clean_chunk})}\n\n"

            yield "data: [DONE]\n\n"
            
        return StreamingResponse(event_stream(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"💥 [CHAT ROUTER STREAM] Error setting up stream: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
