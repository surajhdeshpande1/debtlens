from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.incident import Incident
from app.models.causal import CauseNode
from app.schemas.analytics import SimilarIncidentMatch, RootCauseCluster, RegressionDetectionItem
from app.services.similarity_engine import similarity_engine

router = APIRouter(prefix="/intelligence", tags=["Incident Intelligence"])

@router.get("/similar-incidents", response_model=List[SimilarIncidentMatch])
def find_similar(
    incident_id: int,
    threshold: float = 0.15,
    top_k: int = 5,
    db: Session = Depends(get_db)
):
    target = db.query(Incident).filter(Incident.id == incident_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Incident not found")

    candidates = db.query(Incident).filter(
        Incident.project_id == target.project_id,
        Incident.id != target.id
    ).all()

    return similarity_engine.find_similar_incidents(target, candidates, threshold=threshold, top_k=top_k)

@router.get("/clusters", response_model=List[RootCauseCluster])
def get_root_cause_clusters(project_id: int, eps: float = 0.55, min_samples: int = 2, db: Session = Depends(get_db)):
    causes = db.query(CauseNode).filter(CauseNode.project_id == project_id).all()
    return similarity_engine.cluster_root_causes(causes, eps=eps, min_samples=min_samples)

@router.get("/regressions", response_model=List[RegressionDetectionItem])
def get_regressions(project_id: int, tau: float = 0.50, db: Session = Depends(get_db)):
    incidents = db.query(Incident).filter(Incident.project_id == project_id).all()
    return similarity_engine.detect_regressions(incidents, tau=tau)

@router.get("/compare-pairwise")
def compare_pairwise(
    incident_a_id: int,
    incident_b_id: int,
    alpha: float = 0.55,
    db: Session = Depends(get_db)
):
    inc_a = db.query(Incident).filter(Incident.id == incident_a_id).first()
    inc_b = db.query(Incident).filter(Incident.id == incident_b_id).first()
    if not inc_a or not inc_b:
        raise HTTPException(status_code=404, detail="One or both incidents not found")

    text_a = f"{inc_a.title}. {inc_a.description} module: {inc_a.affected_module}"
    text_b = f"{inc_b.title}. {inc_b.description} module: {inc_b.affected_module}"

    hybrid_mat, lex_mat, sem_mat = similarity_engine.compute_hybrid_matrix([text_a, text_b])
    lex = float(lex_mat[0, 1])
    sem = float(sem_mat[0, 1])
    hyb = (alpha * lex) + ((1.0 - alpha) * sem)

    # Extract overlapping words (excluding common stop words)
    words_a = set(w.lower() for w in inc_a.title.split() + inc_a.description.split() if len(w) > 3)
    words_b = set(w.lower() for w in inc_b.title.split() + inc_b.description.split() if len(w) > 3)
    common_tokens = sorted(list(words_a & words_b))

    return {
        "incident_a": {
            "id": inc_a.id,
            "number": inc_a.incident_number,
            "title": inc_a.title,
            "module": inc_a.affected_module,
            "severity": inc_a.severity
        },
        "incident_b": {
            "id": inc_b.id,
            "number": inc_b.incident_number,
            "title": inc_b.title,
            "module": inc_b.affected_module,
            "severity": inc_b.severity
        },
        "lexical_score": round(lex, 3),
        "semantic_score": round(sem, 3),
        "hybrid_score": round(hyb, 3),
        "alpha_weight": alpha,
        "same_module": inc_a.affected_module.lower() == inc_b.affected_module.lower(),
        "common_tokens": common_tokens[:10]
    }


