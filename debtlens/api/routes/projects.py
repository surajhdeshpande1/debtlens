"""Projects, modules (with ownership = Demo-1 ASSIGNMENT) and module dependencies."""

from __future__ import annotations

import re

from flask import Blueprint, request
from sqlalchemy import delete, select, update

from ...core import engine as E
from ...core import scenarios as SC
from ...core.economics import EconomicParams
from ...core.similarity import DEFAULT_ALPHA, DEFAULT_TAU
from .. import serial
from .. import services as S
from .. import validation as V
from ..deps import db, me, ok, project
from ..errors import ApiError
from ..models import (Assignment, FileMetric, Incident, Module, ModuleDependency, Organization, Project,
                      SatdMarker, TechnicalDebt, User)
from ..security import require

bp = Blueprint("projects", __name__)


def _key(name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", name)
    k = "".join(w[0] for w in words[:4]).upper() if len(words) > 1 else (words[0][:4].upper() if words else "PRJ")
    return k or "PRJ"


def _detail(proj: Project) -> dict:
    s = db()
    st = proj.settings or {}
    p = me()
    out = serial.project(proj, serial.project_counts(s, [proj.id])[proj.id])
    out["settings"] = {"economics": {**EconomicParams().to_dict(), **(st.get("economics") or {})},
                       "alpha": st.get("alpha", DEFAULT_ALPHA), "tau": st.get("tau", DEFAULT_TAU)}
    out["tour"] = st.get("tour")
    out["people"] = st.get("people") or {}
    out["persona"] = serial.persona(proj, p) if p.kind == "sandbox" else None
    if proj.scenario_code:
        try:
            sc = SC.get(proj.scenario_code)
            out["scenario_info"] = {"code": sc["code"], "name": sc["name"], "industry": sc["industry"],
                                    "tagline": sc["tagline"], "summary": sc["summary"]}
        except KeyError:
            out["scenario_info"] = None
    return out


@bp.get("/projects")
@require("read")
def list_projects():
    p = me()
    s = db()
    if p.kind == "sandbox":
        rows = [s.get(Project, p.project_id)]
    else:
        rows = s.execute(select(Project).where(Project.org_id == p.org_id, Project.is_sandbox.is_(False))
                         .order_by(Project.id)).scalars().all()
    rows = [r for r in rows if r is not None]
    counts = serial.project_counts(s, [r.id for r in rows])
    return ok({"projects": [serial.project(r, counts[r.id]) for r in rows]})


@bp.post("/projects")
@require("project.manage")
def create_project():
    p = me()
    if p.kind != "user":
        raise ApiError(403, "sandboxes cannot create projects — register a team first")
    data = V.body(request)
    s = db()
    org = s.get(Organization, p.org_id)
    code = (data.get("scenario") or "").strip().lower() or None
    if code:
        if code not in {x["code"] for x in SC.list_scenarios()}:
            raise ApiError(400, f"unknown scenario '{code}'")
        proj = S.seed_scenario(s, org, code, name=V.text(data, "name", max_len=160) or None)
    else:
        name = V.text(data, "name", required=True, min_len=2, max_len=160)
        proj = Project(org_id=org.id, project_name=name,
                       project_key=(V.text(data, "key", max_len=10) or _key(name)).upper(),
                       description=V.text(data, "description", max_len=2000),
                       repository_url=V.text(data, "repository_url", max_len=300),
                       industry=V.text(data, "industry", max_len=60), settings={})
        s.add(proj)
        s.flush()
        for m in data.get("modules") or []:
            S.module_id(s, proj, str(m))
    S.audit(s, proj.id, p, "project.created", f"project:{proj.id}", scenario=code)
    s.commit()
    return ok({"project": _detail(proj)}, 201)


@bp.get("/projects/<int:pid>")
@require("read")
def get_project(pid: int):
    return ok({"project": _detail(project(pid))})


@bp.patch("/projects/<int:pid>")
@require("settings.write")
def update_project(pid: int):
    proj = project(pid)
    data = V.body(request)
    s = db()
    if "name" in data:
        proj.project_name = V.text(data, "name", required=True, min_len=2, max_len=160)
    if "description" in data:
        proj.description = V.text(data, "description", max_len=2000)
    if "repository_url" in data:
        proj.repository_url = V.text(data, "repository_url", max_len=300)
    st = dict(proj.settings or {})
    if "economics" in data:
        if data["economics"] is None:
            st.pop("economics", None)
        else:
            st["economics"] = {**(st.get("economics") or {}), **V.clean_economics(data["economics"] or {})}
    if "alpha" in data:
        st["alpha"] = V.number(data, "alpha", lo=0, hi=1)
    if "tau" in data:
        st["tau"] = V.number(data, "tau", lo=0.05, hi=0.99)
    proj.settings = st
    S.audit(s, proj.id, me(), "project.settings", f"project:{proj.id}",
            changed=[k for k in ("name", "description", "repository_url", "economics", "alpha", "tau") if k in data])
    s.commit()
    return ok({"project": _detail(proj)})


@bp.delete("/projects/<int:pid>")
@require("project.manage")
def delete_project(pid: int):
    proj = project(pid)
    if proj.is_sandbox:
        raise ApiError(400, "reset the sandbox instead")
    s = db()
    S.delete_project(s, proj.id)
    s.commit()
    return ok({"deleted": True})


# ----------------------------------------------------------------------------- modules

def _owners(s, proj: Project) -> dict[str, str]:
    mods = serial.module_names(s, proj.id)
    out = {}
    for a in s.execute(select(Assignment).where(Assignment.project_id == proj.id)).scalars():
        u = s.get(User, a.user_id)
        if u and a.module_id in mods:
            out[mods[a.module_id]] = u.name
    people = (proj.settings or {}).get("people") or {}
    for mod, key in ((proj.settings or {}).get("module_owners") or {}).items():
        if mod not in out and key in people:
            out[mod] = people[key]["name"]
    return out


@bp.get("/projects/<int:pid>/modules")
@require("read")
def modules(pid: int):
    proj = project(pid)
    s = db()
    snap = S.snapshot(s, proj, with_embeddings=False)
    stats = E.module_stats(snap)
    led = E.ledger(snap, S.project_params(proj))
    by_mod = led["summary"]["by_module"]
    owners = _owners(s, proj)
    deps = E.dependency_pairs(snap)
    ids = {m["name"]: m["id"] for m in snap["modules"]}
    out = []
    for name, st in sorted(stats.items()):
        incs = [i for i in snap["incidents"] if i["module"] == name]
        out.append({**st, "id": ids.get(name), "owner": owners.get(name),
                    "incidents": len(incs), "open_incidents": sum(1 for i in incs if i["status"] != "RESOLVED"),
                    "open_debts": by_mod.get(name, {}).get("count", 0),
                    "interest": by_mod.get(name, {}).get("interest", 0),
                    "depends_on": sorted(b for a, b in deps if a == name),
                    "used_by": sorted(a for a, b in deps if b == name)})
    out.sort(key=lambda m: (-m["interest"], m["name"]))
    return ok({"modules": out, "dependencies": [{"source": a, "target": b} for a, b in deps]})


@bp.post("/projects/<int:pid>/modules")
@require("module.write")
def add_module(pid: int):
    proj = project(pid)
    data = V.body(request)
    s = db()
    name = V.text(data, "name", required=True, min_len=2, max_len=100).lower()
    if s.execute(select(Module.id).where(Module.project_id == proj.id, Module.module_name == name)).first():
        raise ApiError(409, "module already exists")
    m = Module(project_id=proj.id, module_name=name, path=V.text(data, "path", max_len=255),
               description=V.text(data, "description", max_len=400))
    s.add(m)
    S.audit(s, proj.id, me(), "module.created", f"module:{name}")
    s.commit()
    return ok({"module": {"id": m.id, "name": m.module_name, "path": m.path, "description": m.description}}, 201)


def _module(s, proj: Project, mid: int) -> Module:
    m = s.get(Module, mid)
    if m is None or m.project_id != proj.id:
        raise ApiError(404, "module not found")
    return m


@bp.patch("/projects/<int:pid>/modules/<int:mid>")
@require("module.write")
def update_module(pid: int, mid: int):
    proj = project(pid)
    s = db()
    m = _module(s, proj, mid)
    data = V.body(request)
    if "name" in data:
        m.module_name = V.text(data, "name", required=True, min_len=2, max_len=100).lower()
    if "path" in data:
        m.path = V.text(data, "path", max_len=255)
    if "description" in data:
        m.description = V.text(data, "description", max_len=400)
    if "owner_user_id" in data:
        s.execute(delete(Assignment).where(Assignment.project_id == proj.id, Assignment.module_id == m.id))
        if data["owner_user_id"]:
            u = s.get(User, int(data["owner_user_id"]))
            if u is None or u.org_id != proj.org_id:
                raise ApiError(400, "owner must be a member of this team")
            s.add(Assignment(project_id=proj.id, module_id=m.id, user_id=u.id))
    S.audit(s, proj.id, me(), "module.updated", f"module:{m.module_name}")
    s.commit()
    return ok({"module": {"id": m.id, "name": m.module_name, "path": m.path, "description": m.description}})


@bp.delete("/projects/<int:pid>/modules/<int:mid>")
@require("module.write")
def delete_module(pid: int, mid: int):
    proj = project(pid)
    s = db()
    m = _module(s, proj, mid)
    for model in (Incident, TechnicalDebt, FileMetric, SatdMarker):
        s.execute(update(model).where(model.module_id == m.id).values(module_id=None))
    s.execute(delete(ModuleDependency).where((ModuleDependency.source_module_id == m.id)
                                             | (ModuleDependency.target_module_id == m.id)))
    s.execute(delete(Assignment).where(Assignment.module_id == m.id))
    s.delete(m)
    S.audit(s, proj.id, me(), "module.deleted", f"module:{m.module_name}")
    s.commit()
    return ok({"deleted": True})


@bp.post("/projects/<int:pid>/dependencies")
@require("module.write")
def add_dependency(pid: int):
    proj = project(pid)
    data = V.body(request)
    s = db()
    a = S.module_id(s, proj, V.text(data, "source", required=True, max_len=100))
    b = S.module_id(s, proj, V.text(data, "target", required=True, max_len=100))
    if a == b:
        raise ApiError(400, "a module cannot depend on itself")
    if not s.execute(select(ModuleDependency.id).where(ModuleDependency.source_module_id == a,
                                                       ModuleDependency.target_module_id == b)).first():
        s.add(ModuleDependency(project_id=proj.id, source_module_id=a, target_module_id=b))
    S.audit(s, proj.id, me(), "dependency.added", f"{data.get('source')}->{data.get('target')}")
    s.commit()
    return ok({"added": True}, 201)


@bp.delete("/projects/<int:pid>/dependencies")
@require("module.write")
def remove_dependency(pid: int):
    proj = project(pid)
    data = V.body(request)
    s = db()
    a = S.module_id(s, proj, data.get("source"), create=False)
    b = S.module_id(s, proj, data.get("target"), create=False)
    s.execute(delete(ModuleDependency).where(ModuleDependency.project_id == proj.id,
                                             ModuleDependency.source_module_id == a,
                                             ModuleDependency.target_module_id == b))
    s.commit()
    return ok({"removed": True})
