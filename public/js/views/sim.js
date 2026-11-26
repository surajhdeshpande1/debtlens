// Simulate: sprint forecast, failure injection, what-if costs and the industry comparison.
// (Situations on a hard day are the guided run in run.js; their reports live in runs.js.)
import { $, api, bar, chart, COLORS, debounce, fail, html, label, loadCytoscape, n, on, pct, toast } from "../lib.js";
import { can, go, link, openSandbox, S } from "../app.js";
import { card, empty } from "./_parts.js";

const P = () => `/projects/${S.project.id}`;
const INTRO = {
  forecast: "Many possible next sprints: how much each policy for paying down debt saves, with a 95% confidence interval.",
  cascade: "Fail one module on purpose and see which modules go down with it, and which debt makes that likely.",
  whatif: "Change what an hour of work or an incident costs, and see which debt items move past break-even.",
  "": "The same engine on every industry system, side by side.",
};

export async function render(root, ctx) {
  const tab = ["forecast", "cascade", "whatif"].includes(ctx.sub[0]) ? ctx.sub[0] : "";
  root.innerHTML = String(html`<p class="intro-line muted">${INTRO[tab]}</p><div data-tab></div>`);
  const box = $("[data-tab]", root);
  if (tab === "whatif") return whatif(box);
  if (tab === "forecast") return forecast(box);
  if (tab === "cascade") return cascade(box);
  return scenarios(box);
}

// ------------------------------------------------------------------ 1. industry scenarios
async function scenarios(box) {
  box.innerHTML = String(html`<div class="loading"><span class="spinner"></span> Running the engine on every scenario…</div>`);
  const r = await api(`/scenarios/compare?budget=40`);
  const cur = S.project.scenario;
  const rows = [
    ["Incidents (open)", (x) => `${x.incidents} (${x.open_incidents})`],
    ["Mean time to resolve", (x) => (x.mttr_hours === null ? "–" : `${n(x.mttr_hours)} h`)],
    ["Modules", (x) => x.modules],
    ["Open debt items", (x) => x.open_debts],
    ["Principal (hours to fix all)", (x) => `${n(x.principal)} h`],
    ["Interest (hours lost / month)", (x) => `${n(x.interest)} h`],
    ["Past break-even", (x) => pct(x.break_even_pct)],
    ["Regressions detected", (x) => x.regressions],
    ["TODO / FIXME markers", (x) => x.satd],
    ["Most systemic root cause", (x) => x.systemic_cause || "–"],
    ["Plan @ 40 h: items / hours", (x) => `${x.plan_items} / ${n(x.plan_hours)} h`],
    ["Plan @ 40 h: interest retired", (x) => `${n(x.interest_retired)} h / mo`],
    ["Exact vs greedy / vs v1 planner", (x) => `+${n(x.gain_vs_greedy_pct)}% / +${n(x.gain_vs_naive_pct)}%`],
    ["8 sprints: hours saved vs doing nothing", (x) => (x.hours_saved_8_sprints === null ? "–" : `${n(x.hours_saved_8_sprints)} h (${n(x.pct_saved_8_sprints)}%)`)],
  ];
  box.innerHTML = String(html`<p class="small muted">Five systems from different industries, each with its own modules, incident history and debt. One engine, no per-industry code — the differences you see come from the data. ${r.seconds}s to compute.</p>
    <div class="scen-grid" style="margin-bottom:16px">${r.scenarios.map((x) => html`<div class="scen" style="${x.code === cur ? "border-color:var(--accent);box-shadow:var(--shadow)" : ""}">
      <div class="ind">${x.industry}</div><h3>${x.name}</h3><div class="tag">${x.tagline}</div>
      <div class="stats">${n(x.interest)} h/month interest · ${pct(x.break_even_pct)} past break-even</div>
      ${x.code === cur ? html`<span class="badge accent">you are here</span>` : S.project.is_sandbox ? html`<button class="btn sm primary" data-switch="${x.code}">Switch sandbox to ${x.name}</button>`
        : can("project.manage") ? html`<button class="btn sm" data-create="${x.code}">Add as project</button>` : html`<button class="btn sm" data-try="${x.code}">Open as sandbox</button>`}</div>`)}</div>
    ${card("Side by side", html`<div class="table-wrap"><table class="data"><thead><tr><th></th>${r.scenarios.map((x) => html`<th style="${x.code === cur ? "color:var(--accent-strong)" : ""}">${x.name}<div class="tiny muted">${x.industry}</div></th>`)}</tr></thead>
      <tbody>${rows.map(([l, f]) => html`<tr><td class="small muted nowrap">${l}</td>${r.scenarios.map((x) => html`<td class="small">${f(x)}</td>`)}</tr>`)}</tbody></table></div>`, { flush: true })}
    <div class="grid c2" style="margin-top:16px">${card("Interest per month vs principal", html`<div class="chart-box"><canvas data-c1></canvas></div>`)}
      ${card("Hours saved by the optimal plan over 8 sprints", html`<div class="chart-box"><canvas data-c2></canvas></div>`)}</div>`);
  const names = r.scenarios.map((x) => x.name);
  chart($("[data-c1]", box), { type: "bar", data: { labels: names, datasets: [{ label: "Principal (h)", data: r.scenarios.map((x) => x.principal), backgroundColor: COLORS.accent2 },
    { label: "Interest (h / month)", data: r.scenarios.map((x) => x.interest), backgroundColor: COLORS.bad }] }, options: { scales: { y: { beginAtZero: true, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } } });
  chart($("[data-c2]", box), { type: "bar", data: { labels: names, datasets: [{ label: "Hours saved (mean of 60 runs)", data: r.scenarios.map((x) => x.hours_saved_8_sprints), backgroundColor: COLORS.ok }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } } });
  on(box, "click", "[data-switch]", async (e, b) => {
    b.disabled = true;
    try {
      const r2 = await api("/sandbox/reset", { method: "POST", body: { scenario: b.dataset.switch } });
      const { auth } = await import("../lib.js");
      auth.token = r2.token; S.me = null; S.project = null;
      toast(`Switched to ${r2.project.name}`, "ok");
      go(`/p/${r2.project.id}/sim`);
    } catch (ex) { fail(ex); b.disabled = false; }
  });
  on(box, "click", "[data-create]", async (e, b) => {
    b.disabled = true;
    try { const r2 = await api("/projects", { method: "POST", body: { scenario: b.dataset.create } }); toast("Project created", "ok"); go(`/p/${r2.project.id}/home`); }
    catch (ex) { fail(ex); b.disabled = false; }
  });
  on(box, "click", "[data-try]", (e, b) => { if (confirm("Open this scenario as a separate sandbox? You will leave your account session in this tab.")) openSandbox(b.dataset.try, "tech_lead").catch(fail); });
}

// ------------------------------------------------------------------ 2. what-if
const SLIDERS = [
  ["lambda_churn", "λ₁ churn weight", 0, 1, 0.01], ["lambda_blast", "λ₂ blast-radius weight", 0, 6, 0.1],
  ["sw_CRITICAL", "weight: critical", 0, 8, 0.1], ["sw_HIGH", "weight: high", 0, 6, 0.1], ["sw_MEDIUM", "weight: medium", 0, 4, 0.1], ["sw_LOW", "weight: low", 0, 3, 0.1],
  ["w_interest", "risk: interest share", 0, 1, 0.05], ["w_blast", "risk: blast share", 0, 1, 0.05], ["w_severity", "risk: severity share", 0, 1, 0.05], ["w_centrality", "risk: centrality share", 0, 1, 0.05],
];
async function whatif(box) {
  const base = S.project.settings.economics;
  const val = (k) => (k.startsWith("sw_") ? base.severity_weight[k.slice(3)] : base[k]);
  box.innerHTML = String(html`<div class="grid side"><div data-out><div class="loading"><span class="spinner"></span></div></div>
    <div>${card("Assumptions", html`<form data-f>${SLIDERS.map(([k, l, lo, hi, st]) => html`<div class="slider-row"><label for="s-${k}" style="margin:0">${l}</label>
        <input id="s-${k}" type="range" name="${k}" min="${lo}" max="${hi}" step="${st}" value="${val(k)}"><output>${val(k)}</output></div>`)}</form>
      <div class="row tight" style="margin-top:8px"><button class="btn sm" data-reset>Reset to project values</button>${can("settings.write") ? html`<button class="btn sm primary" data-save>Save as project settings</button>` : ""}</div>
      <p class="tiny muted" style="margin:8px 0 0">Interest I(d) = Σ w(sev)·effort + λ₁·churn + λ₂·blast. Risk = 100·(wᵢ·I/Iₘₐₓ + w_b·B/Bₘₐₓ + w_s·S/Sₘₐₓ + w_c·C/Cₘₐₓ), ×1.2 past break-even.</p>`)}</div></div>`);
  const form = $("[data-f]", box);
  const params = () => {
    const d = {}; const sw = {};
    SLIDERS.forEach(([k]) => { const v = +form[k].value; if (k.startsWith("sw_")) sw[k.slice(3)] = v; else d[k] = v; });
    d.severity_weight = sw;
    return d;
  };
  const run = async () => {
    SLIDERS.forEach(([k]) => { form[k].nextElementSibling.textContent = form[k].value; });
    try {
      const r = await api(`${P()}/simulate/whatif`, { method: "POST", body: { params: params(), budgets: [8, 16, 24, 32, 40, 56, 80, 120] } });
      const b = r.summary_before, a = r.summary_after;
      const moved = r.changes.filter((c) => c.rank_before !== c.rank_after || c.break_even_before !== c.break_even_after).slice(0, 12);
      $("[data-out]", box).innerHTML = String(html`<div class="kpis">
          <div class="kpi"><div class="v">${n(a.total_interest)} h</div><div class="l">Interest / month</div><div class="d">was ${n(b.total_interest)} h <span class="${a.total_interest > b.total_interest ? "delta-up" : "delta-down"}">${a.total_interest >= b.total_interest ? "+" : ""}${n(a.total_interest - b.total_interest)}</span></div></div>
          <div class="kpi"><div class="v">${pct(a.break_even_pct)}</div><div class="l">Past break-even</div><div class="d">was ${pct(b.break_even_pct)}</div></div>
          <div class="kpi ${r.flips.length ? "warn" : ""}"><div class="v">${r.flips.length}</div><div class="l">Break-even flips</div><div class="d">${r.flips.slice(0, 4).join(", ") || "none"}</div></div></div>
        ${card("Value of the optimal plan at each budget", html`<div class="chart-box"><canvas data-curve></canvas></div>`)}
        <div style="margin-top:16px">${card("Items whose rank or break-even changed", moved.length ? html`<table class="data"><thead><tr><th>Debt</th><th class="num">Rank</th><th class="num">Interest</th><th class="num">Risk</th><th>Break-even</th></tr></thead><tbody>
          ${moved.map((c) => html`<tr><td><span class="key">${c.key}</span> <a href="${link("debts", c.id)}">${c.title}</a></td><td class="num">${c.rank_before} → <b>${c.rank_after}</b></td>
            <td class="num">${n(c.interest_before)} → ${n(c.interest_after)}</td><td class="num">${n(c.risk_before)} → ${n(c.risk_after)}</td>
            <td>${c.break_even_before === c.break_even_after ? (c.break_even_after ? "past" : "not yet") : html`<span class="badge warn">${c.break_even_before ? "past → not yet" : "not yet → past"}</span>`}</td></tr>`)}</tbody></table>` : empty("Ranking unchanged — move a slider."), { flush: !!moved.length })}</div>`);
      chart($("[data-curve]", box), { type: "line", data: { labels: r.budget_curve.map((x) => x.budget + " h"), datasets: [
        { label: "Project assumptions", data: r.budget_curve.map((x) => x.value_before), borderColor: COLORS.muted, backgroundColor: COLORS.muted, borderDash: [5, 4], tension: 0.25 },
        { label: "What-if", data: r.budget_curve.map((x) => x.value_after), borderColor: COLORS.accent, backgroundColor: COLORS.accent, borderWidth: 3, tension: 0.25 }] },
        options: { scales: { y: { beginAtZero: true, title: { display: true, text: "risk reduction" }, grid: { color: COLORS.grid } }, x: { title: { display: true, text: "sprint budget" }, grid: { display: false } } } } });
    } catch (e) { fail(e); }
  };
  on(box, "input", "[data-f] input", debounce(run, 220));
  on(box, "click", "[data-reset]", () => { SLIDERS.forEach(([k]) => { form[k].value = val(k); }); run(); });
  on(box, "click", "[data-save]", async () => {
    try { const r = await api(`${P()}`, { method: "PATCH", body: { economics: params() } }); S.project = r.project; toast("Saved — the ledger and plans now use these values", "ok"); } catch (e) { fail(e); }
  });
  run();
}

// ------------------------------------------------------------------ 3. Monte Carlo forecast
const PCOL = { optimal: COLORS.accent, greedy: COLORS.ok, oldest_first: COLORS.warn, none: COLORS.bad };
async function forecast(box) {
  box.innerHTML = String(html`<form class="card" data-f><div class="card-body inline-fields" style="align-items:end">
      <div class="field"><label>Budget per sprint (h)</label><input name="budget" type="number" min="0" max="400" value="${(S.project.tour && S.project.tour.budget) || 40}"></div>
      <div class="field"><label>Sprints</label><input name="sprints" type="number" min="1" max="26" value="12"></div>
      <div class="field"><label>Monte Carlo runs</label><input name="runs" type="number" min="10" max="600" value="200"></div>
      <div class="field"><label>New debt per sprint (λ)</label><input name="inflow_rate" type="number" min="0" max="5" step="0.05" value="0.25"></div>
      <div class="field"><label>Incident rate ×</label><input name="hazard_scale" type="number" min="0" max="5" step="0.1" value="1"></div>
      <div class="field"><label>Seed</label><input name="seed" type="number" min="0" value="7"></div>
      <div class="field"><button class="btn primary" type="submit">Run forecast</button></div></div></form>
    <div data-out style="margin-top:16px"></div>`);
  const run = async (f) => {
    const body = Object.fromEntries(new FormData(f));
    $("[data-out]", box).innerHTML = String(html`<div class="loading"><span class="spinner"></span> Simulating ${body.runs} futures × 4 policies…</div>`);
    try {
      const r = await api(`${P()}/simulate/forecast`, { method: "POST", body });
      const pols = Object.entries(r.policies);
      const cmp = r.comparisons;
      $("[data-out]", box).innerHTML = String(html`<div data-tour="forecast">
        <div class="grid c2">${card("Cumulative incident hours (mean, with p10–p90 band)", html`<div class="chart-box tall"><canvas data-c></canvas></div>`)}
          ${card("Open debt items per sprint", html`<div class="chart-box tall"><canvas data-o></canvas></div>`)}</div>
        <div class="grid c2" style="margin-top:16px">${card("Outcome after " + r.config.sprints + " sprints", html`<table class="data"><thead><tr><th>Policy</th><th class="num">Incident hours</th><th class="num">p10–p90</th><th class="num">Fix hours</th><th class="num">Open items</th></tr></thead><tbody>
            ${pols.map(([k, p]) => html`<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${PCOL[k]};margin-right:6px"></i>${p.label}</td><td class="num"><b>${n(p.final_hours_mean)}</b></td>
              <td class="num">${n(p.final_hours_p10)}–${n(p.final_hours_p90)}</td><td class="num">${n(p.fix_hours_mean)}</td><td class="num">${n(p.open_mean[p.open_mean.length - 1])}</td></tr>`)}</tbody></table>`, { flush: true })}
          ${card("Paired comparison (same random futures)", html`<table class="data"><thead><tr><th>Comparison</th><th class="num">Hours saved</th><th class="num">95% CI</th><th class="num">%</th><th class="num">Runs better</th></tr></thead><tbody>
            ${Object.entries(cmp).map(([k, c]) => html`<tr><td>${k.replace("_vs_", " vs ").replace(/_/g, " ")}</td><td class="num"><b>${n(c.hours_saved_mean)}</b></td><td class="num">${n(c.ci95[0])} … ${n(c.ci95[1])}</td><td class="num">${n(c.pct_saved)}%</td><td class="num">${c.runs_better} / ${r.config.runs}</td></tr>`)}</tbody></table>
            <p class="tiny muted" style="margin:8px 12px">Each open debt keeps causing incidents at its own learned rate (Gamma–Poisson, mean (n + 0.5)/(age + 2) × structural multiplier); new debt arrives at λ per sprint. ${r.seconds}s.</p>`, { flush: true })}</div></div>`);
      const labels = r.sprints.map((s) => "S" + s);
      const ds = [];
      pols.forEach(([k, p]) => {
        ds.push({ label: p.label, data: p.cum_hours_mean, borderColor: PCOL[k], backgroundColor: PCOL[k], borderWidth: k === "optimal" || k === "none" ? 3 : 1.5, tension: 0.25, pointRadius: 0 });
        if (k === "optimal" || k === "none") {
          ds.push({ label: `${k} p90`, data: p.cum_hours_p90, borderColor: "transparent", backgroundColor: PCOL[k] + "22", fill: "+1", pointRadius: 0 });
          ds.push({ label: `${k} p10`, data: p.cum_hours_p10, borderColor: "transparent", backgroundColor: PCOL[k] + "22", fill: false, pointRadius: 0 });
        }
      });
      chart($("[data-c]", box), { type: "line", data: { labels, datasets: ds }, options: { plugins: { legend: { labels: { filter: (it) => !/p(1|9)0$/.test(it.text) } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "hours" }, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } } });
      chart($("[data-o]", box), { type: "line", data: { labels, datasets: pols.map(([k, p]) => ({ label: p.label, data: p.open_mean, borderColor: PCOL[k], backgroundColor: PCOL[k], tension: 0.25, pointRadius: 0 })) },
        options: { scales: { y: { beginAtZero: true, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } } });
    } catch (e) { fail(e); $("[data-out]", box).innerHTML = ""; }
  };
  on(box, "submit", "[data-f]", (e, f) => { e.preventDefault(); run(f); });
  run($("[data-f]", box));
}

// ------------------------------------------------------------------ 4. failure injection
async function cascade(box) {
  const mods = await api(`${P()}/modules`);
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const start = q.get("module") || (S.project.tour && S.project.tour.cascade_module) || (mods.modules.sort((a, b) => b.blast_radius - a.blast_radius)[0] || {}).name;
  box.innerHTML = String(html`<div class="card"><form class="table-tools" data-f><span class="small">Fail module</span>
      <select name="module" style="width:auto">${mods.modules.map((m) => html`<option value="${m.name}" ${m.name === start ? "selected" : ""}>${m.name} (${m.used_by.length} dependents)</option>`)}</select>
      <span class="small">spread probability p</span><input type="range" name="p" min="0.05" max="0.9" step="0.05" value="0.35" style="width:160px"><output class="mono small">0.35</output>
      <span class="small">runs</span><input type="number" name="runs" min="100" max="10000" value="3000" style="width:90px">
      <button class="btn primary" type="submit">Inject failure</button>${can("incident.write") ? html`<button class="btn" type="button" data-drill>Raise a drill incident</button>` : ""}</form>
    <div class="card-body" data-out><div class="loading"><span class="spinner"></span></div></div></div>`);
  const form = $("[data-f]", box);
  const cytoscape = await loadCytoscape();
  const run = async (drill = false) => {
    form.p.nextElementSibling.textContent = form.p.value;
    try {
      const r = await api(`${P()}/simulate/cascade`, { method: "POST", body: { module: form.module.value, p: +form.p.value, runs: +form.runs.value, create_incident: drill } });
      if (drill && r.incident) toast(`Drill incident ${r.incident.key} raised — practise the 5 Whys on it`, "ok");
      const prob = Object.fromEntries(r.modules.map((m) => [m.module, m.probability]));
      $("[data-out]", box).innerHTML = String(html`<div data-tour="cascade"><div class="kpis">
          <div class="kpi bad"><div class="v">${n(r.expected_affected, 2)}</div><div class="l">Modules expected to fail</div><div class="d">besides ${r.start}</div></div>
          <div class="kpi"><div class="v">${n(r.p90_affected, 0)}</div><div class="l">90th percentile</div></div>
          <div class="kpi"><div class="v">${r.worst_case_affected}</div><div class="l">Worst case</div><div class="d">${r.worst_case_modules.join(", ") || "—"}</div></div>
          <div class="kpi warn"><div class="v">${n(r.expected_extra_hours)} h</div><div class="l">Expected extra incident hours</div></div></div>
        <div class="grid side"><div><div class="graph short" data-g></div><div class="legend"><span><i style="background:#1a1e24"></i>injected</span><span><i style="background:#c0392b"></i>likely to fail</span><span>darker = higher probability</span></div></div>
          <div>${card("Debt on the failure paths", r.debts_in_path && r.debts_in_path.length ? html`<ul class="small" style="padding-left:18px;margin:0">${r.debts_in_path.map((d) => html`<li><a href="${link("debts")}">${d.key}</a> ${d.title} <span class="muted">(${d.module}, risk ${n(d.risk)})</span></li>`)}</ul>`
            : html`<span class="small muted">No open debt on these paths.</span>`)}</div></div>
        <table class="data" style="margin-top:14px"><thead><tr><th>Module</th><th style="min-width:160px">Failure probability</th><th class="num">Fragility</th><th>Most likely path</th><th class="num">Expected hours</th></tr></thead><tbody>
          ${r.modules.filter((m) => m.probability > 0).map((m) => html`<tr><td><b>${m.module}</b>${m.in_worst_case ? html` <span class="badge bad">worst case</span>` : ""}</td><td>${bar(m.probability * 100, 100, m.probability > 0.3 ? "bad" : "warn", "%")}</td>
            <td class="num">${n(m.fragility, 2)}</td><td class="small mono">${(m.likely_path[m.likely_path.length - 1] === m.module ? m.likely_path : [...m.likely_path, m.module]).join(" → ")}</td><td class="num">${n(m.expected_hours)}</td></tr>`)}</tbody></table>
        <p class="tiny muted">Independent-cascade model over “depends on” edges, reversed: when a module fails, each dependent fails with probability p × fragility (fragility = 0.5 + 0.5 × its debt risk / max). ${r.runs} runs, ${r.seconds}s.</p></div>`);
      const cy = cytoscape({ container: $("[data-g]", box), elements: [
          ...mods.modules.map((m) => ({ data: { id: m.name, label: m.name, p: m.name === r.start ? 1 : prob[m.name] || 0, start: m.name === r.start } })),
          ...mods.dependencies.map((e) => ({ data: { id: `${e.source}>${e.target}`, source: e.source, target: e.target } }))],
        style: [{ selector: "node", style: { "background-color": (el) => (el.data("start") ? "#1a1e24" : `rgba(192,57,43,${0.12 + 0.88 * el.data("p")})`), label: "data(label)", "font-size": 10,
            "text-valign": "bottom", "text-margin-y": 4, width: (el) => 22 + 30 * el.data("p"), height: (el) => 22 + 30 * el.data("p"), "border-width": 1, "border-color": "#c9ced6" } },
          { selector: "edge", style: { width: 1.5, "line-color": "#d5d9df", "target-arrow-color": "#b5bcc5", "target-arrow-shape": "triangle", "curve-style": "bezier" } }],
        layout: { name: "breadthfirst", directed: true, roots: `#${CSS.escape(r.start)}`, spacingFactor: 1.1, padding: 16 } });
      cy.edges().forEach((e) => { if ((prob[e.source().id()] || 0) > 0 && (e.target().id() === r.start || (prob[e.target().id()] || 0) > 0)) e.style({ "line-color": "#e8a59c", "target-arrow-color": "#c0392b" }); });
    } catch (e) { fail(e); }
  };
  on(box, "submit", "[data-f]", (e) => { e.preventDefault(); run(); });
  on(box, "input", "[name=p]", (e) => { form.p.nextElementSibling.textContent = form.p.value; });
  on(box, "change", "[name=p],[name=module]", () => run());
  on(box, "click", "[data-drill]", () => run(true));
  run();
}
