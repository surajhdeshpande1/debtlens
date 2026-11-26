// Role home: what this role needs today, computed server-side for the signed-in role.
import { api, chart, COLORS, html, hrs, n, pct, ago, status, sev } from "../lib.js";
import { link, S } from "../app.js";
import { card, debtTable, empty, head, incidentTable, kpis, planCompare } from "./_parts.js";

const INTRO = {
  tech_lead: "Where the system is bleeding hours, which root causes are systemic, and what fits in the next sprint.",
  admin: "Team-wide picture: risk, root causes, and the sprint plan. Manage people under Team & settings.",
  developer: "The debt and incidents in the modules you own, and the TODO/FIXME markers waiting in your code.",
  qa: "Regressions (fixed incidents that came back), fixes to verify, and new reports still untriaged.",
  manager: "The cost of debt in hours per month, the plan to approve, and the hours it saves over the coming sprints.",
  viewer: "A read-only summary of reliability and technical debt for this project.",
};

function regTable(rows) {
  if (!rows || !rows.length) return empty("No regressions detected.");
  return html`<table class="data"><thead><tr><th>New incident</th><th>Came back from</th><th>Module</th><th class="num">Similarity</th><th class="num">Days after fix</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr><td><span class="key">${r.incident_key}</span> <a href="${link("incidents", r.incident_id)}">${r.incident_title}</a></td>
      <td><span class="key">${r.regressed_from_key}</span> <a href="${link("incidents", r.regressed_from_id)}">${r.regressed_from_title}</a></td>
      <td>${r.module}</td><td class="num">${n(r.similarity, 2)}</td><td class="num">${n(r.days_to_recurrence)}</td></tr>`)}</tbody></table>`;
}

function causeList(nodes) {
  if (!nodes || !nodes.length) return empty("No causes recorded yet.");
  return html`<table class="data"><thead><tr><th>Root cause</th><th class="num">Incidents</th><th class="num">Paths</th></tr></thead><tbody>
    ${nodes.map((c) => html`<tr><td><a href="${link("causal", c.id)}">${c.label}</a> <span class="badge">${(c.category || "").toLowerCase()}</span></td>
      <td class="num">${c.incidents}</td><td class="num">${n(c.paths, 1)}</td></tr>`)}</tbody></table>`;
}

function trendCanvas() { return html`<div class="chart-box short"><canvas data-trend aria-label="Incident trend"></canvas></div>`; }

export async function render(root, ctx) {
  const d = await api(`/projects/${S.project.id}/home`);
  const p = S.project;
  const who = (d.me || S.me.principal.name || "").replace(/ \(sandbox\)$/, "");
  const first = who.split(" ").length > 2 ? who : who.split(" ")[0];
  const dash = d.dashboard;
  const role = d.role;
  let body;
  if (role === "tech_lead" || role === "admin") {
    body = html`<div class="grid side">
      <div class="stack">
        ${card("Highest-risk debt", debtTable(d.top_risks, { compact: true }), { flush: true, actions: html`<a class="btn sm" href="${link("debts")}">All debt</a>` })}
        ${card(`Sprint plan preview — ${n(d.plan_preview.total_weight)} of 40 h`, html`<p class="small">Retires <b>${hrs(d.plan_preview.interest_retired)}</b> of interest per month with
            ${d.plan_preview.selected_items.length} items: ${d.plan_preview.selected_items.map((x, i) => html`${i ? ", " : ""}<a href="${link("debts", x.id)}" class="mono">${x.key}</a>`)}.</p>
            ${planCompare(d.plan_preview.comparison, 40)}`, { actions: html`<a class="btn sm" href="${link("ledger")}">Open planner</a>` })}
      </div>
      <div class="stack">
        ${card("Systemic root causes", causeList(d.systemic_causes), { flush: true, actions: html`<a class="btn sm" href="${link("causal")}">Graph</a>` })}
        ${card("Needs root-cause analysis", incidentTable(d.needs_rca, { cols: ["key", "title", "severity"], none: "Every open incident has a 5 Whys chain." }), { flush: true })}
        ${card("Incidents per month", trendCanvas())}
      </div></div>`;
  } else if (role === "developer") {
    const mine = d.my_modules.length ? html`Modules you own: ${d.my_modules.map((m) => html`<span class="chip">${m}</span> `)}` : html`You don't own a module here yet — showing nothing assigned.`;
    body = html`<p class="small muted">${mine}</p><div class="grid c2">
      ${card("Your debt", debtTable(d.my_debts, { compact: true, none: "No debt assigned to you or your modules." }), { flush: true })}
      ${card("Open incidents in your modules", incidentTable(d.my_open_incidents, { cols: ["key", "title", "severity", "status"], none: "Nothing open in your modules." }), { flush: true })}
      ${card("TODO / FIXME in your code", d.my_satd.length ? html`<table class="data"><thead><tr><th>File</th><th>Marker</th></tr></thead><tbody>${d.my_satd.map((x) => html`<tr><td class="mono small">${x.path}:${x.line}</td><td><span class="badge warn">${x.marker}</span> ${x.text}</td></tr>`)}</tbody></table>` : empty("No self-admitted debt markers in your modules."), { flush: true, actions: html`<a class="btn sm" href="${link("evidence")}">Evidence</a>` })}
      ${card("Regressions in your modules", regTable(d.my_regressions), { flush: true })}</div>`;
  } else if (role === "qa") {
    body = html`<div class="grid c2">
      ${card("Regressions — fixed incidents that came back", regTable(d.regressions), { flush: true, actions: html`<a class="btn sm" href="${link("intel", "regressions")}">Tune τ</a>` })}
      ${card("Fixes to verify (resolved in the last 14 days)", incidentTable(d.verify_fixes, { cols: ["key", "title", "module", "severity"], none: "No recent fixes." }), { flush: true })}
      ${card("New and untriaged", incidentTable(d.unverified_open, { cols: ["key", "title", "module", "severity", "reported"], none: "Nothing waiting for triage." }), { flush: true })}
      ${card("Incidents per month", trendCanvas())}</div>`;
  } else if (role === "manager") {
    const fq = d.forecast_quick && d.forecast_quick.optimal_vs_none;
    body = html`<div class="grid c2">
      ${card("Plan to approve — 40 h sprint budget", html`<p>Fixing <b>${d.plan_preview.selected_items.length}</b> items (${n(d.plan_preview.total_weight)} h) retires
          <b>${hrs(d.plan_preview.interest_retired)}</b> of interest every month.</p>
          ${fq ? html`<div class="callout ok">Over the next 8 sprints this saves about <b>${n(fq.hours_saved_mean)} hours</b> of incident work versus doing nothing
            (95% CI ${n(fq.ci95[0])}–${n(fq.ci95[1])} h, Monte Carlo).</div>` : ""}
          ${planCompare(d.plan_preview.comparison, 40)}`, { actions: html`<a class="btn sm primary" href="${link("ledger")}">Review &amp; approve</a>` })}
      ${card("Hours lost per month, by module", html`<div class="chart-box"><canvas data-bymod></canvas></div>`)}
      ${card("Highest-cost debt", debtTable(dash.top_debts, { compact: true }), { flush: true })}
      ${card("Incidents per month", trendCanvas())}</div>`;
  } else {
    body = html`<div class="grid c2">${card("Highest-cost debt", debtTable(dash.top_debts, { compact: true }), { flush: true })}
      ${card("Incidents per month", trendCanvas())}${card("Systemic root causes", causeList(dash.top_causes), { flush: true })}
      ${card("Recent regressions", regTable(dash.regressions), { flush: true })}</div>`;
  }
  const scen = p.scenario_info;
  let last = null;
  try { last = (await api(`/projects/${S.project.id}/simulations?kind=spike`)).runs.find((x) => x.has_report) || null; } catch { last = null; }
  const ls = last && last.report_summary;
  root.innerHTML = String(html`${head(`${first ? "Hello, " + first : "Overview"} · ${d.role_label}`, INTRO[role] || "",
      html`<a class="btn primary" href="${link("run", "situation")}">Run a scenario</a><a class="btn" href="${link("incidents", "new")}">Report incident</a>`)}
    ${p.is_sandbox && scen ? html`<div class="callout system-line"><b>${scen.name}</b> · ${scen.industry}. ${scen.tagline || ""}</div>` : ""}
    ${ls ? html`<a class="last-run" href="${link("runs", last.id)}"><span class="muted small">Last run report · ${ago(last.created_at)}</span>
      <b>${ls.situation}</b><span>${n(ls.before_hours)} h → ${n(ls.after_hours)} h lost a day after ${ls.plan.join(", ") || "no fixes"}</span><span class="go">Open →</span></a>` : ""}
    ${kpis(dash)}${body}
    <p class="tiny faint" style="margin-top:16px">Similarity engine: ${d.semantic_method === "minilm" ? "MiniLM sentence embeddings + TF-IDF (hybrid)" : "character n-gram fallback + TF-IDF (MiniLM not loaded)"} · computed ${ago(d.generated_at)}</p>`);
  const trend = root.querySelector("[data-trend]");
  if (trend && dash.trend.length) {
    chart(trend, { type: "bar", data: { labels: dash.trend.map((t) => t.month), datasets: [
      { label: "Reported", data: dash.trend.map((t) => t.reported), backgroundColor: COLORS.bad },
      { label: "Resolved", data: dash.trend.map((t) => t.resolved), backgroundColor: COLORS.ok }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } } });
  }
  const bymod = root.querySelector("[data-bymod]");
  if (bymod) {
    const entries = Object.entries(d.interest_by_module || {}).sort((a, b) => b[1].interest - a[1].interest).slice(0, 10);
    chart(bymod, { type: "bar", data: { labels: entries.map((e) => e[0]), datasets: [{ label: "Interest h / month", data: entries.map((e) => e[1].interest), backgroundColor: COLORS.accent }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: COLORS.grid } }, y: { grid: { display: false } } } } });
  }
}
