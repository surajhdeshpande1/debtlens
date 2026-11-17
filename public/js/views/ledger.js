// M7 Ledger & optimiser: principal, interest, break-even; exact knapsack sprint planner; approvals.
import { $, api, ago, chart, COLORS, debounce, fail, html, hrs, label, n, on, pct, toast } from "../lib.js";
import { can, link, S } from "../app.js";
import { card, debtTable, empty, head, planCompare } from "./_parts.js";

const P = () => `/projects/${S.project.id}`;

export async function render(root, ctx) {
  const [led, plans] = await Promise.all([api(`${P()}/ledger`), api(`${P()}/plans`)]);
  const sm = led.summary;
  const open = led.rows.filter((r) => r.is_open);
  const budget0 = (S.project.tour && S.project.tour.budget) || 40;
  const cats = Object.keys(sm.by_category);
  root.innerHTML = String(html`${head("Ledger & optimiser", "Every open debt item priced as principal (hours to fix) and interest (hours lost per month). The optimiser picks the set with the largest risk reduction that fits your sprint budget, respecting prerequisites.")}
    <div class="kpis">
      <div class="kpi"><div class="v">${n(sm.total_principal)} h</div><div class="l">Principal</div><div class="d">${sm.open_items} open items</div></div>
      <div class="kpi bad"><div class="v">${n(sm.total_interest)} h</div><div class="l">Interest / month</div><div class="d">I(d) = Σ w·effort + λ₁·churn + λ₂·blast</div></div>
      <div class="kpi ${sm.net_drag > 0 ? "bad" : "ok"}"><div class="v">${n(sm.net_drag)} h</div><div class="l">Net drag</div><div class="d">interest − principal</div></div>
      <div class="kpi ${sm.break_even_pct > 50 ? "bad" : "warn"}"><div class="v">${pct(sm.break_even_pct)}</div><div class="l">Past break-even</div><div class="d">${sm.break_even_count} of ${sm.open_items} items</div></div>
      <div class="kpi ok"><div class="v">${sm.remediated_items}</div><div class="l">Paid off</div><div class="d">remediated items</div></div>
    </div>
    <div class="grid c2">${card("Interest by category", html`<div class="chart-box short"><canvas data-cat></canvas></div>`)}${card("Interest by module", html`<div class="chart-box short"><canvas data-mod></canvas></div>`)}</div>
    <section class="card" style="margin-top:16px"><div class="card-head"><h3>Sprint planner</h3><span class="tiny muted">precedence-constrained 0/1 knapsack · exact</span></div><div class="card-body">
      <form data-plan class="grid c4" style="align-items:end">
        <div><label>Effort budget: <b data-bout>${budget0}</b> hours</label><input type="range" name="budget" min="4" max="200" step="2" value="${budget0}"></div>
        <div><label>Method</label><select name="method"><option value="auto">Exact (auto: tree DP / branch &amp; bound)</option><option value="tree_dp">Tree DP</option><option value="branch_and_bound">Branch &amp; bound</option>
          <option value="greedy">Greedy (value per hour)</option><option value="naive_dp">v1 naive DP</option><option value="brute_force">Brute force (small backlogs)</option></select></div>
        <div><label>Only categories</label><select name="categories" multiple size="3" style="height:auto">${cats.map((c) => html`<option value="${c}">${label(c)}</option>`)}</select></div>
        <div><label>Must include</label><select name="force" multiple size="3" style="height:auto">${open.map((r) => html`<option value="${r.id}">${r.key} · ${r.title}</option>`)}</select></div>
      </form><div data-result style="margin-top:14px"><div class="loading"><span class="spinner"></span></div></div></div></section>
    <div class="grid c2" style="margin-top:16px">
      ${card("Full ledger (risk-ranked)", debtTable(open, { compact: true }), { flush: true })}
      ${card("Approved sprint plans", plans.plans.length ? html`<table class="data"><thead><tr><th>When</th><th>By</th><th class="num">Budget</th><th class="num">Used</th><th>Items</th><th>Notes</th></tr></thead><tbody>
          ${plans.plans.map((p) => html`<tr><td class="nowrap">${ago(p.created_at)}</td><td class="small">${p.approved_by || "—"}</td><td class="num">${n(p.budget_hours)} h</td><td class="num">${n(p.total_hours)} h</td><td class="small mono">${p.selected_keys.join(" ")}</td><td class="small">${p.notes || ""}</td></tr>`)}</tbody></table>`
        : empty("No plan approved yet. A Manager or Tech Lead approves a plan; its items become the sprint backlog (PRIORITIZED)."), { flush: !!plans.plans.length })}
    </div>`);

  const byCat = Object.entries(sm.by_category).sort((a, b) => b[1].interest - a[1].interest);
  chart($("[data-cat]", root), { type: "bar", data: { labels: byCat.map((e) => label(e[0])), datasets: [{ label: "h / month", data: byCat.map((e) => e[1].interest), backgroundColor: COLORS.accent }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } } });
  const byMod = Object.entries(sm.by_module).sort((a, b) => b[1].interest - a[1].interest).slice(0, 10);
  chart($("[data-mod]", root), { type: "bar", data: { labels: byMod.map((e) => e[0]), datasets: [{ label: "h / month", data: byMod.map((e) => e[1].interest), backgroundColor: COLORS.bad }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } } });

  const form = $("[data-plan]", root);
  let last = null;
  const run = async () => {
    const budget = +form.budget.value;
    $("[data-bout]", root).textContent = budget;
    const sel = (name) => Array.from(form.querySelector(`[name=${name}]`).selectedOptions).map((o) => o.value);
    const body = { budget, method: form.method.value, categories: sel("categories"), force: sel("force").map(Number) };
    try {
      const r = await api(`${P()}/plan`, { method: "POST", body });
      last = body;
      $("[data-result]", root).innerHTML = String(planView(r, budget));
    } catch (e) { $("[data-result]", root).innerHTML = String(html`<div class="callout bad">${e.message}</div>`); }
  };
  on(root, "input", "[name=budget]", debounce(run, 200));
  on(root, "change", "[data-plan] select", run);
  on(root, "click", "[data-approve]", async (e, b) => {
    const notes = prompt("Notes for this sprint plan (optional):", "") ;
    if (notes === null) return;
    b.disabled = true;
    try {
      const r = await api(`${P()}/plans`, { method: "POST", body: { ...last, notes } });
      toast(`Plan approved — ${r.plan.selected_keys.length} items moved to PRIORITIZED`, "ok");
      render(root, ctx);
    } catch (ex) { fail(ex); b.disabled = false; }
  });
  run();
}

function planView(r, budget) {
  const deferred = r.deferred_items || [];
  return html`<div class="grid c2"><div>
      <div class="row tight" style="margin-bottom:8px"><span class="badge accent">${r.method.replace(/_/g, " ")}</span>${r.optimal ? html`<span class="badge ok">optimal (proven)</span>` : html`<span class="badge warn">heuristic</span>`}
        <span class="small muted">${n(r.millis, 1)} ms · ${n(r.work, 0)} steps</span></div>
      <div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><div class="v">${n(r.total_weight)} / ${n(budget)} h</div><div class="l">Hours used (${pct(r.utilization)})</div></div>
        <div class="kpi ok"><div class="v">${n(r.total_value)}</div><div class="l">Risk reduction</div></div><div class="kpi ok"><div class="v">${hrs(r.interest_retired)}</div><div class="l">Interest retired / month</div></div></div>
      ${r.selected_items.length ? html`<table class="data"><thead><tr><th>Fix this sprint</th><th class="num">Hours</th><th class="num">Interest</th><th class="num">Risk</th></tr></thead><tbody>
        ${r.selected_items.map((x) => html`<tr><td><span class="key">${x.key}</span> <a href="${link("debts", x.id)}">${x.title}</a>${(r.forced || []).includes(x.id) ? html` <span class="chip">forced</span>` : ""}</td><td class="num">${n(x.principal)}</td><td class="num">${n(x.interest)}</td><td class="num">${n(x.risk)}</td></tr>`)}</tbody></table>` : empty("Nothing fits this budget.")}
      ${(r.warnings || []).length ? html`<div class="callout warn" style="margin-top:10px">${r.warnings.join(" · ")}</div>` : ""}
      ${can("plan.approve") ? html`<div class="row" style="margin-top:10px"><button class="btn primary" data-approve ${r.selected_items.length ? "" : "disabled"}>Approve as sprint plan</button>
        <span class="small muted">Selected items become PRIORITIZED.</span></div>` : html`<p class="small muted" style="margin-top:10px">A Manager or Tech Lead can approve this plan.</p>`}
    </div><div>
      ${r.comparison ? card("Compared on the same backlog", planCompare(r.comparison, budget)) : ""}
      ${deferred.length ? html`<h4 style="margin-top:14px">Not selected</h4><table class="data"><tbody>${deferred.slice(0, 12).map((x) => html`<tr><td><span class="key">${x.key}</span> ${x.title}</td><td class="small muted">${x.reason}</td></tr>`)}</tbody></table>` : ""}
    </div></div>`;
}
