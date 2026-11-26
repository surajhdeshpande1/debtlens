"""Reports: PDF summary, JSON snapshot export (for the CLI), activity log and the CI quality gate."""

from __future__ import annotations

import io
from datetime import timedelta

from flask import Blueprint, Response, request
from sqlalchemy import select

from ... import __version__
from ...core import engine as E
from ...core import report as REPORT
from .. import services as S
from ..deps import args_float, args_int, db, me, ok, project
from ..models import AuditLog, utcnow
from ..security import require
from ..services import iso

bp = Blueprint("reports", __name__)


@bp.get("/projects/<int:pid>/export")
@require("read")
def export(pid: int):
    proj = project(pid)
    snap = S.snapshot(db(), proj, with_embeddings=False)
    for i in snap["incidents"]:
        i.pop("embedding", None)
    for c in snap["causes"]:
        c.pop("embedding", None)
    snap["format"] = "debtlens-snapshot/1"
    snap["exported_by"] = me().name
    edits, chosen, done = S.playbook_state(db(), proj.id)
    for d in snap["debts"]:
        if chosen.get(d["id"]):
            d["playbook"] = chosen[d["id"]]
        if done.get(d["id"]):
            d["playbook_steps_done"] = done[d["id"]]
    snap["settings"] = {"economics": S.project_params(proj), "alpha": S.project_alpha_tau(proj)[0],
                        "tau": S.project_alpha_tau(proj)[1], "playbooks": edits}
    return ok(snap)


@bp.get("/projects/<int:pid>/activity")
@require("read")
def activity(pid: int):
    proj = project(pid)
    rows = db().execute(select(AuditLog).where(AuditLog.project_id == proj.id).order_by(AuditLog.id.desc())
                        .limit(args_int("limit", 100, 1, 500))).scalars()
    return ok({"events": [{"id": r.id, "actor": r.actor, "role": r.role, "action": r.action, "entity": r.entity,
                           "detail": r.detail, "at": iso(r.created_at)} for r in rows]})


@bp.get("/projects/<int:pid>/gate")
@require("read")
def gate(pid: int):
    """Quality gate for CI: fails the build when the project's live risk crosses a limit."""
    proj = project(pid)
    snap, alpha, tau, fn = S.intel(db(), proj)
    led = E.ledger(snap, S.project_params(proj))
    open_rows = [r for r in led["rows"] if r["is_open"]]
    now = E.reference_now(snap)
    window = args_int("regression_days", 30, 1, 3650)
    since = (now - timedelta(days=window)).isoformat()
    regs = [r for r in E.regressions(snap, tau, alpha, fn)["regressions"] if r["reported_at"] >= since]
    checks = []

    def check(name, value, limit_key, default=None):
        raw = request.args.get(limit_key)
        limit = float(raw) if raw not in (None, "") else default
        if limit is None:
            checks.append({"check": name, "value": value, "limit": None, "pass": True})
        else:
            checks.append({"check": name, "value": value, "limit": limit, "pass": value <= limit})

    check("open critical incidents", sum(1 for i in snap["incidents"] if i["severity"] == "CRITICAL"
                                         and i["status"] != "RESOLVED"), "max_open_critical", 0)
    check(f"regressions in the last {window} days", len(regs), "max_regressions")
    check("debts past break-even", sum(1 for r in open_rows if r["break_even"]), "max_break_even")
    check("highest debt risk score", max((r["risk"] for r in open_rows), default=0), "max_risk")
    check("monthly interest (hours)", led["summary"]["total_interest"], "max_interest")
    return ok({"pass": all(c["pass"] for c in checks), "checks": checks, "project": proj.project_name,
               "regressions": regs[:10]})


@bp.get("/projects/<int:pid>/report.pdf")
@require("read")
def report_pdf(pid: int):
    proj = project(pid)
    s = db()
    budget = args_float("budget", 40, 0, 2000)
    snap, alpha, tau, fn = S.intel(s, proj)
    params = S.project_params(proj)
    bundle = E.similarity_bundle(snap, alpha, fn) if snap["incidents"] else None
    dash = E.dashboard(snap, params, bundle=bundle)
    led = E.ledger(snap, params)
    plan = E.plan(snap, budget, params, led=led)
    graph = E.causal_graph(snap)
    edits, chosen, done = S.playbook_state(s, proj.id)
    guides = plan_guides(snap, plan, edits, chosen, done)
    pdf = build_pdf(proj.project_name, me().name, dash, led, plan, graph, budget, bundle.semantic_method if bundle else None,
                    guides)
    return Response(pdf, mimetype="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={proj.project_key}-debtlens-report.pdf"})


def plan_guides(snap: dict, plan: dict, edits: dict | None = None, chosen: dict | None = None,
                done: dict | None = None) -> dict:
    """The fix playbook for every item in the plan, keyed by debt id, with the steps already ticked."""
    out = {}
    for x in plan.get("selected_items") or []:
        try:
            g = E.debt_playbook(snap, x["id"], edits, chosen)
        except KeyError:
            continue
        g["steps_done"] = list((done or {}).get(x["id"]) or [])
        out[x["id"]] = g
    return out


def build_pdf(name: str, who: str, dash: dict, led: dict, plan: dict, graph: dict, budget: float, method,
              guides: dict | None = None) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape as esc

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm,
                            bottomMargin=14 * mm, title=f"DebtLens report — {name}", author="DebtLens")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=16, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=12, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("b", parent=ss["BodyText"], fontSize=9, leading=12)
    cell = ParagraphStyle("c", parent=body, fontSize=8.2, leading=10)
    small = ParagraphStyle("s", parent=body, fontSize=8, textColor=colors.HexColor("#555555"))

    def table(rows, widths, header=True):
        t = Table([[Paragraph(esc(str(c)), cell) for c in r] for r in rows], colWidths=[w * mm for w in widths],
                  repeatRows=1)
        style = [("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                 ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]
        if header:
            style += [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2fb"))]
        t.setStyle(TableStyle(style))
        return t

    lsum = led["summary"]
    inc = dash["incidents"]
    el = [Paragraph(f"DebtLens report — {esc(name)}", h1),
          Paragraph(f"Generated {utcnow().strftime('%d %b %Y %H:%M')} UTC by {esc(who)} · DebtLens {__version__} · "
                    f"similarity: {method or 'n/a'}", small), Spacer(1, 6)]
    el.append(Paragraph("Summary", h2))
    el.append(table([["Measure", "Value"],
                     ["Incidents (open / total)", f"{inc['open'] + inc['investigating']} / {inc['total']}"],
                     ["Mean time to resolve", f"{inc['mttr_hours']} h" if inc["mttr_hours"] is not None else "n/a"],
                     ["Open debt items", lsum["open_items"]],
                     ["Principal (hours to fix all)", f"{lsum['total_principal']} h"],
                     ["Interest (hours lost per month)", f"{lsum['total_interest']} h"],
                     ["Past break-even (interest > principal)", f"{lsum['break_even_count']} ({lsum['break_even_pct']}%)"],
                     ["Regressions detected", dash["regression_count"]],
                     ["Self-admitted debt markers (TODO/FIXME…)", dash["satd_count"]]], [95, 80]))
    el.append(Paragraph("Highest-risk debt", h2))
    rows = [["Key", "Debt", "Module", "Principal h", "Interest h/mo", "Risk", "Past BE"]]
    for r in [r for r in led["rows"] if r["is_open"]][:12]:
        rows.append([r["key"], r["title"], r["module"], r["principal"], r["interest"], r["risk"],
                     "yes" if r["break_even"] else "no"])
    el.append(table(rows, [21, 64, 25, 18, 20, 14, 16]))
    el.append(Paragraph(f"Recommended plan for a {budget:g}-hour sprint budget", h2))
    el.append(Paragraph(f"Method: {plan['method']} (exact, precedence-constrained 0/1 knapsack). "
                        f"Uses {plan['total_weight']:g} h ({plan['utilization']}%), retires "
                        f"{plan['interest_retired']} h/month of interest.", body))
    guides = guides or {}
    rows = [["Key", "Debt", "Hours", "Interest h/mo", "Fix playbook"]]
    rows += [[x["key"], x["title"], x["principal"], x["interest"], (guides.get(x["id"]) or {}).get("title", "")]
             for x in plan["selected_items"]]
    el.append(table(rows, [18, 80, 15, 21, 44]))
    comp = plan.get("comparison") or {}
    if comp:
        rows = [["Method", "Risk value", "Hours used", "Unused hours"]]
        for m, label in (("optimal", "DebtLens exact optimiser"), ("greedy", "Greedy value/hour"),
                         ("naive_dp", "v1 naive DP (no prerequisites)")):
            pl = comp[m]
            rows.append([label, pl["total_value"], pl["total_weight"], pl["unused_budget"]])
        el.append(Spacer(1, 4))
        el.append(table(rows, [70, 35, 35, 35]))
        el.append(Paragraph(f"Exact optimiser is {comp['gain_vs_greedy_pct']}% better than greedy and "
                            f"{comp['gain_vs_naive_pct']}% better than the v1 planner on this backlog.", small))
    if guides and plan["selected_items"]:
        el.append(Paragraph("How to fix the planned items", h2))
        el.append(Paragraph("Each item's fix playbook, in plan order. Steps the team has already ticked on the website "
                            "are marked [done].", small))
        step = ParagraphStyle("st", parent=cell, leftIndent=10, firstLineIndent=-10)
        for x in plan["selected_items"][:10]:
            g = guides.get(x["id"])
            if not g:
                continue
            ctx = g.get("context") or {}
            el.append(Spacer(1, 5))
            el.append(Paragraph(f"<b>{esc(x['key'])} · {esc(x['title'])}</b> — playbook: <b>{esc(g['title'])}</b>"
                                f" ({len(g.get('steps_done') or [])}/{len(g['steps'])} steps done)", body))
            if ctx.get("root_cause"):
                el.append(Paragraph(f"Root cause: {esc(ctx['root_cause'])}", small))
            done_set = set(g.get("steps_done") or [])
            for i, st in enumerate(g["steps"]):
                mark = " <b>[done]</b>" if i in done_set else ""
                el.append(Paragraph(f"{i + 1}. {esc(st)}{mark}", step))
            if g.get("verify"):
                el.append(Paragraph("<b>Verify:</b> " + " · ".join(esc(v) for v in g["verify"]), cell))
            if g.get("risks"):
                el.append(Paragraph("<b>Watch out:</b> " + " · ".join(esc(v) for v in g["risks"][:2]), cell))
    el.append(Paragraph("Systemic root causes (causal graph)", h2))
    rows = [["Cause", "Incidents", "Paths through", "Degree"]] + [[n["label"], n["incidents"], n["paths"], n["degree"]]
                                                                  for n in graph["nodes"][:6]]
    el.append(table(rows, [110, 20, 25, 20]))
    if dash["regressions"]:
        el.append(Paragraph("Regressions (fixed incidents that came back)", h2))
        rows = [["New", "Came back from", "Module", "Similarity", "Days later"]]
        for r in dash["regressions"][:8]:
            rows.append([f"{r['incident_key']} {r['incident_title']}", r["regressed_from_key"], r["module"],
                         r["similarity"], r["days_to_recurrence"]])
        el.append(table(rows, [80, 28, 25, 20, 20]))
    if dash["hotspots"]:
        el.append(Paragraph("Code hotspots (churn × complexity)", h2))
        rows = [["File", "Module", "Churn", "Complexity", "Score"]]
        for f in dash["hotspots"][:8]:
            rows.append([f.get("path"), f.get("module"), f.get("churn"), f.get("complexity"), f.get("hotspot_score")])
        el.append(table(rows, [85, 30, 18, 22, 20]))
    el.append(Spacer(1, 8))
    el.append(Paragraph("Interest I(d) = Σ severity weight × effort of linked incidents + λ<sub>1</sub>·churn + "
                        "λ<sub>2</sub>·blast radius. "
                        "Risk combines normalised interest, blast radius, worst severity and root-cause centrality, "
                        "boosted ×1.2 past break-even.", small))
    doc.build(el)
    return buf.getvalue()


def build_run_pdf(rep: dict) -> bytes:
    """The end-of-run report (``core.report``) as a PDF, in the same order as the website shows it."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape as esc

    from ...core.report import fmt, hours, pct

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm,
                            bottomMargin=14 * mm, title=f"DebtLens run report — {rep['title']}", author="DebtLens")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=15, leading=19, spaceAfter=3)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=11.5, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("b", parent=ss["BodyText"], fontSize=9, leading=12.2)
    lead = ParagraphStyle("lead", parent=body, fontSize=10, leading=13.5, textColor=colors.HexColor("#1a1e24"))
    cell = ParagraphStyle("c", parent=body, fontSize=8.2, leading=10)
    small = ParagraphStyle("s", parent=body, fontSize=8, leading=10.4, textColor=colors.HexColor("#555555"))
    bullet = ParagraphStyle("bl", parent=body, leftIndent=10, firstLineIndent=-8)

    def table(rows, widths, header=True, shade=None):
        # a cell is plain text (escaped here) or ("raw", markup) when it carries its own <b>/<br/> markup
        t = Table([[Paragraph(c[1] if isinstance(c, tuple) else esc(str(c)), cell) for c in r]
                   for r in rows], colWidths=[w * mm for w in widths], repeatRows=1 if header else 0)
        style = [("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                 ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]
        if header:
            style.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2fb")))
        for row in shade or []:
            style.append(("BACKGROUND", (0, row), (-1, row), colors.HexColor("#f6f7f9")))
        t.setStyle(TableStyle(style))
        return t

    st, sysinfo, sit = rep["settings"], rep["system"], rep["situation"]
    el = [Paragraph(f"Run report: {esc(sit['name'])} — {esc(sysinfo['name'])}", h1),
          Paragraph(f"{esc(sysinfo.get('industry') or '')} · {esc(sit['kind_label'])} · budget {hours(st['budget'])} · "
                    f"{st['runs']} simulated days · seed {st['seed']} · generated "
                    f"{esc(rep['generated_at'][:16].replace('T', ' '))} UTC"
                    + (f" by {esc(rep['run_by'])}" if rep.get("run_by") else "") + f" · DebtLens {__version__}", small),
          Spacer(1, 6), Paragraph(esc(rep["headline"]), lead)]

    el.append(Paragraph("Summary", h2))
    el += [Paragraph("• " + esc(s), bullet) for s in rep["summary"]]

    el.append(Paragraph("The numbers", h2))
    av, wd, sv = rep["numbers"]["average"], rep["numbers"]["watched"], rep["numbers"]["saved"]
    b, a = av["before"], av["after"]
    rows = [["", "Before the fixes", "After the fixes"],
            [("raw", f"<b>{esc(av['label'])}</b>"), "", ""],
            ["Engineering hours lost", hours(b["hours_lost"]), hours(a["hours_lost"])],
            ["…on a good day / a bad day (p10–p90)", f"{fmt(b['hours_lost_p10'])}–{hours(b['hours_lost_p90'])}",
             f"{fmt(a['hours_lost_p10'])}–{hours(a['hours_lost_p90'])}"],
            ["Incidents", fmt(b["incidents"]), fmt(a["incidents"])],
            ["Requests failing", pct(b["failed_traffic_pct"]), pct(a["failed_traffic_pct"])],
            ["Chance of a day with no incident", pct(100 * b["p_no_incident"], 0), pct(100 * a["p_no_incident"], 0)],
            [("raw", f"<b>{esc(wd['label'])}</b>"), "", ""],
            ["Engineering hours lost", hours(wd["before"]["hours_lost"]), hours(wd["after"]["hours_lost"])],
            ["Incidents", fmt(wd["before"]["incidents"], 0), fmt(wd["after"]["incidents"], 0)],
            ["Requests failing", pct(wd["before"]["failed_traffic_pct"]), pct(wd["after"]["failed_traffic_pct"])]]
    el.append(table(rows, [90, 44, 44], shade=[1, 7]))
    el.append(Paragraph(f"The fixes save {hours(sv['mean'])} a day on average (95% confidence {fmt(sv['ci95'][0])}–"
                        f"{fmt(sv['ci95'][1])} h), {fmt(sv['less_pct'], 0)}% less; {sv['better_runs']} of {sv['runs']} "
                        f"simulated days are better" + (f", {sv['worse_runs']} worse." if sv.get("worse_runs") else "."),
                        small))

    el.append(Paragraph(f"What happened on the day you watched (day {wd['day']})", h2))
    for side, label in (("before", "Today, with the open debt"), ("after", "After the fixes")):
        el.append(Paragraph(f"<b>{label}.</b> {esc(rep['timeline']['story_' + side])}", body))
        tl = rep["timeline"][side]
        if tl:
            rows = [["Time", "What happened", "Kind", "Hours"]]
            for r in tl:
                when = f"{r['start']}–{r['end']}" if r.get("end") else (f"{r['start']}–end" if r["type"] == "incident"
                                                                         else r["start"])
                kind = r["kind_label"] + (f" ({r['severity'].lower()})" if r["type"] == "incident" else "")
                rows.append([when, r["text"], kind, hours(r["cost_hours"]) if r["type"] == "incident" else ""])
            el.append(table(rows, [24, 108, 30, 16]))
        el.append(Spacer(1, 5))

    el.append(Paragraph("Hours lost by kind of incident (average day)", h2))
    rows = [["Kind", "Hours before", "Hours after", "Incidents before → after"]]
    rows += [[k["label"], hours(k["before_hours"]), hours(k["after_hours"]),
              f"{fmt(k['before_incidents'])} → {fmt(k['after_incidents'])}"] for k in rep["impact"]]
    el.append(table(rows, [60, 35, 35, 48]))

    if rep["situation_effects"] or rep.get("bots"):
        el.append(Paragraph("What the situation did", h2))
        for e in rep["situation_effects"]:
            line = f"• {e['start']}, {e['hours']} h: {esc(e['label'])} — {esc(REPORT.guard_text(e))}."
            if e["prevented"] and e["guard_in_plan"]:
                line += f" After the fix: {esc(e['prevented'].rstrip('.'))}."
            el.append(Paragraph(line, bullet))
        bt = rep.get("bots")
        if bt:
            el.append(Paragraph(f"• Bots make up {fmt(100 * bt['share'], 0)}% of the extra traffic; "
                                + (f"{esc(', '.join(bt['mitigated_by']))} blocks most of them"
                                   + (" and is in the plan." if bt["blocked_in_plan"] else ", but it is not in the plan.")
                                   if bt["mitigated_by"] else "nothing in the debt list blocks them."), bullet))

    if rep["causes"]:
        el.append(Paragraph("Why it failed", h2))
        rows = [["Module", "Incident on % of days", "Why"]]
        for c in rep["causes"]:
            why = "<br/>".join(esc(r) for r in c["reasons"])
            if c["fixed_by"]:
                why += f"<br/><b>Fixed by:</b> {esc(', '.join(c['fixed_by']))}"
            rows.append([("raw", f"<b>{esc(c['module'])}</b>"),
                         f"{fmt(100 * c['p_incident_before'], 0)}% → {fmt(100 * c['p_incident_after'], 0)}%", ("raw", why)])
        el.append(table(rows, [26, 30, 122]))

    fx = rep["fixes"]
    el.append(Paragraph(f"What to fix first ({hours(fx['hours_used'])} of the {hours(fx['budget'])} budget)", h2))
    if fx["items"]:
        rows = [["Key", "Fix", "Module", "Hours", "Protects", "Playbook"]]
        for x in fx["items"]:
            prot = (f"needed for {', '.join(x['prerequisite_of'])}" if x["prerequisite_of"] and x["protects_hours"] < 0.05
                    else hours(x["protects_hours"]))
            rows.append([x["key"], x["title"] + (" (guards against the situation)" if x["guards_situation"] else ""),
                         x["module"], hours(x["hours"]), prot, x["playbook"] or ""])
        el.append(table(rows, [18, 64, 20, 14, 18, 44]))
    else:
        el.append(Paragraph("No fix within the budget changes this day.", body))
    if fx.get("regular"):
        el.append(Paragraph(esc(fx["regular"]["note"]), small))

    el.append(Paragraph("What to do next", h2))
    el += [Paragraph(f"{i}. {esc(r)}", bullet) for i, r in enumerate(rep["recommendations"], 1)]

    el.append(KeepTogether([Paragraph("How this was worked out", h2)]
                           + [Paragraph("• " + esc(m), small) for m in rep["method"]]))
    doc.build(el)
    return buf.getvalue()
