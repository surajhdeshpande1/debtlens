from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class FiveWhysItem(BaseModel):
    step: int
    question: str
    cause: str
    category: Optional[str] = "GENERAL"

class IncidentCreate(BaseModel):
    project_id: int
    title: str
    description: str
    severity: str = "MEDIUM"
    affected_module: str
    affected_component: Optional[str] = None
    reported_by: Optional[str] = "Current User"
    resolution_effort_hours: float = 4.0
    five_whys: Optional[List[FiveWhysItem]] = None

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    affected_module: Optional[str] = None
    affected_component: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolution_effort_hours: Optional[float] = None
    resolved_at: Optional[datetime] = None

class IncidentResponse(BaseModel):
    id: int
    project_id: int
    incident_number: str
    title: str
    description: str
    severity: str
    status: str
    affected_module: str
    affected_component: Optional[str]
    reported_by: Optional[str]
    resolution_notes: Optional[str]
    resolution_effort_hours: float
    reported_at: datetime
    resolved_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)

class IncidentDetailResponse(IncidentResponse):
    linked_causes: List[dict] = []
    linked_debt_ids: List[int] = []
    is_regression: bool = False
    regressed_from_id: Optional[int] = None

