from typing import Dict, List
from sqlalchemy.orm import Session

from app.config import settings
from app.models.debt import DebtItem, DebtIncidentLink
from app.models.incident import Incident
from app.models.repository import FileHotspot, ModuleDependency

SEVERITY_WEIGHTS = {
    "CRITICAL": 3.5,
    "HIGH": 2.5,
    "MEDIUM": 1.5,
    "LOW": 1.0
}

def compute_module_blast_radius(db: Session, project_id: int) -> Dict[str, int]:
    """
    Computes transitive blast radius for each module via Depth First Traversal (DFS)
    on the module dependency graph.
    If module A is depended on by B, and B by C, then blast radius of A is 2.
    """
    dependencies = db.query(ModuleDependency).filter(ModuleDependency.project_id == project_id).all()
    
    # Graph where edge is: target -> sources (who depends on target?)
    dependents_map = {}
    all_modules = set()
    for dep in dependencies:
        s, t = dep.source_module.lower(), dep.target_module.lower()
        all_modules.add(s)
        all_modules.add(t)
        if t not in dependents_map:
            dependents_map[t] = set()
        dependents_map[t].add(s)

    blast_radius = {}
    for mod in all_modules:
        visited = set()
        def dfs(current: str):
            for parent in dependents_map.get(current, set()):
                if parent not in visited:
                    visited.add(parent)
                    dfs(parent)
        dfs(mod)
        blast_radius[mod] = len(visited)

    return blast_radius

def compute_module_churn(db: Session, project_id: int) -> Dict[str, int]:
    """Sum churn counts of all files in each module."""
    hotspots = db.query(FileHotspot).filter(FileHotspot.project_id == project_id).all()
    churn_map = {}
    for h in hotspots:
        m = h.module_name.lower()
        churn_map[m] = churn_map.get(m, 0) + h.churn_count
    return churn_map

def update_debt_economics(db: Session, project_id: int) -> List[DebtItem]:
    """
    Calculates and updates accrued interest I(d), break-even status, and composite risk R(d)
    for all debt items in the project according to Section 7.3:
    I(d) = sum [severity_weight(k) * resolution_effort(k)] + lambda_1 * churn(d) + lambda_2 * blast_radius(d)
    Break-even is true when I(d) > P(d).
    """
    blast_radius_map = compute_module_blast_radius(db, project_id)
    churn_map = compute_module_churn(db, project_id)

    debt_items = db.query(DebtItem).filter(DebtItem.project_id == project_id).all()

    for debt in debt_items:
        # 1. Sum over linked incidents
        incident_links = db.query(DebtIncidentLink).filter(DebtIncidentLink.debt_id == debt.id).all()
        incident_cost = 0.0
        max_severity_val = 1.0

        for link in incident_links:
            inc = db.query(Incident).filter(Incident.id == link.incident_id).first()
            if inc:
                sev_weight = SEVERITY_WEIGHTS.get(inc.severity.upper(), 1.0)
                effort = inc.resolution_effort_hours or 4.0
                incident_cost += (sev_weight * effort)
                max_severity_val = max(max_severity_val, sev_weight)

        # 2. Structural multipliers from linked repository
        mod_key = debt.module_name.lower()
        churn = churn_map.get(mod_key, 12)  # fallback default baseline churn
        blast_radius = blast_radius_map.get(mod_key, 1)

        structural_interest = (settings.LAMBDA_CHURN * churn) + (settings.LAMBDA_BLAST_RADIUS * blast_radius)
        total_accrued_interest = round(incident_cost + structural_interest, 2)

        debt.accrued_interest = total_accrued_interest
        # Break-even status: I(d) > P(d)
        debt.break_even_status = (debt.accrued_interest > debt.effort_principal)

        # Composite Risk Reduction R(d)
        # Combines economic interest, blast radius exposure, and breakeven urgency
        urgency_multiplier = 1.5 if debt.break_even_status else 1.0
        raw_risk = (
            (debt.accrued_interest * 0.4) +
            (blast_radius * 2.5) +
            (max_severity_val * 3.0)
        ) * urgency_multiplier
        debt.risk_score = round(raw_risk, 2)

    db.commit()
    return debt_items

