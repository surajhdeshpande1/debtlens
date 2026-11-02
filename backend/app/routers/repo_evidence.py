from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from app.database import get_db
from app.models.repository import FileHotspot, ModuleDependency, SelfAdmittedDebt, RepoMetadata
from app.schemas.analytics import HotspotItem, SelfAdmittedDebtItem
from app.services.debt_economics import compute_module_blast_radius
from app.services.repo_analyzer import analyze_workspace_codebase, analyze_code_snippet
from pydantic import BaseModel

class CodeSnippetRequest(BaseModel):
    code: str
    language: str = "python"

router = APIRouter(prefix="/repo", tags=["Repository Evidence"])

@router.get("/hotspots", response_model=List[HotspotItem])
def get_hotspots(project_id: int, db: Session = Depends(get_db)):
    blast_radius_map = compute_module_blast_radius(db, project_id)
    hotspots = db.query(FileHotspot).filter(FileHotspot.project_id == project_id).order_by(FileHotspot.risk_score.desc()).all()
    
    results = []
    for h in hotspots:
        br = blast_radius_map.get(h.module_name.lower(), 1)
        results.append(HotspotItem(
            id=h.id,
            file_path=h.file_path,
            module_name=h.module_name,
            churn_count=h.churn_count,
            cyclomatic_complexity=h.cyclomatic_complexity,
            risk_score=h.risk_score,
            blast_radius=br
        ))
    return results

@router.get("/dependencies")
def get_module_dependencies(project_id: int, db: Session = Depends(get_db)):
    deps = db.query(ModuleDependency).filter(ModuleDependency.project_id == project_id).all()
    blast_radius_map = compute_module_blast_radius(db, project_id)

    nodes = set()
    edges = []
    for d in deps:
        nodes.add(d.source_module)
        nodes.add(d.target_module)
        edges.append({
            "source": d.source_module,
            "target": d.target_module
        })

    node_list = []
    for m in sorted(nodes):
        node_list.append({
            "id": m,
            "label": m.capitalize(),
            "blast_radius": blast_radius_map.get(m.lower(), 0)
        })

    return {
        "nodes": node_list,
        "edges": edges,
        "blast_radius_map": blast_radius_map
    }

@router.get("/satd", response_model=List[SelfAdmittedDebtItem])
def get_self_admitted_debt(project_id: int, marker: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(SelfAdmittedDebt).filter(SelfAdmittedDebt.project_id == project_id)
    if marker and marker != "ALL":
        query = query.filter(SelfAdmittedDebt.marker_type == marker.upper())
    
    items = query.order_by(SelfAdmittedDebt.id.asc()).all()
    return [
        SelfAdmittedDebtItem(
            id=s.id,
            file_path=s.file_path,
            module_name=s.module_name,
            line_number=s.line_number,
            marker_type=s.marker_type,
            comment_text=s.comment_text,
            status=s.status
        )
        for s in items
    ]

@router.post("/scan-workspace")
def scan_workspace(project_id: int, workspace_path: Optional[str] = None, db: Session = Depends(get_db)):
    target_path = workspace_path or os.getcwd()
    try:
        analyze_workspace_codebase(db, project_id, target_path)
        return {"message": "Workspace scanned successfully", "path": target_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan workspace: {str(e)}")

@router.post("/analyze-snippet")
def analyze_snippet(req: CodeSnippetRequest):
    return analyze_code_snippet(req.code, req.language)


