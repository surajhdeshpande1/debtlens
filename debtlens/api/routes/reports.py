"""Reports: PDF summary, JSON snapshot export (for the CLI), activity log and the CI quality gate."""

from __future__ import annotations

import io
from datetime import timedelta

from flask import Blueprint, Response, request
from sqlalchemy import select

from ... import __version__
from ...core import engine as E
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
    snap["settings"] = {"economics": S.project_params(proj), "alpha": S.project_alpha_tau(proj)[0],
                        "tau": S.project_alpha_tau(proj)[1]}
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
    pdf = build_pdf(proj.project_name, me().name, dash, led, plan, graph, budget, bundle.semantic_method if bundle else None)
    return Response(pdf, mimetype="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={proj.project_key}-debtlens-report.pdf"})


def build_pdf(name: str, who: str, dash: dict, led: dict, plan: dict, graph: dict, budget: float, method) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm,
                            bottomMargin=14 * mm, title=f"DebtLens report — {name}", author="DebtLens")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=16, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=12, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("b", parent=ss["BodyText"], fontSize=9, leading=12)
    cell = ParagraphStyle("c", parent=body, fontSize=8.2, leading=10)
    small = ParagraphStyle("s", parent=body, fontSize=8, textColor=colors.HexColor("#555555"))
    accent = colors.HexColor("#2457c5")

    def table(rows, widths, header=True):
        t = Table([[Paragraph(str(c), cell) for c in r] for r in rows], colWidths=[w * mm for w in widths], repeatRows=1)
        style = [("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                 ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]
        if header:
            style += [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2fb"))]
        t.setStyle(TableStyle(style))
        return t

    lsum = led["summary"]
    inc = dash["incidents"]
    el = [Paragraph(f"DebtLens report — {name}", h1),
          Paragraph(f"Generated {utcnow().strftime('%d %b %Y %H:%M')} UTC by {who} · DebtLens {__version__} · "
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
    rows = [["Key", "Debt", "Hours", "Interest h/mo"]] + [[x["key"], x["title"], x["principal"], x["interest"]]
                                                          for x in plan["selected_items"]]
    el.append(table(rows, [20, 110, 20, 25]))
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
    el.append(Paragraph("Interest I(d) = Σ severity weight × effort of linked incidents + λ₁·churn + λ₂·blast radius. "
                        "Risk combines normalised interest, blast radius, worst severity and root-cause centrality, "
                        "boosted ×1.2 past break-even.", small))
    doc.build(el)
    return buf.getvalue()
