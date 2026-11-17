// M6 Intelligence: similar incidents, regressions, knowledge search and the measured evaluation.
import { $, api, chart, COLORS, debounce, fail, html, n, on, status } from "../lib.js";
import { link, S } from "../app.js";
import { card, empty, head, scoreBars } from "./_parts.js";

const P = () => `/projects/${S.project.id}`;
const TABS = [["", "Knowledge search"], ["similar", "Similar incidents"], ["regressions", "Regressions"], ["eval", "Evaluation (measured)"]];

export async function render(root, ctx) {
  const tab = ctx.sub[0] || "";
  root.innerHTML = String(html`${head("Intelligence", "Hybrid similarity = α · TF-IDF (shared words) + (1 − α) · MiniLM sentence embeddings (shared meaning). It powers duplicate checks, the knowledge base and regression detection.")}
    <div class="tabs">${TABS.map(([k, l]) => html`<a href="${link("intel")}${k ? "/" + k : ""}" class="${k === tab ? "active" : ""}">${l}</a>`)}</div><div data-tab></div>`);
  const box = $("[data-tab]", root);
  if (tab === "similar") return similarTab(box);
  if (tab === "regressions") return regressionTab(box);
  if (tab === "eval") return evalTab(box);
  return searchTab(box);
}

function searchTab(box) {
  box.innerHTML = String(html`<form class="row" data-q style="margin-bottom:14px"><input type="search" name="q" class="grow" style="max-width:640px" placeholder="Describe a problem in plain words, e.g. “refund sent twice after a retry”" autofocus>
      <button class="btn primary" type="submit">Search</button></form><div data-res>${empty("Search past incidents by meaning, not just keywords — results show what fixed them and the lesson learned.")}</div>`);
  const run = async (q) => {
    if (q.trim().length < 3) return;
    try {
      const r = await api(`${P()}/search`, { method: "POST", body: { query: q } });
      $("[data-res]", box).innerHTML = String(r.results.length ? html`<p class="small muted">${r.results.length} result(s) · ${r.method === "minilm" ? "MiniLM + TF-IDF" : "char n-gram + TF-IDF"}</p>
        ${r.results.map((m) => html`<div class="match"><div class="row between"><span><span class="key mono">${m.key}</span> <a href="${link("incidents", m.id)}">${m.title}</a> <span class="chip">${m.module}</span></span>${status(m.status)}</div>
          ${m.fix ? html`<div class="fix"><b>What fixed it:</b> ${m.fix}</div>` : html`<div class="fix muted">Not fixed yet.</div>`}${m.lessons ? html`<div class="fix"><b>Lesson:</b> ${m.lessons}</div>` : ""}${scoreBars(m)}</div>`)}` : empty("Nothing similar found."));
    } catch (e) { fail(e); }
  };
  on(box, "submit", "[data-q]", (e, f) => { e.preventDefault(); run(f.q.value); });
  on(box, "input", "[name=q]", debounce((e) => run(e.target.value), 500));
}

async function similarTab(box) {
  const incs = (await api(`${P()}/incidents?limit=500`)).items;
  box.innerHTML = String(html`<div class="card"><div class="table-tools"><label class="sr" for="pick">Incident</label>
      <select id="pick" data-pick style="max-width:520px">${incs.map((i) => html`<option value="${i.id}">${i.key} · ${i.title}</option>`)}</select>
      <span class="small muted">α</span><input type="range" min="0" max="1" step="0.05" value="${S.project.settings.alpha}" data-alpha style="width:160px"><output class="mono small" data-aout>${S.project.settings.alpha}</output>
      <span class="tiny muted">0 = meaning only · 1 = words only</span></div><div class="card-body" data-res></div></div>`);
  const run = async () => {
    const id = $("[data-pick]", box).value, a = $("[data-alpha]", box).value;
    $("[data-aout]", box).textContent = a;
    try {
      const r = await api(`${P()}/similar/${id}?k=8&threshold=0.1&alpha=${a}`);
      $("[data-res]", box).innerHTML = String(r.matches.length ? r.matches.map((m) => html`<div class="match"><div class="row between"><span><span class="key mono">${m.key}</span> <a href="${link("incidents", m.id)}">${m.title}</a></span><span class="row tight">${m.same_module ? html`<span class="chip">same module</span>` : ""}${status(m.status)}</span></div>
        <div class="tiny muted">shared terms: ${(m.shared_terms || []).join(", ") || "—"}</div>${scoreBars(m)}</div>`) : empty("Nothing above the threshold."));
    } catch (e) { fail(e); }
  };
  on(box, "change", "[data-pick]", run);
  on(box, "input", "[data-alpha]", debounce(run, 250));
  run();
}

async function regressionTab(box) {
  const tau0 = S.project.settings.tau;
  box.innerHTML = String(html`<div class="card"><div class="table-tools"><span class="small">Threshold τ</span><input type="range" min="0.2" max="0.8" step="0.05" value="${tau0}" data-tau style="width:220px">
      <output class="mono small" data-tout>${tau0}</output><span class="tiny muted">A regression = similarity ≥ τ, same module, reported after the earlier incident was resolved.</span></div><div data-res></div></div>`);
  const run = async () => {
    const t = $("[data-tau]", box).value;
    $("[data-tout]", box).textContent = t;
    try {
      const r = await api(`${P()}/regressions?tau=${t}`);
      $("[data-res]", box).innerHTML = String(r.regressions.length ? html`<table class="data"><thead><tr><th>New incident</th><th>Came back from</th><th>Module</th><th class="num">Hybrid</th><th class="num">Lexical</th><th class="num">Semantic</th><th class="num">Days after fix</th></tr></thead><tbody>
        ${r.regressions.map((x) => html`<tr><td><span class="key">${x.incident_key}</span> <a href="${link("incidents", x.incident_id)}">${x.incident_title}</a></td><td><span class="key">${x.regressed_from_key}</span> <a href="${link("incidents", x.regressed_from_id)}">${x.regressed_from_title}</a></td>
          <td>${x.module}</td><td class="num"><b>${n(x.similarity, 2)}</b></td><td class="num">${n(x.lexical, 2)}</td><td class="num">${n(x.semantic, 2)}</td><td class="num">${n(x.days_to_recurrence)}</td></tr>`)}</tbody></table>`
        : empty(`No regressions at τ = ${t}.`));
    } catch (e) { fail(e); }
  };
  on(box, "input", "[data-tau]", debounce(run, 250));
  run();
}

async function evalTab(box) {
  if (!S.project.scenario) { box.innerHTML = String(html`<div class="callout">Evaluation needs labelled ground truth — open one of the industry scenarios to see measured accuracy.</div>`); return; }
  const r = await api(`${P()}/evaluation`);
  const best = r.retrieval.reduce((a, b) => (b["p@1"] > a["p@1"] ? b : a), r.retrieval[0]);
  const cfg = r.configured;
  box.innerHTML = String(html`<div data-tour="eval"><div class="callout">The ${S.project.scenario_info ? S.project.scenario_info.name : ""} incidents carry hand-labelled duplicate groups and true regressions.
      Each incident in a group is used as a query; a hit is another member of its group. Nothing here is hard-coded — it is recomputed from the live data (${r.semantic_method === "minilm" ? "MiniLM loaded" : "MiniLM not loaded: char n-gram fallback"}).</div>
    <div class="grid c2">
      ${card("Retrieval accuracy by method", html`<div class="chart-box"><canvas data-ret></canvas></div>`)}
      ${card("Regression detection vs threshold τ", html`<div class="chart-box"><canvas data-reg></canvas></div><p class="tiny muted" style="margin:6px 0 0">Scored at the configured α = ${cfg.alpha}; configured τ = ${cfg.tau}. Lower τ finds more regressions (recall) at the cost of false alarms (precision).</p>`)}
    </div>
    <div class="grid c2" style="margin-top:16px">
      ${card("Retrieval (precision@k, MRR)", html`<table class="data"><thead><tr><th>Method</th><th class="num">Queries</th><th class="num">P@1</th><th class="num">Hit@3</th><th class="num">Hit@5</th><th class="num">MRR</th></tr></thead><tbody>
        ${r.retrieval.map((m) => html`<tr style="${m === best ? "font-weight:600" : ""}${m.configured ? ";background:var(--accent-weak)" : ""}"><td>${m.method}${m === best ? html` <span class="badge ok">best</span>` : ""}${m.configured ? html` <span class="badge accent">in use</span>` : ""}</td><td class="num">${m.queries}</td><td class="num">${n(m["p@1"], 3)}</td><td class="num">${n(m["hit@3"], 3)}</td><td class="num">${n(m["hit@5"], 3)}</td><td class="num">${n(m.mrr, 3)}</td></tr>`)}</tbody></table>`, { flush: true })}
      ${card("Root-cause clustering (DBSCAN)", html`<div class="kpis"><div class="kpi"><div class="v">${n(r.clustering.purity, 3)}</div><div class="l">Purity</div></div><div class="kpi"><div class="v">${n(r.clustering.ari, 3)}</div><div class="l">Adjusted Rand index</div></div>
          <div class="kpi"><div class="v">${r.clustering.clusters}</div><div class="l">Clusters</div><div class="d">${r.clustering.noise} noise · ε ${n(r.clustering.eps, 2)}</div></div></div>
        <table class="data"><thead><tr><th class="num">τ</th><th class="num">Precision</th><th class="num">Recall</th><th class="num">F1</th><th class="num">TP / FP / FN</th></tr></thead><tbody>
        ${r.regression.map((x) => html`<tr style="${x.configured ? "font-weight:600;background:var(--accent-weak)" : ""}"><td class="num">${x.tau}</td><td class="num">${n(x.precision, 3)}</td><td class="num">${n(x.recall, 3)}</td><td class="num">${n(x.f1, 3)}</td><td class="num">${x.tp} / ${x.fp} / ${x.fn}</td></tr>`)}</tbody></table>`)}
    </div></div>`);
  chart($("[data-ret]", box), { type: "bar", data: { labels: r.retrieval.map((m) => m.method.replace(" (lexical)", "").replace("Char n-gram TF-IDF", "Char n-gram").replace(" embeddings", "").replace("Hybrid α=", "Hybrid ")), datasets: [
      { label: "Precision@1", data: r.retrieval.map((m) => m["p@1"]), backgroundColor: COLORS.accent },
      { label: "MRR", data: r.retrieval.map((m) => m.mrr), backgroundColor: COLORS.accent2 }] },
    options: { scales: { y: { min: 0, max: 1, grid: { color: COLORS.grid } }, x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 10.5 } } } } } });
  chart($("[data-reg]", box), { type: "line", data: { labels: r.regression.map((x) => x.tau), datasets: [
      { label: "Precision", data: r.regression.map((x) => x.precision), borderColor: COLORS.accent, backgroundColor: COLORS.accent, tension: 0.2 },
      { label: "Recall", data: r.regression.map((x) => x.recall), borderColor: COLORS.warn, backgroundColor: COLORS.warn, tension: 0.2 },
      { label: "F1", data: r.regression.map((x) => x.f1), borderColor: COLORS.ok, backgroundColor: COLORS.ok, borderWidth: 3, tension: 0.2 }] },
    options: { scales: { y: { min: 0, max: 1, grid: { color: COLORS.grid } }, x: { title: { display: true, text: "τ" }, grid: { display: false } } } } });
}
