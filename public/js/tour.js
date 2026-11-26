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
    { view: "home", route: r("home"), title: "Overview · the story of this system",
      text: `${t.headline || "A realistic production system with a history of incidents."} You are the Tech Lead; switch roles in the top bar to see what a Developer, QA or Manager sees.`,
      focus: "[data-tour=kpis]" },
    { view: "incidents", route: r("incidents", t.incident || ""), title: "Incidents · one incident, end to end",
      text: "Every incident has a 5 Whys chain. When another incident gives the same answer, both point at the same cause (see “shared with”). Below it: similar past incidents, found by words (TF-IDF) and by meaning (MiniLM), and any regression.",
      focus: "[data-tour=whys]" },
    { view: "causal", route: r("causal"), title: "Incidents · root causes as a graph",
      text: "All the 5 Whys chains merged into one graph. The bigger the node, the more incidents end at that cause. The causes ranked first are the ones worth fixing once.",
      focus: "[data-tour=graph]" },
    { view: "debts", route: r("debts", t.debt || ""), title: "Debt · priced in hours",
      text: "Principal is the hours to fix it. Interest is the hours it costs every month, from the incidents it caused, how often its code changes and how much depends on it. When interest passes principal, it is past break-even. Each item also gets a fix playbook.",
      focus: "[data-tour=ledger-row]" },
    { view: "ledger", route: r("ledger"), title: "Debt · what to fix this sprint",
      text: `An exact planner picks the set of fixes that lowers risk most within a ${t.budget || 40}-hour sprint, respecting which fix needs which. It is compared live with a greedy pick and with the first version's planner.`,
      focus: "[data-tour=compare]" },
    { view: "run", route: r("run", "situation"), title: "Simulate · run a scenario",
      text: "The heart of DebtLens: pick a situation — a rush of users, bots, an outage, a bad release, a failing database — and press Run this day. You watch the day live, before and after the fixes, and get a report of what happened, why, and what to fix first.",
      focus: "[data-tour=situations]" },
    { view: "runs", route: r("runs"), title: "Reports · every run, kept",
      text: "Each run is saved with its report, so the team can read it later or download it as a PDF.",
      focus: "[data-tour=runs]" },
    { view: "sim", route: r("sim", "cascade"), title: "Simulate · break one module on purpose",
      text: `Fail “${t.cascade_module || "a core module"}” and watch which modules go down with it. The likely path and the debt on it are listed.`,
      focus: "[data-tour=cascade]" },
    { view: "intel", route: r("intel", "eval"), title: "Incidents · measured, not claimed",
      text: "The incidents are labelled, so accuracy is measured live: how often the right past incident comes first, how well incidents group, and how many regressions are caught.",
      focus: "[data-tour=eval]" },
    { view: "terminal", route: r("terminal"), title: "The terminal",
      text: "The same engine runs in a terminal: scan a repository's history, plan, simulate a situation and print its report, or fail a CI build when risk is too high. That's the tour; reset the sandbox any time from the ⚙ menu.",
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
