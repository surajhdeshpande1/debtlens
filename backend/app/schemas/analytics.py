from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class RemediationRequest(BaseModel):
    project_id: int
    sprint_budget_hours: float = 40.0
    allowed_categories: Optional[List[str]] = None
    force_include_debt_ids: Optional[List[int]] = None

class RemediationDebtItem(BaseModel):
    id: int
    debt_key: str
    title: str
    category: str
    module_name: str
    effort_principal: float
    accrued_interest: float
    risk_score: float
    break_even_status: bool
    prerequisite_keys: List[str] = []

class RemediationPlanResponse(BaseModel):
    sprint_budget: float
    total_effort_allocated: float
    budget_utilization_pct: float
    total_risk_reduced: float
    accumulated_interest_saved: float
    selected_items: List[RemediationDebtItem]
    deferred_items: List[RemediationDebtItem]
    remediation_order: List[str]  # Topological sequence

class WhatIfSimulationRequest(BaseModel):
    project_id: int
    budget_scenarios: List[float] = [20.0, 40.0, 60.0, 80.0, 120.0]

class WhatIfScenarioResult(BaseModel):
    budget: float
    effort_used: float
    items_count: int
    risk_reduction: float
    interest_saved: float
    roi_ratio: float

class WhatIfSimulationResponse(BaseModel):
    scenarios: List[WhatIfScenarioResult]

class SimilarIncidentMatch(BaseModel):
    incident_id: int
    incident_number: str
    title: str
    severity: str
    status: str
    affected_module: str
    similarity_score: float
    lexical_score: float
    semantic_score: float

class RootCauseCluster(BaseModel):
    cluster_id: int
    cause_count: int
    theme_title: str
    causes: List[str]
    is_noise: bool

class RegressionDetectionItem(BaseModel):
    new_incident_id: int
    new_incident_number: str
    new_incident_title: str
    resolved_incident_id: int
    resolved_incident_number: str
    resolved_incident_title: str
    affected_module: str
    similarity: float
    resolved_at: datetime
    reported_at: datetime
    days_to_recurrence: float

class HotspotItem(BaseModel):
    id: int
    file_path: str
    module_name: str
    churn_count: int
    cyclomatic_complexity: float
    risk_score: float
    blast_radius: int

class SelfAdmittedDebtItem(BaseModel):
    id: int
    file_path: str
    module_name: str
    line_number: int
    marker_type: str
    comment_text: str
    status: str

class ExecutiveDashboardSummary(BaseModel):
    total_incidents: int
    open_incidents: int
    resolved_incidents: int
    total_debt_items: int
    past_breakeven_count: int
    total_principal_effort: float
    total_accrued_interest: float
    net_economic_drag: float  # interest - principal
    high_risk_modules: List[dict]
    top_systemic_causes: List[dict]
    regressions_detected: int
    satd_count: int

