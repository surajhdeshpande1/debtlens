from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import csv
import io

from app.database import get_db
from app.models.debt import DebtItem, DebtStatus, DebtPrerequisite, DebtIncidentLink
from app.models.incident import Incident
from app.schemas.debt import DebtCreate, DebtUpdate, DebtResponse, DebtPrerequisiteCreate
from app.services.debt_economics import update_debt_economics
from app.utils import utc_now

router = APIRouter(prefix="/debt", tags=["Debt Registry"])

@router.get("", response_model=List[DebtResponse])
def get_debt_items(
    project_id: int,
    status: Optional[str] = None,
    category: Optional[str] = None,
    break_even_only: Optional[bool] = False,
    db: Session = Depends(get_db)
):
    update_debt_economics(db, project_id)
    query = db.query(DebtItem).filter(DebtItem.project_id == project_id)

    if status and status != "ALL":
        query = query.filter(DebtItem.status == status.upper())
    if category and category != "ALL":
        query = query.filter(DebtItem.category == category.upper())
    if break_even_only:
        query = query.filter(DebtItem.break_even_status == True)

    items = query.order_by(DebtItem.risk_score.desc()).all()
    results = []
    now = utc_now()

    for d in items:
        prereqs = [p.prerequisite_debt_id for p in d.prerequisites]
        inc_count = len(d.incident_links)
        age = (now - d.created_at).days if d.created_at else 0

        results.append(DebtResponse(
            id=d.id,
            project_id=d.project_id,
            debt_key=d.debt_key,
            title=d.title,
            description=d.description,
            category=d.category,
            module_name=d.module_name,
            file_path=d.file_path,
            effort_principal=d.effort_principal,
            accrued_interest=d.accrued_interest,
            break_even_status=d.break_even_status,
            risk_score=d.risk_score,
            status=d.status,
            assignee=d.assignee,
            root_cause_id=d.root_cause_id,
            created_at=d.created_at,
            updated_at=d.updated_at,
            prerequisite_ids=prereqs,
            linked_incident_count=inc_count,
            age_days=age
        ))
    return results

@router.get("/export/csv")
def export_debt_csv(project_id: int, db: Session = Depends(get_db)):
    update_debt_economics(db, project_id)
    items = db.query(DebtItem).filter(DebtItem.project_id == project_id).order_by(DebtItem.risk_score.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Debt Key", "Title", "Category", "Module", "File Path",
        "Principal Effort (hrs)", "Accrued Interest (hrs)", "Break-Even Flag",
        "Risk Score", "Status", "Assignee"
    ])
    for item in items:
        writer.writerow([
            item.debt_key,
            item.title,
            item.category,
            item.module_name,
            item.file_path or "N/A",
            item.effort_principal,
            round(item.accrued_interest, 2),
            "YES" if item.break_even_status else "NO",
            round(item.risk_score, 2),
            item.status,
            item.assignee or "Unassigned"
        ])
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=debtlens_debt_ledger_p{project_id}.csv"}
    )

@router.post("", response_model=DebtResponse)
def create_debt_item(data: DebtCreate, db: Session = Depends(get_db)):
    count = db.query(DebtItem).filter(DebtItem.project_id == data.project_id).count()
    key = f"DEBT-{101 + count}"

    debt = DebtItem(
        project_id=data.project_id,
        debt_key=key,
        title=data.title,
        description=data.description,
        category=data.category.upper(),
        module_name=data.module_name.lower(),
        file_path=data.file_path,
        effort_principal=data.effort_principal,
        status=DebtStatus.IDENTIFIED.value,
        assignee=data.assignee,
        root_cause_id=data.root_cause_id
    )
    db.add(debt)
    db.commit()
    db.refresh(debt)

    if data.prerequisite_ids:
        for pid in data.prerequisite_ids:
            db.add(DebtPrerequisite(debt_id=debt.id, prerequisite_debt_id=pid))
    
    if data.linked_incident_ids:
        for inc_id in data.linked_incident_ids:
            db.add(DebtIncidentLink(debt_id=debt.id, incident_id=inc_id))

    db.commit()
    update_debt_economics(db, data.project_id)
    db.refresh(debt)

    return DebtResponse(
        id=debt.id,
        project_id=debt.project_id,
        debt_key=debt.debt_key,
        title=debt.title,
        description=debt.description,
        category=debt.category,
        module_name=debt.module_name,
        file_path=debt.file_path,
        effort_principal=debt.effort_principal,
        accrued_interest=debt.accrued_interest,
        break_even_status=debt.break_even_status,
        risk_score=debt.risk_score,
        status=debt.status,
        assignee=debt.assignee,
        root_cause_id=debt.root_cause_id,
        created_at=debt.created_at,
        updated_at=debt.updated_at,
        prerequisite_ids=data.prerequisite_ids or [],
        linked_incident_count=len(data.linked_incident_ids or []),
        age_days=0
    )

@router.patch("/{debt_id}", response_model=DebtResponse)
def update_debt(debt_id: int, data: DebtUpdate, db: Session = Depends(get_db)):
    debt = db.query(DebtItem).filter(DebtItem.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt item not found")

    for field, val in data.dict(exclude_unset=True).items():
        if field == "prerequisite_ids" and val is not None:
            db.query(DebtPrerequisite).filter(DebtPrerequisite.debt_id == debt.id).delete()
            for pid in val:
                db.add(DebtPrerequisite(debt_id=debt.id, prerequisite_debt_id=pid))
        elif val is not None:
            setattr(debt, field, val)

    db.commit()
    update_debt_economics(db, debt.project_id)
    db.refresh(debt)

    prereqs = [p.prerequisite_debt_id for p in debt.prerequisites]
    return DebtResponse(
        id=debt.id,
        project_id=debt.project_id,
        debt_key=debt.debt_key,
        title=debt.title,
        description=debt.description,
        category=debt.category,
        module_name=debt.module_name,
        file_path=debt.file_path,
        effort_principal=debt.effort_principal,
        accrued_interest=debt.accrued_interest,
        break_even_status=debt.break_even_status,
        risk_score=debt.risk_score,
        status=debt.status,
        assignee=debt.assignee,
        root_cause_id=debt.root_cause_id,
        created_at=debt.created_at,
        updated_at=debt.updated_at,
        prerequisite_ids=prereqs,
        linked_incident_count=len(debt.incident_links),
        age_days=(utc_now() - debt.created_at).days if debt.created_at else 0
    )

@router.post("/link-incident")
def link_debt_to_incident(debt_id: int, incident_id: int, db: Session = Depends(get_db)):
    debt = db.query(DebtItem).filter(DebtItem.id == debt_id).first()
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not debt or not incident:
        raise HTTPException(status_code=404, detail="Debt or incident not found")

    exists = db.query(DebtIncidentLink).filter(
        DebtIncidentLink.debt_id == debt_id,
        DebtIncidentLink.incident_id == incident_id
    ).first()
    if not exists:
        db.add(DebtIncidentLink(debt_id=debt_id, incident_id=incident_id))
        db.commit()
        update_debt_economics(db, debt.project_id)

    return {"message": "Linked successfully", "debt_id": debt_id, "incident_id": incident_id}

