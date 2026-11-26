"""CLI tests: every offline command, the CI exit code, and the website round trip."""

from __future__ import annotations

import json
import os

import pytest
from typer.testing import CliRunner

os.environ.setdefault("DEBTLENS_DISABLE_ML", "1")

from debtlens.cli.main import app  # noqa: E402
from debtlens.core import packs as PK  # noqa: E402
from debtlens.core import report as REPORT  # noqa: E402

runner = CliRunner()


@pytest.fixture(autouse=True)
def isolated_config(tmp_path, monkeypatch):
    monkeypatch.setenv("DEBTLENS_CONFIG_DIR", str(tmp_path / "cfg"))
    monkeypatch.setenv("COLUMNS", "160")
    for k in ("DEBTLENS_URL", "DEBTLENS_TOKEN"):
        monkeypatch.delenv(k, raising=False)


def run(*args):
    r = runner.invoke(app, list(args))
    return r


def test_version_and_scenarios():
    assert "2.0.0" in run("--version").output
    r = run("scenarios", "--json")
    assert r.exit_code == 0 and {s["code"] for s in json.loads(r.output)} >= {"fintech", "college"}


@pytest.mark.parametrize("code", ["fintech", "healthtech", "ecommerce", "college", "self"])
def test_demo_every_scenario(code):
    r = run("demo", code, "--json")
    assert r.exit_code == 0, r.output
    d = json.loads(r.output)
    assert d["incidents"]["total"] > 5 and d["ledger"]["open_items"] > 0


def test_plan_is_optimal_and_respects_budget():
    d = json.loads(run("plan", "--scenario", "college", "--budget", "30", "--json").output)
    assert d["total_weight"] <= 30 and d["optimal"]
    assert d["comparison"]["optimal"]["total_value"] >= d["comparison"]["greedy"]["total_value"] - 1e-9


def test_plan_force_and_unknown_key():
    d = json.loads(run("plan", "-s", "fintech", "-b", "40", "--force", "DEBT-104", "--json").output)
    assert "DEBT-104" in [x["key"] for x in d["selected_items"]]
    assert run("plan", "-s", "fintech", "--force", "DEBT-999").exit_code != 0


def test_similar_and_incident_show():
    d = json.loads(run("similar", "connection pool exhausted at checkout", "-s", "fintech", "--json").output)
    assert d["results"] and d["method"] == "char-ngram"
    r = run("incidents", "show", "INC-118", "-s", "fintech")
    assert r.exit_code == 0 and "W1" in r.output


def test_simulations_offline():
    f = json.loads(run("simulate", "forecast", "-s", "ecommerce", "--runs", "30", "--sprints", "4", "--json").output)
    assert f["policies"]["optimal"]["final_hours_mean"] <= f["policies"]["none"]["final_hours_mean"]
    c = json.loads(run("simulate", "cascade", "db", "-s", "fintech", "--runs", "300", "--json").output)
    assert c["start"] == "db" and c["expected_affected"] > 0
    w = json.loads(run("simulate", "whatif", "-s", "fintech", "--lambda-churn", "0.6", "--json").output)
    assert w["summary_after"]["total_interest"] > w["summary_before"]["total_interest"]


def test_playbooks_and_load_spike_offline():
    r = run("playbook", "debt-101", "-s", "fintech")
    assert r.exit_code == 0 and "connection pool" in r.output.lower() and "1." in r.output, r.output
    d = json.loads(run("playbook", "DEBT-203", "-s", "healthtech", "--json").output)
    assert d["key"] == "reconciliation" and d["match"]["chosen"]
    assert run("playbook", "DEBT-999", "-s", "fintech").exit_code != 0
    assert run("playbook", "DEBT-101", "-s", "fintech", "--done", "1").exit_code != 0  # progress lives on the website
    lib = json.loads(run("playbooks", "-s", "college", "--json").output)
    assert len(lib["playbooks"]) == 25 and {x["key"] for x in lib["debts"]} >= {"DEBT-401", "DEBT-411"}
    s = json.loads(run("simulate", "spike", "-s", "college", "--runs", "80", "--json").output)
    assert s["event"]["key"] == "results-day" and s["plan"]["hours_used"] <= 40
    c = json.loads(run("simulate", "spike", "-s", "fintech", "--peak", "6", "--start", "9", "--hours", "2", "--budget", "0",
                       "--runs", "50", "--json").output)
    assert c["event"]["key"] == "custom" and c["plan"]["selected"] == []
    r = run("simulate", "spike", "-s", "ecommerce", "--runs", "60")
    assert r.exit_code == 0 and "What to fix before the event" in r.output, r.output
    assert any(ch in r.output for ch in "▁▂▃▄▅▆▇█")  # hour-by-hour sparklines
    assert run("simulate", "spike", "-s", "fintech", "--event", "nonsense").exit_code != 0


def test_live_replay_in_the_terminal(monkeypatch):
    from debtlens.cli import live as LIVE

    monkeypatch.setattr(LIVE, "HOUR_BUSY", 0.05)  # play the day in a blink
    monkeypatch.setattr(LIVE, "HOUR_QUIET", 0.005)
    r = run("simulate", "spike", "-s", "tatkal", "-e", "tatkal-bots", "--runs", "80", "--live", "--side", "--speed", "8")
    assert r.exit_code == 0, r.output
    assert "LIVE REPLAY" in r.output and "Today, with the open debt" in r.output and "After the fixes" in r.output
    assert "blocked at the edge" in r.output and "DEBT-508" in r.output and "replay stopped" not in r.output
    s = json.loads(run("simulate", "spike", "-s", "tatkal", "-e", "tatkal-bots", "--runs", "80", "--json").output)
    assert f"{s['replay']['before']['total_hours_lost']:,.1f} engineer-hours lost" in r.output
    assert run("simulate", "spike", "-s", "tatkal", "--live", "--json").exit_code != 0
    assert LIVE.count(4500) == "4,500" and LIVE.count(3.2e5) == "3.2 lakh" and LIVE.count(1.4e7) == "1.4 crore"


def test_scenario_packs_run_by_name_and_pack_files_open_on_the_website(tmp_path):
    packs = json.loads(run("pack", "list", "--json").output)
    assert [p["code"] for p in packs] == ["tatkal", "broker", "food", "stream", "rides", "taxfiling", "tickets", "exam",
                                          "airline", "appointments", "grocery"]
    listed = {s["code"] for s in json.loads(run("scenarios", "--json").output)}
    assert listed >= {"fintech", "tatkal", "tickets", "exam", "grocery"}
    r = run("pack", "show", "food")
    assert r.exit_code == 0 and "IPL final night" in r.output and "dispatch" in r.output and "Situations" in r.output, r.output
    evs = json.loads(run("simulate", "spike", "-s", "grocery", "--list", "--json").output)
    assert [e["key"] for e in evs][:2] == ["diwali-evening", "drop-scripts"] and {e["kind"] for e in evs} >= {"bots", "outage", "deploy"}
    s = json.loads(run("simulate", "spike", "-s", "rides", "--runs", "60", "--json").output)
    assert s["event"]["kind"] == "traffic" and s["plan"]["hours_used"] <= 40
    assert json.loads(run("plan", "-s", "rides", "--budget", "40", "--json").output)["total_weight"] <= 40
    # a pack file is not opened in the terminal: the website checks it and opens it
    f = tmp_path / "rail.json"
    f.write_text(PK.dump(PK.get("tatkal")), encoding="utf-8")
    for args in (("demo", str(f)), ("plan", "-s", str(f)), ("simulate", "spike", "-s", str(f)), ("pack", "show", str(f))):
        r = run(*args)
        assert r.exit_code != 0 and "opened on the website" in (r.output + str(r.exception)), args
    assert run("pack", "validate", str(f)).exit_code != 0 and run("pack", "export", "tatkal").exit_code != 0
    assert run("pack", "show", "nope").exit_code != 0


def test_a_situation_ends_with_the_same_report_as_the_website(tmp_path):
    dest = tmp_path / "report.txt"
    r = run("simulate", "spike", "-s", "fintech", "-e", "acquirer-outage", "--runs", "80", "--report", "-o", str(dest))
    assert r.exit_code == 0, r.output
    for needle in ("DebtLens run report: Acquiring bank outage — PayCore", "WHAT HAPPENED ON THE DAY YOU WATCHED",
                   "WHY IT FAILED", "WHAT TO DO NEXT", "DEBT-104"):
        assert needle in r.output, needle
    text = dest.read_text(encoding="utf-8")
    assert text.startswith("DebtLens run report") and "HOW THIS WAS WORKED OUT" in text
    j = json.loads(run("simulate", "spike", "-s", "fintech", "-e", "acquirer-outage", "--runs", "80", "--json").output)
    assert REPORT.hours(j["before"]["hours_lost"]) in text and REPORT.hours(j["after"]["hours_lost"]) in text


def test_ci_exit_codes():
    assert run("ci", "-s", "fintech", "--max-open-critical", "0").exit_code == 1
    assert run("ci", "-s", "fintech", "--max-open-critical", "10").exit_code == 0


def test_scan_ingest_export_analyse(tmp_path):
    (tmp_path / "pkg" / "api").mkdir(parents=True)
    (tmp_path / "pkg" / "core").mkdir(parents=True)
    (tmp_path / "pkg" / "api" / "views.py").write_text("from pkg.core import rules\n# FIXME: handle timeouts\n")
    (tmp_path / "pkg" / "core" / "rules.py").write_text("def f(x):\n    return 1 if x else 2\n")
    d = json.loads(run("scan", str(tmp_path), "--json").output)
    assert {m["name"] for m in d["modules"]} >= {"api", "core"}
    assert d["satd"][0]["marker"] == "FIXME"
    log = tmp_path / "app.log"
    log.write_text("2026-11-10 10:00:01 ERROR [orders] ValueError: bad quantity -3\n2026-11-10 10:00:02 ERROR [orders] ValueError: bad quantity -7\n")
    g = json.loads(run("ingest", str(log), "--json").output)
    assert len(g["groups"]) == 1 and g["groups"][0]["count"] == 2
    snap = tmp_path / "snap.json"
    assert run("export", "-s", "healthtech", "-o", str(snap)).exit_code == 0
    a = json.loads(run("analyse", str(snap), "--json").output)
    assert a["incidents"]["total"] == 24


def test_commands_needing_a_project_explain_themselves():
    r = run("incidents", "new", "--title", "x", "-y")
    assert r.exit_code != 0


def test_login_and_remote_commands_against_the_api(monkeypatch):
    """Point the CLI's HTTP client at an in-process Flask app."""
    import debtlens.cli.client as client_mod
    from debtlens.api import create_app

    flask_app = create_app("sqlite://", testing=True)
    web = flask_app.test_client()
    tok = web.post("/api/v1/auth/register", json={"name": "Cli User", "email": "cli@example.com", "password": "pass-1234"}).json["token"]
    pid = web.post("/api/v1/projects", json={"scenario": "fintech"}, headers={"Authorization": f"Bearer {tok}"}).json["project"]["id"]
    api_token = web.post("/api/v1/auth/tokens", json={"name": "t"}, headers={"Authorization": f"Bearer {tok}"}).json["token"]

    def fake_request(self, method, path, body=None, raw=False, timeout=90.0):
        resp = web.open("/api/v1" + path, method=method, json=body, headers={"Authorization": f"Bearer {self.token}"})
        if resp.status_code >= 400:
            raise client_mod.CliError(f"server said {resp.status_code}: {resp.json.get('error')}")
        return resp.data if raw else resp.json

    monkeypatch.setattr(client_mod.Api, "_request", fake_request)
    r = run("login", "http://testserver", "--token", api_token, "--project", str(pid))
    assert r.exit_code == 0, r.output
    assert str(pid) in run("projects").output
    d = json.loads(run("plan", "--budget", "32", "--json").output)
    assert d["total_weight"] <= 32
    r = run("incidents", "new", "--title", "Refund webhook delivered twice", "--module", "webhooks", "--severity", "high",
            "--why", "Duplicate refund events", "--why", "The retry worker re-sent events that were already delivered", "-y")
    assert r.exit_code == 0 and "reported INC-" in r.output, r.output
    assert run("ci", "--max-open-critical", "0").exit_code == 1
    d = json.loads(run("playbook", "DEBT-101", "--done", "1,3", "--json").output)
    assert d["steps_done"] == [0, 2] and d["progress"]["done"] == 2
    d = json.loads(run("playbook", "DEBT-101", "--use", "load-testing", "--json").output)
    assert d["key"] == "load-testing" and d["steps_done"] == []
    assert "load" in run("playbooks").output.lower()
    s = json.loads(run("simulate", "spike", "--runs", "50", "--json").output)
    assert s["event"]["key"] == "salary-day" and s["plan"]["hours_used"] <= 40
