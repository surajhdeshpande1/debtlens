from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import csv
import io

from app.database import get_db
from app.models.incident import Incident, IncidentStatus
from app.models.causal import IncidentCausalLink, CauseNode
from app.models.debt import DebtIncidentLink
from app.schemas.incident import IncidentCreate, IncidentUpdate, IncidentResponse, IncidentDetailResponse
from app.services.causal_graph import find_or_create_cause_node, add_causal_edge, recompute_centrality_metrics
from app.services.similarity_engine import similarity_engine
from app.services.debt_economics import update_debt_economics
from app.utils import utc_now

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("", response_model=List[IncidentResponse])
def get_incidents(
    project_id: int,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    module: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Incident).filter(Incident.project_id == project_id)
    if status and status != "ALL":
        query = query.filter(Incident.status == status.upper())
    if severity and severity != "ALL":
        query = query.filter(Incident.severity == severity.upper())
    if module and module != "ALL":
        query = query.filter(Incident.affected_module == module)
    if search:
        s = f"%{search}%"
        query = query.filter((Incident.title.ilike(s)) | (Incident.description.ilike(s)) | (Incident.incident_number.ilike(s)))
    
    return query.order_by(Incident.reported_at.desc()).all()

@router.get("/export/csv")
def export_incidents_csv(project_id: int, db: Session = Depends(get_db)):
    items = db.query(Incident).filter(Incident.project_id == project_id).order_by(Incident.reported_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Incident ID", "Title", "Severity", "Status", "Affected Module",
        "Component", "Reported By", "Resolution Effort (hrs)", "Reported At", "Resolved At"
    ])
    for inc in items:
        writer.writerow([
            inc.incident_number,
            inc.title,
            inc.severity,
            inc.status,
            inc.affected_module,
            inc.affected_component or "N/A",
            inc.reported_by or "Operator",
            inc.resolution_effort_hours,
            inc.reported_at.strftime("%Y-%m-%d %H:%M:%S") if inc.reported_at else "",
            inc.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if inc.resolved_at else ""
        ])
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=debtlens_incidents_p{project_id}.csv"}
    )

@router.get("/{incident_id}", response_model=IncidentDetailResponse)
def get_incident_detail(incident_id: int, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Fetch linked 5-Whys causes
    causal_links = db.query(IncidentCausalLink).filter(IncidentCausalLink.incident_id == inc.id).order_by(IncidentCausalLink.step_number).all()
    causes_data = []
    for cl in causal_links:
        node = db.query(CauseNode).filter(CauseNode.id == cl.cause_node_id).first()
        if node:
            causes_data.append({
                "step": cl.step_number,
                "cause_id": node.id,
                "description": node.description,
                "category": node.category,
                "betweenness_centrality": node.betweenness_centrality,
                "degree_centrality": node.degree_centrality
            })

    # Fetch linked debt items
    debt_links = db.query(DebtIncidentLink).filter(DebtIncidentLink.incident_id == inc.id).all()
    debt_ids = [dl.debt_id for dl in debt_links]

    # Check regression
    all_incidents = db.query(Incident).filter(Incident.project_id == inc.project_id).all()
    regressions = similarity_engine.detect_regressions(all_incidents)
    is_reg = False
    reg_from = None
    for r in regressions:
        if r["new_incident_id"] == inc.id:
            is_reg = True
            reg_from = r["resolved_incident_id"]
            break

    detail = IncidentDetailResponse(
        id=inc.id,
        project_id=inc.project_id,
        incident_number=inc.incident_number,
        title=inc.title,
        description=inc.description,
        severity=inc.severity,
        status=inc.status,
        affected_module=inc.affected_module,
        affected_component=inc.affected_component,
        reported_by=inc.reported_by,
        resolution_notes=inc.resolution_notes,
        resolution_effort_hours=inc.resolution_effort_hours,
        reported_at=inc.reported_at,
        resolved_at=inc.resolved_at,
        linked_causes=causes_data,
        linked_debt_ids=debt_ids,
        is_regression=is_reg,
        regressed_from_id=reg_from
    )
    return detail

@router.post("", response_model=IncidentResponse)
def create_incident(data: IncidentCreate, db: Session = Depends(get_db)):
    # Auto-generate incident number (e.g., INC-113)
    count = db.query(Incident).filter(Incident.project_id == data.project_id).count()
    inc_num = f"INC-{101 + count}"

    inc = Incident(
        project_id=data.project_id,
        incident_number=inc_num,
        title=data.title,
        description=data.description,
        severity=data.severity.upper(),
        status=IncidentStatus.OPEN.value,
        affected_module=data.affected_module.lower(),
        affected_component=data.affected_component,
        reported_by=data.reported_by or "Operator",
        resolution_effort_hours=data.resolution_effort_hours,
        reported_at=utc_now()
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)

    # Process 5-Whys if provided
    if data.five_whys:
        prev_node = None
        for item in sorted(data.five_whys, key=lambda x: x.step):
            if item.cause and item.cause.strip():
                node = find_or_create_cause_node(db, data.project_id, item.cause.strip(), item.category or "GENERAL")
                db.add(IncidentCausalLink(
                    incident_id=inc.id,
                    cause_node_id=node.id,
                    step_number=item.step
                ))
                if prev_node:
                    add_causal_edge(db, data.project_id, prev_node.id, node.id, "caused_by")
                prev_node = node
        db.commit()
        recompute_centrality_metrics(db, data.project_id)

    # Update economic ledger
    update_debt_economics(db, data.project_id)
    return inc

@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(incident_id: int, data: IncidentUpdate, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    for field, val in data.dict(exclude_unset=True).items():
        if field == "status" and val:
            inc.status = val.upper()
            if inc.status == IncidentStatus.RESOLVED.value and not inc.resolved_at:
                inc.resolved_at = utc_now()
        elif val is not None:
            setattr(inc, field, val)

    db.commit()
    db.refresh(inc)
    update_debt_economics(db, inc.project_id)
    return inc

