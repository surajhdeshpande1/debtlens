// Reports → Run reports: every situation run in this project, each with its full end-of-run report.
import { ago, api, fail, html, n } from "../lib.js";
import { kindLabel, link, S } from "../app.js";
import { loadReport, reportHtml, wireReport } from "./report.js";

const P = () => `/projects/${S.project.id}`;
const OTHER = { forecast: "Sprint forecast", cascade: "Failure injection", whatif: "What-if costs" };

export async function render(root, ctx) {
  if (ctx.sub[0]) return one(root, +ctx.sub[0]);
  let r;
  try { r = await api(`${P()}/simulations`); } catch (e) { return fail(e); }
  const reps = r.runs.filter((x) => x.has_report);
  const other = r.runs.filter((x) => !x.has_report);
  root.innerHTML = String(html`<div class="intro-line"><h2>Run reports</h2><span class="muted">Every situation you run is kept here with its report: what happened, why, and what to fix first.</span></div>
    ${reps.length ? html`<div class="table-wrap card" data-tour="runs"><table class="data"><thead><tr><th>When</th><th>Situation</th><th class="num">Hours lost a day</th><th class="num">Requests failing</th><th>Fixes</th><th>By</th></tr></thead><tbody>
      ${reps.map((x) => { const s = x.report_summary; return html`<tr>
        <td class="nowrap">${ago(x.created_at)}</td>
        <td><span class="kind k-${s.kind} sm">${kindLabel(s.kind)}</span> <a href="${link("runs", x.id)}">${s.situation}</a></td>
        <td class="num nowrap">${n(s.before_hours)} → <b>${n(s.after_hours)}</b> h <span class="muted small">(−${n(s.less_pct, 0)}%)</span></td>
        <td class="num nowrap">${n(s.failed_traffic_before)} → ${n(s.failed_traffic_after)}%</td>
        <td class="small mono">${s.plan.join(", ") || "—"}<span class="muted"> · ${n(s.budget)} h budget</span></td>
        <td class="small">${x.run_by || "—"}</td></tr>`; })}</tbody></table></div>`
      : html`<div class="callout" data-tour="runs">No runs yet. <a href="${link("run", "situation")}">Run a scenario</a> — the report appears here when it finishes.</div>`}
    ${other.length ? html`<details class="other-runs"><summary class="small muted">Other simulations in this project (${other.length})</summary>
      <table class="data small"><thead><tr><th>When</th><th>Kind</th><th>By</th></tr></thead><tbody>
      ${other.map((x) => html`<tr><td class="nowrap">${ago(x.created_at)}</td><td>${OTHER[x.kind] || x.kind}</td><td>${x.run_by || "—"}</td></tr>`)}</tbody></table></details>` : ""}`);
}

async function one(root, id) {
  let saved;
  try { saved = await loadReport(id); } catch (e) { root.innerHTML = String(html`<div class="callout bad">${e.message}</div><a href="${link("runs")}">← All run reports</a>`); return; }
  const actions = html`<a class="btn sm" href="${link("run", `watch/${id}`)}">▶ Watch the day</a>`;
  root.innerHTML = String(html`<p class="no-print"><a href="${link("runs")}">← All run reports</a></p>${reportHtml(saved.report, { runId: id, actions })}`);
  wireReport(root, id);
}

