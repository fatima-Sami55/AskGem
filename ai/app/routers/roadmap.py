"""
ai/app/routers/roadmap.py
FastAPI router for generating personalized academic roadmaps.
"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import RoadmapRequest, RoadmapResponse
from app.agents import roadmap_agent
import logging

logger = logging.getLogger("roadmap_router")
router = APIRouter(tags=["roadmap"])

@router.post("/roadmap", response_model=RoadmapResponse)
def generate_roadmap_endpoint(request: RoadmapRequest):
    """Generates a dynamic, search-grounded roadmap tailored to the student profile."""
    try:
        profile_dict = request.profile.model_dump() if request.profile else {}
        logger.info(f"🔄 [ROADMAP ROUTER] Forwarding request to roadmap_agent orchestrator...")
        
        roadmap_data = roadmap_agent.generate_personalized_roadmap(profile_dict)
        return roadmap_data
    except Exception as e:
        logger.error(f"❌ [ROADMAP ROUTER] Error generating roadmap: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
