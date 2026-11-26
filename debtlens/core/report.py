"""The report at the end of a simulation run: what happened on the day, why, what the fixes change, what to do next.

``build`` turns a load-spike / situation result (``engine.spike``) into one structured report. The website renders it,
the API stores it with the run and turns it into a PDF, and the terminal prints it with ``to_text``. Every sentence and
number in it comes from the simulation result, so the three always agree, and every number says which of the two
views it belongs to:

* the **average** over all simulated days (the expected outcome), and
* **the day you watched**: the one simulated day the live replay plays, chosen because it is close to the average.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

FORMAT = "debtlens-run-report/1"

INCIDENT_LABEL = {"overload": "Overload", "cascade": "Knock-on failure", "outage": "Outage", "deploy": "Bad release",
                  "fault": "Random fault"}
SITUATION_LABEL = {"traffic": "Rush of real users", "bots": "Bot attack", "outage": "Provider outage",
                   "deploy": "Bad release", "database": "Database trouble", "cache": "Cache stampede",
                   "leak": "Memory leak", "zone": "Data-centre zone lost", "retry": "Retry storm"}
KIND_SHORT = {"traffic": "Rush", "bots": "Bots", "outage": "Outage", "deploy": "Bad release", "database": "Database",
              "cache": "Cache", "leak": "Memory leak", "zone": "Zone lost", "retry": "Retry storm"}  # as on the website
KIND_ORDER = ("overload", "cascade", "outage", "deploy", "fault")


# ----------------------------------------------------------------------------- formatting (shared with to_text)

def fmt(v, d: int = 1) -> str:
    """A number the way the website shows it: at most ``d`` decimals, no trailing zeros, Indian digit grouping."""
    if v is None:
        return "–"
    # round half away from zero on the shortest decimal form, as the browser's toLocaleString does
    q = Decimal(repr(float(v))).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)
    neg, q = q < 0, abs(q)
    whole, _, frac = f"{q:.{d}f}".partition(".")
    frac = frac.rstrip("0")
    if len(whole) > 3:  # 1,23,456
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        whole = ",".join([head, *groups, tail]) if head else ",".join([*groups, tail])
    return ("-" if neg else "") + whole + ("." + frac if frac else "")


def hours(v) -> str:
    return f"{fmt(v)} h"


def pct(v, d: int = 1) -> str:
    return f"{fmt(v, d)}%"


def clock(minute) -> str:
    m = max(0, min(1439, int(minute)))
    return f"{m // 60:02d}:{m % 60:02d}"


def hour(h) -> str:
    return f"{int(h) % 24:02d}:00"


def _plural(k, word: str, many: str | None = None) -> str:
    return f"{fmt(k, 0)} {word if k == 1 else (many or word + 's')}"


def _join(items: list[str]) -> str:
    items = [x for x in items if x]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _less(before: float, after: float) -> float:
    return 0.0 if before <= 0 else max(0.0, 100.0 * (before - after) / before)


# ----------------------------------------------------------------------------- the day you watched

def _effect_at(effects: list[dict], module: str, h: int, typ: str | None = None) -> dict | None:
    for e in effects or []:
        if typ and e.get("type") != typ:
            continue
        if e.get("module") in (module, "*") and e["start"] <= h < e["start"] + e["hours"]:
            return e
    return None


def _timeline(trace: dict, effects: list[dict]) -> list[dict]:
    """One row per incident (with when it recovered) and per situation marker, in time order."""
    evs = trace.get("events") or []
    rows = []
    for k, e in enumerate(evs):
        kind = e["kind"]
        if kind in INCIDENT_LABEL:
            end = next((x["minute"] for x in evs[k + 1:] if x["kind"] == "recovered" and x["module"] == e["module"]), None)
            m = e["module"]
            if kind == "overload":
                u = round(100 * float(e.get("utilisation") or 0))
                text = (f"{m} overloaded: {u}% of what it can carry." if u >= 100
                        else f"{m} went down at {u}% load, too close to its limit.")
            elif kind == "cascade":
                text = f"{m} failed because {e.get('from') or 'a module it depends on'}, which it depends on, was down."
            elif kind in ("outage", "deploy"):
                eff = _effect_at(effects, m, e["hour"], "down")
                why = eff["label"] if eff else ("a bad release" if kind == "deploy" else "a dependency stopped answering")
                text = f"{m} stopped working: {why[0].lower() + why[1:] if why else why}."
            else:
                text = f"{m} failed on its own (a random fault: a crashed process, a bad node or a full disk)."
            rows.append({"type": "incident", "kind": kind, "kind_label": INCIDENT_LABEL[kind], "module": m,
                         "minute": e["minute"], "start": clock(e["minute"]),
                         "end_minute": end, "end": clock(end) if end is not None else None,
                         "duration_min": (end - e["minute"]) if end is not None else None,
                         "severity": e.get("severity") or "MEDIUM", "cost_hours": float(e.get("cost_hours") or 0),
                         "from": e.get("from"), "text": text})
        elif kind == "situation":
            if e.get("effect") == "capacity":
                left = round(100 * float(e.get("factor") or 0))
                target = "every module" if e["module"] == "*" else e["module"]
                text = f"{e['label']} ({target} keeps {left}% of its capacity for {_plural(e.get('hours', 1), 'hour')}"
                text += ", softened by a fix)." if e.get("mitigated") else ")."
            else:
                text = e["label"] + (" (it still happened, despite the fix that usually prevents it)."
                                     if e.get("mitigated") else ".")
            rows.append({"type": "situation", "kind": "situation", "kind_label": "Situation", "module": e["module"],
                         "minute": e["minute"], "start": clock(e["minute"]), "text": text,
                         "mitigated": bool(e.get("mitigated"))})
        elif kind in ("situation_end", "prevented"):
            rows.append({"type": kind, "kind": kind, "kind_label": "Over" if kind == "situation_end" else "Prevented",
                         "module": e["module"], "minute": e["minute"], "start": clock(e["minute"]),
                         "text": e["label"].rstrip(".") + "."})
    rows.sort(key=lambda r: (r["minute"], 0 if r["type"] != "incident" else 1))
    return rows


def _story(rows: list[dict], trace: dict) -> str:
    """The watched day in two or three sentences."""
    inc = [r for r in rows if r["type"] == "incident"]
    if not inc:
        return "Nothing failed all day."
    first = inc[0]
    knock = [r for r in inc if r["kind"] == "cascade"]
    own = [r for r in inc if r["kind"] != "cascade"]
    parts = [f"{_plural(len(inc), 'incident')}, {hours(trace.get('total_hours_lost', 0))} of engineering time to "
             f"handle {'it' if len(inc) == 1 else 'them'}, and {pct(trace.get('failed_traffic_pct', 0))} of the day's "
             f"requests failed."]
    lead = f"The first: {first['start']}, {first['text'][0].lower() + first['text'][1:]}"
    parts.append(lead if lead.endswith(".") else lead + ".")
    if knock and own:
        mods = sorted({r["module"] for r in knock})
        parts.append(f"{_plural(len(knock), 'knock-on failure')} followed ({_join(mods[:4])}"
                     f"{' and more' if len(mods) > 4 else ''}).")
    still = [r for r in inc if r["end"] is None]
    if still:
        parts.append(f"{_join(sorted({r['module'] for r in still})[:3])} had not recovered by the end of the day.")
    else:
        last = max(inc, key=lambda r: r["end_minute"] or 0)
        parts.append(f"Everything was back by {last['end']}.")
    return " ".join(parts)


# ----------------------------------------------------------------------------- the report

def build(res: dict, system: dict | None = None, *, deps: list | None = None, run_by: str | None = None,
          generated_at: str | None = None) -> dict:
    """The full run report for one ``engine.spike`` result."""
    system = dict(system or {})
    ev = res["event"]
    kind = ev.get("kind") or ("bots" if res.get("bots") else "traffic")
    b, a = res["before"], res["after"]
    plan, reg, rp = res["plan"], res.get("regular_plan"), res["replay"]
    runs, budget = res["runs"], res["budget"]
    effects = res.get("effects") or []
    bots = res.get("bots")
    titles = res.get("playbook_titles") or {}
    debts = {d["key"]: d for d in res.get("debts") or []}
    sel = plan["selected"]
    sel_keys = [x["key"] for x in sel]
    name = system.get("name") or "The system"
    saved = res["saved_hours"]
    less = _less(b["hours_lost"], a["hours_lost"])
    day_no = rp["run"] + 1

    # ---- headline and summary
    if b["hours_lost"] < 1 and b["incidents"] < 0.2:
        headline = (f"{name} holds up on this day: on average under an engineer-hour is lost and "
                    f"{pct(b['failed_traffic_pct'])} of requests fail.")
    elif sel:
        headline = (f"{ev['name']}: {name} loses about {hours(b['hours_lost'])} of engineering time on an average day "
                    f"and {pct(b['failed_traffic_pct'])} of requests fail. Fixing {_plural(len(sel), 'debt item')} "
                    f"first ({hours(plan['hours_used'])} of the {hours(budget)} budget) cuts that to "
                    f"{hours(a['hours_lost'])} and {pct(a['failed_traffic_pct'])}: {fmt(less, 0)}% less time lost.")
    else:
        headline = (f"{ev['name']}: {name} loses about {hours(b['hours_lost'])} of engineering time on an average day, "
                    f"and no fix that fits in {hours(budget)} changes that.")
    summary = []
    sit = SITUATION_LABEL.get(kind, kind)
    when = hour(ev.get("peak_hour", 0))
    summary.append(f"The situation: {sit.lower()}. {ev.get('description') or ''}".strip())
    if ev.get("peak", 1) > 1.05:
        summary.append(f"Traffic peaks at {fmt(ev['peak'])}× a normal busy hour, at {when}.")
    summary.append(f"Before the fixes: {fmt(b['incidents'])} incidents on an average day ({fmt(b['incidents_p90'], 0)} "
                   f"on a bad one), {hours(b['hours_lost'])} lost, and a {fmt(100 * b['p_no_incident'], 0)}% chance "
                   f"of a day with no incident at all.")
    if sel:
        summary.append(f"After the fixes: {fmt(a['incidents'])} incidents, {hours(a['hours_lost'])} lost, "
                       f"{fmt(100 * a['p_no_incident'], 0)}% chance of a clean day. The fixes save "
                       f"{hours(saved['mean'])} a day (95% confidence {fmt(saved['ci95'][0])}–{fmt(saved['ci95'][1])} h) "
                       f"and make {saved['better_runs']} of the {saved['runs']} simulated days better"
                       + (f", {saved['worse_runs']} worse" if saved.get("worse_runs") else "") + ".")
    left = sum(v["hours"] for v in a["by_kind"].values()) or 0.0
    if sel and a["hours_lost"] > 0:
        fault = a["by_kind"].get("fault", {}).get("hours", 0.0)
        if left and fault / left >= 0.5:
            summary.append(f"Most of what is left ({hours(fault)}) is random faults, which happen on any day "
                           f"and which none of these fixes prevents.")
    summary.append(f"The live replay shows day {day_no} of {runs}, picked because it is close to the average: "
                   f"{hours(rp['before']['total_hours_lost'])} lost before the fixes, "
                   f"{hours(rp['after']['total_hours_lost'])} after.")

    # ---- the numbers, both views, clearly labelled
    def side(s: dict) -> dict:
        return {"incidents": s["incidents"], "incidents_p90": s["incidents_p90"], "hours_lost": s["hours_lost"],
                "hours_lost_p10": s["hours_lost_p10"], "hours_lost_p90": s["hours_lost_p90"],
                "failed_traffic_pct": s["failed_traffic_pct"], "p_no_incident": s["p_no_incident"],
                "p_any_user_outage": s["p_any_user_outage"]}

    def watched(t: dict) -> dict:
        return {"incidents": t["incidents"], "hours_lost": t["total_hours_lost"],
                "failed_traffic_pct": t["failed_traffic_pct"]}

    numbers = {
        "average": {"label": f"Average of {runs} simulated days", "before": side(b), "after": side(a)},
        "watched": {"label": f"The day you watched (day {day_no} of {runs})", "day": day_no,
                    "turnout": rp.get("turnout"), "before": watched(rp["before"]), "after": watched(rp["after"])},
        "saved": {"mean": saved["mean"], "ci95": saved["ci95"], "better_runs": saved["better_runs"],
                  "worse_runs": saved.get("worse_runs", 0), "runs": saved["runs"], "less_pct": round(less, 1)},
    }

    # ---- timeline of the watched day
    tl_before, tl_after = _timeline(rp["before"], effects), _timeline(rp["after"], effects)
    timeline = {"day": day_no, "before": tl_before, "after": tl_after,
                "story_before": _story(tl_before, rp["before"]), "story_after": _story(tl_after, rp["after"])}

    # ---- impact by kind (averages)
    impact = [{"kind": k, "label": INCIDENT_LABEL[k], "before_hours": b["by_kind"][k]["hours"],
               "after_hours": a["by_kind"][k]["hours"], "before_incidents": b["by_kind"][k]["incidents"],
               "after_incidents": a["by_kind"][k]["incidents"]}
              for k in KIND_ORDER if k in b["by_kind"]]

    # ---- why: the modules that failed and the debt behind them
    callers_of: dict[str, list[str]] = {}
    for caller, callee in deps or []:
        callers_of.setdefault(callee, []).append(caller)
    depends_on: dict[str, list[str]] = {}
    for caller, callee in deps or []:
        depends_on.setdefault(caller, []).append(callee)
    watched_kinds: dict[str, set] = {}
    for r in tl_before:
        if r["type"] == "incident":
            watched_kinds.setdefault(r["module"], set()).add(r["kind"])
    causes = []
    mods = sorted(res.get("modules") or [], key=lambda m: (-m["p_incident_before"], m["module"]))
    by_mod = {m["module"]: m for m in mods}
    for m in mods:
        if m["p_incident_before"] < 0.05 and m["module"] not in watched_kinds:
            continue
        mod = m["module"]
        seen = watched_kinds.get(mod, set())
        own = [d for d in debts.values() if d["module"] == mod and (d["capacity_effect"] or d["resilience_effect"])]
        reasons = []
        peak = m["peak_utilisation_before"]
        loaded = m.get("first_overload_hour") is not None or peak >= 0.85 or "overload" in seen
        if m.get("first_overload_hour") is not None:
            reasons.append(f"Overloads from {hour(m['first_overload_hour'])}: its busiest hour needs "
                           f"{fmt(100 * peak, 0)}% of what it can carry.")
        elif peak >= 0.85:
            reasons.append(f"Runs close to its limit: {fmt(100 * peak, 0)}% at the busiest hour.")
        cap_debts = [d for d in own if d["capacity_effect"]]
        if loaded and cap_debts and m["capacity_before"] < 0.999:
            reasons.append(f"Open debt leaves it {fmt(100 * m['capacity_before'], 0)}% of its capacity ("
                           + ", ".join(f"{d['key']} −{fmt(100 * d['capacity_effect'], 0)}%" for d in cap_debts) + ").")
        ups = sorted(depends_on.get(mod) or [])
        failing_ups = [u for u in ups if by_mod.get(u, {}).get("p_incident_before", 0) >= 0.1] or ups
        if ups and ("cascade" in seen or not loaded):
            frag = [d for d in own if d["resilience_effect"]]
            reasons.append(f"Goes down when something it depends on fails ({_join(failing_ups[:4])})"
                           + (f"; open debt makes that more likely ({', '.join(d['key'] for d in frag)})." if frag else "."))
        for e in effects:
            if e["module"] in (mod, "*"):
                reasons.append(f"The situation: {e['label'][0].lower() + e['label'][1:]} "
                               f"({clock(60 * e['start'] + int(e.get('minute') or 0))}, {_plural(e['hours'], 'hour')}).")
                break
        if "fault" in seen and not reasons:
            reasons.append("Failed at random on the day you watched (its incident history makes that more likely).")
        fixed_here = [x["key"] for x in sel if x["module"] == mod]
        safer = [u for u in failing_ups if by_mod.get(u) and by_mod[u]["p_incident_after"] < 0.5 * by_mod[u]["p_incident_before"]]
        if not fixed_here and ups and safer and m["p_incident_after"] < 0.5 * m["p_incident_before"]:
            reasons.append(f"After the fixes it is safer because {_join(safer[:3])} "
                           f"{'fails' if len(safer[:3]) == 1 else 'fail'} far less often.")
        causes.append({"module": mod, "p_incident_before": m["p_incident_before"],
                       "p_incident_after": m["p_incident_after"], "peak_before": m["peak_utilisation_before"],
                       "peak_after": m["peak_utilisation_after"], "capacity_before": m["capacity_before"],
                       "capacity_after": m["capacity_after"], "first_overload_hour": m.get("first_overload_hour"),
                       "severity": m.get("severity"), "reasons": reasons or ["Fails now and then; no single cause."],
                       "debts": [{"key": d["key"], "title": d["title"], "playbook": titles.get(d["playbook"], d["playbook"]),
                                  "capacity_effect": d["capacity_effect"], "resilience_effect": d["resilience_effect"],
                                  "in_plan": d["in_plan"]} for d in own],
                       "fixed_by": fixed_here})
        if len(causes) >= 10:
            break

    # ---- the situation's own effects
    sit_effects = []
    for e in effects:
        sit_effects.append({
            "label": e["label"], "module": e["module"], "type": e["type"],
            "start": clock(60 * e["start"] + int(e.get("minute") or 0)),
            "hours": e["hours"], "chance": e.get("chance", 1.0), "factor": e.get("factor"),
            "guarded_by": list(e.get("mitigated_by") or []), "guard_in_plan": bool(e.get("guarded_in_plan")),
            "mitigation": e.get("mitigation"), "prevented": e.get("prevented") or "",
            "happened_before": e.get("happened_before"), "happened_after": e.get("happened_after"),
        })

    # ---- fixes
    items = []
    for x in sel:
        d = debts.get(x["key"]) or {}
        items.append({"key": x["key"], "title": x.get("title"), "module": x["module"], "hours": x.get("principal"),
                      "playbook": titles.get(x.get("playbook"), x.get("playbook")),
                      "protects_hours": x.get("protects_hours", 0.0), "alone_hours": x.get("alone_hours", 0.0),
                      "guards_situation": bool(x.get("guards_situation")),
                      "prerequisite_of": list(x.get("prerequisite_of") or []),
                      "capacity_effect": d.get("capacity_effect", 0.0), "resilience_effect": d.get("resilience_effect", 0.0)})
    fixes = {"budget": budget, "hours_used": plan["hours_used"], "items": items,
             "method": plan.get("method"), "combinations": plan.get("combinations_simulated")}
    if reg:
        reg_keys = [k for k in (reg.get("selected_keys") or []) if k]
        if not reg_keys:
            by_id = {d["id"]: d["key"] for d in res.get("debts") or []}
            reg_keys = [by_id[i] for i in reg.get("selected_ids") or [] if i in by_id]
        gap = saved["mean"] - reg["saved_hours"]["mean"]
        fixes["regular"] = {"keys": reg_keys, "saved_hours": reg["saved_hours"]["mean"], "difference": round(gap, 1),
                            "after_hours": reg["summary"]["hours_lost"],
                            "note": (f"The regular sprint plan (ranked by monthly interest and risk) would save "
                                     f"{hours(reg['saved_hours']['mean'])} on this day; preparing for it saves "
                                     f"{hours(gap)} more." if gap >= 0.5 else
                                     "The regular sprint plan already covers this day about as well.")}

    # ---- what is still at risk, and what to do next
    remaining = [{"module": c["module"], "p_incident_after": c["p_incident_after"], "peak_after": c["peak_after"]}
                 for c in causes if c["p_incident_after"] >= 0.1]
    nxt = list(plan.get("next") or [])  # further fixes, valued on top of the plan
    fixes["next"] = nxt
    recs, said = [], set()
    if items:
        order = ", ".join(f"{x['key']} ({fmt(x['hours'])} h)" for x in items)
        recs.append(f"To be ready for “{ev['name']}”, fix in this order: {order}."
                    + (f" That leaves {hours(budget - plan['hours_used'])} of the budget for other work."
                       if budget - plan["hours_used"] >= 4 else ""))

    def guard_advice(label: str, keys: list[str]) -> None:
        for x in nxt:
            if x["key"] in keys and x["key"] not in said:
                said.add(x["key"])
                more = (f"It fits in the budget that is left." if x["fits"]
                        else f"It needs {hours(x['extra_hours'])} more than the plan uses, so a budget of "
                             f"{hours(plan['hours_used'] + x['extra_hours'])}.")
                recs.append(f"{x['key']} ({x['title']}) guards against “{label}” and would save another "
                            f"{hours(x['gain_hours'])} a day on top of the plan. {more}")
                return

    for e in sit_effects:
        if not e["guarded_by"]:
            recs.append(f"Nothing in the debt list guards against “{e['label']}”. Add a debt item for it (a fallback, "
                        f"a timeout or a second provider) so the planner can weigh it.")
        elif not e["guard_in_plan"]:
            guard_advice(e["label"], e["guarded_by"])
    if bots:
        if not bots.get("mitigated_by"):
            recs.append("Nothing in the debt list blocks the bots. Add a debt item for rate limits or a CAPTCHA.")
        elif not bots.get("blocked_in_plan"):
            guard_advice("the bots", list(bots["mitigated_by"]))
    if fixes.get("regular") and fixes["regular"]["difference"] >= 0.5:
        recs.append(f"Do not rely on the regular sprint plan for this day: it saves "
                    f"{hours(fixes['regular']['saved_hours'])}, the plan above {hours(saved['mean'])}.")
    for rmod in remaining[:3]:
        cand = next((x for x in nxt if x["module"] == rmod["module"] and x["key"] not in said), None)
        tip = ""
        if cand:
            said.add(cand["key"])
            tip = f" The next fix there: {cand['key']} ({cand['title']}), another {hours(cand['gain_hours'])} saved."
        recs.append(f"{rmod['module']} still fails on {fmt(100 * rmod['p_incident_after'], 0)}% of days after the "
                    f"fixes (busiest hour at {fmt(100 * rmod['peak_after'], 0)}% load).{tip}")
    rest = [x for x in nxt if x["key"] not in said]
    if rest:
        recs.append("Next in line if there is more time: " + "; ".join(
            f"{x['key']} ({x['title']}, another {hours(x['gain_hours'])} saved for {hours(x['extra_hours'])} of work)"
            for x in rest[:2]) + ".")
    fault_after = a["by_kind"].get("fault", {}).get("hours", 0.0)
    if fault_after >= 1:
        recs.append(f"About {hours(fault_after)} a day is random faults. Good alerts and a short runbook for each "
                    f"module cut the time each one costs.")
    if kind == "traffic" and any((d.get("playbook") or "") == "load-testing" for d in debts.values() if not d["in_plan"]):
        recs.append("Rehearse the busy day with a load test before it happens: one of the open debt items is exactly that.")
    if not recs:
        recs.append("Nothing to change for this day: the system has enough headroom.")

    a_ = res.get("assumptions") or {}
    method = [
        f"DebtLens simulated {runs} versions of this day, once with today's open debt and once after the fixes, "
        f"with the same luck both times (same turnout, same random faults), so the difference is the fixes.",
        "Each hour, a module's load is its normal busy-hour utilisation times the traffic reaching it, divided by the "
        "capacity left after its open debt and the situation's effects. It fails when the load passes a limit that "
        f"varies a little from day to day (turnout ±{fmt(100 * a_.get('day_sigma', 0.15), 0)}%, capacity "
        f"±{fmt(100 * a_.get('capacity_sigma', 0.05), 0)}%) and recovers below {fmt(100 * a_.get('recover_below', 0.9), 0)}%.",
        f"A failure spreads to each module that depends on it with probability {fmt(a_.get('p_cascade', 0.6), 2)} × "
        f"its fragility; open debt such as a missing timeout makes a module more fragile.",
        "Modules also fail at random, at the rate of their own incidents in the last 180 days (and more often under "
        "load), so no day is ever perfectly clean.",
    ]
    if bots:
        method.append(f"Bots: blocking turns away {fmt(100 * bots['blocked'], 0)}% of bot traffic, but "
                      f"{fmt(100 * a_.get('bot_adapt', 0.2), 0)}% of the blocked bots adapt and get through, and turning "
                      f"bots away still costs the front door {fmt(100 * a_.get('reject_cost', 0.1), 0)}% of serving them.")
    if effects:
        method.append("A fix that guards against the situation softens it rather than removing it: a forced outage "
                      "still happens on some days, and a capacity loss is cut by part, not all.")
    method.append(f"The plan is the best set of fixes that fits the budget, found by an exact multiple-choice knapsack "
                  f"over {fmt(plan.get('combinations_simulated', 0), 0)} simulated combinations. Hours lost are the "
                  f"engineering hours to handle each incident, from the module's own past incidents and severity.")

    return {
        "format": FORMAT,
        "title": f"{ev['name']} — {name}",
        "generated_at": generated_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "run_by": run_by,
        "system": {"name": name, "key": system.get("key"), "industry": system.get("industry"),
                   "code": system.get("scenario") or system.get("code")},
        "situation": {"key": ev["key"], "name": ev["name"], "kind": kind, "kind_label": sit,
                      "description": ev.get("description") or "", "peak": ev.get("peak"), "peak_hour": ev.get("peak_hour"),
                      "preset": bool(ev.get("preset"))},
        "settings": {"budget": budget, "runs": runs, "seed": res.get("seed"), "value_runs": res.get("value_runs")},
        "headline": headline,
        "summary": summary,
        "numbers": numbers,
        "timeline": timeline,
        "impact": impact,
        "causes": causes,
        "situation_effects": sit_effects,
        "bots": ({"share": bots["share"], "blocked": bots["blocked"], "adapt": bots.get("adapt"),
                  "mitigated_by": bots.get("mitigated_by") or [], "blocked_in_plan": bool(bots.get("blocked_in_plan"))}
                 if bots else None),
        "fixes": fixes,
        "remaining": remaining,
        "recommendations": recs,
        "method": method,
        "assumptions": a_,
    }


def summary_row(rep: dict) -> dict:
    """The few numbers the run list needs."""
    av = rep["numbers"]["average"]
    return {"title": rep["title"], "system": rep["system"]["name"], "situation": rep["situation"]["name"],
            "kind": rep["situation"]["kind"], "before_hours": av["before"]["hours_lost"],
            "after_hours": av["after"]["hours_lost"], "failed_traffic_before": av["before"]["failed_traffic_pct"],
            "failed_traffic_after": av["after"]["failed_traffic_pct"], "less_pct": rep["numbers"]["saved"]["less_pct"],
            "plan": [x["key"] for x in rep["fixes"]["items"]], "budget": rep["settings"]["budget"],
            "runs": rep["settings"]["runs"]}


# ----------------------------------------------------------------------------- plain text (the terminal)

def _wrap(text: str, width: int, indent: str = "") -> list[str]:
    words, lines, cur = str(text).split(), [], ""
    for w in words:
        if cur and len(indent) + len(cur) + 1 + len(w) > width:
            lines.append(indent + cur)
            cur = w
        else:
            cur = f"{cur} {w}" if cur else w
    if cur:
        lines.append(indent + cur)
    return lines or [indent]


def to_text(rep: dict, width: int = 96) -> str:
    """The report as plain text, in the same order and with the same numbers as the website."""
    out: list[str] = []
    rule = "─" * width

    def h(title: str) -> None:
        out.extend(["", title.upper(), rule])

    def para(text: str, indent: str = "") -> None:
        out.extend(_wrap(text, width, indent))

    out.append(f"DebtLens run report: {rep['title']}")
    sysinfo = rep["system"]
    st = rep["settings"]
    out.append(f"{sysinfo.get('industry') or ''} · {rep['situation']['kind_label']} · budget {hours(st['budget'])} · "
               f"{st['runs']} simulated days · seed {st['seed']} · {rep['generated_at'][:16].replace('T', ' ')} UTC")
    out.append(rule)
    para(rep["headline"])

    h("Summary")
    for s in rep["summary"]:
        para("• " + s, "")

    h("The numbers")
    av, wd, sv = rep["numbers"]["average"], rep["numbers"]["watched"], rep["numbers"]["saved"]
    rows = [("", "Before", "After"),
            ("Engineering hours lost (average)", hours(av["before"]["hours_lost"]), hours(av["after"]["hours_lost"])),
            ("  on a good / bad day (p10–p90)", f"{fmt(av['before']['hours_lost_p10'])}–{hours(av['before']['hours_lost_p90'])}",
             f"{fmt(av['after']['hours_lost_p10'])}–{hours(av['after']['hours_lost_p90'])}"),
            ("Incidents (average)", fmt(av["before"]["incidents"]), fmt(av["after"]["incidents"])),
            ("Requests failing (average)", pct(av["before"]["failed_traffic_pct"]), pct(av["after"]["failed_traffic_pct"])),
            ("Chance of a day with no incident", pct(100 * av["before"]["p_no_incident"], 0),
             pct(100 * av["after"]["p_no_incident"], 0)),
            (f"The day you watched (day {wd['day']}): hours lost", hours(wd["before"]["hours_lost"]),
             hours(wd["after"]["hours_lost"])),
            ("The day you watched: incidents", fmt(wd["before"]["incidents"], 0), fmt(wd["after"]["incidents"], 0))]
    w0 = max(len(r[0]) for r in rows) + 2
    for r in rows:
        out.append(f"{r[0]:<{w0}}{r[1]:>16}{r[2]:>16}")
    para(f"The fixes save {hours(sv['mean'])} a day on average (95% confidence {fmt(sv['ci95'][0])}–{fmt(sv['ci95'][1])} h), "
         f"{fmt(sv['less_pct'], 0)}% less; {sv['better_runs']} of {sv['runs']} days better"
         + (f", {sv['worse_runs']} worse." if sv.get("worse_runs") else "."))

    h(f"What happened on the day you watched (day {wd['day']})")
    for side, label in (("before", "Today, with the open debt"), ("after", "After the fixes")):
        out.append(label + ":")
        para(rep["timeline"]["story_" + side], "  ")
        for r in rep["timeline"][side]:
            span = f"{r['start']}–{r['end']}" if r.get("end") else (f"{r['start']}–end " if r["type"] == "incident" else r["start"])
            tag = r["kind_label"] + (f", {r['severity'].lower()}, {hours(r['cost_hours'])}" if r["type"] == "incident" else "")
            lines = _wrap(f"{r['text']} [{tag}]", width - 16)
            out.append(f"  {span:<13} {lines[0]}")
            out.extend(f"  {'':<13} {ln}" for ln in lines[1:])
        out.append("")

    h("Hours lost by kind of incident (average day)")
    out.append(f"{'':<22}{'Before':>12}{'After':>12}{'Incidents':>22}")
    for k in rep["impact"]:
        out.append(f"{k['label']:<22}{hours(k['before_hours']):>12}{hours(k['after_hours']):>12}"
                   f"{fmt(k['before_incidents']) + ' → ' + fmt(k['after_incidents']):>22}")

    if rep["situation_effects"] or rep.get("bots"):
        h("What the situation did")
        for e in rep["situation_effects"]:
            g = (f"guarded by {', '.join(e['guarded_by'])}" + (" (in the plan)" if e["guard_in_plan"] else " (not in the plan)")
                 if e["guarded_by"] else "nothing guards against it")
            para(f"• {e['start']}, {_plural(e['hours'], 'hour')}: {e['label']} — {g}.")
            if e["prevented"] and e["guard_in_plan"]:
                para(f"After the fix: {e['prevented'].rstrip('.')}.", "    ")
        bt = rep.get("bots")
        if bt:
            para(f"• Bots make up {fmt(100 * bt['share'], 0)}% of the extra traffic. "
                 + (f"{', '.join(bt['mitigated_by'])} blocks most of them" + (" and is in the plan." if bt["blocked_in_plan"]
                                                                             else ", but it is not in the plan.")
                    if bt["mitigated_by"] else "Nothing in the debt list blocks them."))

    h("Why it failed")
    for c in rep["causes"]:
        out.append(f"{c['module']}  (an incident on {fmt(100 * c['p_incident_before'], 0)}% of days → "
                   f"{fmt(100 * c['p_incident_after'], 0)}% after the fixes)")
        for r in c["reasons"]:
            para("- " + r, "    ")
        if c["fixed_by"]:
            para("Fixed by: " + ", ".join(c["fixed_by"]), "    ")

    h(f"What to fix first ({hours(rep['fixes']['hours_used'])} of {hours(rep['fixes']['budget'])})")
    if rep["fixes"]["items"]:
        for x in rep["fixes"]["items"]:
            extra = " · guards against the situation" if x["guards_situation"] else ""
            prot = (f"needed for {', '.join(x['prerequisite_of'])}" if x["prerequisite_of"] and x["protects_hours"] < 0.05
                    else f"protects {hours(x['protects_hours'])}")
            para(f"• {x['key']} {x['title']} — {x['module']}, {hours(x['hours'])}, {prot}{extra}. Playbook: {x['playbook']}.")
    else:
        para("No fix within the budget changes this day.")
    if rep["fixes"].get("regular"):
        para(rep["fixes"]["regular"]["note"])

    h("What to do next")
    for i, r in enumerate(rep["recommendations"], 1):
        lines = _wrap(r, width - 4)
        out.append(f"{i:>2}. {lines[0]}")
        out.extend("    " + ln for ln in lines[1:])

    h("How this was worked out")
    for m in rep["method"]:
        para("• " + m)
    return "\n".join(out) + "\n"
