"""Fix playbooks: step-by-step guidance for each debt item, with progress, editable per project."""

from __future__ import annotations

from collections import Counter

from flask import Blueprint, request
from sqlalchemy import select, update

from ...core import engine as E
from ...core import playbooks as PB
from .. import services as S
from .. import validation as V
from ..deps import db, me, ok, project
from ..errors import ApiError
from ..models import DebtPlaybook, TechnicalDebt, utcnow
from ..security import require

bp = Blueprint("playbooks", __name__)


def _debt(s, proj, did: int) -> TechnicalDebt:
    d = s.get(TechnicalDebt, did)
    if d is None or d.project_id != proj.id:
        raise ApiError(404, "debt item not found")
    return d


def _view(s, proj, did: int) -> dict:
    snap = S.snapshot(s, proj, with_embeddings=False)
    edits, chosen, done = S.playbook_state(s, proj.id)
    try:
        out = E.debt_playbook(snap, did, edits, chosen)
    except KeyError as e:
        raise ApiError(404, "debt item not found") from e
    steps = done.get(did, [])
    out["steps_done"] = steps
    out["progress"] = {"done": len(steps), "total": len(out["steps"])}
    out["choices"] = [{"key": k, "title": v.title} for k, v in sorted(PB.library(edits).items(), key=lambda x: x[1].title)]
    return out


@bp.get("/projects/<int:pid>/playbooks")
@require("read")
def library(pid: int):
    proj = project(pid)
    s = db()
    snap = S.snapshot(s, proj, with_embeddings=False)
    edits, chosen, done = S.playbook_state(s, proj.id)
    lib, assignment = E.playbook_assignment(snap, edits, chosen)
    usage = Counter(a["key"] for a in assignment.values())
    debts = []
    for d in snap.get("debts") or []:
        a = assignment[d["id"]]
        pb = lib.get(a["key"])
        debts.append({"id": d["id"], "key": d["key"], "title": d["title"], "module": d.get("module"),
                      "status": d.get("status"), "playbook": a["key"], "playbook_title": pb.title if pb else a["key"],
                      "chosen": a.get("chosen", False), "matched": a.get("matched", []),
                      "steps_done": len(done.get(d["id"], [])), "steps_total": len(pb.steps) if pb else 0})
    rows = []
    for key, pb in sorted(lib.items(), key=lambda x: x[1].title):
        rows.append(pb.to_dict() | {"used_by": usage.get(key, 0), "edited": key in edits and key in PB.BY_KEY,
                                    "custom": key not in PB.BY_KEY})
    return ok({"playbooks": rows, "debts": debts})


@bp.put("/projects/<int:pid>/playbooks/<key>")
@require("settings.write")
def save(pid: int, key: str):
    """Edit a built-in playbook for this project, or add a project playbook."""
    proj = project(pid)
    s = db()
    data = V.body(request)
    base = PB.BY_KEY.get(key)
    try:
        clean = PB.validate_custom({**(base.to_dict() if base else {}), **data, "key": key})
    except ValueError as e:
        raise ApiError(400, str(e)) from e
    k = clean.pop("key")
    settings = dict(proj.settings or {})
    pbs = dict(settings.get("playbooks") or {})
    pbs[k] = clean
    settings["playbooks"] = pbs
    proj.settings = settings
    S.audit(s, proj.id, me(), "playbook.saved", k, builtin=base is not None)
    s.commit()
    return ok(PB.library(pbs)[k].to_dict() | {"edited": base is not None, "custom": base is None})


@bp.delete("/projects/<int:pid>/playbooks/<key>")
@require("settings.write")
def remove(pid: int, key: str):
    """Undo a project's edit of a built-in playbook, or delete a project playbook."""
    proj = project(pid)
    s = db()
    settings = dict(proj.settings or {})
    pbs = dict(settings.get("playbooks") or {})
    if key not in pbs:
        raise ApiError(404, "this project has no edited or custom playbook with that key")
    pbs.pop(key)
    settings["playbooks"] = pbs
    proj.settings = settings
    if key not in PB.BY_KEY:  # debts that used the deleted playbook go back to automatic matching
        ids = select(TechnicalDebt.id).where(TechnicalDebt.project_id == proj.id)
        s.execute(update(DebtPlaybook).where(DebtPlaybook.debt_id.in_(ids), DebtPlaybook.playbook_key == key)
                  .values(playbook_key=None, steps_done=[]))
    S.audit(s, proj.id, me(), "playbook.removed", key)
    s.commit()
    return ok({"removed": key, "builtin": key in PB.BY_KEY})


@bp.get("/projects/<int:pid>/debts/<int:did>/playbook")
@require("read")
def debt_playbook(pid: int, did: int):
    proj = project(pid)
    s = db()
    _debt(s, proj, did)
    return ok(_view(s, proj, did))


@bp.put("/projects/<int:pid>/debts/<int:did>/playbook")
@require("debt.write")
def update_debt_playbook(pid: int, did: int):
    """Choose another playbook for this debt ({"playbook": key or null}) or tick steps ({"steps_done": [0, 2]})."""
    proj = project(pid)
    s = db()
    d = _debt(s, proj, did)
    data = V.body(request)
    row = s.execute(select(DebtPlaybook).where(DebtPlaybook.debt_id == d.id)).scalar_one_or_none()
    if row is None:
        row = DebtPlaybook(debt_id=d.id, playbook_key=None, steps_done=[])
        s.add(row)
    edits, _, _ = S.playbook_state(s, proj.id)
    lib = PB.library(edits)
    if "playbook" in data:
        key = data.get("playbook")
        if key is not None and key not in lib:
            raise ApiError(400, f"unknown playbook {key!r}")
        if key != row.playbook_key:
            row.playbook_key = key
            row.steps_done = []
    if "steps_done" in data:
        current = _view(s, proj, d.id) if row.playbook_key is None else None
        total = len(current["steps"]) if current else len(lib[row.playbook_key].steps)
        steps = sorted({i for i in V.int_list(data.get("steps_done"), "steps_done") if 0 <= i < total})
        row.steps_done = steps
    row.updated_by_id = me().user_id
    row.updated_at = utcnow()
    S.audit(s, proj.id, me(), "playbook.progress", d.debt_key, playbook=row.playbook_key,
            steps=len(row.steps_done or []))
    s.commit()
    return ok(_view(s, proj, d.id))
