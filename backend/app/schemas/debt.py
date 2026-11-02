from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class DebtCreate(BaseModel):
    project_id: int
    title: str
    description: str
    category: str = "CODE_SMELL"
    module_name: str
    file_path: Optional[str] = None
    effort_principal: float = 8.0  # P(d) in hours
    root_cause_id: Optional[int] = None
    assignee: Optional[str] = None
    prerequisite_ids: Optional[List[int]] = None
    linked_incident_ids: Optional[List[int]] = None

class DebtUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    module_name: Optional[str] = None
    file_path: Optional[str] = None
    effort_principal: Optional[float] = None
    status: Optional[str] = None
    assignee: Optional[str] = None
    root_cause_id: Optional[int] = None
    prerequisite_ids: Optional[List[int]] = None

class DebtResponse(BaseModel):
    id: int
    project_id: int
    debt_key: str
    title: str
    description: str
    category: str
    module_name: str
    file_path: Optional[str]
    effort_principal: float
    accrued_interest: float
    break_even_status: bool
    risk_score: float
    status: str
    assignee: Optional[str]
    root_cause_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    prerequisite_ids: List[int] = []
    linked_incident_count: int = 0
    age_days: int = 0

    model_config = ConfigDict(from_attributes=True)

class DebtPrerequisiteCreate(BaseModel):
    debt_id: int
    prerequisite_debt_id: int

