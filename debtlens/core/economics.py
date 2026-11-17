"""Technical debt as a financial instrument (module M7: ledger).

For every debt item d:

    P(d)  principal  = remediation effort (hours), estimated by the developer
    I(d)  interest   = Σ_{k ∈ incidents(d)} w_sev(k) · effort(k)      (hours already lost)
                       + λ₁ · churn(module(d))                         (change pressure)
                       + λ₂ · blast_radius(module(d))                  (structural exposure)
    break-even       = I(d) > P(d)   → coping has already cost more than fixing would

Risk-reduction value R(d) ∈ [0, 120] used by the optimiser (each term scaled by the
largest value among open items so no single unit dominates):

    R(d) = 100 · ( 0.5·I/Iₘₐₓ + 0.2·B/Bₘₐₓ + 0.2·S/Sₘₐₓ + 0.1·C/Cₘₐₓ ) · (1.2 if past break-even)

    I = interest, B = blast radius, S = worst incident severity weight,
    C = betweenness centrality of the debt's root cause in the causal graph.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

SEVERITY_WEIGHT = {"CRITICAL": 3.5, "HIGH": 2.5, "MEDIUM": 1.5, "LOW": 1.0}
SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW")
OPEN_STATUSES = ("IDENTIFIED", "PRIORITIZED", "IN_PROGRESS", "DEFERRED")


@dataclass
class EconomicParams:
    lambda_churn: float = 0.15
    lambda_blast: float = 1.8
    severity_weight: dict = field(default_factory=lambda: dict(SEVERITY_WEIGHT))
    w_interest: float = 0.5
    w_blast: float = 0.2
    w_severity: float = 0.2
    w_centrality: float = 0.1
    breakeven_boost: float = 1.2

    @classmethod
    def from_dict(cls, d: dict | None) -> "EconomicParams":
        p = cls()
        for k, v in (d or {}).items():
            if k == "severity_weight" and isinstance(v, dict):
                p.severity_weight.update({str(a).upper(): float(b) for a, b in v.items()})
            elif hasattr(p, k) and v is not None:
                setattr(p, k, float(v))
        return p

    def to_dict(self) -> dict:
        return asdict(self)


def is_open(debt: dict) -> bool:
    return (debt.get("status") or "IDENTIFIED").upper() != "REMEDIATED"


def compute_ledger(
    debts: list[dict],
    incidents_by_id: dict,
    module_churn: dict[str, float],
    module_blast: dict[str, int],
    cause_centrality: dict | None = None,
    params: EconomicParams | None = None,
    debt_churn: dict | None = None,
) -> list[dict]:
    """Price every debt item.  Returns one row per debt (open and remediated).

    churn(d) is the churn of the debt's own file when it is known (``debt_churn``),
    otherwise the churn of its module."""
    p = params or EconomicParams()
    cause_centrality = cause_centrality or {}
    rows = []
    for d in debts:
        module = (d.get("module") or "").lower()
        inc_cost = 0.0
        worst = 0.0
        linked = []
        for iid in d.get("incident_ids") or []:
            inc = incidents_by_id.get(iid)
            if not inc:
                continue
            w = p.severity_weight.get((inc.get("severity") or "MEDIUM").upper(), 1.0)
            effort = float(inc.get("effort_hours") or 0.0)
            inc_cost += w * effort
            worst = max(worst, w)
            linked.append(inc.get("key") or iid)
        churn_source = "file" if debt_churn and d.get("id") in debt_churn else "module"
        churn = float(debt_churn[d["id"]]) if churn_source == "file" else float(module_churn.get(module, 0.0))
        blast = int(module_blast.get(module, 0))
        churn_i = p.lambda_churn * churn
        blast_i = p.lambda_blast * blast
        interest = inc_cost + churn_i + blast_i
        principal = float(d.get("principal") or 0.0)
        rows.append({
            "id": d.get("id"),
            "key": d.get("key"),
            "title": d.get("title"),
            "module": module,
            "category": d.get("category"),
            "status": (d.get("status") or "IDENTIFIED").upper(),
            "principal": round(principal, 2),
            "incident_interest": round(inc_cost, 2),
            "churn_interest": round(churn_i, 2),
            "blast_interest": round(blast_i, 2),
            "interest": round(interest, 2),
            "net_drag": round(interest - principal, 2),
            "break_even": interest > principal,
            "break_even_ratio": round(interest / principal, 3) if principal > 0 else None,
            "churn": churn,
            "churn_source": churn_source,
            "blast_radius": blast,
            "worst_severity_weight": worst,
            "root_cause_centrality": round(float(cause_centrality.get(d.get("root_cause_id"), 0.0)), 4),
            "linked_incidents": linked,
            "incident_ids": [i for i in (d.get("incident_ids") or []) if i in incidents_by_id],
            "prerequisite_ids": list(d.get("prerequisite_ids") or []),
            "is_open": is_open(d),
        })
    _score_risk(rows, p)
    return rows


def _score_risk(rows: list[dict], p: EconomicParams) -> None:
    open_rows = [r for r in rows if r["is_open"]] or rows
    mx = {
        "interest": max((r["interest"] for r in open_rows), default=0.0) or 1.0,
        "blast": max((r["blast_radius"] for r in open_rows), default=0) or 1,
        "sev": max((r["worst_severity_weight"] for r in open_rows), default=0.0) or 1.0,
        "cent": max((r["root_cause_centrality"] for r in open_rows), default=0.0) or 1.0,
    }
    for r in rows:
        comp = {
            "interest": p.w_interest * min(1.0, r["interest"] / mx["interest"]),
            "blast": p.w_blast * min(1.0, r["blast_radius"] / mx["blast"]),
            "severity": p.w_severity * min(1.0, r["worst_severity_weight"] / mx["sev"]),
            "centrality": p.w_centrality * min(1.0, r["root_cause_centrality"] / mx["cent"]),
        }
        boost = p.breakeven_boost if r["break_even"] else 1.0
        r["risk"] = round(100.0 * sum(comp.values()) * boost, 2)
        r["risk_components"] = {k: round(100.0 * v * boost, 2) for k, v in comp.items()}


def summarize(rows: list[dict]) -> dict:
    open_rows = [r for r in rows if r["is_open"]]
    tp = sum(r["principal"] for r in open_rows)
    ti = sum(r["interest"] for r in open_rows)
    be = [r for r in open_rows if r["break_even"]]
    by_cat: dict[str, dict] = {}
    by_mod: dict[str, dict] = {}
    for r in open_rows:
        for key, bucket in ((r["category"] or "OTHER", by_cat), (r["module"] or "-", by_mod)):
            b = bucket.setdefault(key, {"count": 0, "principal": 0.0, "interest": 0.0, "break_even": 0})
            b["count"] += 1
            b["principal"] = round(b["principal"] + r["principal"], 2)
            b["interest"] = round(b["interest"] + r["interest"], 2)
            b["break_even"] += int(r["break_even"])
    return {
        "open_items": len(open_rows),
        "remediated_items": len(rows) - len(open_rows),
        "total_principal": round(tp, 1),
        "total_interest": round(ti, 1),
        "net_drag": round(ti - tp, 1),
        "break_even_count": len(be),
        "break_even_pct": round(100.0 * len(be) / max(1, len(open_rows)), 1),
        "by_category": by_cat,
        "by_module": dict(sorted(by_mod.items(), key=lambda kv: -kv[1]["interest"])),
    }
