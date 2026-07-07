"""
ai/app/routers/recommendations.py
FastAPI router for personalized university and scholarship recommendations.
"""
import logging
from fastapi import APIRouter

from app.models.schemas import (
    RecommendationsRequest,
    UniversityRecommendationsResponse,
    ScholarshipRecommendationsResponse,
    UniversityRecommendation,
    ScholarshipRecommendation,
)
from app.agents import recommendations_agent

logger = logging.getLogger("recommendations_router")
router = APIRouter(tags=["recommendations"])


def _safe_university_items(raw_items: list) -> list[UniversityRecommendation]:
    items = []
    for u in raw_items or []:
        try:
            items.append(UniversityRecommendation(**u))
        except Exception as exc:
            logger.warning("[RECOMMENDATIONS ROUTER] Skipping invalid university item: %s", exc)
    return items


def _safe_scholarship_items(raw_items: list) -> list[ScholarshipRecommendation]:
    items = []
    for s in raw_items or []:
        try:
            items.append(ScholarshipRecommendation(**s))
        except Exception as exc:
            logger.warning("[RECOMMENDATIONS ROUTER] Skipping invalid scholarship item: %s", exc)
    return items


@router.post("/recommendations/universities", response_model=UniversityRecommendationsResponse)
def university_recommendations_endpoint(request: RecommendationsRequest):
    """Returns personalized university recommendations grounded in live web search."""
    profile_dict = request.profile.model_dump() if request.profile else {}
    try:
        result = recommendations_agent.get_university_recommendations(profile_dict)
    except Exception as exc:
        logger.error("[RECOMMENDATIONS ROUTER] Universities agent error: %s", exc)
        result = {"universities": [], "profileSummary": None}

    universities = _safe_university_items(result.get("universities", []))
    return UniversityRecommendationsResponse(
        universities=universities,
        profileSummary=result.get("profileSummary"),
        disclaimer=result.get("disclaimer") or "Verify all details on official university websites.",
        source=result.get("source"),
    )


@router.post("/recommendations/scholarships", response_model=ScholarshipRecommendationsResponse)
def scholarship_recommendations_endpoint(request: RecommendationsRequest):
    """Returns personalized scholarship recommendations grounded in live web search."""
    profile_dict = request.profile.model_dump() if request.profile else {}
    try:
        result = recommendations_agent.get_scholarship_recommendations(profile_dict)
    except Exception as exc:
        logger.error("[RECOMMENDATIONS ROUTER] Scholarships agent error: %s", exc)
        result = {"scholarships": [], "profileSummary": None}

    scholarships = _safe_scholarship_items(result.get("scholarships", []))
    return ScholarshipRecommendationsResponse(
        scholarships=scholarships,
        profileSummary=result.get("profileSummary"),
        disclaimer=result.get("disclaimer") or "Verify eligibility and deadlines on official scholarship portals.",
        source=result.get("source"),
    )
