// Guided examiner tour: walks through the live sandbox data, one module at a time.
import { $, $$, html, on, store } from "./lib.js";
import { S, go } from "./app.js";

const KEY = "debtlens.tour";
let panel = null;

function steps() {
  const t = (S.project && S.project.tour) || {};
  const p = S.project ? S.project.id : 0;
  const r = (view, sub) => `/p/${p}/${view}${sub ? "/" + sub : ""}`;
  return [
    { view: "home", route: r("home"), title: "The story of this system",
      text: `${t.headline || "A realistic production system with a history of incidents."} You are the Tech Lead. This home screen is computed for your role — switch roles in the top bar to see the Developer, QA or Manager view.`,
      focus: "[data-tour=kpis]" },
    { view: "incidents", route: r("incidents", t.incident || ""), title: "M2 + M3 · One incident, end to end",
      text: "Every incident carries a 5 Whys chain. Each answer is a reusable cause node — when another incident gives the same answer, it converges onto the same node (see “shared with”). Below: similar past incidents scored lexically (TF-IDF) and semantically (MiniLM), and any regression.",
      focus: "[data-tour=whys]" },
    { view: "causal", route: r("causal"), title: "M3 · Root causes as a graph",
      text: "All 5 Whys chains merged into one directed graph. Node size = incidents converging on a cause. The ranking below uses that convergence plus betweenness centrality (shortest paths through the cause) — those are the systemic causes worth fixing once.",
      focus: "[data-tour=graph]" },
    { view: "debts", route: r("debts", t.debt || ""), title: "M4 · Debt priced in hours",
      text: "Principal = hours to fix. Interest = hours it costs every month: linked incident effort × severity weight, plus churn pressure and dependency blast radius. When interest > principal, the debt is past break-even.",
      focus: "[data-tour=ledger-row]" },
    { view: "evidence", route: r("evidence"), title: "M5 · Evidence mined from Git",
      text: `Churn × complexity hotspots, TODO/FIXME debt markers and the import-dependency graph come from the repository itself (CLI: full local history; website: any public GitHub URL). Look at the blast radius of “${t.module || "the core module"}”.`,
      focus: "[data-tour=hotspots]" },
    { view: "ledger", route: r("ledger"), title: "M7 · What to fix this sprint",
      text: `An exact precedence-constrained 0/1 knapsack chooses the debt set with the highest risk reduction that fits a ${t.budget || 40}-hour budget. It is compared live with greedy and with v1's naive DP, which ignored prerequisites.`,
      focus: "[data-tour=compare]" },
    { view: "sim", route: r("sim", "forecast"), title: "Simulation Lab · 12 sprints ahead",
      text: "Monte Carlo forecast: each open debt keeps causing incidents at a rate learned from its own history (Gamma–Poisson). The same random futures are replayed under each policy, so the difference is the policy alone (95% confidence interval).",
      focus: "[data-tour=forecast]" },
    { view: "sim", route: r("sim", "cascade"), title: "Simulation Lab · Inject a failure",
      text: `Fail “${t.cascade_module || "a core module"}” and watch the failure spread to modules that depend on it (independent cascade, fragility from debt risk). The likely path and the debts on it are listed — and you can raise a drill incident.`,
      focus: "[data-tour=cascade]" },
    { view: "sim", route: r("sim", "spike"), title: "Simulation Lab · The busiest day",
      text: "Run this system's busiest day hour by hour: which modules overload, how many engineer hours and requests it costs, and which debt to fix before it — compared with the regular sprint plan. Press Simulate, then try your own peak and budget.",
      focus: "[data-tour=spike]" },
    { view: "intel", route: r("intel", "eval"), title: "M6 · Measured, not claimed",
      text: "The scenario's or pack's incidents are labelled, so accuracy is measured live: precision@k for TF-IDF vs MiniLM vs the hybrid, clustering purity/ARI, and regression precision/recall at each threshold τ.",
      focus: "[data-tour=eval]" },
    { view: "terminal", route: r("terminal"), title: "Same engine in the terminal",
      text: "Everything you saw runs from the command line too (`pipx install debtlens`): scan a repo, ingest logs, plan, simulate, and gate a CI build. That's the tour — reset the sandbox any time.",
      focus: null },
  ];
}

const load = () => { try { return JSON.parse(store.get(KEY) || "null"); } catch { return null; } };
const save = (st) => (st ? store.set(KEY, JSON.stringify(st)) : store.del(KEY));

export function start() {
  save({ step: 0 });
  const st = steps()[0];
  go(st.route);
  setTimeout(() => sync(st.view), 50);
}
export function stop() { save(null); if (panel) panel.remove(); panel = null; $$(".tour-highlight").forEach((x) => x.classList.remove("tour-highlight")); }

export function sync(view) {
  const st = load();
  // A missing or stale saved state (e.g. from an older version of the tour) simply hides the panel.
  if (!st || !Number.isInteger(st.step) || !S.project || !S.project.tour) { if (panel) { panel.remove(); panel = null; } return; }
  const all = steps();
  const i = Math.max(0, Math.min(st.step, all.length - 1));
  const step = all[i];
  if (panel) panel.remove();
  panel = document.createElement("div");
  panel.className = "tour";
  panel.innerHTML = String(html`<div class="progress"><span style="width:${((i + 1) / all.length) * 100}%"></span></div>
    <div class="tour-head"><span>Guided tour · step ${i + 1} of ${all.length}</span><button class="btn ghost sm" data-x aria-label="Close tour">✕</button></div>
    <div class="tour-body"><h3>${step.title}</h3><div>${step.text}</div>
      ${view !== step.view ? html`<p class="small muted" style="margin-top:6px">You moved away from this step. <a href="#${step.route}">Go back to it</a>.</p>` : ""}</div>
    <div class="tour-foot"><button class="btn sm" data-prev ${i === 0 ? "disabled" : ""}>← Back</button>
      ${i < all.length - 1 ? html`<button class="btn sm primary" data-next>Next →</button>` : html`<button class="btn sm primary" data-x>Finish</button>`}</div>`);
  document.body.appendChild(panel);
  on(panel, "click", "[data-x]", stop);
  on(panel, "click", "[data-next],[data-prev]", (e, b) => {
    const j = i + (b.hasAttribute("data-next") ? 1 : -1);
    save({ step: j });
    go(all[j].route);
  });
  $$(".tour-highlight").forEach((x) => x.classList.remove("tour-highlight"));
  if (step.focus && view === step.view) {
    const tryFocus = (left) => {
      const t = $(step.focus);
      if (t) { t.classList.add("tour-highlight"); t.scrollIntoView({ block: "center", behavior: "smooth" }); }
      else if (left > 0) setTimeout(() => tryFocus(left - 1), 250);
    };
    tryFocus(12);
  }
}
