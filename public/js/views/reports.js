// M8 Knowledge & reporting: lessons learned, PDF/CSV/JSON exports, CI quality gate, activity log.
import { $, api, ago, codeBlock, copyButtons, date, download, fail, html, n, on } from "../lib.js";
import { link, S } from "../app.js";
import { card, empty, head } from "./_parts.js";

const P = () => `/projects/${S.project.id}`;

export async function render(root) {
  const [snap, act] = await Promise.all([api(`${P()}/export`), api(`${P()}/activity?limit=60`)]);
  const byId = Object.fromEntries(snap.incidents.map((i) => [i.id, i]));
  const lessons = snap.resolutions.filter((r) => (r.lessons || "").trim()).map((r) => ({ ...r, inc: byId[r.incident_id] })).filter((r) => r.inc)
    .sort((a, b) => (b.resolved_at || "").localeCompare(a.resolved_at || ""));
  root.innerHTML = String(html`${head("Lessons & exports", "Lessons from every fixed incident, the project report as a PDF, data exports and a quality gate for CI.",
      html`<a class="btn" href="${link("intel")}">Search the knowledge base</a>`)}
    <div class="grid c2">
      ${card("Reports & exports", html`<div class="stack">
          <div class="row"><span class="grow"><b>PDF summary</b><div class="small muted">KPIs, highest-risk debt, the recommended plan and how it compares, systemic causes, regressions and hotspots.</div></div>
            <label class="small" style="margin:0">budget <input type="number" data-budget value="${(S.project.tour && S.project.tour.budget) || 40}" min="4" max="400" style="width:70px"> h</label><button class="btn primary" data-pdf>Download PDF</button></div>
          <div class="row"><span class="grow"><b>Incidents (CSV)</b><div class="small muted">Spreadsheet of every incident.</div></div><button class="btn" data-dl="incidents">Download</button></div>
          <div class="row"><span class="grow"><b>Debt ledger (CSV)</b><div class="small muted">Principal, interest, risk and break-even per item.</div></div><button class="btn" data-dl="debts">Download</button></div>
          <div class="row"><span class="grow"><b>Project snapshot (JSON)</b><div class="small muted">Everything, in the format the CLI reads: <code>debtlens analyse snapshot.json</code></div></div><button class="btn" data-dl="json">Download</button></div></div>`)}
      ${card("CI quality gate", html`<form data-gate><p class="small muted" style="margin-top:0">Fail a build when live risk crosses your limits. The same check runs in GitHub Actions through the CLI.</p>
          <div class="inline-fields"><div class="field"><label>Max open critical</label><input type="number" name="max_open_critical" value="0" min="0"></div>
            <div class="field"><label>Max regressions (30 d)</label><input type="number" name="max_regressions" value="3" min="0"></div>
            <div class="field"><label>Max debts past break-even</label><input type="number" name="max_break_even" placeholder="no limit" min="0"></div>
            <div class="field"><label>Max interest h/month</label><input type="number" name="max_interest" placeholder="no limit" min="0"></div></div>
          <button class="btn" type="submit">Run gate now</button></form><div data-gate-out></div>`)}
    </div>
    <div class="grid c2" style="margin-top:16px">
      ${card(`Lessons learned (${lessons.length})`, lessons.length ? html`<div class="stack">${lessons.slice(0, 40).map((l) => html`<div><div class="small"><span class="key mono">${l.inc.key}</span> <a href="${link("incidents", l.inc.id)}">${l.inc.title}</a> <span class="muted">· ${l.inc.module} · ${date(l.resolved_at)}</span></div>
          <div>${l.lessons}</div><div class="small muted">Fix: ${l.action}</div></div>`)}</div>` : empty("No lessons recorded yet — add one when you resolve an incident."))}
      ${card("Activity", act.events.length ? html`<table class="data"><tbody>${act.events.map((e) => html`<tr><td class="nowrap small">${ago(e.at)}</td><td class="small">${e.actor}</td><td class="small"><span class="chip">${e.action}</span> ${e.entity || ""}</td></tr>`)}</tbody></table>` : empty("No activity yet."), { flush: !!act.events.length })}
    </div>
    <div style="margin-top:16px">${card("GitHub Actions: block risky merges", html`<p class="small">Add this workflow to <code>.github/workflows/debtlens.yml</code>. Store an API token (Team &amp; settings → API tokens) as the secret <code>DEBTLENS_TOKEN</code>.</p>
      ${codeBlock(`name: debtlens
on: [pull_request]
jobs:
  debt-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }          # full history for churn
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - uses: surajhdeshpande1/debtlens@main   # scans this repo, then runs the gate
        with: { project: ${S.project.id}, max-open-critical: 0, max-regressions: 3 }
        env: { DEBTLENS_URL: ${location.origin}, DEBTLENS_TOKEN: \${{ secrets.DEBTLENS_TOKEN }} }`)}`)}</div>`);
  copyButtons(root);
  on(root, "click", "[data-pdf]", (e, b) => { b.disabled = true; download(`${P()}/report.pdf?budget=${$("[data-budget]", root).value}`, `${S.project.key}-debtlens-report.pdf`).catch(fail).finally(() => (b.disabled = false)); });
  on(root, "click", "[data-dl]", (e, b) => {
    const k = b.dataset.dl;
    if (k === "json") {
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${S.project.key}-snapshot.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else download(`${P()}/${k}.csv`, `${S.project.key}-${k}.csv`).catch(fail);
  });
  on(root, "submit", "[data-gate]", async (e, f) => {
    e.preventDefault();
    const qs = new URLSearchParams(Object.entries(Object.fromEntries(new FormData(f))).filter(([, v]) => v !== "")).toString();
    try {
      const g = await api(`${P()}/gate?${qs}`);
      $("[data-gate-out]", root).innerHTML = String(html`<div class="callout ${g.pass ? "ok" : "bad"}" style="margin-top:12px"><b>${g.pass ? "PASS" : "FAIL"}</b> — ${g.pass ? "within every limit" : "at least one limit exceeded; the CLI would exit with code 1"}</div>
        <table class="data"><tbody>${g.checks.map((c) => html`<tr><td>${c.check}</td><td class="num">${n(c.value)}</td><td class="num muted">${c.limit === null ? "no limit" : "≤ " + n(c.limit)}</td><td>${c.pass ? html`<span class="badge ok">ok</span>` : html`<span class="badge bad">fail</span>`}</td></tr>`)}</tbody></table>`);
    } catch (ex) { fail(ex); }
  });
}
