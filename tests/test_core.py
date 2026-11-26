"""Engine tests: every algorithm is checked against a reference implementation
(scikit-learn, NetworkX, Radon, brute force) or against a hand-computed answer."""

import json
import random
import subprocess
from pathlib import Path

import pytest

from debtlens.core import clustering, economics, engine, graph, ingest, mining, optimiser, playbooks, scenarios, simulation
from debtlens.core import packs as PK
from debtlens.core import report as REPORT
from debtlens.core import spike as SPIKE
from debtlens.core import text as T
from debtlens.core.tfidf import TfidfModel, cosine_matrix

DOCS = [
    "Checkout API returning HTTP 500 during sale traffic",
    "Connection pool exhausted, checkout requests time out",
    "Merchants received duplicate webhook callbacks",
    "Webhook retries resend events merchants already acknowledged",
    "Settlement file short because refunds counted twice",
    "UPI payments stuck pending after NPCI slowdown",
]


# ----------------------------------------------------------------------------- similarity

def test_word_tfidf_matches_sklearn():
    sk = pytest.importorskip("sklearn.feature_extraction.text")
    from sklearn.metrics.pairwise import cosine_similarity

    ours = cosine_matrix(TfidfModel(T.word_analyzer).fit_transform(DOCS))
    ref = cosine_similarity(sk.TfidfVectorizer(analyzer=T.word_analyzer).fit_transform(DOCS))
    for i in range(len(DOCS)):
        for j in range(len(DOCS)):
            assert ours[i][j] == pytest.approx(ref[i][j], abs=1e-9)


def test_char_ngrams_match_sklearn_char_wb():
    sk = pytest.importorskip("sklearn.feature_extraction.text")
    v = sk.TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), lowercase=True)
    analyzer = v.build_analyzer()
    for d in DOCS:
        assert sorted(T.char_ngrams(d)) == sorted(analyzer(T.normalize(d)))


def test_regression_detection_rules():
    from debtlens.core import similarity

    incs = [
        {"id": 1, "key": "A", "title": "Pool exhausted, checkout 500", "description": "QueuePool limit reached", "module": "db",
         "status": "RESOLVED", "reported_at": "2026-01-01T10:00:00", "resolved_at": "2026-01-01T12:00:00"},
        {"id": 2, "key": "B", "title": "Pool exhausted again, checkout 500", "description": "QueuePool limit reached", "module": "db",
         "status": "OPEN", "reported_at": "2026-02-01T10:00:00"},
        {"id": 3, "key": "C", "title": "Pool exhausted, checkout 500", "description": "QueuePool limit reached", "module": "api",
         "status": "OPEN", "reported_at": "2026-02-02T10:00:00"},
        {"id": 4, "key": "D", "title": "Pool exhausted, checkout 500", "description": "QueuePool limit reached", "module": "db",
         "status": "OPEN", "reported_at": "2026-01-01T11:00:00"},
    ]
    b = similarity.build([similarity.incident_text(i) for i in incs], 0.5)
    regs = similarity.detect_regressions(incs, b, 0.5)
    assert [(r["incident_key"], r["regressed_from_key"]) for r in regs] == [("B", "A")]  # C: other module, D: before fix


# ----------------------------------------------------------------------------- clustering

def test_dbscan_matches_sklearn():
    skc = pytest.importorskip("sklearn.cluster")
    rng = random.Random(3)
    pts = [(rng.gauss(cx, 0.3), rng.gauss(cy, 0.3)) for cx, cy in [(0, 0), (4, 4), (8, 0)] for _ in range(15)]
    pts += [(rng.uniform(-3, 11), rng.uniform(-3, 7)) for _ in range(8)]
    dist = [[((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5 for b in pts] for a in pts]
    ours = clustering.dbscan(dist, 0.6, 4)
    ref = skc.DBSCAN(eps=0.6, min_samples=4, metric="precomputed").fit_predict(dist).tolist()
    assert ours == ref


# ----------------------------------------------------------------------------- graph

def _random_digraph(seed, n=14, p=0.2):
    rng = random.Random(seed)
    nodes = list(range(n))
    edges = [(a, b) for a in nodes for b in nodes if a != b and rng.random() < p]
    return nodes, edges


@pytest.mark.parametrize("seed", range(6))
def test_centrality_matches_networkx(seed):
    nx = pytest.importorskip("networkx")
    nodes, edges = _random_digraph(seed)
    G = nx.DiGraph()
    G.add_nodes_from(nodes)
    G.add_edges_from(edges)
    ours_b = graph.betweenness_centrality(nodes, edges)
    ours_d = graph.degree_centrality(nodes, edges)
    ref_b = nx.betweenness_centrality(G)
    ref_d = nx.degree_centrality(G)
    for v in nodes:
        assert ours_b[v] == pytest.approx(ref_b[v], abs=1e-9)
        assert ours_d[v] == pytest.approx(ref_d[v], abs=1e-9)


def test_blast_radius_counts_transitive_dependents():
    deps = [("checkout", "orders"), ("orders", "db"), ("reports", "db"), ("db", "db")]
    br = graph.blast_radius(["checkout", "orders", "db", "reports"], deps)
    assert br == {"db": 3, "orders": 1, "checkout": 0, "reports": 0}


def test_scc_and_topological_sort():
    nodes = list("abcde")
    edges = [("a", "b"), ("b", "c"), ("c", "a"), ("c", "d")]
    comps = sorted(sorted(c) for c in graph.strongly_connected_components(nodes, edges))
    assert ["a", "b", "c"] in comps
    with pytest.raises(graph.CycleError):
        graph.topological_sort(nodes, edges)
    assert graph.topological_sort(list("abc"), [("a", "b"), ("a", "c"), ("b", "c")]) == ["a", "b", "c"]


# ----------------------------------------------------------------------------- optimiser

def _instance(seed, n=12, forest=True):
    rng = random.Random(seed)
    items = []
    for i in range(n):
        pre = ()
        if i and rng.random() < 0.45:
            pre = (rng.randrange(i),) if forest else tuple(sorted(set(rng.randrange(i) for _ in range(rng.randint(1, 2)))))
        items.append(optimiser.Item(i, f"D{i}", rng.choice([1, 2, 3, 4, 6, 8, 12, 16]) * 1.0,
                                    round(rng.uniform(5, 100), 2), pre))
    return items


@pytest.mark.parametrize("seed", range(25))
def test_tree_dp_is_optimal(seed):
    items = _instance(seed, forest=True)
    budget = random.Random(seed).choice([10, 20, 30, 45])
    exact = optimiser.solve(items, budget, "brute_force")
    dp = optimiser.solve(items, budget, "tree_dp")
    assert dp.total_value == pytest.approx(exact.total_value)
    assert dp.total_weight <= budget


@pytest.mark.parametrize("seed", range(25))
def test_branch_and_bound_is_optimal_on_dags(seed):
    items = _instance(seed, forest=False)
    budget = random.Random(seed).choice([10, 20, 30, 45])
    exact = optimiser.solve(items, budget, "brute_force")
    bb = optimiser.solve(items, budget, "branch_and_bound")
    assert bb.optimal and bb.total_value == pytest.approx(exact.total_value)
    chosen = set(bb.selected)
    for it in items:  # every selected item has its prerequisites selected, and they come first
        if it.id in chosen:
            assert set(it.prereqs) <= chosen
            assert all(bb.selected.index(p) < bb.selected.index(it.id) for p in it.prereqs)


def test_naive_dp_wastes_budget_where_exact_does_not():
    items = [optimiser.Item(1, "A", 6, 10), optimiser.Item(2, "B", 4, 60, (1,)), optimiser.Item(3, "C", 6, 50)]
    naive = optimiser.solve(items, 10, "naive_dp")
    exact = optimiser.solve(items, 10, "auto")
    assert exact.total_value == 70 and set(exact.selected) == {1, 2}
    assert naive.total_value < exact.total_value


def test_forced_blocked_and_cycles():
    items = [optimiser.Item(1, "A", 5, 10), optimiser.Item(2, "B", 5, 20, (1,)), optimiser.Item(3, "C", 5, 30, (4,)),
             optimiser.Item(5, "E", 2, 5, (6,)), optimiser.Item(6, "F", 2, 5, (5,))]
    plan = optimiser.solve(items, 10, force=[2], blocked_prereqs=[4])
    assert plan.selected == [1, 2]  # forcing B pulls in its prerequisite A first
    assert "blocked" in plan.deferred[3]
    cyc = optimiser.solve(items, 20)
    assert any("cycle" in w for w in cyc.warnings) and {5, 6} <= set(cyc.selected)


# ----------------------------------------------------------------------------- economics

def test_interest_formula_matches_synopsis():
    incs = {1: {"severity": "CRITICAL", "effort_hours": 4}, 2: {"severity": "LOW", "effort_hours": 2}}
    rows = economics.compute_ledger([{"id": 9, "key": "D", "module": "db", "principal": 10, "incident_ids": [1, 2]}],
                                    incs, {"db": 20}, {"db": 3})
    r = rows[0]
    assert r["interest"] == pytest.approx(3.5 * 4 + 1.0 * 2 + 0.15 * 20 + 1.8 * 3)
    assert r["break_even"] is True and r["net_drag"] == pytest.approx(r["interest"] - 10)


# ----------------------------------------------------------------------------- mining

def _git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True,
                   env={"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t",
                        "GIT_COMMITTER_EMAIL": "t@t", "PATH": "/usr/bin:/bin:/usr/local/bin", "HOME": str(cwd)})


def test_scan_repository_reads_real_git_history(tmp_path):
    (tmp_path / "pay").mkdir()
    (tmp_path / "db").mkdir()
    (tmp_path / "db" / "pool.py").write_text("def get():\n    return 1\n")
    _git(tmp_path, "init", "-q")
    _git(tmp_path, "add", ".")
    _git(tmp_path, "commit", "-q", "-m", "one")
    for k in range(3):
        (tmp_path / "pay" / "api.py").write_text(
            "from db.pool import get\n\n"
            "def charge(x, y):\n"
            f"    # TODO: idempotency key ({k})\n"
            "    if x and y:\n        return get()\n"
            "    for i in range(3):\n        if i > x:\n            break\n"
            "    s = '# FIXME not a comment'\n    return s\n")
        _git(tmp_path, "add", ".")
        _git(tmp_path, "commit", "-q", "-m", f"c{k}")
    res = mining.scan_repository(tmp_path, since_days=None)
    f = {x["path"]: x for x in res["files"]}
    assert f["pay/api.py"]["churn"] == 3 and f["db/pool.py"]["churn"] == 1
    assert f["pay/api.py"]["complexity"] == 5  # 1 + if + and + for + if
    assert [s["marker"] for s in res["satd"]] == ["TODO"]  # the FIXME inside a string is ignored
    assert {"source": "pay", "target": "db", "weight": 1} in res["dependencies"]


def test_python_complexity_matches_radon():
    radon = pytest.importorskip("radon.complexity")
    src = Path(mining.__file__).read_text()
    ours = mining.python_complexity(src)
    blocks = radon.cc_visit(src)
    funcs = [b for b in blocks if b.letter in "FM"]
    funcs += [m for b in blocks if b.letter == "C" for m in b.methods]
    assert ours["max_function"] == max(b.complexity for b in funcs)


def test_satd_lists_are_not_debt():
    assert mining.scan_satd("x = 1  # marker types: TODO, FIXME, HACK\n", "python") == []
    assert mining.scan_satd("// HACK: retry loop\nconst a = 1;\n", "js")[0]["marker"] == "HACK"


# ----------------------------------------------------------------------------- ingest

def test_log_ingestion_groups_by_signature():
    log = "\n".join([
        "2026-11-10 10:00:01 ERROR checkout failed",
        "Traceback (most recent call last):",
        '  File "/app/services/checkout/api.py", line 40, in pay',
        "TimeoutError: pool timeout after 30s for order 4411",
        "2026-11-10 10:00:05 INFO ok",
        "Traceback (most recent call last):",
        '  File "/app/services/checkout/api.py", line 40, in pay',
        "TimeoutError: pool timeout after 31s for order 9921",
    ])
    res = ingest.parse_logs(log)
    timeouts = [g for g in res["groups"] if g["exception"] == "TimeoutError"]
    assert len(timeouts) == 1 and timeouts[0]["count"] == 2 and timeouts[0]["module"] == "checkout"


def test_csv_import_normalises_fields():
    recs, errs = ingest.parse_csv("Summary,Priority,Component,State,Created\nLogin fails,P1,Auth,closed,2026-03-01\nx,,,,\n")
    assert recs[0]["severity"] == "CRITICAL" and recs[0]["status"] == "RESOLVED" and recs[0]["module"] == "auth"
    assert errs and "missing title" in errs[0]


# ----------------------------------------------------------------------------- simulations & scenarios

@pytest.mark.parametrize("code", [s["code"] for s in scenarios.list_scenarios()])
def test_every_scenario_runs_end_to_end(code):
    snap = scenarios.materialize(code)
    led = engine.ledger(snap)
    assert led["summary"]["open_items"] > 0
    plan = engine.plan(snap, 40)
    assert plan["total_weight"] <= 40 and plan["comparison"]["optimal"]["total_value"] >= plan["comparison"]["greedy"]["total_value"] - 1e-6
    assert engine.dashboard(snap)["incidents"]["total"] == len(snap["incidents"])


def test_evaluation_scores_the_configured_alpha_and_tau():
    snap = scenarios.materialize("ecommerce")
    ev = engine.evaluate(snap, scenarios.labels("ecommerce"), None, alpha=0.35, tau=0.3)
    hybrid = [r for r in ev["retrieval"] if "alpha" in r]
    assert [r["alpha"] for r in hybrid if r["configured"]] == [0.35]
    assert {0.2, 0.4, 0.7} <= {r["alpha"] for r in hybrid}
    assert ev["configured"] == {"alpha": 0.35, "tau": 0.3} and ev["regression_alpha"] == 0.35
    assert [r["tau"] for r in ev["regression"] if r["configured"]] == [0.3]


def test_forecast_is_reproducible_and_ranks_policies():
    snap = scenarios.materialize("fintech")
    cfg = {"runs": 40, "sprints": 6, "budget": 40, "seed": 5}
    a = engine.forecast(snap, cfg)
    b = engine.forecast(snap, cfg)
    assert a["policies"]["optimal"]["cum_hours_mean"] == b["policies"]["optimal"]["cum_hours_mean"]
    assert a["policies"]["none"]["final_hours_mean"] > a["policies"]["optimal"]["final_hours_mean"]


def test_cascade_extremes():
    mods = ["a", "b", "c"]
    deps = [("b", "a"), ("c", "b")]
    full = simulation.cascade(mods, deps, {m: 1.0 for m in mods}, "a", p=1.0, runs=50)
    none = simulation.cascade(mods, deps, {m: 1.0 for m in mods}, "a", p=0.0, runs=50)
    assert full["expected_affected"] == 2 and full["worst_case_affected"] == 2
    assert none["expected_affected"] == 0


# ----------------------------------------------------------------------------- fix playbooks

def test_playbooks_match_the_evidence_and_fall_back_when_there_is_none():
    snap = scenarios.materialize("fintech")
    _, a = engine.playbook_assignment(snap)
    key = {d["key"]: a[d["id"]]["key"] for d in snap["debts"]}
    assert key["DEBT-101"] == "pool-isolation" and key["DEBT-102"] == "idempotency" and key["DEBT-104"] == "circuit-breaker"
    pool = playbooks.match({"title": "Connection pool exhausted under load", "description": "pool size 10", "category": "ARCHITECTURE"})
    assert pool["key"] == "pool-isolation" and pool["confident"] and "connection pool" in pool["matched"]
    vague = playbooks.match({"title": "Rename variables in a helper", "module": "misc"})
    assert vague == {"key": playbooks.FALLBACK, "score": 0.0, "matched": [], "confident": False}
    assert len(playbooks.LIBRARY) == len(playbooks.BY_KEY) == 25
    for pb in playbooks.LIBRARY:
        assert pb.steps and pb.verify and 0 <= pb.capacity <= 0.6 and 0 <= pb.resilience <= 0.6
        assert all(u.startswith("https://") for _, u in pb.references)


def test_playbook_choices_and_project_edits_win_over_matching():
    h = scenarios.materialize("healthtech")
    d203 = next(d for d in h["debts"] if d["key"] == "DEBT-203")
    assert engine.playbook_assignment(h)[1][d203["id"]] == {"key": "reconciliation", "score": None, "matched": [],
                                                            "confident": True, "chosen": True}  # set in the scenario file
    snap = scenarios.materialize("fintech")
    d101 = next(d for d in snap["debts"] if d["key"] == "DEBT-101")
    _, a = engine.playbook_assignment(snap, chosen={d101["id"]: "load-testing"})
    assert a[d101["id"]]["key"] == "load-testing" and a[d101["id"]]["chosen"]
    _, a = engine.playbook_assignment(snap, chosen={d101["id"]: "no-such-playbook"})
    assert a[d101["id"]]["key"] == "pool-isolation"  # an unknown choice is ignored
    edits = {"pool-isolation": {"steps": ["Ask the DBA for the real pool limit", "Split the pool"]}}
    pb = engine.debt_playbook(snap, "DEBT-101", edits)
    assert pb["steps"] == edits["pool-isolation"]["steps"] and pb["title"] == playbooks.BY_KEY["pool-isolation"].title
    assert pb["context"]["debt_key"] == "DEBT-101" and pb["context"]["incidents"]
    assert any("No recurrence of the linked incidents" in v for v in pb["verify"])
    clean = playbooks.validate_custom({"title": "UPI fallback PSP!", "steps": ["Add a second PSP", " "], "capacity": 9,
                                       "references": [{"url": "javascript:alert(1)"}, {"url": "https://npci.org.in"}]})
    assert clean["key"] == "upi-fallback-psp" and clean["steps"] == ["Add a second PSP"] and clean["capacity"] == 0.6
    assert [r["url"] for r in clean["references"]] == ["https://npci.org.in"]
    with pytest.raises(ValueError):
        playbooks.validate_custom({"title": "No steps"})


# ----------------------------------------------------------------------------- load spikes

def test_overload_curve_and_exposure_propagation():
    assert SPIKE.p_overload(1.0) == pytest.approx(0.5)
    assert SPIKE.p_overload(0.7) < 0.01 < 0.99 < SPIKE.p_overload(1.3)
    # traffic entering at the API reaches everything it calls; a module only the batch job uses is not exposed
    mods = ["api", "db", "batch", "ledger"]
    deps = [("api", "db"), ("batch", "ledger"), ("ledger", "db")]
    e = SPIKE.exposure(mods, deps, {"api": 1.0})
    assert e["api"] == e["db"] == 1.0 and e["batch"] == e["ledger"] == 0.0
    e = SPIKE.exposure(mods, deps, {"api": 1.0}, fixed={"db": 0.3})
    assert e["db"] == 0.3
    prof = SPIKE.custom_profile(6, 9, 2, ramp=1)
    assert len(prof) == 24 and prof[8] == prof[11] == 3.5 and prof[9] == prof[10] == 6 and prof[7] == prof[12] == 1.0
    late = SPIKE.custom_profile(6, 22, 3, ramp=1)  # the simulated day ends at midnight
    assert late[21] == 3.5 and late[22] == late[23] == 6 and late[0] == 1.0
    ev = engine.spike(scenarios.materialize("fintech"), {"peak": 6, "start_hour": 22, "duration": 3}, 0, runs=50)["event"]
    assert "for 2 h (cut at midnight" in ev["description"] and "1 h falls outside" in ev["description"]


def test_spike_plan_fits_the_budget_includes_prerequisites_and_helps():
    snap = scenarios.materialize("college")
    r = engine.spike(snap, None, 40, runs=120, seed=3)
    assert r["event"]["key"] == "results-day" and r["peak"] == 12
    plan = r["plan"]
    assert plan["hours_used"] <= 40 and plan["method"]
    keys = {x["key"] for x in plan["selected"]}
    by_key = {d["key"]: d for d in snap["debts"]}
    by_id = {d["id"]: d for d in snap["debts"]}
    for k in keys:  # every prerequisite of a planned fix is planned too
        assert {by_id[p]["key"] for p in by_key[k].get("prerequisite_ids") or [] if by_id[p]["status"] != "RESOLVED"} <= keys
    assert {"DEBT-401", "DEBT-411"} <= keys
    assert r["after"]["hours_lost"] < r["before"]["hours_lost"]
    assert r["saved_hours"]["worse_runs"] == 0 and r["saved_hours"]["ci95"][0] > 0
    assert r["saved_hours"]["mean"] >= r["regular_plan"]["saved_hours"]["mean"] - 1e-9
    zero = engine.spike(snap, None, 0, runs=60, seed=3)
    assert zero["plan"]["selected"] == [] and zero["after"]["hours_lost"] == zero["before"]["hours_lost"]


def test_bigger_spikes_hurt_more_and_runs_are_reproducible():
    snap = scenarios.materialize("fintech")
    days = [engine.spike(snap, {"peak": p, "start_hour": 12, "duration": 3}, 0, runs=80, seed=5)["before"]
            for p in (1, 4, 8)]
    lost = [d["hours_lost"] for d in days]
    assert lost[0] < lost[1] < lost[2]
    # an ordinary day overloads nothing, but it is not perfect either: modules still fail now and then at random
    assert days[0]["by_kind"]["overload"]["hours"] == 0 and days[0]["by_kind"]["fault"]["hours"] > 0
    a = engine.spike(snap, None, 40, runs=60, seed=9)
    b = engine.spike(snap, None, 40, runs=60, seed=9)
    assert a["before"] == b["before"] and a["plan"]["selected"] == b["plan"]["selected"]
    assert a["event"]["key"] == "salary-day"
    with pytest.raises(ValueError):
        engine.spike(snap, "no-such-event")
    for code in ("healthtech", "ecommerce", "self"):  # every scenario has an event (self uses the custom default)
        r = engine.spike(scenarios.materialize(code), None, 40, runs=50, seed=1)
        assert r["plan"]["hours_used"] <= 40 and r["after"]["hours_lost"] <= r["before"]["hours_lost"]


# ----------------------------------------------------------------------------- scenario packs


def test_bundled_packs_are_valid_distinct_and_complete():
    codes = PK.codes()
    assert len(codes) == 11 and len(set(codes)) == 11
    assert not set(codes) & {s["code"] for s in scenarios.list_scenarios()}
    keys = set()
    for code in codes:
        pack = PK.get(code)
        again, warnings = PK.validate(PK.dump(pack))  # a bundled pack survives its own download
        assert again == pack and warnings == []
        info = PK.info(pack)
        assert info["event"] and info["event"]["peak"] > 1 and len(pack["spike"]["profile"]) == SPIKE.HOURS
        assert pack["tour"]["incident"] in {i["key"] for i in pack["incidents"]}
        roles = {p["role"] for p in pack["people"].values()}
        assert roles >= {"admin", "tech_lead", "developer", "qa", "manager", "viewer"}
        labels = scenarios.labels(pack)
        assert len(labels["duplicate_groups"]) >= 5 and len(labels["regressions"]) >= 5
        own = {i["key"] for i in pack["incidents"]} | {d["key"] for d in pack["debts"]}
        assert not own & keys  # keys never repeat across packs, so switching packs on stage is not confusing
        keys |= own


@pytest.mark.parametrize("code", PK.codes())
def test_every_pack_runs_every_page_and_simulation(code):
    pack = PK.get(code)
    snap = scenarios.materialize(pack)
    assert snap["project"]["spike"]["key"] == pack["spike"]["key"]
    _, asg = engine.playbook_assignment(snap)
    assert all(a["key"] != playbooks.FALLBACK for a in asg.values()), "every debt matches a specific playbook"
    dash = engine.dashboard(snap)
    assert dash["top_causes"] and dash["top_causes"][0]["incidents"] >= 3
    ev = engine.evaluate(snap, scenarios.labels(pack))
    hybrid = next(r for r in ev["retrieval"] if r["method"] == "Hybrid α=0.4")
    reg = next(r for r in ev["regression"] if r["configured"])
    assert hybrid["p@1"] >= 0.75 and reg["precision"] >= 0.8 and reg["recall"] >= 0.3
    pl = engine.plan(snap, 40)
    assert 0 < pl["total_weight"] <= 40 and pl["optimal"]
    fc = engine.forecast(snap, {"runs": 40, "sprints": 6, "budget": 40, "policies": ["optimal", "none"]})
    assert fc["comparisons"]["optimal_vs_none"]["hours_saved_mean"] > 0
    cas = engine.cascade(snap, pack["tour"]["cascade_module"], 0.35, 300)
    assert cas["expected_affected"] > 0
    sp = engine.spike(snap, None, 40, 80, 17)
    assert sp["event"]["key"] == pack["spike"]["key"] and sp["event"]["preset"]
    assert sp["after"]["hours_lost"] < 0.6 * sp["before"]["hours_lost"]
    assert sp["plan"]["hours_used"] <= 40 and sp["saved_hours"]["mean"] >= sp["regular_plan"]["saved_hours"]["mean"] - 1


def test_pack_validation_lists_every_problem():
    pack = PK.get("tatkal")
    bad = PK.parse(PK.dump(pack))
    bad["modules"].append({"name": "Bad Module!"})
    bad["incidents"][0]["module"] = "nowhere"
    bad["incidents"][1]["fixed"] = 999
    bad["incidents"][2]["sev"] = "SEVERE"
    bad["debts"][0]["needs"] = ["DEBT-404"]
    bad["debts"][1]["incidents"] = ["INC-000"]
    bad["debts"][2]["playbook"] = "magic"
    bad["dependencies"].append(["gateway", "gateway"])
    bad["spike"]["entry"] = {"moon": 1}
    with pytest.raises(PK.PackError) as e:
        PK.validate(bad)
    text = "\n".join(e.value.problems)
    for needle in ("'name' must be", "INC-501: module 'nowhere'", "INC-502: 'fixed' (999 days ago) is before",
                   "'sev' must be one of", "needs unknown debt DEBT-404", "unknown incident INC-000",
                   "unknown playbook 'magic'", "cannot depend on itself", "unknown module 'moon'"):
        assert needle in text, needle
    assert len(e.value.problems) >= 9
    for raw, msg in ((b"{nope", "not valid JSON"), (b"[1, 2]", "a pack is a JSON object"),
                     (b"x" * (PK.MAX_BYTES + 1), "larger than"), ({"name": "x"}, "'name' must have at least 2")):
        with pytest.raises(PK.PackError) as e:
            PK.validate(raw)
        assert msg in str(e.value.problems)


def test_pack_situations_are_checked_and_share_how_users_come_in():
    raw = json.loads((PK.PACK_DIR / "grocery.json").read_text(encoding="utf-8"))
    sit = next(e for e in raw["events"] if e["key"] == "upi-outage")
    assert "entry" not in sit and "baseline" not in sit
    pack, _ = PK.validate(raw)
    got = next(e for e in pack["events"] if e["key"] == "upi-outage")
    assert got["entry"] == pack["spike"]["entry"] and got["kind"] == "outage"  # users come in the same way
    r = engine.spike(scenarios.materialize(pack), "upi-outage", 40, runs=60, seed=1)
    assert r["event"]["kind"] == "outage" and r["modules"][0]["baseline"] > 0  # utilisation comes from the main event
    sit["kind"] = "earthquake"
    sit["effects"] = [{"type": "melt", "module": "payments"},
                      {"type": "down", "module": "nowhere", "start": 3, "label": "x marks"},
                      {"type": "capacity", "module": "payments", "start": 30, "factor": 3, "label": "too much"},
                      {"type": "down", "module": "payments", "start": 2, "label": "Payments stop", "kind": "meteor",
                       "mitigated_by": ["DEBT-0000"]},
                      {"type": "down", "module": "payments", "start": 2}]
    with pytest.raises(PK.PackError) as e:
        PK.validate(raw)
    text = "\n".join(e.value.problems)
    for needle in ("'kind' must be one of", "must be a list of at most 4", ):
        assert needle in text, needle
    sit["effects"] = sit["effects"][:4]
    with pytest.raises(PK.PackError) as e:
        PK.validate(raw)
    text = "\n".join(e.value.problems)
    for needle in ("'type' must be 'down'", "'nowhere' is not listed in modules", "'start' must be",
                   "'factor' must be", "'kind' must be 'outage' or 'deploy'", "unknown debt DEBT-0000"):
        assert needle in text, needle


def test_minimal_pack_gets_defaults_and_a_custom_spike_profile():
    pack, warnings = PK.validate({
        "name": "Tiny Shop", "modules": ["web", "db"], "dependencies": [["web", "db"]],
        "incidents": [{"key": "inc-1", "title": "Checkout down", "module": "web", "ago": 10, "fixed": 9,
                       "whys": ["Checkout failed", "The database was saturated"]}],
        "debts": [{"key": "d-1", "title": "Index the orders table", "module": "db", "principal": 4,
                   "incidents": ["INC-1"]}],
        "spike": {"name": "Sale", "peak": 6, "start_hour": 20, "duration": 2, "entry": {"web": 1}},
        "tour": {"incident": "INC-9"}})
    assert pack["code"] == "tiny-shop" and pack["key"] == "TINY" and pack["incidents"][0]["key"] == "INC-1"
    assert max(pack["spike"]["profile"]) == 6 and pack["spike"]["profile"][20] == 6
    assert "tour" not in pack and any("tour" in w for w in warnings)
    snap = scenarios.materialize(pack)
    assert engine.spike(snap, None, 10, 40)["event"]["name"] == "Sale"


# ----------------------------------------------------------------------------- live replay and bot attacks


def _check_trace(tr, mods, entry):
    """A replay trace must agree with itself: states, events, minutes, totals."""
    n = len(mods)
    assert len(tr["states"]) == SPIKE.HOURS and all(len(s) == n for s in tr["states"])
    share = [entry.get(m, 0.0) for m in mods]
    total = sum(share) or 1.0
    for h, st in enumerate(tr["states"]):
        assert tr["failed_share"][h] == pytest.approx(min(1.0, sum(s for s, x in zip(share, st) if x) / total), abs=1e-3)
    incident_kinds, markers = set(SPIKE.INCIDENT_KINDS), {"situation", "situation_end", "prevented"}
    assert {e["kind"] for e in tr["events"]} <= incident_kinds | markers | {"recovered"}
    starts = [e for e in tr["events"] if e["kind"] in incident_kinds]
    assert tr["incidents"] == len(starts)
    assert tr["total_hours_lost"] == pytest.approx(sum(e["cost_hours"] for e in starts), abs=0.2)
    assert [e["minute"] for e in tr["events"]] == sorted(e["minute"] for e in tr["events"])
    for e in tr["events"]:
        h = e["hour"]
        assert h * 60 <= e["minute"] < h * 60 + 60
        if e["kind"] in markers:  # what happened to the system that day; not a change of any module's state
            assert e["label"]
            continue
        i = mods.index(e["module"])
        prev = tr["states"][h - 1][i] if h else 0
        if e["kind"] == "recovered":
            assert prev and not tr["states"][h][i]
        else:  # 1 = failed itself (overload, fault, outage, bad deploy), 2 = taken down by a dependency
            assert tr["states"][h][i] == (2 if e["kind"] == "cascade" else 1) and not prev
            assert tr["kinds"][h][i] == e["kind"]
        if e["kind"] == "cascade":
            src = next((x for x in tr["events"] if x["hour"] == h and x["module"] == e["from"] and x["kind"] != "recovered"), None)
            assert src is None or src["minute"] < e["minute"]
            assert tr["cause"][h][i] == e["from"]
    for h in range(SPIKE.HOURS):  # inside the hour, changes happen at their minute; by its end, the hour's state holds
        assert SPIKE.state_at(tr, mods, h * 60 + 59) == tr["states"][h]
        assert SPIKE.state_at(tr, mods, h * 60) == [p if any(e["module"] == m and e["hour"] == h and e["minute"] > h * 60
                                                              and e["kind"] in SPIKE.STATE_KINDS for e in tr["events"]) else s
                                                    for m, s, p in zip(mods, tr["states"][h],
                                                                       tr["states"][h - 1] if h else [0] * n)]


@pytest.mark.parametrize("code,event", [("tatkal", "tatkal-bots"), ("stream", None), ("fintech", None), ("broker", "credential-stuffing"),
                                        ("fintech", "acquirer-outage"), ("exam", "proctor-leak"), ("appointments", "zone-power"),
                                        ("airline", "payment-release")])
def test_replay_day_is_typical_and_consistent(code, event):
    snap = scenarios.materialize(code)
    r = engine.spike(snap, event, 40, runs=200, seed=17)
    rp = r["replay"]
    assert rp["modules"] == sorted(rp["modules"]) and 0 <= rp["run"] < r["runs"]
    for side in ("before", "after"):
        _check_trace(rp[side], rp["modules"], r["event"]["entry"])
    # the replayed day is a typical one, before and after the fixes
    for side, mean in (("before", r["before"]["hours_lost"]), ("after", r["after"]["hours_lost"])):
        assert abs(rp[side]["total_hours_lost"] - mean) <= max(12.0, 0.25 * mean), side
    again = engine.spike(snap, event, 40, runs=200, seed=17)["replay"]
    assert again == rp  # minutes and all: a rehearsal shows exactly what the demo will show
    assert r["journey"] and all(s["module"] in rp["modules"] for s in r["journey"]["steps"])


def test_bot_attacks_are_blocked_only_by_their_fix():
    snap = scenarios.materialize("tatkal")
    bots = engine.spike(snap, "tatkal-bots", 40, runs=150, seed=17)
    assert bots["event"]["kind"] == "bots" and bots["bots"]["mitigated_by"] == ["DEBT-508"]
    assert bots["bots"]["blocked_in_plan"] and "DEBT-508" in {x["key"] for x in bots["plan"]["selected"]}
    share, blocked = bots["bots"]["share"], bots["bots"]["blocked"]
    for p, q in zip(bots["profile"], bots["replay"]["profile_after"]):
        # bots adapt: a fifth of the blocked ones get through anyway
        assert q == pytest.approx(p if p <= 1 else 1 + (p - 1) * (1 - share * blocked * (1 - SPIKE.BOT_ADAPT)), abs=1e-3)
    assert bots["regular_plan"]["blocks_bots"] is False  # the sprint plan does not see the attack coming
    assert bots["saved_hours"]["mean"] > 3 * bots["regular_plan"]["saved_hours"]["mean"]
    none = engine.spike(snap, "tatkal-bots", 0, runs=60, seed=17)  # no time to fix anything: nothing is blocked
    assert not none["bots"]["blocked_in_plan"] and none["replay"]["profile_after"] == none["profile"]
    main = engine.spike(snap, None, 40, runs=60, seed=17)
    assert main["bots"] is None and main["event"]["kind"] == "traffic" and main["replay"]["profile_after"] == main["profile"]
    model = SPIKE.Model(["a"], [], {"a": 0.5}, {"a": 1.0}, {"a": 1.0}, {"a": 6.0}, {"a": "HIGH"}, [1.0, 11.0] + [1.0] * 22,
                        bots={"share": 0.5, "blocked": 0.8, "mitigated_by": {7}})
    fixed = model.for_fixed({7})
    assert fixed.profile[1] == pytest.approx(1 + 10 * (1 - 0.5 * 0.8 * 0.8)) and model.for_fixed({8}).profile[1] == 11.0
    assert fixed.edge[1] == pytest.approx(10 * 0.32 * SPIKE.REJECT_COST) and fixed.load("a", 1) > 0.5 * 7.8  # turning bots away costs a little
    for code in PK.codes():  # every pack has one bot attack, and the debt that stops it is open
        pack = PK.get(code)
        evs = [e for e in [pack["spike"], *pack.get("events", [])] if e.get("bots")]
        assert len(evs) == 1, code
        open_keys = {d["key"] for d in pack["debts"] if d.get("status", "IDENTIFIED") != "RESOLVED"}
        assert set(evs[0]["bots"]["mitigated_by"]) <= open_keys
        assert pack["journey"]["steps"] and pack["journey"]["app"]


# ----------------------------------------------------------------------------- situations

SYSTEMS = ["fintech", "healthtech", "ecommerce", "college", *PK.codes()]


@pytest.mark.parametrize("code", SYSTEMS)
def test_every_system_has_varied_situations_that_the_right_fix_softens(code):
    snap = scenarios.materialize(code)
    evs = scenarios.events(code)
    assert len(evs) >= 4 and len({SPIKE.kind_of(e) for e in evs[1:]}) >= 3  # the busy day and three kinds of trouble
    open_keys = {d["key"] for d in snap["debts"] if economics.is_open(d)}
    for e in evs[1:]:
        r = engine.spike(snap, e["key"], 40, runs=80, seed=17)
        b, a = r["before"], r["after"]
        assert 0 < a["hours_lost"] < b["hours_lost"], e["key"]  # better after the fixes, but never a perfect zero
        assert sum(v["hours"] for v in b["by_kind"].values()) == pytest.approx(b["hours_lost"], abs=0.6)
        guards = {k for x in r["effects"] for k in x["mitigated_by"]} | set((r["bots"] or {}).get("mitigated_by") or [])
        assert guards <= open_keys, e["key"]
        if guards:  # the situation-aware plan finds a fix that softens this very situation
            assert guards & {x["key"] for x in r["plan"]["selected"]}, e["key"]


def test_run_report_says_what_happened_why_and_what_to_do_next():
    snap = scenarios.materialize("fintech")
    res = engine.spike(snap, "acquirer-outage", 40, runs=120, seed=17)
    rep = engine.spike_report(snap, res, run_by="Asha")
    av, wd = rep["numbers"]["average"], rep["numbers"]["watched"]
    # the average and the watched day are kept apart, labelled, and match the result they came from
    assert av["label"] == "Average of 120 simulated days" and wd["label"].startswith("The day you watched (day ")
    assert av["before"]["hours_lost"] == res["before"]["hours_lost"] and av["after"]["hours_lost"] == res["after"]["hours_lost"]
    assert wd["before"]["hours_lost"] == res["replay"]["before"]["total_hours_lost"]
    # the timeline holds every incident of the watched day, in order, with when it recovered
    tl = rep["timeline"]["before"]
    inc = [r for r in tl if r["type"] == "incident"]
    assert len(inc) == res["replay"]["before"]["incidents"] and [r["minute"] for r in tl] == sorted(r["minute"] for r in tl)
    assert sum(r["cost_hours"] for r in inc) == pytest.approx(wd["before"]["hours_lost"], abs=0.3)
    assert all(r["end"] is None or r["end_minute"] > r["minute"] for r in inc)
    assert any(r["type"] == "situation" for r in tl) and rep["timeline"]["story_before"]
    # hours by kind add up, and the outage is what the fix shrinks
    assert sum(k["before_hours"] for k in rep["impact"]) == pytest.approx(av["before"]["hours_lost"], abs=0.6)
    out = next(k for k in rep["impact"] if k["kind"] == "outage")
    assert out["before_hours"] > 2 * out["after_hours"]
    eff = rep["situation_effects"][0]
    assert eff["guarded_by"] == ["DEBT-104"] and eff["guard_in_plan"] and eff["start"] == "18:40"
    assert "DEBT-104" in [x["key"] for x in rep["fixes"]["items"]] and rep["causes"][0]["module"] == "gateway"
    assert rep["recommendations"][0].startswith("To be ready for “Acquiring bank outage”")
    # every planned fix earns its place on the day, and "next" fixes are valued on top of the plan
    assert all(x["protects_hours"] >= SPIKE.MIN_GAIN or x["prerequisite_of"] for x in res["plan"]["selected"])
    assert all(x["gain_hours"] >= SPIKE.MIN_GAIN and x["extra_hours"] > 0 for x in res["plan"]["next"])
    text = REPORT.to_text(rep)
    for needle in ("WHAT HAPPENED ON THE DAY YOU WATCHED", "WHY IT FAILED", "WHAT TO DO NEXT", "DEBT-104", "18:40"):
        assert needle in text
    row = REPORT.summary_row(rep)
    assert row["situation"] == "Acquiring bank outage" and row["before_hours"] == av["before"]["hours_lost"]
    # numbers look the same in the report, the PDF, the terminal and the website (en-IN, half away from zero)
    assert [REPORT.fmt(x) for x in (58.0, 3.25, 0.05, 123456.75, 1234, -2.5)] == ["58", "3.3", "0.1", "1,23,456.8", "1,234", "-2.5"]
    assert REPORT.clock(664) == "11:04" and REPORT.hours(12.0) == "12 h"


def _toy(effects=(), profile=None):
    mods = ["a", "b"]
    eff = SPIKE.make_effects(list(effects), mods, {"DEBT-9": 9}, "outage")
    return SPIKE.Model(mods, [("a", "b")], {"a": 0.2, "b": 0.2}, {"a": 1.0, "b": 1.0}, {"a": 1.0}, {"a": 6.0, "b": 6.0},
                       {"a": "HIGH", "b": "HIGH"}, profile or [1.0] * SPIKE.HOURS, effects=eff)


def test_situation_effects_force_failures_and_the_guarding_fix_softens_them():
    down = {"type": "down", "module": "b", "start": 10, "hours": 2, "minute": 5, "chance": 1.0,
            "mitigated_by": ["DEBT-9", "DEBT-404"], "mitigation": 0.8, "label": "b's provider stops answering"}
    model = _toy([down])
    assert model.effects[0]["by_keys"] == ["DEBT-9"] and model.blockers() == {9}  # unknown debts are dropped
    caps, frag = SPIKE.capacities(model, [], {}, set())
    draws = SPIKE.Draws.make(100, 2, 1, 3, 1)
    sim = SPIKE._simulate(model, caps, frag, draws, 100)
    assert sim["down_hours"][1][10] == sim["down_hours"][1][11] == 100  # b is down both hours, every day
    assert sim["kind_count"]["outage"] >= 100 and sim["effect_hits"] == [100]
    fixed = model.for_fixed({9})
    assert fixed.effects[0]["mitigated"] and fixed.effects[0]["chance"] == pytest.approx(0.2)
    assert model.for_fixed({8}) is model  # a fix that does not guard against it changes nothing
    after = SPIKE._simulate(fixed, caps, frag, draws, 100)
    assert 5 <= after["effect_hits"][0] <= 40  # about one day in five it still happens
    assert after["kind_hours"]["outage"] < 0.5 * sim["kind_hours"]["outage"]
    # a capacity effect lowers what the module can carry; a ramp gets worse hour by hour (a leak)
    leak = _toy([{"type": "capacity", "module": "a", "start": 8, "hours": 4, "factor": 0.2, "ramp": True,
                  "mitigated_by": ["DEBT-9"], "mitigation": 0.6, "label": "a leaks memory"}])
    rho = SPIKE._rho(leak, [1.0, 1.0])[0]
    assert rho[7] == pytest.approx(0.2) and rho[8] < rho[9] < rho[10] < rho[11] and rho[11] == pytest.approx(1.0)
    assert rho[12] == pytest.approx(0.2)  # the situation is over
    softer = SPIKE._rho(leak.for_fixed({9}), [1.0, 1.0])[0]
    assert softer[11] == pytest.approx(0.2 / (1 - 0.8 * 0.4))  # the fix removes 60% of the loss, not all of it
    zone = _toy([{"type": "capacity", "module": "*", "start": 3, "hours": 1, "factor": 0.5, "label": "a zone is lost"}])
    assert [r[3] for r in SPIKE._rho(zone, [1.0, 1.0])] == [pytest.approx(0.4), pytest.approx(0.4)]


def test_background_faults_follow_each_modules_history_and_rise_under_load():
    snap = scenarios.materialize("fintech")
    mods = sorted(engine.module_stats(snap))
    rates = engine.fault_rates(snap, mods)
    counts = {m: sum(1 for i in snap["incidents"] if (i["module"] or "").lower() == m) for m in mods}
    busiest, quietest = max(mods, key=lambda m: counts[m]), min(mods, key=lambda m: counts[m])
    assert rates[busiest] > rates[quietest] > 0  # a module with no history still has a small chance
    assert rates[quietest] >= 0.25 / (SPIKE.FAULT_WINDOW_DAYS * SPIKE.HOURS)
    calm = engine.spike(snap, {"peak": 1, "start_hour": 12, "duration": 1}, 0, runs=200, seed=3)["before"]
    busy = engine.spike(snap, None, 0, runs=200, seed=3)["before"]
    assert 0 < calm["by_kind"]["fault"]["incidents"] < busy["by_kind"]["fault"]["incidents"]


def test_pack_validation_checks_bots_and_the_journey():
    p = PK.parse(PK.dump(PK.get("tatkal")))
    p["events"][0]["bots"]["mitigated_by"] = ["DEBT-999"]
    p["events"][0]["bots"]["share"] = 2
    p["journey"]["steps"][0]["module"] = "moon"
    with pytest.raises(PK.PackError) as e:
        PK.validate(p)
    text = "\n".join(e.value.problems)
    for needle in ("'share' must be between 0 and 1", "names unknown debt DEBT-999", "module 'moon' is not listed"):
        assert needle in text, needle
    q = PK.parse(PK.dump(PK.get("tatkal")))
    q["journey"]["color"] = "blue"
    pack, warnings = PK.validate(q)
    assert pack["journey"]["color"] is None and any("color" in w for w in warnings)
