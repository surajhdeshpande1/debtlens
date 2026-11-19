"""Run the whole DebtLens analysis over a *project snapshot*.

A snapshot is a plain dict — built from MySQL by the API, from a bundled scenario,
or from ``debtlens export`` — so the website, the CLI and the tests all call exactly
the same functions:

    {
      "project":      {...},
      "now":          "2026-11-17T10:00:00",          # reference time (optional)
      "modules":      [{"name", "churn", "complexity", "loc", "files", ...}],
      "dependencies": [{"source": "checkout", "target": "payments"}],   # source depends on target
      "files":        [{"path", "module", "churn", "complexity", "loc", ...}],
      "satd":         [{"path", "line", "marker", "text", "module"}],
      "incidents":    [{"id", "key", "title", "description", "module", "severity", "status",
                        "reported_at", "resolved_at", "effort_hours", "embedding"?}],
      "causes":       [{"id", "label", "category", "embedding"?}],
      "cause_edges":  [{"source", "target", "weight"}],                 # symptom -> deeper cause
      "root_causes":  [{"incident_id", "level", "cause_id"}],           # 5 Whys answers
      "debts":        [{"id", "key", "title", "module", "category", "principal", "status",
                        "incident_ids", "prerequisite_ids", "root_cause_id", "created_at"}],
    }
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Callable

from . import clustering, economics, evaluation, graph, optimiser, playbooks, similarity, simulation
from . import spike as SPIKE
from . import text as T

EmbedFn = Callable[[list[str]], list[list[float]]]


def _dt(v) -> datetime | None:
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        return v.replace(tzinfo=None) if v.tzinfo is None else v.astimezone(timezone.utc).replace(tzinfo=None)
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d.astimezone(timezone.utc).replace(tzinfo=None) if d.tzinfo else d


def reference_now(snap: dict) -> datetime:
    return _dt(snap.get("now")) or datetime.now(timezone.utc).replace(tzinfo=None)


# ----------------------------------------------------------------------------- structure

def dependency_pairs(snap: dict) -> list[tuple[str, str]]:
    out = []
    for d in snap.get("dependencies") or []:
        s, t = (d["source"], d["target"]) if isinstance(d, dict) else (d[0], d[1])
        if s and t and s.lower() != t.lower():
            out.append((s.lower(), t.lower()))
    return out


def module_stats(snap: dict) -> dict[str, dict]:
    stats: dict[str, dict] = {}
    for m in snap.get("modules") or []:
        name = (m.get("name") or "").lower()
        if name:
            stats[name] = {"name": name, "churn": float(m.get("churn") or 0), "complexity": float(m.get("complexity") or 0),
                           "loc": int(m.get("loc") or 0), "files": int(m.get("files") or 0),
                           "path": m.get("path"), "description": m.get("description"), "id": m.get("id")}
    file_churn: dict[str, float] = defaultdict(float)
    file_cx: dict[str, float] = defaultdict(float)
    file_n: dict[str, int] = defaultdict(int)
    for f in snap.get("files") or []:
        mod = (f.get("module") or "").lower()
        file_churn[mod] = max(file_churn[mod], float(f.get("churn") or 0))
        file_cx[mod] += float(f.get("complexity") or 0)
        file_n[mod] += 1
    for mod in set(file_n) | {(x.get("module") or "").lower() for x in (snap.get("incidents") or []) + (snap.get("debts") or [])} \
            | {a for a, _ in dependency_pairs(snap)} | {b for _, b in dependency_pairs(snap)}:
        if not mod:
            continue
        s = stats.setdefault(mod, {"name": mod, "churn": 0.0, "complexity": 0.0, "loc": 0, "files": 0})
        if not s["churn"] and file_churn.get(mod):
            s["churn"] = file_churn[mod]
        if not s["complexity"] and file_cx.get(mod):
            s["complexity"] = file_cx[mod]
        if not s["files"] and file_n.get(mod):
            s["files"] = file_n[mod]
    blast = graph.blast_radius(stats.keys(), dependency_pairs(snap))
    for name, s in stats.items():
        s["blast_radius"] = blast.get(name, 0)
    sat = defaultdict(int)
    for x in snap.get("satd") or []:
        sat[(x.get("module") or "").lower()] += 1
    for name, s in stats.items():
        s["satd"] = sat.get(name, 0)
    return stats


def debt_file_churn(snap: dict) -> dict:
    """churn(d) for debts that point at a file (or a directory of files)."""
    files = snap.get("files") or []
    out = {}
    for d in snap.get("debts") or []:
        fp = (d.get("file_path") or "").strip().rstrip("/")
        if not fp:
            continue
        exact = [f for f in files if f.get("path") == fp]
        under = exact or [f for f in files if (f.get("path") or "").startswith(fp + "/")]
        if under:
            out[d["id"]] = max(float(f.get("churn") or 0) for f in under)
    return out


def causal_metrics(snap: dict) -> dict:
    nodes = [c["id"] for c in snap.get("causes") or []]
    edges = [(e["source"], e["target"]) for e in snap.get("cause_edges") or []]
    deg = graph.degree_centrality(nodes, edges) if nodes else {}
    btw = graph.betweenness_centrality(nodes, edges) if nodes else {}
    raw = graph.betweenness_centrality(nodes, edges, normalized=False) if nodes else {}
    inc_count: dict = defaultdict(set)
    for rc in snap.get("root_causes") or []:
        inc_count[rc["cause_id"]].add(rc["incident_id"])
    # incidents = how many incident chains converge on the node (in-reach); paths = raw betweenness
    return {n: {"degree": round(deg.get(n, 0.0), 4), "betweenness": round(btw.get(n, 0.0), 4),
                "paths": round(raw.get(n, 0.0), 2), "incidents": len(inc_count.get(n, ()))} for n in nodes}


def causal_graph(snap: dict) -> dict:
    metrics = causal_metrics(snap)
    weight = defaultdict(int)
    for e in snap.get("cause_edges") or []:
        weight[(e["source"], e["target"])] += int(e.get("weight") or 1)
    depth: dict = {}
    for rc in snap.get("root_causes") or []:
        depth[rc["cause_id"]] = max(depth.get(rc["cause_id"], 0), int(rc.get("level") or 1))
    nodes = []
    for c in snap.get("causes") or []:
        m = metrics.get(c["id"], {})
        nodes.append({"id": c["id"], "label": c["label"], "category": c.get("category") or "GENERAL",
                      "degree": m.get("degree", 0), "betweenness": m.get("betweenness", 0),
                      "paths": m.get("paths", 0), "incidents": m.get("incidents", 0), "depth": depth.get(c["id"], 1)})
    # systemic ranking: incident chains converging on the cause, then shortest paths through it
    # (raw betweenness), then degree; deeper causes win ties
    nodes.sort(key=lambda n: (-n["incidents"], -n["paths"], -n["degree"], -n["depth"]))
    return {"nodes": nodes, "edges": [{"source": s, "target": t, "weight": w} for (s, t), w in weight.items()]}


# ----------------------------------------------------------------------------- economics

def ledger(snap: dict, params: economics.EconomicParams | dict | None = None) -> dict:
    p = params if isinstance(params, economics.EconomicParams) else economics.EconomicParams.from_dict(params)
    stats = module_stats(snap)
    incs = {i["id"]: i for i in snap.get("incidents") or []}
    cent = {k: v["betweenness"] for k, v in causal_metrics(snap).items()}
    rows = economics.compute_ledger(
        snap.get("debts") or [], incs,
        {k: v["churn"] for k, v in stats.items()}, {k: v["blast_radius"] for k, v in stats.items()},
        cent, p, debt_file_churn(snap))
    now = reference_now(snap)
    created = {d["id"]: _dt(d.get("created_at")) for d in snap.get("debts") or []}
    for r in rows:
        c = created.get(r["id"])
        r["age_days"] = max(0, (now - c).days) if c else 0
    rows.sort(key=lambda r: (not r["is_open"], -r["risk"]))
    return {"rows": rows, "summary": economics.summarize(rows), "params": p.to_dict()}


def plan(snap: dict, budget: float, params=None, method: str = "auto", force=(), categories=None,
         compare: bool = True, led: dict | None = None) -> dict:
    led = led or ledger(snap, params)
    rows = led["rows"]
    by_id = {r["id"]: r for r in rows}
    items, blocked = optimiser.items_from_ledger(rows, categories)
    p = optimiser.solve(items, budget, method, force=force, blocked_prereqs=blocked)

    def card(i):
        r = by_id[i]
        return {k: r[k] for k in ("id", "key", "title", "module", "category", "principal", "interest", "risk",
                                  "break_even", "prerequisite_ids", "status")}

    out = p.to_dict()
    out["selected_items"] = [card(i) for i in p.selected]
    out["deferred_items"] = [{**card(i), "reason": p.deferred.get(i, "")} for i in by_id
                             if i not in set(p.selected) and by_id[i]["is_open"]]
    out["interest_retired"] = round(sum(by_id[i]["interest"] for i in p.selected), 1)
    if compare:
        out["comparison"] = optimiser.compare(items, budget, force=force, blocked_prereqs=blocked)
    return out


# ----------------------------------------------------------------------------- intelligence

def _incident_embeddings(snap: dict):
    return [i.get("embedding") for i in snap.get("incidents") or []]


def similarity_bundle(snap: dict, alpha: float = similarity.DEFAULT_ALPHA, embed_fn: EmbedFn | None = None):
    incs = snap.get("incidents") or []
    return similarity.build([similarity.incident_text(i) for i in incs], alpha, _incident_embeddings(snap), embed_fn)


def similar_incidents(snap: dict, incident_id, k: int = 5, threshold: float = 0.2,
                      alpha: float = similarity.DEFAULT_ALPHA, embed_fn: EmbedFn | None = None, bundle=None) -> dict:
    incs = snap.get("incidents") or []
    idx = next((n for n, i in enumerate(incs) if i["id"] == incident_id), None)
    if idx is None:
        raise KeyError(incident_id)
    b = bundle or similarity_bundle(snap, alpha, embed_fn)
    res = []
    for j, sc in similarity.top_similar(b, idx, k, threshold):
        o = incs[j]
        res.append({"id": o["id"], "key": o.get("key"), "title": o["title"], "module": o.get("module"),
                    "severity": o.get("severity"), "status": o.get("status"), **sc,
                    "same_module": (o.get("module") or "").lower() == (incs[idx].get("module") or "").lower(),
                    "shared_terms": T.shared_terms(b.texts[idx], b.texts[j], 8)})
    return {"incident_id": incident_id, "alpha": b.alpha, "semantic_method": b.semantic_method, "matches": res}


def regressions(snap: dict, tau: float = similarity.DEFAULT_TAU, alpha: float = similarity.DEFAULT_ALPHA,
                embed_fn: EmbedFn | None = None, bundle=None) -> dict:
    incs = snap.get("incidents") or []
    b = bundle or similarity_bundle(snap, alpha, embed_fn)
    return {"tau": tau, "alpha": b.alpha, "semantic_method": b.semantic_method,
            "regressions": similarity.detect_regressions(incs, b, tau)}


def cause_clusters(snap: dict, eps: float | None = None, min_samples: int = 2, embed_fn: EmbedFn | None = None) -> dict:
    causes = snap.get("causes") or []
    texts = [c["label"] for c in causes]
    if len(texts) < 2:
        return {"clusters": [], "semantic_method": None, "eps": eps}
    sim, method = similarity.semantic_matrix(texts, [c.get("embedding") for c in causes], embed_fn)
    eps = eps if eps is not None else (0.45 if method == similarity.SEMANTIC_MINILM else 0.62)
    cl = clustering.cluster_texts(texts, sim, eps, min_samples, ids=[c["id"] for c in causes])
    return {"clusters": cl, "semantic_method": method, "eps": eps, "min_samples": min_samples}


def converge_cause(label: str, causes: list[dict], embed_fn: EmbedFn | None = None,
                   threshold: float = 0.84) -> tuple[object | None, float, str]:
    """Find an existing cause node equivalent to a new 5-Whys answer (graph convergence)."""
    norm = T.normalize_cause(label)
    for c in causes:
        if T.normalize_cause(c["label"]) == norm:
            return c["id"], 1.0, "exact"
    if not causes:
        return None, 0.0, "none"
    if embed_fn is not None:
        try:
            vecs = [c.get("embedding") for c in causes]
            missing = [i for i, v in enumerate(vecs) if v is None]
            if missing:
                for i, v in zip(missing, embed_fn([causes[i]["label"] for i in missing])):
                    vecs[i] = v
            q = embed_fn([label])[0]
            from .tfidf import dense_cosine

            best = max(range(len(causes)), key=lambda i: dense_cosine(q, vecs[i]))
            score = dense_cosine(q, vecs[best])
            if score >= threshold:
                return causes[best]["id"], round(score, 4), "minilm"
            return None, round(score, 4), "minilm"
        except Exception:
            pass
    best = max(causes, key=lambda c: T.token_overlap(label, c["label"]))
    score = T.token_overlap(label, best["label"])
    return (best["id"], round(score, 4), "token-overlap") if score >= 0.8 else (None, round(score, 4), "token-overlap")


ALPHA_GRID = (0.2, 0.3, 0.4, 0.5, 0.6, 0.7)
TAU_GRID = (0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7)


def evaluate(snap: dict, labels: dict, embed_fn: EmbedFn | None = None,
             alpha: float = similarity.DEFAULT_ALPHA, tau: float = similarity.DEFAULT_TAU) -> dict:
    """Score retrieval, clustering and regression detection against labelled ground truth.

    Hybrid retrieval is shown over a grid of α that always contains the configured α, and regression detection is
    scored at the configured α, because that is the setting the application uses to raise regressions.
    """
    alpha, tau = round(float(alpha), 2), round(float(tau), 2)
    incs = snap.get("incidents") or []
    key_ix = {i.get("key"): n for n, i in enumerate(incs)}
    groups = [None] * len(incs)
    for g, keys in (labels.get("duplicate_groups") or {}).items():
        for k in keys:
            if k in key_ix:
                groups[key_ix[k]] = g
    texts = [similarity.incident_text(i) for i in incs]
    lex = similarity.lexical_matrix(texts)
    char = similarity.char_matrix(texts)
    sem, method = similarity.semantic_matrix(texts, _incident_embeddings(snap), embed_fn)
    rows = [{"method": "TF-IDF (lexical)", **evaluation.retrieval_metrics(lex, groups)},
            {"method": "Char n-gram TF-IDF", **evaluation.retrieval_metrics(char, groups)}]
    if method == similarity.SEMANTIC_MINILM:
        rows.append({"method": "MiniLM embeddings", **evaluation.retrieval_metrics(sem, groups)})
    def hybrid(a: float) -> list[list[float]]:
        return [[a * lex[i][j] + (1 - a) * sem[i][j] for j in range(len(incs))] for i in range(len(incs))]

    best = None
    for a in sorted({*ALPHA_GRID, alpha}):
        r = {"method": f"Hybrid α={a:g}", "alpha": a, "configured": abs(a - alpha) < 1e-9,
             **evaluation.retrieval_metrics(hybrid(a), groups)}
        rows.append(r)
        if best is None or (r["mrr"] or 0) > (best["mrr"] or 0):
            best = r
    # clustering: deepest 5-Whys answer of each labelled incident
    deepest: dict = {}
    for rc in snap.get("root_causes") or []:
        if rc["incident_id"] not in deepest or rc["level"] > deepest[rc["incident_id"]][0]:
            deepest[rc["incident_id"]] = (rc["level"], rc["cause_id"])
    label_of = {c["id"]: c["label"] for c in snap.get("causes") or []}
    pts = [(n, label_of.get(deepest[i["id"]][1])) for n, i in enumerate(incs) if i["id"] in deepest and groups[n]]
    clustering_res = None
    if len(pts) >= 4:
        ctexts = [t for _, t in pts]
        csim, cmethod = similarity.semantic_matrix(ctexts, None, embed_fn)
        eps = 0.45 if cmethod == similarity.SEMANTIC_MINILM else 0.62
        pred = clustering.dbscan(clustering.similarity_to_distance(csim), eps, 2)
        truth = [groups[n] for n, _ in pts]
        clustering_res = {"points": len(pts), "method": cmethod, "eps": eps,
                          "clusters": len({p for p in pred if p != -1}), "noise": sum(1 for p in pred if p == -1),
                          "purity": evaluation.purity(pred, truth), "ari": evaluation.adjusted_rand_index(pred, truth)}
    # regressions
    truth_pairs = {tuple(p) for p in labels.get("regressions") or []}
    reg_rows = []
    if truth_pairs:
        b = similarity.SimilarityBundle(texts, lex, sem, hybrid(alpha), alpha, method)
        for t in sorted({*TAU_GRID, tau}):
            pred = {(r["incident_key"], r["regressed_from_key"]) for r in similarity.detect_regressions(incs, b, t)}
            reg_rows.append({"tau": t, "configured": abs(t - tau) < 1e-9,
                             **evaluation.regression_scores(pred, truth_pairs)})
    return {"semantic_method": method, "retrieval": rows, "best_alpha": best["alpha"] if best else None,
            "configured": {"alpha": alpha, "tau": tau}, "clustering": clustering_res, "regression": reg_rows,
            "regression_alpha": alpha,
            "labelled": {"duplicate_queries": rows[0]["queries"], "regression_pairs": len(truth_pairs)}}


# ----------------------------------------------------------------------------- simulations

def whatif(snap: dict, overrides: dict | None, budgets: list[float], base_params=None) -> dict:
    base = ledger(snap, base_params)
    merged = {**(base["params"] or {}), **{k: v for k, v in (overrides or {}).items() if v is not None}}
    alt = ledger(snap, merged)
    b_by = {r["id"]: r for r in base["rows"] if r["is_open"]}
    a_by = {r["id"]: r for r in alt["rows"] if r["is_open"]}
    b_rank = {r["id"]: n for n, r in enumerate(sorted(b_by.values(), key=lambda r: -r["risk"]), 1)}
    a_rank = {r["id"]: n for n, r in enumerate(sorted(a_by.values(), key=lambda r: -r["risk"]), 1)}
    changes = []
    for i, a in a_by.items():
        b = b_by[i]
        changes.append({"id": i, "key": a["key"], "title": a["title"], "module": a["module"],
                        "interest_before": b["interest"], "interest_after": a["interest"],
                        "risk_before": b["risk"], "risk_after": a["risk"],
                        "rank_before": b_rank[i], "rank_after": a_rank[i],
                        "break_even_before": b["break_even"], "break_even_after": a["break_even"]})
    changes.sort(key=lambda c: c["rank_after"])
    curve = []
    for B in sorted(set(float(x) for x in budgets)):
        pb = plan(snap, B, compare=False, led=base)
        pa = plan(snap, B, compare=False, led=alt)
        curve.append({"budget": B, "value_before": pb["total_value"], "value_after": pa["total_value"],
                      "items_before": len(pb["selected"]), "items_after": len(pa["selected"]),
                      "interest_retired_before": pb["interest_retired"], "interest_retired_after": pa["interest_retired"],
                      "selected_after": [x["key"] for x in pa["selected_items"]]})
    for k in range(1, len(curve)):
        db = curve[k]["budget"] - curve[k - 1]["budget"]
        curve[k]["marginal_value_per_hour"] = round((curve[k]["value_after"] - curve[k - 1]["value_after"]) / db, 2) if db else 0
    return {"params_before": base["params"], "params_after": alt["params"], "summary_before": base["summary"],
            "summary_after": alt["summary"], "changes": changes, "budget_curve": curve,
            "flips": [c["key"] for c in changes if c["break_even_before"] != c["break_even_after"]]}


def forecast(snap: dict, cfg: dict | None = None, params=None) -> dict:
    c = simulation.ForecastConfig.from_dict(cfg)
    led = ledger(snap, params)
    stats = module_stats(snap)
    incs = {i["id"]: i for i in snap.get("incidents") or []}
    ages = {r["id"]: r["age_days"] for r in led["rows"]}
    debts = simulation.build_forecast_inputs(led["rows"], incs, stats, ages, c.sprint_days)
    res = simulation.forecast(debts, c, led["params"]["severity_weight"])
    res["open_debts_at_start"] = len(debts)
    return res


def cascade(snap: dict, module: str, p: float = 0.35, runs: int = 2000, seed: int = 11) -> dict:
    stats = module_stats(snap)
    led = ledger(snap)
    risk = defaultdict(float)
    for r in led["rows"]:
        if r["is_open"]:
            risk[r["module"]] += r["risk"]
    mx = max(risk.values(), default=0) or 1.0
    fragility = {m: 0.5 + 0.5 * risk.get(m, 0.0) / mx for m in stats}
    cost: dict = defaultdict(list)
    for i in snap.get("incidents") or []:
        w = economics.SEVERITY_WEIGHT.get((i.get("severity") or "MEDIUM").upper(), 1.5)
        cost[(i.get("module") or "").lower()].append(w * float(i.get("effort_hours") or 4))
    avg = {m: sum(v) / len(v) for m, v in cost.items() if v}
    res = simulation.cascade(list(stats), dependency_pairs(snap), fragility, module, p, runs, seed, avg)
    res["debts_in_path"] = [{"key": r["key"], "title": r["title"], "module": r["module"], "risk": r["risk"]}
                            for r in led["rows"] if r["is_open"] and (r["module"] == res["start"] or r["module"] in
                                                                       {m["module"] for m in res["modules"] if m["probability"] >= 0.25})]
    return res


# ----------------------------------------------------------------------------- playbooks and load spikes

def playbook_assignment(snap: dict, overrides: dict | None = None, chosen: dict | None = None) -> tuple[dict, dict]:
    """(library, assignment): the playbook for every debt item, with project edits and explicit choices applied."""
    lib = playbooks.library(overrides)
    causes = {c["id"]: c["label"] for c in snap.get("causes") or []}
    return lib, playbooks.assign(snap.get("debts") or [], causes, lib, chosen)


def debt_playbook(snap: dict, debt_id, overrides: dict | None = None, chosen: dict | None = None) -> dict:
    """The fix playbook for one debt item, made specific to its module, root cause and incidents."""
    lib, assignment = playbook_assignment(snap, overrides, chosen)
    debt = next((d for d in snap.get("debts") or [] if d["id"] == debt_id or d.get("key") == debt_id), None)
    if debt is None:
        raise KeyError(debt_id)
    a = assignment[debt["id"]]
    pb = lib.get(a["key"]) or playbooks.BY_KEY[playbooks.FALLBACK]
    causes = {c["id"]: c["label"] for c in snap.get("causes") or []}
    incs = {i["id"]: i for i in snap.get("incidents") or []}
    out = playbooks.for_debt(debt, pb, [incs.get(i) for i in debt.get("incident_ids") or []],
                             causes.get(debt.get("root_cause_id")))
    out["match"] = a
    return out


def spike(snap: dict, event: str | dict | None = None, budget: float = 40.0, runs: int = 300, seed: int = 17,
          params=None, overrides: dict | None = None, chosen: dict | None = None) -> dict:
    """Load-spike simulation for a snapshot: before, the spike-aware fix plan, after, and the regular plan."""
    stats = module_stats(snap)
    mods = sorted(stats)
    deps = [(a, b) for a, b in dependency_pairs(snap) if a in stats and b in stats]
    proj = snap.get("project") or {}
    presets = [p for p in (proj.get("events") or []) if isinstance(p, dict)]
    if not presets:
        main = proj.get("spike") if isinstance(proj.get("spike"), dict) else SPIKE.PRESETS.get(proj.get("scenario") or "")
        presets = [main] if main else []
    preset = presets[0] if presets else None
    if isinstance(event, str) and event not in ("", "preset", "custom"):
        preset = next((p for p in presets if p["key"] == event), None)
        if preset is None:
            raise ValueError(f"unknown spike event {event!r}")
    if isinstance(event, dict):
        profile = SPIKE.custom_profile(event.get("peak", 5), event.get("start_hour", 20), event.get("duration", 2),
                                       event.get("ramp", 1), event.get("base", 1.0))
        start = int(event.get("start_hour", 20)) % 24
        hours = max(1, min(24, int(event.get("duration", 2))))
        cut = start + hours > 24
        ev = {"key": "custom", "name": event.get("name") or "Custom spike", "preset": False,
              "description": f"{max(profile):g}× traffic from {start:02d}:00 for {min(hours, 24 - start)} h"
                             + (f" (cut at midnight: the simulation covers one day, so {start + hours - 24} h "
                                f"{'falls' if start + hours - 24 == 1 else 'fall'} outside it)" if cut else "")}
    elif preset and event in (None, "", preset["key"], "preset"):
        profile = list(preset["profile"])
        ev = {"key": preset["key"], "name": preset["name"], "description": preset["description"], "preset": True,
              "kind": "bots" if preset.get("bots") else "traffic"}
    elif event in (None, "", "preset", "custom"):
        profile = SPIKE.custom_profile(5, 20, 2)
        ev = {"key": "custom", "name": "Custom spike", "preset": False, "description": "5× traffic from 20:00 for 2 h"}
    else:
        raise ValueError(f"unknown spike event {event!r}")
    entry = dict(preset["entry"]) if preset else SPIKE.default_entry(mods, deps)
    entry = {m: w for m, w in entry.items() if m in stats}
    # Utilisation at a normal peak hour belongs to the system, not the event: an event without its own baseline
    # (a bot attack, say) uses the main event's.
    base_src = (preset or {}).get("baseline") or (presets[0].get("baseline") if presets else None) or {}
    baseline = {m: float(base_src.get(m, SPIKE.DEFAULT_BASELINE)) for m in mods}
    expo = SPIKE.exposure(mods, deps, entry, (preset or {}).get("exposure"))
    efforts: dict = defaultdict(list)
    for i in snap.get("incidents") or []:
        efforts[(i.get("module") or "").lower()].append(float(i.get("effort_hours") or 4))
    severity, cost = {}, {}
    for m in mods:
        sev = "CRITICAL" if entry.get(m, 0) >= 0.8 else "HIGH" if expo[m] >= 0.5 else "MEDIUM"
        severity[m] = sev
        eff = efforts.get(m) or [4.0]
        cost[m] = round(SPIKE.SEVERITY_WEIGHT[sev] * sum(eff) / len(eff), 2)
    lib, assignment = playbook_assignment(snap, overrides, chosen)
    debts = [{**d, "module": (d.get("module") or "").lower()} for d in snap.get("debts") or []]
    factors = playbooks.load_factors(debts, assignment, lib)
    open_debts = [d for d in debts if economics.is_open(d)]
    reg = plan(snap, budget, params, compare=False)
    bots = None
    if isinstance(event, (str, type(None))) and preset and preset.get("bots") and ev.get("preset"):
        keys = {d["key"]: d["id"] for d in open_debts}
        b = preset["bots"]
        bots = {"share": float(b.get("share", 0.8)), "blocked": float(b.get("blocked", 0.9)),
                "mitigated_by": {keys[k] for k in b.get("mitigated_by") or () if k in keys}}
    model = SPIKE.Model(mods, deps, baseline, expo, entry, cost, severity, profile, bots=bots)
    res = SPIKE.simulate(model, open_debts, factors, budget, runs, seed, regular_plan=list(reg["selected"]),
                         playbook_of={d["id"]: assignment[d["id"]]["key"] for d in debts})
    res["event"] = ev | {"peak": max(profile), "entry": entry}
    res["playbook_titles"] = {k: v.title for k, v in lib.items()}
    res["journey"] = proj.get("journey")
    return res


# ----------------------------------------------------------------------------- dashboard

def dashboard(snap: dict, params=None, bundle=None, embed_fn: EmbedFn | None = None) -> dict:
    incs = snap.get("incidents") or []
    led = ledger(snap, params)
    stats = module_stats(snap)
    cg = causal_graph(snap)
    reg = regressions(snap, bundle=bundle, embed_fn=embed_fn) if incs else {"regressions": []}
    by_sev = defaultdict(int)
    by_status = defaultdict(int)
    for i in incs:
        by_sev[(i.get("severity") or "MEDIUM").upper()] += 1
        by_status[(i.get("status") or "OPEN").upper()] += 1
    mods = sorted(stats.values(), key=lambda m: -led["summary"]["by_module"].get(m["name"], {}).get("interest", 0))
    now = reference_now(snap)
    monthly = defaultdict(lambda: {"reported": 0, "resolved": 0})
    for i in incs:
        r = _dt(i.get("reported_at"))
        if r and (now - r).days <= 180:
            monthly[r.strftime("%Y-%m")]["reported"] += 1
        s = _dt(i.get("resolved_at"))
        if s and (now - s).days <= 180:
            monthly[s.strftime("%Y-%m")]["resolved"] += 1
    mttr = [(_dt(i["resolved_at"]) - _dt(i["reported_at"])).total_seconds() / 3600 for i in incs
            if i.get("resolved_at") and i.get("reported_at") and _dt(i["resolved_at"]) and _dt(i["reported_at"])]
    return {
        "incidents": {"total": len(incs), "open": by_status["OPEN"], "investigating": by_status["INVESTIGATING"],
                      "resolved": by_status["RESOLVED"], "by_severity": dict(by_sev),
                      "mttr_hours": round(sum(mttr) / len(mttr), 1) if mttr else None},
        "ledger": led["summary"],
        "top_debts": [{k: r[k] for k in ("id", "key", "title", "module", "principal", "interest", "risk", "break_even")}
                      for r in led["rows"] if r["is_open"]][:6],
        "modules": [{**m, "interest": led["summary"]["by_module"].get(m["name"], {}).get("interest", 0)} for m in mods][:8],
        "top_causes": cg["nodes"][:5],
        "regressions": reg["regressions"][:5],
        "regression_count": len(reg["regressions"]),
        "satd_count": len(snap.get("satd") or []),
        "hotspots": sorted(snap.get("files") or [], key=lambda f: -float(f.get("hotspot_score") or 0))[:6],
        "trend": [{"month": k, **v} for k, v in sorted(monthly.items())],
    }
