from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.causal import CauseNode, CausalEdge, IncidentCausalLink
from app.schemas.causal import CauseNodeCreate, CauseNodeResponse, CausalGraphResponse
from app.services.causal_graph import get_causal_graph_data, find_or_create_cause_node, add_causal_edge, recompute_centrality_metrics

router = APIRouter(prefix="/causal", tags=["Causal Analysis"])

@router.get("/graph", response_model=CausalGraphResponse)
def get_graph(project_id: int, db: Session = Depends(get_db)):
    return get_causal_graph_data(db, project_id)

@router.get("/nodes", response_model=List[CauseNodeResponse])
def get_cause_nodes(project_id: int, db: Session = Depends(get_db)):
    recompute_centrality_metrics(db, project_id)
    nodes = db.query(CauseNode).filter(CauseNode.project_id == project_id).all()
    results = []
    for n in nodes:
        cnt = db.query(IncidentCausalLink).filter(IncidentCausalLink.cause_node_id == n.id).count()
        results.append({
            "id": n.id,
            "project_id": n.project_id,
            "description": n.description,
            "normalized_text": n.normalized_text,
            "category": n.category,
            "degree_centrality": n.degree_centrality,
            "betweenness_centrality": n.betweenness_centrality,
            "created_at": n.created_at,
            "incident_count": cnt
        })
    results.sort(key=lambda x: (x["betweenness_centrality"] + x["degree_centrality"]), reverse=True)
    return results

@router.post("/nodes", response_model=CauseNodeResponse)
def create_cause_node(data: CauseNodeCreate, db: Session = Depends(get_db)):
    node = find_or_create_cause_node(db, data.project_id, data.description, data.category)
    recompute_centrality_metrics(db, data.project_id)
    return node

