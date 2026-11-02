from typing import List, Dict, Set
import networkx as nx
from sqlalchemy.orm import Session

from app.models.debt import DebtItem, DebtPrerequisite
from app.services.debt_economics import update_debt_economics

def get_all_transitive_prerequisites(debt_id: int, prereq_map: Dict[int, Set[int]]) -> Set[int]:
    """Computes the full transitive closure of prerequisites for a given debt item."""
    visited: Set[int] = set()
    stack = list(prereq_map.get(debt_id, set()))
    while stack:
        curr = stack.pop()
        if curr not in visited:
            visited.add(curr)
            stack.extend(prereq_map.get(curr, set()))
    return visited

def get_topologically_ordered_debts(db: Session, project_id: int) -> List[DebtItem]:
    """
    Builds a directed graph of debt prerequisites (u -> v means v depends on u, so u must come before v)
    and returns debts in topological order.
    """
    debts = db.query(DebtItem).filter(
        DebtItem.project_id == project_id,
        DebtItem.status != "REMEDIATED"
    ).all()
    debt_map = {d.id: d for d in debts}

    prereqs = db.query(DebtPrerequisite).all()

    G = nx.DiGraph()
    for d in debts:
        G.add_node(d.id)

    for p in prereqs:
        if p.debt_id in debt_map and p.prerequisite_debt_id in debt_map:
            # prerequisite_debt must be completed before debt_id
            G.add_edge(p.prerequisite_debt_id, p.debt_id)

    # Topological sort (or fallback to risk-ranked if cycles exist)
    try:
        ordered_ids = list(nx.topological_sort(G))
    except nx.NetworkXUnfeasible:
        # Cycle fallback: sort by risk_score descending
        ordered_ids = [d.id for d in sorted(debts, key=lambda x: x.risk_score, reverse=True)]

    return [debt_map[did] for did in ordered_ids if did in debt_map]

def solve_knapsack_remediation(
    db: Session,
    project_id: int,
    sprint_budget_hours: float = 40.0,
    allowed_categories: List[str] = None,
    force_include_debt_ids: List[int] = None
) -> dict:
    """
    Solves the 0/1 knapsack problem with prerequisite dependencies.
    Quantizes effort into 1.0 hour / 0.5 hour step integers for exact DP packing.
    """
    # First make sure economic numbers are current
    update_debt_economics(db, project_id)

    debts = get_topologically_ordered_debts(db, project_id)

    if allowed_categories:
        allowed_set = set(c.upper() for c in allowed_categories)
        debts = [d for d in debts if d.category.upper() in allowed_set]

    # Map prerequisites
    prereq_map: Dict[int, Set[int]] = {}
    prereq_records = db.query(DebtPrerequisite).all()
    for pr in prereq_records:
        if pr.debt_id not in prereq_map:
            prereq_map[pr.debt_id] = set()
        prereq_map[pr.debt_id].add(pr.prerequisite_debt_id)

    all_debt_dict = {d.id: d for d in debts}

    # Pre-select forced items and all their transitive prerequisites
    selected_set: Set[int] = set()
    if force_include_debt_ids:
        for fid in force_include_debt_ids:
            if fid in all_debt_dict:
                selected_set.add(fid)
                all_ancestors = get_all_transitive_prerequisites(fid, prereq_map)
                for pid in all_ancestors:
                    if pid in all_debt_dict:
                        selected_set.add(pid)

    # Compute remaining budget
    forced_effort = sum(all_debt_dict[did].effort_principal for did in selected_set if did in all_debt_dict)
    remaining_budget = max(0.0, sprint_budget_hours - forced_effort)

    # Candidate pool for 0/1 Knapsack
    candidates = [d for d in debts if d.id not in selected_set]

    # Quantize effort (scale by 2 for 0.5 hr precision)
    scale = 2
    budget_capacity = int(round(remaining_budget * scale))

    items = []
    for d in candidates:
        weight = max(1, int(round(d.effort_principal * scale)))
        value = int(round(d.risk_score * 10))  # scaled value
        items.append({
            "id": d.id,
            "weight": weight,
            "value": value,
            "obj": d,
            "prereqs": prereq_map.get(d.id, set())
        })

    n = len(items)
    # Dynamic Programming table DP[i][w]
    dp = [[0] * (budget_capacity + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        item = items[i - 1]
        w = item["weight"]
        v = item["value"]
        for cap in range(budget_capacity + 1):
            if w <= cap:
                dp[i][cap] = max(dp[i - 1][cap], dp[i - 1][cap - w] + v)
            else:
                dp[i][cap] = dp[i - 1][cap]

    # Backtracking to reconstruct chosen subset
    cap = budget_capacity
    knapsack_chosen_ids = set()
    for i in range(n, 0, -1):
        if dp[i][cap] != dp[i - 1][cap]:
            item = items[i - 1]
            knapsack_chosen_ids.add(item["id"])
            cap -= item["weight"]

    # Post-check prerequisite closure: ensure every chosen item has its prereqs included
    closure_set = set(selected_set) | knapsack_chosen_ids
    # Greedily include missing prerequisites if feasible, or defer items whose prereqs were missed
    final_selected_ids = set(selected_set)
    # Re-examine candidates in topological order
    total_effort = forced_effort
    for d in debts:
        if d.id in knapsack_chosen_ids:
            reqs = get_all_transitive_prerequisites(d.id, prereq_map)
            if reqs.issubset(final_selected_ids):
                if total_effort + d.effort_principal <= sprint_budget_hours:
                    final_selected_ids.add(d.id)
                    total_effort += d.effort_principal

    # Build response objects
    selected_items = []
    deferred_items = []

    for d in debts:
        prereq_keys = [
            all_debt_dict[pid].debt_key
            for pid in prereq_map.get(d.id, set())
            if pid in all_debt_dict
        ]
        item_dict = {
            "id": d.id,
            "debt_key": d.debt_key,
            "title": d.title,
            "category": d.category,
            "module_name": d.module_name,
            "effort_principal": d.effort_principal,
            "accrued_interest": d.accrued_interest,
            "risk_score": d.risk_score,
            "break_even_status": d.break_even_status,
            "prerequisite_keys": prereq_keys
        }

        if d.id in final_selected_ids:
            selected_items.append(item_dict)
        else:
            deferred_items.append(item_dict)

    allocated_effort = sum(item["effort_principal"] for item in selected_items)
    risk_reduced = sum(item["risk_score"] for item in selected_items)
    interest_saved = sum(item["accrued_interest"] for item in selected_items)

    utilization = (allocated_effort / sprint_budget_hours * 100.0) if sprint_budget_hours > 0 else 0.0

    return {
        "sprint_budget": sprint_budget_hours,
        "total_effort_allocated": round(allocated_effort, 1),
        "budget_utilization_pct": round(min(100.0, utilization), 1),
        "total_risk_reduced": round(risk_reduced, 2),
        "accumulated_interest_saved": round(interest_saved, 2),
        "selected_items": selected_items,
        "deferred_items": deferred_items,
        "remediation_order": [it["debt_key"] for it in selected_items]
    }

def run_what_if_simulation(
    db: Session,
    project_id: int,
    budgets: List[float] = [20.0, 40.0, 60.0, 80.0, 120.0]
) -> List[dict]:
    """Runs knapsack optimization across multiple budget points to generate sensitivity curve."""
    results = []
    for b in budgets:
        plan = solve_knapsack_remediation(db, project_id, sprint_budget_hours=b)
        roi = round(plan["accumulated_interest_saved"] / max(1.0, plan["total_effort_allocated"]), 2)
        results.append({
            "budget": b,
            "effort_used": plan["total_effort_allocated"],
            "items_count": len(plan["selected_items"]),
            "risk_reduction": plan["total_risk_reduced"],
            "interest_saved": plan["accumulated_interest_saved"],
            "roi_ratio": roi
        })
    return results

