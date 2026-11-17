// Shared building blocks for the views.
import { bar, date, ago, html, hrs, n, pct, sev, status } from "../lib.js";
import { link } from "../app.js";

export const head = (title, sub = "", actions = "", crumbs = "") => html`<div class="page-head"><div>${crumbs ? html`<div class="crumbs">${crumbs}</div>` : ""}
  <h1>${title}</h1>${sub ? html`<div class="sub">${sub}</div>` : ""}</div><div class="row tight">${actions}</div></div>`;

export const card = (title, body, { actions = "", flush = false, attrs = "" } = {}) => html`<section class="card" ${attrs}>
  <div class="card-head"><h3>${title}</h3><div class="row tight">${actions}</div></div><div class="card-body ${flush ? "flush" : ""}">${body}</div></section>`;

export const empty = (msg) => html`<div class="empty">${msg}</div>`;

export function kpis(d) {
  const inc = d.incidents, led = d.ledger;
  return html`<div class="kpis" data-tour="kpis">
    <div class="kpi ${inc.open + inc.investigating > 0 ? "warn" : "ok"}"><div class="v">${inc.open + inc.investigating}</div><div class="l">Open incidents</div><div class="d">${inc.total} total · ${inc.resolved} resolved</div></div>
    <div class="kpi"><div class="v">${inc.mttr_hours === null ? "–" : n(inc.mttr_hours) + " h"}</div><div class="l">Mean time to resolve</div><div class="d">reported → resolved</div></div>
    <div class="kpi bad"><div class="v">${n(led.total_interest)} h</div><div class="l">Interest per month</div><div class="d">hours lost to open debt</div></div>
    <div class="kpi"><div class="v">${n(led.total_principal)} h</div><div class="l">Principal</div><div class="d">to fix all ${led.open_items} open items</div></div>
    <div class="kpi ${led.break_even_pct > 50 ? "bad" : "warn"}"><div class="v">${pct(led.break_even_pct)}</div><div class="l">Past break-even</div><div class="d">${led.break_even_count} items cost more than fixing</div></div>
    <div class="kpi ${d.regression_count ? "bad" : "ok"}"><div class="v">${d.regression_count}</div><div class="l">Regressions</div><div class="d">fixed incidents that came back</div></div>
    <div class="kpi"><div class="v">${d.satd_count}</div><div class="l">TODO / FIXME markers</div><div class="d">self-admitted debt in code</div></div>
  </div>`;
}

export function incidentTable(items, { cols = ["key", "title", "module", "severity", "status", "reported"], none = "No incidents." } = {}) {
  if (!items || !items.length) return empty(none);
  const H = { key: "Key", title: "Incident", module: "Module", severity: "Severity", status: "Status", reported: "Reported", whys: "5 Whys", debts: "Debts", effort: "Effort", source: "Source", occ: "Seen" };
  const C = {
    key: (i) => html`<td class="key">${i.key}</td>`,
    title: (i) => html`<td class="title-cell"><a href="${link("incidents", i.id)}">${i.title}</a></td>`,
    module: (i) => html`<td>${i.module}</td>`,
    severity: (i) => html`<td>${sev(i.severity)}</td>`,
    status: (i) => html`<td>${status(i.status)}</td>`,
    reported: (i) => html`<td class="nowrap" title="${date(i.reported_at, true)}">${ago(i.reported_at)}</td>`,
    whys: (i) => html`<td class="num">${i.whys ? i.whys : html`<span class="badge warn">none</span>`}</td>`,
    debts: (i) => html`<td class="num">${i.debt_count || ""}</td>`,
    effort: (i) => html`<td class="num">${hrs(i.effort_hours)}</td>`,
    source: (i) => html`<td><span class="chip">${i.source}</span></td>`,
    occ: (i) => html`<td class="num">${i.occurrences > 1 ? "×" + i.occurrences : ""}</td>`,
  };
  return html`<div class="table-wrap"><table class="data"><thead><tr>${cols.map((c) => html`<th class="${["whys", "debts", "effort", "occ"].includes(c) ? "num" : ""}">${H[c]}</th>`)}</tr></thead>
    <tbody>${items.map((i) => html`<tr>${cols.map((c) => C[c](i))}</tr>`)}</tbody></table></div>`;
}

export function debtTable(rows, { none = "No debt items.", maxRisk = null, compact = false } = {}) {
  if (!rows || !rows.length) return empty(none);
  const mr = maxRisk || Math.max(1, ...rows.map((r) => r.risk || 0));
  return html`<div class="table-wrap"><table class="data"><thead><tr><th>Key</th><th>Debt</th><th>Module</th>${compact ? "" : html`<th>Status</th>`}
    <th class="num">Principal</th><th class="num">Interest / mo</th><th style="min-width:130px">Risk</th><th>Break-even</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr><td class="key">${r.key}</td><td class="title-cell"><a href="${link("debts", r.id)}">${r.title}</a></td><td>${r.module}</td>
      ${compact ? "" : html`<td>${status(r.status)}</td>`}<td class="num">${hrs(r.principal)}</td><td class="num">${hrs(r.interest)}</td>
      <td>${bar(r.risk || 0, mr, r.break_even ? "bad" : "")}</td><td>${r.break_even ? html`<span class="badge bad">past</span>` : html`<span class="badge">not yet</span>`}</td></tr>`)}</tbody></table></div>`;
}

export function planCompare(comp, budget) {
  if (!comp) return "";
  const rows = [["optimal", "DebtLens exact optimiser", ""], ["greedy", "Greedy (value per hour)", "warn"], ["naive_dp", "v1 naive DP (ignores prerequisites)", "bad"]];
  const max = Math.max(...rows.map(([k]) => comp[k].total_value), 1);
  return html`<div data-tour="compare"><table class="data"><thead><tr><th>Method</th><th style="min-width:160px">Risk reduction</th><th class="num">Hours used</th><th class="num">Unused</th><th>Optimal</th></tr></thead><tbody>
    ${rows.map(([k, lbl, cls]) => html`<tr><td>${lbl}</td><td>${bar(comp[k].total_value, max, cls)}</td><td class="num">${n(comp[k].total_weight)} / ${n(budget ?? comp[k].budget)}</td>
      <td class="num">${n(comp[k].unused_budget)} h</td><td>${comp[k].optimal ? html`<span class="badge ok">proven</span>` : html`<span class="badge">no</span>`}</td></tr>`)}
    </tbody></table>
    <p class="small muted" style="margin:8px 0 0">The exact optimiser is <b>${n(comp.gain_vs_greedy_pct)}%</b> better than greedy and <b>${n(comp.gain_vs_naive_pct)}%</b> better than the v1 planner on this backlog.
    ${comp.naive_dp.warnings && comp.naive_dp.warnings.length ? html`<br>v1 issue: ${comp.naive_dp.warnings[0]}` : ""}</p></div>`;
}

export const scoreBars = (m) => html`<div class="scorebars">
  <span>lexical</span>${bar(m.lexical ?? 0, 1)}<span></span>
  <span>semantic</span>${bar(m.semantic ?? 0, 1)}<span></span>
  <span><b>hybrid</b></span>${bar(m.hybrid ?? 0, 1, "ok")}<span></span></div>`;

export const sevOptions = (sel = "MEDIUM") => ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => html`<option value="${s}" ${s === sel ? "selected" : ""}>${s.toLowerCase()}</option>`);
export const moduleOptions = (mods, sel = "") => mods.map((m) => html`<option value="${m}" ${m === sel ? "selected" : ""}>${m}</option>`);
