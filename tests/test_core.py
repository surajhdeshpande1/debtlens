"""Engine tests: every algorithm is checked against a reference implementation
(scikit-learn, NetworkX, Radon, brute force) or against a hand-computed answer."""

import random
import subprocess
from pathlib import Path

import pytest

from debtlens.core import clustering, economics, engine, graph, ingest, mining, optimiser, playbooks, scenarios, simulation
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
    assert len(playbooks.LIBRARY) == len(playbooks.BY_KEY) == 24
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
    lost = [engine.spike(snap, {"peak": p, "start_hour": 12, "duration": 3}, 0, runs=80, seed=5)["before"]["hours_lost"]
            for p in (1, 4, 8)]
    assert lost[0] == 0 and lost[0] < lost[1] < lost[2]
    a = engine.spike(snap, None, 40, runs=60, seed=9)
    b = engine.spike(snap, None, 40, runs=60, seed=9)
    assert a["before"] == b["before"] and a["plan"]["selected"] == b["plan"]["selected"]
    assert a["event"]["key"] == "salary-day"
    with pytest.raises(ValueError):
        engine.spike(snap, "no-such-event")
    for code in ("healthtech", "ecommerce", "self"):  # every scenario has an event (self uses the custom default)
        r = engine.spike(scenarios.materialize(code), None, 40, runs=50, seed=1)
        assert r["plan"]["hours_used"] <= 40 and r["after"]["hours_lost"] <= r["before"]["hours_lost"]
