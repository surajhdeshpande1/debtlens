// Run a scenario, in four steps: 1 pick a system → 2 pick a situation → 3 watch it happen → 4 read the report.
import { $, api, fail, html, n, on } from "../lib.js";
import { allSystems, go, isSandbox, kindLabel, link, S, switchSystem, systemCard, uploadCard, wirePackUpload } from "../app.js";
import { empty } from "./_parts.js";
import { loadReport, reportHtml, wireReport } from "./report.js";

const P = () => `/projects/${S.project.id}`;
const STEPS = ["Pick a system", "Pick a situation", "Watch it happen", "Read the report"];
const hh = (x) => `${String(x).padStart(2, "0")}:00`;
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function query() {
  const q = location.hash.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

function stepper(at) {
  const run = S.lastRun && S.lastRun.project === S.project.id ? S.lastRun : null;
  const href = [link("run", "system"), link("run", "situation"), run ? link("run", `watch/${run.id}`) : null, run && run.id ? link("run", `report/${run.id}`) : null];
  return html`<ol class="stepper">${STEPS.map((t, i) => {
    const cls = i === at ? "now" : i < at ? "done" : "";
    const label = html`<span class="num">${i < at ? "✓" : i + 1}</span><span>${t}${i === 0 ? html`<small>${S.project.name}</small>` : ""}</span>`;
    return html`<li class="${cls}">${href[i] && i !== at ? html`<a href="${href[i]}">${label}</a>` : html`<span>${label}</span>`}</li>`;
  })}</ol>`;
}

export async function render(root, ctx) {
  const step = ctx.sub[0] || "situation";
  if (step === "system") return pickSystem(root);
  if (step === "go") return runIt(root, ctx.sub[1] || "custom", query());
  if (step === "watch") return watch(root, +ctx.sub[1]);
  if (step === "report") return report(root, +ctx.sub[1]);
  return pickSituation(root, query());
}

// ------------------------------------------------------------------ 1 · pick a system
function pickSystem(root) {
  const cur = S.project.scenario_info || {};
  if (!isSandbox()) {
    root.innerHTML = String(html`${stepper(0)}<div class="callout">You are working in your team's projects. Pick one; each keeps its own incidents, debt and run reports.
      To try the sample systems, sign out (⚙ menu) and open one from the start page as a private sandbox.</div>
      <div class="sys-grid">${(S.projects || []).map((p) => html`<a class="sys ${p.id === S.project.id ? "current" : ""}" href="#/p/${p.id}/run/situation" style="color:inherit;text-decoration:none">
        <div class="ind">${p.industry || p.key}</div><h3>${p.name}</h3><p class="tag">${p.description || ""}</p></a>`)}</div>`);
    return;
  }
  const systems = allSystems();
  root.innerHTML = String(html`${stepper(0)}
    <div class="intro-line"><h2>Pick a system</h2><span class="muted">Each one is a whole product: its modules, incidents with 5 Whys, technical debt and the days that hurt it.</span></div>
    <div class="sys-grid">${systems.map((s) => systemCard(s, { current: !cur.uploaded && cur.code === s.code, action: "Use this" }))}
      ${cur.uploaded ? html`<div class="sys current"><div class="ind">Uploaded pack</div><h3>${cur.name}</h3><p class="tag">The pack you uploaded.</p><span class="badge accent">Open now</span></div>` : ""}
      ${uploadCard()}</div>`);
  on(root, "click", "[data-open]", async (e, b) => {
    b.disabled = true;
    try { await switchSystem(b.dataset.open); } catch (ex) { fail(ex); b.disabled = false; }
  });
  wirePackUpload(root, { onOpen: (pack) => switchSystem(null, pack) });
}

// ------------------------------------------------------------------ 2 · pick a situation
function effectLine(e) {
  const where = e.module === "*" ? "every module" : e.module;
  return html`<li>${e.label} <span class="muted">(${where}, ${clock(60 * e.start + (e.minute || 0))}, ${e.hours} h)</span></li>`;
}

function situationCard(ev) {
  const guards = [...new Set([...(ev.effects || []).flatMap((e) => e.mitigated_by || []), ...((ev.bots || {}).mitigated_by || [])])];
  return html`<div class="sit" data-ev="${ev.key}">
    <div class="row between"><span class="kind k-${ev.kind}">${kindLabel(ev.kind)}</span><span class="small muted">peak ${n(ev.peak)}× at ${hh(ev.peak_hour)}</span></div>
    <h3>${ev.name}</h3>
    <p class="desc">${ev.description}</p>
    ${(ev.effects || []).length ? html`<div class="sit-what"><b>What goes wrong</b><ul>${ev.effects.map(effectLine)}</ul></div>` : ""}
    ${ev.bots ? html`<div class="sit-what"><b>Bots</b> are ${Math.round(ev.bots.share * 100)}% of the extra traffic.</div>` : ""}
    <div class="row between sit-foot"><span class="tiny muted">${guards.length ? `Guarded by ${guards.join(", ")}` : ev.kind === "traffic" ? "Only real users" : ""}</span>
      <button class="btn primary sm" data-run="${ev.key}">Run this day →</button></div>
  </div>`;
}

async function pickSituation(root, q) {
  root.innerHTML = String(html`${stepper(1)}<div class="loading"><span class="spinner"></span></div>`);
  let r;
  try { r = await api(`${P()}/simulate/spike/events`); } catch (e) { return fail(e); }
  const events = r.events.filter((e) => e.key !== "custom");
  const budget = +q.budget || +(S.lastRun && S.lastRun.budget) || 40;
  const runs = +q.runs || 300;
  root.innerHTML = String(html`${stepper(1)}
    <div class="intro-line"><h2>Pick a situation for ${S.project.name}</h2><span class="muted">What happens on the day. DebtLens then simulates ${n(runs, 0)} versions of that day, with today's debt and after the best fixes.</span></div>
    <form class="settings-bar" data-settings>
      <label>Hours you can spend on fixes before the day <input type="number" name="budget" min="0" max="500" step="4" value="${budget}"></label>
      <label>Simulated days <select name="runs">${[100, 300, 600].map((x) => html`<option value="${x}" ${x === runs ? "selected" : ""}>${x}${x === 300 ? " (recommended)" : x === 100 ? " (faster)" : ""}</option>`)}</select></label>
    </form>
    ${events.length ? html`<div class="sit-grid" data-tour="situations">${events.map(situationCard)}
      <div class="sit custom" data-ev="custom"><div class="row between"><span class="kind k-traffic">Your own</span></div><h3>Make your own rush</h3>
        <p class="desc">Choose how big the rush is, when it starts and how long it lasts.</p>
        <div class="inline-fields three"><label>Peak ×<input type="number" name="peak" min="1" max="50" value="6"></label>
          <label>Starts at<select name="start">${Array.from({ length: 24 }, (_, i) => html`<option value="${i}" ${i === 19 ? "selected" : ""}>${hh(i)}</option>`)}</select></label>
          <label>Hours<input type="number" name="hours" min="1" max="24" value="2"></label></div>
        <div class="row between sit-foot"><span></span><button class="btn primary sm" data-run="custom">Run this day →</button></div></div></div>`
      : empty("This system has no situations yet: make your own rush.")}`);
  on(root, "submit", "[data-settings]", (e) => e.preventDefault());
  on(root, "click", "[data-run]", (e, b) => {
    const f = Object.fromEntries(new FormData($("[data-settings]", root)));
    const qs = new URLSearchParams({ budget: f.budget || 40, runs: f.runs || 300 });
    if (b.dataset.run === "custom") {
      const c = b.closest(".sit");
      qs.set("peak", $("[name=peak]", c).value); qs.set("start", $("[name=start]", c).value); qs.set("hours", $("[name=hours]", c).value);
    }
    go(`/p/${S.project.id}/run/go/${encodeURIComponent(b.dataset.run)}?${qs}`);
  });
}

// ------------------------------------------------------------------ 3 · watch it happen
function body(key, q, save = true) {
  const budget = Math.max(0, Math.min(500, +q.budget || 40));
  const runs = Math.max(50, Math.min(1000, +q.runs || 300));
  const event = key === "custom" ? { peak: +q.peak || 6, start_hour: +q.start || 19, duration: +q.hours || 2 } : key;
  return { event, budget, runs, ...(q.seed ? { seed: +q.seed } : {}), ...(save ? {} : { save: false }) };
}

async function runIt(root, key, q) {
  const b = body(key, q);
  root.innerHTML = String(html`${stepper(2)}<div class="running"><span class="spinner"></span>
    <div><b>Simulating ${n(b.runs, 0)} days…</b><div class="muted small">Each day is played twice: with today's open debt, and after the best fixes that fit in ${n(b.budget)} hours.</div></div></div>`);
  let r;
  try { r = await api(`${P()}/simulate/spike`, { method: "POST", body: b }); }
  catch (e) { root.innerHTML = String(html`${stepper(1)}<div class="callout bad">${e.message}</div><a class="btn" href="${link("run", "situation")}">← Pick a situation</a>`); return; }
  S.lastRun = { id: r.run_id, project: S.project.id, result: r, key, budget: b.budget };
  history.replaceState(null, "", `#/p/${S.project.id}/run/watch/${r.run_id}`);  // a refresh must not run it again
  return watch(root, r.run_id, true);
}

async function replayFor(runId) {
  if (S.lastRun && S.lastRun.id === runId && S.lastRun.result && S.lastRun.result.replay) return S.lastRun.result;
  // Same seed and settings: the simulation is deterministic, so this is exactly the day that was run.
  const saved = await loadReport(runId);
  const p = saved.run.params || {};
  const key = p.custom ? "custom" : p.event;
  const q = p.custom ? { peak: p.custom.peak, start: p.custom.start_hour, hours: p.custom.duration } : {};
  const r = await api(`${P()}/simulate/spike`, { method: "POST", body: { ...body(key, { ...q, budget: p.budget, runs: p.runs, seed: p.seed }, false) } });
  r.run_id = runId;
  S.lastRun = { id: runId, project: S.project.id, result: r, key, budget: p.budget };
  return r;
}

async function watch(root, runId, autoplay = false) {
  let r = S.lastRun && S.lastRun.id === runId ? S.lastRun.result : null;
  if (!r) {
    root.innerHTML = String(html`${stepper(2)}<div class="running"><span class="spinner"></span><div><b>Loading the day…</b></div></div>`);
    try { r = await replayFor(runId); } catch (e) { root.innerHTML = String(html`${stepper(1)}<div class="callout bad">${e.message}</div>`); return; }
  }
  const b = r.before, a = r.after, rp = r.replay;
  root.innerHTML = String(html`${stepper(2)}
    <div class="watch">
      <div><span class="kind k-${r.event.kind || "traffic"}">${kindLabel(r.event.kind || "traffic")}</span>
        <h2>${r.event.name}</h2><p class="muted">${r.event.description || ""}</p></div>
      <div class="ba">
        <div class="ba-side bad"><div class="ba-l">Today, with the open debt</div><div class="ba-v">${n(b.hours_lost)} h</div><div class="ba-d">lost on an average day · ${n(b.failed_traffic_pct)}% of requests fail</div></div>
        <div class="ba-arrow">→</div>
        <div class="ba-side ok"><div class="ba-l">After fixing ${r.plan.selected.map((x) => x.key).join(", ") || "nothing"}</div><div class="ba-v">${n(a.hours_lost)} h</div><div class="ba-d">lost on an average day · ${n(a.failed_traffic_pct)}% of requests fail</div></div>
      </div>
      <p class="small muted">The replay plays day ${rp.run + 1} of ${n(r.runs, 0)}, picked because it is close to the average: ${n(rp.before.total_hours_lost)} h lost today, ${n(rp.after.total_hours_lost)} h after the fixes.</p>
      <div class="row"><button class="btn primary lg" data-watch>▶ Watch the day</button><a class="btn lg" href="${link("run", `report/${runId}`)}">Read the report →</a>
        <a class="btn ghost" href="${link("run", "situation")}">Try another situation</a></div>
    </div>`);
  const open = async (btn) => {
    const { openReplay } = await import("./replay.js");
    openReplay(r, { project: S.project, opener: btn, mode: "before", onReport: () => go(`/p/${S.project.id}/run/report/${runId}`) });
  };
  on(root, "click", "[data-watch]", (e, btn) => open(btn));
  if (autoplay) open($("[data-watch]", root));
}

// ------------------------------------------------------------------ 4 · read the report
async function report(root, runId) {
  root.innerHTML = String(html`${stepper(3)}<div class="loading"><span class="spinner"></span></div>`);
  let saved;
  try { saved = await loadReport(runId); } catch (e) { root.innerHTML = String(html`${stepper(3)}<div class="callout bad">${e.message}</div>`); return; }
  if (!S.lastRun || S.lastRun.id !== runId) S.lastRun = { id: runId, project: S.project.id, result: null, key: saved.run.params.event, budget: saved.run.params.budget };
  const actions = html`<a class="btn sm" href="${link("run", `watch/${runId}`)}">▶ Watch the day</a><a class="btn sm" href="${link("run", "situation")}?budget=${saved.report.settings.budget}">Try another situation</a>`;
  root.innerHTML = String(html`${stepper(3)}${reportHtml(saved.report, { runId, actions })}`);
  wireReport(root, runId);
}
