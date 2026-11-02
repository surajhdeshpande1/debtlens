from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.debt import DebtItem
from app.schemas.analytics import RemediationRequest, RemediationPlanResponse, WhatIfSimulationRequest, WhatIfSimulationResponse
from app.services.knapsack_optimiser import solve_knapsack_remediation, run_what_if_simulation
from app.services.debt_economics import update_debt_economics

router = APIRouter(prefix="/optimiser", tags=["Ledger & Remediation Optimiser"])

@router.post("/plan", response_model=RemediationPlanResponse)
def get_optimal_plan(req: RemediationRequest, db: Session = Depends(get_db)):
    plan = solve_knapsack_remediation(
        db=db,
        project_id=req.project_id,
        sprint_budget_hours=req.sprint_budget_hours,
        allowed_categories=req.allowed_categories,
        force_include_debt_ids=req.force_include_debt_ids
    )
    return plan

@router.post("/what-if", response_model=WhatIfSimulationResponse)
def simulate_what_if(req: WhatIfSimulationRequest, db: Session = Depends(get_db)):
    scenarios = run_what_if_simulation(
        db=db,
        project_id=req.project_id,
        budgets=req.budget_scenarios
    )
    return {"scenarios": scenarios}

@router.get("/ledger-summary")
def get_ledger_summary(project_id: int, db: Session = Depends(get_db)):
    update_debt_economics(db, project_id)
    debts = db.query(DebtItem).filter(DebtItem.project_id == project_id).all()

    total_p = sum(d.effort_principal for d in debts)
    total_i = sum(d.accrued_interest for d in debts)
    breakeven_items = [d for d in debts if d.break_even_status]

    category_breakdown = {}
    for d in debts:
        c = d.category
        if c not in category_breakdown:
            category_breakdown[c] = {"count": 0, "principal": 0.0, "interest": 0.0}
        category_breakdown[c]["count"] += 1
        category_breakdown[c]["principal"] += d.effort_principal
        category_breakdown[c]["interest"] += d.accrued_interest

    return {
        "total_principal": round(total_p, 1),
        "total_interest": round(total_i, 1),
        "net_drag": round(total_i - total_p, 1),
        "total_items": len(debts),
        "breakeven_count": len(breakeven_items),
        "breakeven_pct": round(len(breakeven_items) / max(1, len(debts)) * 100, 1),
        "category_breakdown": category_breakdown
    }

