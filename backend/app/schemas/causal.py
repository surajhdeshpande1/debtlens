from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class CauseNodeCreate(BaseModel):
    project_id: int
    description: str
    category: Optional[str] = "GENERAL"

class CauseNodeResponse(BaseModel):
    id: int
    project_id: int
    description: str
    normalized_text: str
    category: str
    degree_centrality: float
    betweenness_centrality: float
    created_at: datetime
    incident_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

class CausalEdgeResponse(BaseModel):
    id: int
    source_cause_id: int
    target_cause_id: int
    source_description: str
    target_description: str
    relation_type: str
    frequency: int

class CytoscapeNodeData(BaseModel):
    id: str
    label: str
    category: str
    degree_centrality: float
    betweenness_centrality: float
    incident_count: int

class CytoscapeEdgeData(BaseModel):
    id: str
    source: str
    target: str
    relation: str
    weight: int

class CytoscapeElement(BaseModel):
    data: dict

class CausalGraphResponse(BaseModel):
    nodes: List[dict]
    edges: List[dict]
    systemic_causes: List[CauseNodeResponse]

