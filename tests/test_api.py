"""API tests: accounts, roles (RBAC), sandbox isolation and every main workflow, on SQLite."""

from __future__ import annotations

import os
import subprocess
from datetime import timedelta
from pathlib import Path

import pytest

os.environ.setdefault("DEBTLENS_DISABLE_ML", "1")

from debtlens.api import create_app  # noqa: E402
from debtlens.api import db as DB  # noqa: E402
from debtlens.api.models import Project, utcnow  # noqa: E402
from debtlens.core import mining  # noqa: E402


TEST_DB = os.environ.get("DEBTLENS_TEST_DATABASE_URL", "sqlite://")  # e.g. mysql+pymysql://u:p@localhost/debtlens_test


@pytest.fixture()
def client():
    app = create_app(TEST_DB, testing=True)
    if not TEST_DB.startswith("sqlite"):
        from debtlens.api.models import Base

        Base.metadata.drop_all(DB.engine())  # a clean MySQL/TiDB schema for every test
        DB._initialised = False
    with app.test_client() as c:
        yield c


def api(c, method, path, token=None, **kw):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return getattr(c, method)("/api/v1" + path, headers=headers, **kw)


def sandbox(c, scenario="fintech", role="tech_lead"):
    r = api(c, "post", "/sandbox", json={"scenario": scenario, "role": role})
    assert r.status_code == 201, r.json
    return r.json["token"], r.json["project"]["id"]


def as_role(c, token, role):
    r = api(c, "post", "/sandbox/role", token, json={"role": role})
    assert r.status_code == 200, r.json
    return r.json["token"]


def register(c, email="lead@example.com", org="BEC ISE"):
    r = api(c, "post", "/auth/register", json={"name": "Suraj Lead", "email": email, "password": "correct-horse-1",
                                               "org_name": org})
    assert r.status_code == 201, r.json
    return r.json["token"]


# ----------------------------------------------------------------------------- basics

def test_health_and_meta(client):
    r = api(client, "get", "/health")
    assert r.status_code == 200 and r.json["database"]["dialect"] == TEST_DB.split(":")[0].split("+")[0]
    m = api(client, "get", "/meta").json
    assert {s["code"] for s in m["scenarios"]} == {"fintech", "healthtech", "ecommerce", "college", "self"}
    assert m["permissions"]["project.manage"] == ["admin"]
    assert api(client, "get", "/nope").status_code == 404


def test_requires_auth(client):
    assert api(client, "get", "/projects").status_code == 401
    assert api(client, "get", "/projects", "garbage").status_code == 401


# ----------------------------------------------------------------------------- accounts

def test_register_login_tokens(client):
    tok = register(client)
    me = api(client, "get", "/auth/me", tok).json
    assert me["principal"]["role"] == "admin" and me["org"]["name"] == "BEC ISE"
    assert api(client, "post", "/auth/register", json={"name": "X Y", "email": "lead@example.com",
                                                       "password": "another-pass1"}).status_code == 409
    assert api(client, "post", "/auth/login", json={"email": "lead@example.com", "password": "wrong-pass"}).status_code == 401
    r = api(client, "post", "/auth/login", json={"email": "LEAD@example.com", "password": "correct-horse-1"})
    assert r.status_code == 200
    t = api(client, "post", "/auth/tokens", tok, json={"name": "laptop"}).json
    assert t["token"].startswith("dlt_")
    assert api(client, "get", "/auth/me", t["token"]).json["principal"]["role"] == "admin"
    assert api(client, "delete", f"/auth/tokens/{t['id']}", tok).status_code == 200
    assert api(client, "get", "/auth/me", t["token"]).status_code == 401


def test_login_rate_limit(client):
    register(client)
    codes = [api(client, "post", "/auth/login", json={"email": "lead@example.com", "password": "nope-nope"}).status_code
             for _ in range(13)]
    assert codes[:12] == [401] * 12 and codes[12] == 429


def test_team_roles_enforced_server_side(client):
    admin = register(client)
    pid = api(client, "post", "/projects", admin, json={"scenario": "healthtech"}).json["project"]["id"]
    r = api(client, "post", "/team", admin, json={"name": "Dev One", "email": "dev@example.com",
                                                   "password": "dev-pass-123", "role": "developer"})
    assert r.status_code == 201
    dev = api(client, "post", "/auth/login", json={"email": "dev@example.com", "password": "dev-pass-123"}).json["token"]
    assert api(client, "get", f"/projects/{pid}/incidents", dev).status_code == 200
    assert api(client, "post", "/projects", dev, json={"name": "Mine"}).status_code == 403
    assert api(client, "patch", f"/projects/{pid}", dev, json={"tau": 0.5}).status_code == 403
    assert api(client, "post", f"/projects/{pid}/plans", dev, json={"budget": 40}).status_code == 403
    # the last admin cannot demote themselves
    me = api(client, "get", "/auth/me", admin).json["user"]
    assert api(client, "patch", f"/team/{me['id']}", admin, json={"role": "viewer"}).status_code == 400
    demo = api(client, "post", "/team/demo", admin, json={"password": "viva-pass-2026"}).json
    assert len(demo["created"]) == 5
    qa = next(d["email"] for d in demo["created"] if d["role"] == "qa")
    assert api(client, "post", "/auth/login", json={"email": qa, "password": "viva-pass-2026"}).status_code == 200


def test_org_isolation(client):
    a = register(client, "a@example.com", "Team A")
    b = register(client, "b@example.com", "Team B")
    pa = api(client, "post", "/projects", a, json={"name": "Alpha"}).json["project"]["id"]
    assert api(client, "get", f"/projects/{pa}", b).status_code == 404
    assert api(client, "get", "/projects", b).json["projects"] == []


# ----------------------------------------------------------------------------- sandboxes

def test_sandbox_every_scenario(client):
    for code in ("fintech", "healthtech", "ecommerce", "college", "self"):
        tok, pid = sandbox(client, code)
        home = api(client, "get", f"/projects/{pid}/home", tok)
        assert home.status_code == 200, (code, home.json)
        assert home.json["dashboard"]["incidents"]["total"] > 10
        ev = api(client, "get", f"/projects/{pid}/evaluation", tok).json
        assert max(r["p@1"] for r in ev["retrieval"]) >= 0.5 and ev["clustering"]["purity"] >= 0.6


def test_sandbox_isolation_and_reset(client):
    t1, p1 = sandbox(client)
    t2, p2 = sandbox(client)
    assert p1 != p2
    assert api(client, "get", f"/projects/{p2}", t1).status_code == 403
    r = api(client, "post", f"/projects/{p1}/incidents", t1, json={"title": "Payment page blank after deploy",
                                                                    "module": "checkout", "severity": "HIGH"})
    assert r.status_code == 201
    n1 = api(client, "get", f"/projects/{p1}/incidents", t1).json["total"]
    n2 = api(client, "get", f"/projects/{p2}/incidents", t2).json["total"]
    assert n1 == n2 + 1
    r = api(client, "post", "/sandbox/reset", t1, json={})
    assert r.status_code == 201
    t1b, p1b = r.json["token"], r.json["project"]["id"]
    assert api(client, "get", f"/projects/{p1b}/incidents", t1b).json["total"] == n2
    assert api(client, "get", f"/projects/{p1}", t1).status_code in (403, 404, 410)


def test_sandbox_expiry(client):
    tok, pid = sandbox(client)
    s = DB.session()
    p = s.get(Project, pid)
    p.expires_at = utcnow() - timedelta(minutes=1)
    s.commit()
    s.close()
    assert api(client, "get", f"/projects/{pid}", tok).status_code == 410


ROLE_MATRIX = [
    # (role, method, path-suffix, body, allowed)
    ("viewer", "post", "/incidents", {"title": "Viewer tries to report", "module": "ledger"}, False),
    ("qa", "post", "/incidents", {"title": "QA reports a flaky refund", "module": "refunds"}, True),
    ("developer", "post", "/debts", {"title": "Extract retry policy", "module": "gateway", "principal": 6}, True),
    ("qa", "post", "/debts", {"title": "QA tries to add debt", "module": "gateway"}, False),
    ("manager", "post", "/plans", {"budget": 32}, True),
    ("developer", "post", "/plans", {"budget": 32}, False),
    ("developer", "patch", "", {"tau": 0.5}, False),
    ("tech_lead", "patch", "", {"tau": 0.5, "economics": {"lambda_churn": 0.3}}, True),
    ("viewer", "post", "/simulate/forecast", {"runs": 20, "sprints": 3}, True),
    ("manager", "post", "/modules", {"name": "new-service"}, False),
    ("tech_lead", "post", "/modules", {"name": "new-service"}, True),
    ("admin", "delete", "", None, False),  # sandboxes are reset, not deleted
]


@pytest.mark.parametrize("role,method,suffix,body,allowed", ROLE_MATRIX)
def test_role_matrix(client, role, method, suffix, body, allowed):
    tok, pid = sandbox(client)
    tok = as_role(client, tok, role)
    kw = {"json": body} if body is not None else {}
    r = api(client, method, f"/projects/{pid}{suffix}", tok, **kw)
    if allowed:
        assert r.status_code in (200, 201), r.json
    else:
        assert r.status_code in (400, 403), r.json


def test_debt_priority_needs_tech_lead(client):
    tok, pid = sandbox(client)
    debts = api(client, "get", f"/projects/{pid}/debts", tok).json["items"]
    d = next(x for x in debts if x["status"] == "IDENTIFIED")
    dev = as_role(client, tok, "developer")
    assert api(client, "patch", f"/projects/{pid}/debts/{d['id']}", dev, json={"priority": "CRITICAL"}).status_code == 403
    assert api(client, "patch", f"/projects/{pid}/debts/{d['id']}", dev, json={"status": "IN_PROGRESS"}).status_code == 200
    assert api(client, "patch", f"/projects/{pid}/debts/{d['id']}", tok, json={"priority": "CRITICAL"}).status_code == 200


# ----------------------------------------------------------------------------- workflows

def test_incident_lifecycle_with_whys_and_duplicates(client):
    tok, pid = sandbox(client)
    incs = api(client, "get", f"/projects/{pid}/incidents", tok, query_string={"status": "OPEN,INVESTIGATING"}).json["items"]
    target = api(client, "get", f"/projects/{pid}/incidents/{incs[0]['id']}", tok).json["incident"]
    chk = api(client, "post", f"/projects/{pid}/incidents/check", tok,
              json={"title": target["title"], "description": target["description"], "module": target["module"]}).json
    assert chk["matches"][0]["id"] == target["id"] and chk["verdict"] == "duplicate"

    r = api(client, "post", f"/projects/{pid}/incidents", tok,
            json={"title": "Settlement batch job hangs at midnight", "description": "cron never finishes",
                  "module": "settlement", "severity": "CRITICAL",
                  "whys": ["Batch job hangs", "Database locks held by reconciliation", "No lock timeout configured"]})
    assert r.status_code == 201 and len(r.json["whys"]) == 3
    iid = r.json["incident"]["id"]
    # a second incident giving the same deepest answer converges onto the same cause node
    r2 = api(client, "post", f"/projects/{pid}/incidents", tok,
             json={"title": "Refund export stalls", "module": "refunds",
                   "whys": ["Export stalls", "no lock timeout configured"]}).json
    root_1 = r.json["whys"][-1]["cause_id"]
    assert r2["whys"][-1]["cause_id"] == root_1 and r2["whys"][-1]["merged"]

    detail = api(client, "get", f"/projects/{pid}/incidents/{iid}", tok).json
    assert detail["whys"][2]["shared_with"] == 1
    res = api(client, "put", f"/projects/{pid}/incidents/{iid}/resolution", tok,
              json={"action_taken": "Added lock_timeout=5s and split the job", "lessons_learned": "Always set timeouts",
                    "effort_hours": 6})
    assert res.status_code == 200 and res.json["incident"]["status"] == "RESOLVED"
    graph = api(client, "get", f"/projects/{pid}/causal-graph", tok).json
    node = next(n for n in graph["nodes"] if n["id"] == root_1)
    assert len(node["incident_keys"]) == 2
    csv_text = api(client, "get", f"/projects/{pid}/incidents.csv", tok).data.decode()
    assert "Settlement batch job hangs" in csv_text


def test_debt_links_cycles_plan_and_approval(client):
    tok, pid = sandbox(client)
    incs = api(client, "get", f"/projects/{pid}/incidents", tok).json["items"]
    a = api(client, "post", f"/projects/{pid}/debts", tok, json={"title": "Add idempotency keys to refunds",
                                                                  "module": "refunds", "principal": 10,
                                                                  "incident_ids": [incs[0]["id"]]}).json["debt"]
    b = api(client, "post", f"/projects/{pid}/debts", tok, json={"title": "Move refunds to the outbox pattern",
                                                                  "module": "refunds", "principal": 16,
                                                                  "prerequisite_ids": [a["id"]]}).json["debt"]
    r = api(client, "patch", f"/projects/{pid}/debts/{a['id']}", tok, json={"prerequisite_ids": [b["id"]]})
    assert r.status_code == 400 and "cycle" in r.json["error"]
    d = api(client, "get", f"/projects/{pid}/debts/{b['id']}", tok).json
    assert d["prerequisites"][0]["id"] == a["id"] and d["ledger"]["interest"] >= 0
    plan = api(client, "post", f"/projects/{pid}/plan", tok, json={"budget": 40}).json
    assert plan["total_weight"] <= 40 + 1e-9
    comp = plan["comparison"]
    assert comp["optimal"]["total_value"] >= comp["greedy"]["total_value"] - 1e-9
    assert comp["optimal"]["total_value"] >= comp["naive_dp"]["total_value"] - 1e-9 or comp["naive_dp"]["warnings"]
    mgr = as_role(client, tok, "manager")
    ap = api(client, "post", f"/projects/{pid}/plans", mgr, json={"budget": 40, "notes": "Sprint 14"})
    assert ap.status_code == 201
    chosen = set(ap.json["plan"]["selected_keys"])
    statuses = {x["key"]: x["status"] for x in api(client, "get", f"/projects/{pid}/debts", tok).json["items"]}
    assert chosen and all(statuses[k] in ("PRIORITIZED", "IN_PROGRESS") for k in chosen)
    assert api(client, "get", f"/projects/{pid}/plans", tok).json["plans"][0]["notes"] == "Sprint 14"


def test_simulations(client):
    tok, pid = sandbox(client)
    w = api(client, "post", f"/projects/{pid}/simulate/whatif", tok,
            json={"params": {"lambda_churn": 0.6, "lambda_blast": 4}, "budgets": [16, 40]}).json
    assert "flips" in w and len(w["budget_curve"]) == 2
    f = api(client, "post", f"/projects/{pid}/simulate/forecast", tok, json={"runs": 40, "sprints": 6}).json
    assert f["policies"]["optimal"]["final_hours_mean"] <= f["policies"]["none"]["final_hours_mean"]
    mods = api(client, "get", f"/projects/{pid}/modules", tok).json["modules"]
    core = max(mods, key=lambda m: len(m["used_by"]))["name"]
    c = api(client, "post", f"/projects/{pid}/simulate/cascade", tok,
            json={"module": core, "p": 0.5, "runs": 500, "create_incident": True}).json
    assert c["expected_affected"] > 0 and c["incident"]["source"] == "simulation"
    assert api(client, "post", f"/projects/{pid}/simulate/cascade", tok, json={"module": "nope"}).status_code == 400
    assert len(api(client, "get", f"/projects/{pid}/simulations", tok).json["runs"]) == 3


def test_load_spike_simulation(client):
    tok, pid = sandbox(client, "college")
    events = api(client, "get", f"/projects/{pid}/simulate/spike/events", tok).json["events"]
    assert events[0]["key"] == "results-day"
    r = api(client, "post", f"/projects/{pid}/simulate/spike", tok, json={"event": "results-day", "budget": 40, "runs": 80}).json
    assert r["plan"]["hours_used"] <= 40 and r["after"]["hours_lost"] < r["before"]["hours_lost"]
    keys = {x["key"] for x in r["plan"]["selected"]}
    assert all(set(x["prerequisite_of"]) <= keys for x in r["plan"]["selected"])
    viewer = as_role(client, tok, "viewer")  # simulations change nothing, so every role may run them
    c = api(client, "post", f"/projects/{pid}/simulate/spike", viewer,
            json={"event": {"peak": 6, "start_hour": 9, "duration": 2}, "budget": 0, "runs": 50}).json
    assert c["event"]["key"] == "custom" and c["plan"]["selected"] == [] and c["peak"] == 6
    assert api(client, "post", f"/projects/{pid}/simulate/spike", tok, json={"event": "nonsense"}).status_code == 400
    runs = api(client, "get", f"/projects/{pid}/simulations", tok).json["runs"]
    assert [x["kind"] for x in runs].count("spike") == 2


def test_spike_events_bot_attacks_and_the_live_replay(client):
    tok, pid = sandbox(client, "tatkal")
    r = api(client, "get", f"/projects/{pid}/simulate/spike/events", tok).json
    kinds = {e["key"]: e.get("kind") for e in r["events"] if e.get("preset")}
    assert kinds == {"tatkal-10am": "traffic", "tatkal-bots": "bots"}
    assert r["journey"]["app"] == "RailYatra" and len(r["journey"]["steps"]) == 7
    s = api(client, "post", f"/projects/{pid}/simulate/spike", tok, json={"event": "tatkal-bots", "budget": 40, "runs": 80}).json
    assert s["event"]["kind"] == "bots" and s["bots"]["blocked_in_plan"] and s["journey"]["who"].startswith("Priya")
    rp = s["replay"]
    assert len(rp["before"]["states"]) == 24 and all("minute" in e for e in rp["before"]["events"])
    assert rp["before"]["total_hours_lost"] > rp["after"]["total_hours_lost"]
    viewer = as_role(client, tok, "viewer")
    assert api(client, "get", f"/projects/{pid}/simulate/spike/events", viewer).status_code == 200


def test_scenario_packs_cards_download_and_validation(client):
    meta = api(client, "get", "/meta").json
    assert [p["code"] for p in meta["packs"]][:2] == ["tatkal", "broker"] and len(meta["packs"]) == 7
    assert len(meta["scenarios"]) == 5  # packs never change the industry-scenario comparison
    r = api(client, "get", "/packs/tatkal")
    assert r.status_code == 200 and "attachment" in r.headers["Content-Disposition"]
    pack = r.get_json()
    assert pack["format"] == "debtlens-pack/1" and pack["spike"]["key"] == "tatkal-10am"
    assert api(client, "get", "/packs/nope").status_code == 404
    ok = api(client, "post", "/packs/validate", json={"pack": pack}).json
    assert ok["valid"] and ok["info"]["counts"]["incidents"] == 20
    pack["incidents"][0]["module"] = "nowhere"
    bad = api(client, "post", "/packs/validate", json={"pack": pack}).json
    assert not bad["valid"] and any("nowhere" in p for p in bad["problems"])


def test_sandbox_from_a_pack_code_and_from_an_uploaded_pack(client):
    tok, pid = sandbox(client, "broker", "developer")
    d = api(client, "get", f"/projects/{pid}", tok).json["project"]
    assert d["scenario_info"]["pack"] and not d["scenario_info"]["uploaded"] and d["persona"]["name"] == "Vikram Rathore"
    ev = api(client, "get", f"/projects/{pid}/simulate/spike/events", tok).json["events"]
    assert ev[0]["key"] == "budget-day" and ev[0]["peak"] == 12
    assert api(client, "get", f"/projects/{pid}/evaluation", tok).status_code == 200

    pack = api(client, "get", "/packs/tickets").get_json()
    pack.update(code="my-show", name="My Show Co")
    r = api(client, "post", "/sandbox", json={"pack": pack, "role": "tech_lead"})
    assert r.status_code == 201, r.json
    tok2, pid2 = r.json["token"], r.json["project"]["id"]
    d = api(client, "get", f"/projects/{pid2}", tok2).json["project"]
    assert d["name"] == "My Show Co" and d["scenario_info"]["uploaded"] and d["tour"]["incident"] == "INC-1120"
    ev = api(client, "get", f"/projects/{pid2}/simulate/spike/events", tok2).json["events"]
    assert ev[0]["key"] == "stadium-drop"
    s = api(client, "post", f"/projects/{pid2}/simulate/spike", tok2, json={"budget": 40, "runs": 60}).json
    assert s["event"]["key"] == "stadium-drop" and s["after"]["hours_lost"] < s["before"]["hours_lost"]
    e = api(client, "get", f"/projects/{pid2}/evaluation", tok2).json
    assert e["labelled"]["regression_pairs"] >= 5 and e["labelled"]["duplicate_queries"] >= 10
    snap = api(client, "get", f"/projects/{pid2}/export", tok2).json
    assert snap["project"]["spike"]["key"] == "stadium-drop"  # the terminal sees the pack's event too
    r = api(client, "post", "/sandbox/reset", tok2, json={})  # an uploaded pack resets to itself
    assert r.status_code == 201 and r.json["project"]["name"] == "My Show Co"
    r = api(client, "post", "/sandbox/reset", r.json["token"], json={"scenario": "food"})  # the top-bar switcher
    assert r.status_code == 201 and r.json["project"]["name"] == "ZaikaNow"
    assert api(client, "get", f"/projects/{pid}", tok2).status_code in (403, 404)  # still isolated from other sandboxes

    pack["debts"][0]["needs"] = ["DEBT-0"]
    r = api(client, "post", "/sandbox", json={"pack": pack})
    assert r.status_code == 400 and any("DEBT-0" in p for p in r.json["problems"])
    assert api(client, "post", "/sandbox", json={"pack": "not a pack"}).status_code == 400
    assert api(client, "post", "/sandbox", json={"scenario": "../fintech"}).status_code == 400


def test_playbooks_choice_progress_and_project_edits(client):
    tok, pid = sandbox(client)
    lib = api(client, "get", f"/projects/{pid}/playbooks", tok).json
    assert len(lib["playbooks"]) == 24
    row = next(d for d in lib["debts"] if d["key"] == "DEBT-101")
    assert row["playbook"] == "pool-isolation" and not row["chosen"]
    url = f"/projects/{pid}/debts/{row['id']}/playbook"
    v = api(client, "get", url, tok).json
    assert v["key"] == "pool-isolation" and v["progress"] == {"done": 0, "total": len(v["steps"])}
    v = api(client, "put", url, tok, json={"steps_done": [0, 2, 99]}).json
    assert v["steps_done"] == [0, 2] and v["progress"]["done"] == 2
    v = api(client, "put", url, tok, json={"playbook": "load-testing"}).json
    assert v["key"] == "load-testing" and v["match"]["chosen"] and v["steps_done"] == []  # new playbook, fresh progress
    assert api(client, "put", url, tok, json={"playbook": "nope"}).status_code == 400
    viewer = as_role(client, tok, "viewer")
    assert api(client, "get", url, viewer).status_code == 200
    assert api(client, "put", url, viewer, json={"steps_done": [1]}).status_code == 403
    dev = as_role(client, tok, "developer")
    assert api(client, "put", url, dev, json={"playbook": None}).json["key"] == "pool-isolation"  # back to automatic
    assert api(client, "put", f"/projects/{pid}/playbooks/pool-isolation", dev, json={"steps": ["x"]}).status_code == 403
    lead = as_role(client, tok, "tech_lead")
    e = api(client, "put", f"/projects/{pid}/playbooks/pool-isolation", lead,
            json={"steps": ["Ask the DBA for the real limit", "Split the pool"]}).json
    assert e["edited"] and e["steps"] == ["Ask the DBA for the real limit", "Split the pool"]
    v = api(client, "get", url, lead).json
    assert v["steps"] == e["steps"] and v["edited"] and not v["custom"]
    c = api(client, "put", f"/projects/{pid}/playbooks/upi-fallback", lead, json={"title": "UPI fallback", "steps": ["Add a second PSP"]})
    assert c.status_code == 200 and c.json["custom"]
    assert api(client, "put", f"/projects/{pid}/playbooks/bad", lead, json={"title": ""}).status_code == 400
    v = api(client, "put", url, lead, json={"playbook": "upi-fallback", "steps_done": [0]}).json
    assert v["progress"] == {"done": 1, "total": 1} and v["custom"] and not v["edited"]
    assert api(client, "delete", f"/projects/{pid}/playbooks/upi-fallback", lead).json == {"removed": "upi-fallback", "builtin": False}
    v = api(client, "get", url, lead).json
    assert v["key"] == "pool-isolation" and v["steps_done"] == []  # the deleted playbook's debts go back to automatic
    assert api(client, "delete", f"/projects/{pid}/playbooks/upi-fallback", lead).status_code == 404
    assert api(client, "delete", f"/projects/{pid}/playbooks/pool-isolation", lead).json["builtin"] is True
    assert api(client, "get", url, lead).json["steps"] != e["steps"]  # the built-in text is back


def test_csv_import_is_idempotent(client):
    tok, pid = sandbox(client, "college")
    text = ("id,summary,component,priority,status,created\n"
            "ERP-1,Hall ticket PDF shows wrong photo,exams,High,Open,2026-10-02\n"
            "ERP-2,Fee receipt email not sent,fees,Medium,Closed,2026-10-05\n")
    dry = api(client, "post", f"/projects/{pid}/import/incidents", tok, json={"format": "csv", "text": text}).json
    assert dry["dry_run"] and len(dry["would_create"]) == 2
    real = api(client, "post", f"/projects/{pid}/import/incidents", tok,
               json={"format": "csv", "text": text, "dry_run": False}).json
    assert len(real["created"]) == 2
    again = api(client, "post", f"/projects/{pid}/import/incidents", tok,
                json={"format": "csv", "text": text, "dry_run": False}).json
    assert again["created"] == [] and len(again["skipped"]) == 2


LOG = """2026-11-10 10:00:01 ERROR [payments] TimeoutError: upstream gateway timed out after 3000 ms order=81723
Traceback (most recent call last):
  File "/app/payments/gateway.py", line 88, in charge
TimeoutError: upstream gateway timed out after 3000 ms
2026-11-10 10:00:09 ERROR [payments] TimeoutError: upstream gateway timed out after 3000 ms order=81791
Traceback (most recent call last):
  File "/app/payments/gateway.py", line 88, in charge
TimeoutError: upstream gateway timed out after 3000 ms
"""


def test_log_ingestion_detects_recurrence(client):
    tok, pid = sandbox(client)
    r = api(client, "post", f"/projects/{pid}/import/logs", tok, json={"text": LOG, "dry_run": False}).json
    assert len(r["groups"]) == 1 and r["groups"][0]["count"] == 2 and r["groups"][0]["action"] == "create"
    key = r["groups"][0]["created_key"]
    inc = next(i for i in api(client, "get", f"/projects/{pid}/incidents", tok, query_string={"q": key}).json["items"]
               if i["key"] == key)
    api(client, "put", f"/projects/{pid}/incidents/{inc['id']}/resolution", tok, json={"action_taken": "Raised timeout"})
    again = api(client, "post", f"/projects/{pid}/import/logs", tok,
                json={"text": LOG.replace("2026-11-10", "2026-11-14"), "dry_run": False}).json
    assert again["groups"][0]["action"] == "recurred" and again["groups"][0]["existing_key"] == key


def _git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True,
                   env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t",
                        "GIT_COMMITTER_EMAIL": "t@t"})


def test_scan_upload_and_satd_conversion(client, tmp_path: Path):
    repo = tmp_path / "repo"
    (repo / "payments").mkdir(parents=True)
    (repo / "payments" / "gateway.py").write_text("import db\n# TODO: add retries with jitter\n"
                                                  "def charge(x):\n    if x:\n        return 1\n    return 0\n")
    (repo / "db.py").write_text("def q():\n    return 1\n")
    _git(repo, "init", "-q")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "init")
    scan = mining.scan_repository(repo)
    tok, pid = sandbox(client)
    r = api(client, "post", f"/projects/{pid}/evidence/scan", tok, json=scan)
    assert r.status_code == 201 and r.json["applied"]["files"] == 2
    ev = api(client, "get", f"/projects/{pid}/evidence", tok).json
    marker = next(x for x in ev["satd"] if "retries" in x["text"])
    d = api(client, "post", f"/projects/{pid}/satd/{marker['id']}/debt", tok, json={}).json["debt"]
    assert d["source"] == "satd" and d["category"] == "INFRASTRUCTURE"
    assert api(client, "post", f"/projects/{pid}/satd/{marker['id']}/debt", tok, json={}).status_code == 409


def test_reports_gate_and_export(client):
    tok, pid = sandbox(client)
    lib = api(client, "get", f"/projects/{pid}/playbooks", tok).json
    d101 = next(d for d in lib["debts"] if d["key"] == "DEBT-101")
    api(client, "put", f"/projects/{pid}/debts/{d101['id']}/playbook", tok, json={"playbook": "load-testing", "steps_done": [0]})
    pdf = api(client, "get", f"/projects/{pid}/report.pdf", tok)
    assert pdf.status_code == 200 and pdf.data[:4] == b"%PDF"
    pypdf = pytest.importorskip("pypdf")
    import io

    text = "".join(pg.extract_text() for pg in pypdf.PdfReader(io.BytesIO(pdf.data)).pages)
    assert "Fix playbook" in text and "How to fix the planned items" in text
    g = api(client, "get", f"/projects/{pid}/gate", tok, query_string={"max_open_critical": 100}).json
    assert g["pass"] is True
    api(client, "post", f"/projects/{pid}/incidents", tok, json={"title": "Card network outage", "severity": "CRITICAL",
                                                                 "module": "gateway"})
    g = api(client, "get", f"/projects/{pid}/gate", tok, query_string={"max_open_critical": 0}).json
    assert g["pass"] is False
    snap = api(client, "get", f"/projects/{pid}/export", tok).json
    assert snap["format"] == "debtlens-snapshot/1" and "embedding" not in snap["incidents"][0]
    exported = next(d for d in snap["debts"] if d["key"] == "DEBT-101")
    assert exported["playbook"] == "load-testing" and exported["playbook_steps_done"] == [0]
    assert snap["settings"]["playbooks"] == {}
    assert len(api(client, "get", f"/projects/{pid}/activity", tok).json["events"]) >= 1


def test_validation_errors(client):
    tok, pid = sandbox(client)
    assert api(client, "post", f"/projects/{pid}/incidents", tok, json={"title": "x"}).status_code == 400
    assert api(client, "post", f"/projects/{pid}/incidents", tok,
               json={"title": "Valid title here", "severity": "APOCALYPTIC"}).status_code == 400
    assert api(client, "post", f"/projects/{pid}/debts", tok, json={"title": "Valid debt", "principal": -5}).status_code == 400
    assert api(client, "post", f"/projects/{pid}/plan", tok, json={"budget": "lots"}).status_code == 400
    assert api(client, "post", "/sandbox", json={"scenario": "mars"}).status_code == 400


def test_lazy_engine_from_environment_does_not_deadlock(monkeypatch):
    """Vercel never calls configure(): the first request must build the engine lazily."""
    import threading

    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    monkeypatch.setattr(DB, "_engine", None)
    monkeypatch.setattr(DB, "_Session", None)
    monkeypatch.setattr(DB, "_initialised", False)
    app = create_app(testing=True)
    out = {}
    t = threading.Thread(target=lambda: out.setdefault("r", app.test_client().get("/api/v1/health")), daemon=True)
    t.start()
    t.join(20)
    assert "r" in out and out["r"].status_code == 200
