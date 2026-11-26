// The end-of-run report, rendered from the report the server stored with the run (core/report.py).
// The same report is the PDF and the terminal's text, so the numbers and sentences here match them exactly.
import { api, date, download, fail, html, n, on, toast } from "../lib.js";
import { kindLabel, S } from "../app.js";

const KIND_TONE = { overload: "bad", cascade: "warn", outage: "bad", deploy: "bad", fault: "muted", situation: "warn", situation_end: "info", prevented: "ok" };
const pctf = (v, d = 1) => (v === null || v === undefined ? "–" : `${n(v, d)}%`);
const h = (v) => `${n(v)} h`;

function change(before, after, unit = "", lowerIsBetter = true) {
  const better = lowerIsBetter ? after < before : after > before;
  return html`<span class="from">${n(before)}${unit}</span><span class="arrow">→</span><span class="to ${better ? "good" : after === before ? "" : "worse"}">${n(after)}${unit}</span>`;
}

function timeline(rows, story, title) {
  return html`<div class="tl-col"><h4>${title}</h4><p class="tl-story">${story}</p>
    ${rows.length ? html`<ol class="tl">${rows.map((r) => html`<li class="tl-row t-${KIND_TONE[r.kind] || "info"}">
      <time>${r.start}${r.type === "incident" ? html`<span class="tl-end">${r.end ? "–" + r.end : "–end"}</span>` : ""}</time>
      <div><span class="tl-kind">${r.kind_label}${r.type === "incident" ? html` · ${(r.severity || "").toLowerCase()}` : ""}</span>
        <div class="tl-text">${r.text}</div></div>
      <div class="tl-cost">${r.type === "incident" ? h(r.cost_hours) : ""}</div></li>`)}</ol>` : html`<p class="muted small">Nothing happened.</p>`}</div>`;
}

function kindBars(impact) {
  const max = Math.max(1, ...impact.map((k) => Math.max(k.before_hours, k.after_hours)));
  return html`<div class="kbars">${impact.map((k) => html`<div class="kbar"><div class="kbar-l">${k.label}<span class="muted tiny"> · ${n(k.before_incidents)} → ${n(k.after_incidents)} incidents</span></div>
    <div class="kbar-b"><i class="before" style="width:${(k.before_hours / max) * 100}%"></i><span>${h(k.before_hours)}</span></div>
    <div class="kbar-b"><i class="after" style="width:${(k.after_hours / max) * 100}%"></i><span>${h(k.after_hours)}</span></div></div>`)}
    <div class="kbar-key small muted"><span><i class="before"></i>today</span><span><i class="after"></i>after the fixes</span></div></div>`;
}

/** The whole report as HTML. ``actions`` is extra markup for the button row (watch, try another…). */
export function reportHtml(rep, { runId = null, actions = "" } = {}) {
  const av = rep.numbers.average, wd = rep.numbers.watched, sv = rep.numbers.saved;
  const b = av.before, a = av.after, st = rep.settings, sit = rep.situation;
  const fx = rep.fixes;
  return html`<article class="report" data-report>
    <header class="rep-head">
      <div><span class="kind k-${sit.kind}">${sit.kind_label}</span>
        <h1>${sit.name} <span class="muted">— ${rep.system.name}</span></h1>
        <div class="muted small">${rep.system.industry || ""} · fix budget ${h(st.budget)} · ${n(st.runs, 0)} simulated days · seed ${st.seed}
          · ${date(rep.generated_at, true)}${rep.run_by ? ` · run by ${rep.run_by}` : ""}</div></div>
      <div class="row tight rep-actions no-print">${actions}
        ${runId ? html`<button class="btn sm" data-dl="pdf">⬇ PDF</button><button class="btn sm" data-dl="txt">⬇ Text</button>` : ""}
        <button class="btn sm" data-print>Print</button></div>
    </header>
    <p class="rep-headline">${rep.headline}</p>

    <section class="rep-kpis" aria-label="${av.label}">
      <div class="rk"><div class="rk-l">Engineering hours lost</div><div class="rk-v">${change(b.hours_lost, a.hours_lost, " h")}</div><div class="rk-d">${n(sv.less_pct, 0)}% less</div></div>
      <div class="rk"><div class="rk-l">Requests failing</div><div class="rk-v">${change(b.failed_traffic_pct, a.failed_traffic_pct, "%")}</div><div class="rk-d">share of the day's requests</div></div>
      <div class="rk"><div class="rk-l">Incidents a day</div><div class="rk-v">${change(b.incidents, a.incidents)}</div><div class="rk-d">${n(b.incidents_p90, 0)} on a bad day today</div></div>
      <div class="rk"><div class="rk-l">Days with no incident</div><div class="rk-v">${change(100 * b.p_no_incident, 100 * a.p_no_incident, "%", false)}</div><div class="rk-d">chance of a clean day</div></div>
      <div class="rk ok"><div class="rk-l">Saved by the fixes</div><div class="rk-v"><span class="to good">${h(sv.mean)}</span></div><div class="rk-d">a day · 95% confidence ${n(sv.ci95[0])}–${n(sv.ci95[1])} h</div></div>
    </section>
    <p class="small muted rep-note">These are averages over ${n(st.runs, 0)} simulated days. ${wd.label}: ${h(wd.before.hours_lost)} lost and ${n(wd.before.incidents, 0)} incidents today,
      ${h(wd.after.hours_lost)} and ${n(wd.after.incidents, 0)} after the fixes.</p>

    <section class="rep-sec"><h2>Summary</h2><ul class="rep-list">${rep.summary.map((s) => html`<li>${s}</li>`)}</ul></section>

    <section class="rep-sec"><h2>What happened on the day you watched <span class="muted small">(day ${wd.day} of ${n(st.runs, 0)})</span></h2>
      <div class="tl-grid">${timeline(rep.timeline.before, rep.timeline.story_before, "Today, with the open debt")}${timeline(rep.timeline.after, rep.timeline.story_after, "After the fixes")}</div></section>

    <section class="rep-sec"><h2>Hours lost by kind of incident <span class="muted small">(average day)</span></h2>${kindBars(rep.impact)}</section>

    ${rep.situation_effects.length || rep.bots ? html`<section class="rep-sec"><h2>What the situation did</h2><ul class="rep-list">
      ${rep.situation_effects.map((e) => html`<li><b>${e.start}, ${e.hours} h:</b> ${e.label}.
        ${e.guarded_by.length ? html`<span class="badge ${e.guard_in_plan ? "ok" : "warn"}">${e.guard_in_plan ? "fixed by" : "not in the plan:"} ${e.guarded_by.join(", ")}</span>` : html`<span class="badge bad">nothing guards against it</span>`}
        ${e.prevented && e.guard_in_plan ? html`<div class="small muted">After the fix: ${e.prevented}</div>` : ""}</li>`)}
      ${rep.bots ? html`<li><b>Bots</b> make up ${n(100 * rep.bots.share, 0)}% of the extra traffic.
        ${rep.bots.mitigated_by.length ? html`<span class="badge ${rep.bots.blocked_in_plan ? "ok" : "warn"}">${rep.bots.blocked_in_plan ? "blocked by" : "not in the plan:"} ${rep.bots.mitigated_by.join(", ")}</span>` : html`<span class="badge bad">nothing blocks them</span>`}</li>` : ""}
    </ul></section>` : ""}

    ${rep.causes.length ? html`<section class="rep-sec"><h2>Why it failed</h2><div class="causes">${rep.causes.map((c) => html`<div class="cause">
      <div class="row between"><b class="mono">${c.module}</b><span class="small">incident on <b>${n(100 * c.p_incident_before, 0)}%</b> of days → <b class="${c.p_incident_after < c.p_incident_before ? "good" : ""}">${n(100 * c.p_incident_after, 0)}%</b></span></div>
      <ul>${c.reasons.map((r) => html`<li>${r}</li>`)}</ul>
      ${c.fixed_by.length ? html`<div class="small"><span class="badge ok">fixed by ${c.fixed_by.join(", ")}</span></div>` : ""}</div>`)}</div></section>` : ""}

    <section class="rep-sec"><h2>What to fix first <span class="muted small">(${h(fx.hours_used)} of the ${h(fx.budget)} budget)</span></h2>
      ${fx.items.length ? html`<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Fix</th><th>Module</th><th class="num">Hours</th><th class="num">Protects</th><th>Playbook</th></tr></thead><tbody>
        ${fx.items.map((x, i) => html`<tr><td>${i + 1}</td><td><span class="key">${x.key}</span> ${x.title}${x.guards_situation ? html` <span class="badge ok">guards against the situation</span>` : ""}</td>
          <td>${x.module}</td><td class="num">${h(x.hours)}</td><td class="num">${x.prerequisite_of.length && x.protects_hours < 0.05 ? html`<span class="small">needed for ${x.prerequisite_of.join(", ")}</span>` : h(x.protects_hours)}</td>
          <td class="small">${x.playbook || ""}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">No fix within the budget changes this day.</p>`}
      ${fx.regular ? html`<p class="small muted">${fx.regular.note}</p>` : ""}</section>

    <section class="rep-sec"><h2>What to do next</h2><ol class="rep-next">${rep.recommendations.map((r) => html`<li>${r}</li>`)}</ol></section>

    <section class="rep-sec"><details><summary><h2 style="display:inline">How this was worked out</h2></summary>
      <ul class="rep-list small">${rep.method.map((m) => html`<li>${m}</li>`)}</ul>
      <div class="small muted">Model settings: ${Object.entries(rep.assumptions || {}).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ")}</div></details></section>
  </article>`;
}

/** Buttons that every report has: downloads and print. */
export function wireReport(root, runId) {
  on(root, "click", "[data-dl]", async (e, b) => {
    const kind = b.dataset.dl;
    b.disabled = true;
    try { await download(`/projects/${S.project.id}/simulations/${runId}/report.${kind}`, `run-${runId}-report.${kind}`); toast("Downloaded", "ok"); }
    catch (ex) { fail(ex); } finally { b.disabled = false; }
  });
  on(root, "click", "[data-print]", () => window.print());
}

/** Load a saved run's report. */
export async function loadReport(runId) {
  return api(`/projects/${S.project.id}/simulations/${runId}`);
}

export { kindLabel };
