"""
ai/app/services/chroma_service.py
Service managing persistent semantic memory using ChromaDB with detailed BTS logging.
"""
import os
import uuid
import time
import logging
import chromadb

logger = logging.getLogger("chroma_service")

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_DEFAULT_CHROMA = os.path.join(_REPO_ROOT, "data", "chroma_data")
_chroma_env = os.getenv("CHROMA_PATH", _DEFAULT_CHROMA)
CHROMA_PATH = os.path.abspath(_chroma_env) if not os.path.isabs(_chroma_env) else _chroma_env
COLLECTION_NAME = "conversation_memory"

os.makedirs(CHROMA_PATH, exist_ok=True)
logger.debug("[chroma] init path=%s", CHROMA_PATH)
client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_or_create_collection(name=COLLECTION_NAME)
logger.debug("[chroma] collection=%s count=%s", COLLECTION_NAME, collection.count())

def save_memory(user_id: str, session_id: str, summary: str, metadata: dict = None) -> None:
    """Embeds and persists a conversation summary associated with user ID and session ID."""
    logger.debug("[chroma] save user_id=%s session_id=%s", user_id, session_id)
    meta = metadata.copy() if metadata else {}
    meta["user_id"] = user_id
    meta["session_id"] = session_id or "default_session"
    if "timestamp" not in meta:
        meta["timestamp"] = int(time.time())
    if "type" not in meta:
        meta["type"] = meta.get("source", "conversation_summary")
        
    doc_id = str(uuid.uuid4())
    collection.add(
        documents=[summary],
        metadatas=[meta],
        ids=[doc_id]
    )
    logger.debug("[chroma] saved doc_id=%s", doc_id)

def get_relevant_memories(user_id: str, query: str, session_id: str = None, n_results: int = 3) -> list:
    """Performs semantic similarity query on stored memories scoped to user ID (across all sessions)."""
    start = time.time()
    count = collection.count()
    if count == 0:
        logger.debug("[chroma] collection empty")
        return []
    try:
        where_clause = {"user_id": {"$eq": user_id}}
        if session_id:
            where_clause = {
                "$and": [
                    {"user_id": {"$eq": user_id}},
                    {"session_id": {"$eq": session_id}},
                ]
            }
        results = collection.query(
            query_texts=[query],
            n_results=min(n_results * 3 if session_id else n_results, count),
            where=where_clause
        )
        duration = time.time() - start
        documents = results.get("documents", [])
        metadatas = results.get("metadatas", [])
        retrieved = documents[0] if documents and len(documents) > 0 else []
        if session_id and metadatas and len(metadatas) > 0:
            filtered = []
            for doc, meta in zip(documents[0], metadatas[0]):
                if meta.get("session_id") == session_id:
                    filtered.append(doc)
            retrieved = filtered[:n_results]
        else:
            retrieved = retrieved[:n_results]
        logger.debug("[chroma] query done in %.2fs retrieved=%s", duration, len(retrieved))
        return retrieved
    except Exception as e:
        logger.error("[chroma] query error: %s", str(e))
        return []

def delete_session_memories(user_id: str, session_id: str) -> None:
    """Deletes vector memory entries for a specific user and session."""
    logger.debug("[chroma] delete session user_id=%s session_id=%s", user_id, session_id)
    try:
        collection.delete(where={
            "$and": [
                {"user_id": {"$eq": user_id}},
                {"session_id": {"$eq": session_id}},
            ]
        })
        logger.debug("[chroma] session deleted session_id=%s", session_id)
    except Exception as e:
        logger.error("[chroma] delete session error: %s", str(e))
        raise


def delete_user_memories(user_id: str) -> None:
    """Deletes all persistent vector memory entries associated with a user ID."""
    logger.debug("[chroma] delete user user_id=%s", user_id)
    try:
        collection.delete(where={"user_id": user_id})
        logger.debug("[chroma] user deleted user_id=%s", user_id)
    except Exception as e:
        logger.error("[chroma] delete user error: %s", str(e))
