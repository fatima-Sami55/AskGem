"""
ai/app/routers/search.py
Router exposing web search capabilities.
"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import SearchRequest
from app.services import search_service

router = APIRouter(tags=["search"])

@router.post("/search")
def execute_search(request: SearchRequest):
    """Executes live web search using Tavily API with DuckDuckGo fallback."""
    try:
        results = search_service.search(query=request.query, max_results=request.max_results or 5)
        cleaned = search_service.clean_results(results)
        return {
            "query": request.query,
            "results": results,
            "cleaned_results": cleaned
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
