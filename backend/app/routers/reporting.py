from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.incident import Incident
from app.models.debt import DebtItem
from app.models.causal import CauseNode
from app.models.repository import FileHotspot, SelfAdmittedDebt
from app.schemas.analytics import ExecutiveDashboardSummary
from app.services.debt_economics import update_debt_economics, compute_module_blast_radius
from app.services.similarity_engine import similarity_engine
from app.services.pdf_service import generate_pdf_report

router = APIRouter(prefix="/reporting", tags=["Knowledge & Reporting"])

@router.get("/dashboard-summary", response_model=ExecutiveDashboardSummary)
def get_dashboard_summary(project_id: int, db: Session = Depends(get_db)):
    update_debt_economics(db, project_id)

    incidents = db.query(Incident).filter(Incident.project_id == project_id).all()
    open_inc = [i for i in incidents if i.status != "RESOLVED"]
    res_inc = [i for i in incidents if i.status == "RESOLVED"]

    debts = db.query(DebtItem).filter(DebtItem.project_id == project_id).all()
    past_breakeven = [d for d in debts if d.break_even_status]
    tot_p = sum(d.effort_principal for d in debts)
    tot_i = sum(d.accrued_interest for d in debts)

    # High risk modules
    blast_radius_map = compute_module_blast_radius(db, project_id)
    mod_stats = {}
    for d in debts:
        m = d.module_name
        if m not in mod_stats:
            mod_stats[m] = {"module": m, "debt_count": 0, "interest": 0.0, "blast_radius": blast_radius_map.get(m.lower(), 1)}
        mod_stats[m]["debt_count"] += 1
        mod_stats[m]["interest"] += d.accrued_interest
    
    high_risk_mods = sorted(mod_stats.values(), key=lambda x: x["interest"], reverse=True)[:5]

    # Top systemic causes
    causes = db.query(CauseNode).filter(CauseNode.project_id == project_id).order_by(CauseNode.betweenness_centrality.desc()).limit(5).all()
    top_causes = [
        {
            "id": c.id,
            "description": c.description,
            "category": c.category,
            "betweenness_centrality": c.betweenness_centrality,
            "degree_centrality": c.degree_centrality
        }
        for c in causes
    ]

    regressions = similarity_engine.detect_regressions(incidents)
    satd_count = db.query(SelfAdmittedDebt).filter(SelfAdmittedDebt.project_id == project_id).count()

    return ExecutiveDashboardSummary(
        total_incidents=len(incidents),
        open_incidents=len(open_inc),
        resolved_incidents=len(res_inc),
        total_debt_items=len(debts),
        past_breakeven_count=len(past_breakeven),
        total_principal_effort=round(tot_p, 1),
        total_accrued_interest=round(tot_i, 1),
        net_economic_drag=round(tot_i - tot_p, 1),
        high_risk_modules=high_risk_mods,
        top_systemic_causes=top_causes,
        regressions_detected=len(regressions),
        satd_count=satd_count
    )

@router.get("/pdf")
def download_pdf_report(project_id: int, db: Session = Depends(get_db)):
    try:
        pdf_bytes = generate_pdf_report(db, project_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=DebtLens_Audit_Project_{project_id}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

