"""JSON shapes returned by the API."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (DebtIncident, Incident, Module, Project, Resolution, RootCause, TechnicalDebt, User)
from .security import ROLE_LABELS, Principal
from .services import iso


def module_names(s: Session, pid: int) -> dict[int, str]:
    return {m.id: m.module_name for m in s.execute(select(Module).where(Module.project_id == pid)).scalars()}


def incident(i: Incident, mods: dict[int, str], extra: dict | None = None) -> dict:
    d = {"id": i.id, "key": i.incident_key, "title": i.title, "description": i.description,
         "module": mods.get(i.module_id, "unassigned") if i.module_id else "unassigned", "module_id": i.module_id,
         "severity": i.severity, "status": i.status, "reported_by": i.reporter_name, "reported_at": iso(i.reported_at),
         "resolved_at": iso(i.resolved_at), "effort_hours": i.effort_hours, "source": i.source,
         "external_ref": i.external_ref, "occurrences": i.occurrences, "updated_at": iso(i.updated_at)}
    if extra:
        d.update(extra)
    return d


def debt(d: TechnicalDebt, mods: dict[int, str], extra: dict | None = None) -> dict:
    out = {"id": d.id, "key": d.debt_key, "title": d.title, "description": d.description,
           "module": mods.get(d.module_id, "unassigned") if d.module_id else "unassigned", "module_id": d.module_id,
           "category": d.category, "priority": d.priority, "status": d.status, "principal": d.principal_hours,
           "assigned_to": d.assignee_name, "assigned_user_id": d.assigned_to, "root_cause_id": d.root_cause_node_id,
           "file_path": d.file_path, "source": d.source, "created_at": iso(d.created_at), "updated_at": iso(d.updated_at)}
    if extra:
        out.update(extra)
    return out


def user(u: User, show_email: bool = True) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email if show_email else None, "role": u.role,
            "role_label": ROLE_LABELS.get(u.role, u.role), "title": u.title, "is_active": u.is_active,
            "can_login": u.can_login, "last_login_at": iso(u.last_login_at), "created_at": iso(u.created_at)}


def project_counts(s: Session, pids: list[int]) -> dict[int, dict]:
    out = {p: {"incidents": 0, "open_incidents": 0, "debts": 0, "open_debts": 0, "modules": 0} for p in pids}
    if not pids:
        return out
    for pid, status, n in s.execute(select(Incident.project_id, Incident.status, func.count(Incident.id))
                                    .where(Incident.project_id.in_(pids)).group_by(Incident.project_id, Incident.status)):
        out[pid]["incidents"] += n
        if status != "RESOLVED":
            out[pid]["open_incidents"] += n
    for pid, status, n in s.execute(select(TechnicalDebt.project_id, TechnicalDebt.status, func.count(TechnicalDebt.id))
                                    .where(TechnicalDebt.project_id.in_(pids))
                                    .group_by(TechnicalDebt.project_id, TechnicalDebt.status)):
        out[pid]["debts"] += n
        if status != "REMEDIATED":
            out[pid]["open_debts"] += n
    for pid, n in s.execute(select(Module.project_id, func.count(Module.id)).where(Module.project_id.in_(pids))
                            .group_by(Module.project_id)):
        out[pid]["modules"] = n
    return out


def project(p: Project, counts: dict | None = None) -> dict:
    st = p.settings or {}
    return {"id": p.id, "name": p.project_name, "key": p.project_key, "description": p.description,
            "repository_url": p.repository_url, "industry": p.industry, "scenario": p.scenario_code,
            "is_sandbox": p.is_sandbox, "expires_at": iso(p.expires_at), "created_at": iso(p.created_at),
            "counts": counts, "has_tour": bool(st.get("tour"))}


def persona(p: Project, principal: Principal) -> dict | None:
    """In a sandbox the visitor plays the scenario character who holds the chosen role."""
    st = p.settings or {}
    people = st.get("people") or {}
    # MySQL and TiDB store JSON objects with their keys re-ordered, so the scenario's own order is kept separately:
    # the first person listed for a role plays it.
    order = [k for k in (st.get("people_order") or []) if k in people] + sorted(set(people) - set(st.get("people_order") or []))
    for key in order:
        person = people[key]
        if person.get("role") == principal.role:
            return {"key": key, **person}
    return None


def incident_extras(s: Session, ids: list[int]) -> dict[int, dict]:
    """Linked debt count, 5-Whys depth and resolution flag for a list of incidents."""
    out = {i: {"whys": 0, "debt_count": 0, "has_resolution": False} for i in ids}
    if not ids:
        return out
    for iid, n in s.execute(select(RootCause.incident_id, func.count(RootCause.id)).where(RootCause.incident_id.in_(ids))
                            .group_by(RootCause.incident_id)):
        out[iid]["whys"] = n
    for iid, n in s.execute(select(DebtIncident.incident_id, func.count(DebtIncident.id))
                            .where(DebtIncident.incident_id.in_(ids)).group_by(DebtIncident.incident_id)):
        out[iid]["debt_count"] = n
    for (iid,) in s.execute(select(Resolution.incident_id).where(Resolution.incident_id.in_(ids))):
        out[iid]["has_resolution"] = True
    return out
