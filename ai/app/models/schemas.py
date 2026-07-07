"""
ai/app/models/schemas.py
Pydantic schemas for data validation across AskPeri AI endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class StudentProfile(BaseModel):
    nationality: Optional[str] = "Pakistani"
    current_degree: Optional[str] = None
    target_degree: Optional[str] = None
    cgpa: Optional[float] = None
    preferred_countries: Optional[List[str]] = Field(default_factory=list)
    preferred_majors: Optional[List[str]] = Field(default_factory=list)
    budget: Optional[Any] = None
    english_test: Optional[Dict[str, Any]] = None
    work_experience: Optional[Any] = None
    research_experience: Optional[bool] = None
    publications: Optional[int] = None
    profile_score: Optional[float] = None
    career_goals: Optional[str] = None
    extracted_this_message: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    profile: Optional[StudentProfile] = None
    conversation_history: Optional[List[ChatMessage]] = Field(default_factory=list)

class SearchSource(BaseModel):
    title: str
    url: str
    source: str

class ChatResponse(BaseModel):
    response: str
    user_id: str
    searched: Optional[bool] = False
    queries_used: Optional[List[str]] = Field(default_factory=list)
    sources: Optional[List[SearchSource]] = Field(default_factory=list)

class SearchRequest(BaseModel):
    query: str
    max_results: Optional[int] = 5

class MemoryRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    conversation: List[ChatMessage]

class HealthResponse(BaseModel):
    status: str
    ollama: bool = False
    model: bool = False
    chroma: bool = False

class PingOllamaRequest(BaseModel):
    prompt: Optional[str] = "say hello"

class PingOllamaResponse(BaseModel):
    response: Any

class RoadmapRequest(BaseModel):
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    profile: Optional[StudentProfile] = None

class RoadmapStepDetail(BaseModel):
    title: str
    summary: Optional[str] = None
    details: List[str] = Field(default_factory=list)
    url: Optional[str] = None

class RoadmapResearchTask(BaseModel):
    title: str
    url: str
    fieldsToCollect: List[str] = Field(default_factory=list)
    notes: Optional[str] = None

class RoadmapPhase(BaseModel):
    phase: int
    title: str
    timeline: str
    description: Optional[str] = None
    steps: List[str] = Field(default_factory=list)
    stepDetails: List[RoadmapStepDetail] = Field(default_factory=list)
    tasks: List[RoadmapResearchTask] = Field(default_factory=list)

class RoadmapOpportunity(BaseModel):
    name: str
    url: str
    matchScore: int
    keyDeadline: str
    fundingType: str
    summary: str
    type: str  # Must be 'program' or 'scholarship'
    country: Optional[str] = None
    whyItFits: Optional[str] = None

class RoadmapResponse(BaseModel):
    title: Optional[str] = None
    opportunities: List[RoadmapOpportunity] = Field(default_factory=list)
    overallTimeline: str
    phases: List[RoadmapPhase] = Field(default_factory=list)
    gaps: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

class ProfileExtractRequest(BaseModel):
    message: str
    current_context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    regex_draft: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ProfileFieldResult(BaseModel):
    value: Optional[Any] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    action: str = "skip"  # update | skip | conflict
    reason: Optional[str] = None

class ProfileExtractResponse(BaseModel):
    fields: Dict[str, ProfileFieldResult] = Field(default_factory=dict)
    notes: Optional[str] = None

class RecommendationsRequest(BaseModel):
    profile: Optional[StudentProfile] = None
    recommendation_type: str = "universities"  # universities | scholarships

class UniversityRecommendation(BaseModel):
    name: str
    country: str
    program: Optional[str] = None
    minGpa: Optional[float] = None
    ieltsMin: Optional[float] = None
    tuition: Optional[str] = None
    whyItFits: str
    sourceUrl: str
    matchScore: Optional[int] = Field(default=None, ge=0, le=100)
    verified: Optional[bool] = True

class ScholarshipRecommendation(BaseModel):
    name: str
    country: str
    fundingType: str
    coverage: Optional[str] = None
    eligibility: Optional[str] = None
    deadline: Optional[str] = None
    amount: Optional[str] = None
    whyItFits: str
    sourceUrl: str
    matchScore: Optional[int] = Field(default=None, ge=0, le=100)
    verified: Optional[bool] = True

class UniversityRecommendationsResponse(BaseModel):
    universities: List[UniversityRecommendation] = Field(default_factory=list)
    profileSummary: Optional[str] = None
    disclaimer: str = "Verify all details on official university websites."
    source: Optional[str] = None

class ScholarshipRecommendationsResponse(BaseModel):
    scholarships: List[ScholarshipRecommendation] = Field(default_factory=list)
    profileSummary: Optional[str] = None
    disclaimer: str = "Verify eligibility and deadlines on official scholarship portals."
    source: Optional[str] = None
