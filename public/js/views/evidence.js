// M5 Repository evidence (hotspots, TODO/FIXME, dependency graph) and the data intake paths.
import { $, api, ago, bar, codeBlock, copyButtons, esc, fail, formData, html, label, loadCytoscape, n, on, safeUrl, sev, toast } from "../lib.js";
import { can, go, link, S } from "../app.js";
import { card, empty, head } from "./_parts.js";

const P = () => `/projects/${S.project.id}`;
const TABS = [["", "Hotspots"], ["satd", "TODO / FIXME"], ["deps", "Dependency graph"], ["import", "Import data"]];

export async function render(root, ctx) {
  const tab = ctx.sub[0] || "";
  const ev = await api(`${P()}/evidence?limit=300`);
  const last = ev.scans[0];
  root.innerHTML = String(html`${head("Code evidence", "Hotspots, TODO/FIXME markers and dependencies, mined from the repository itself.",
      can("evidence.write") ? html`<button class="btn primary" data-mine>Mine a GitHub repo</button>` : "")}
    ${last ? html`<div class="callout"><b>Last scan:</b> ${last.repository || "repository"} ${last.branch ? html`<span class="chip">${last.branch}</span>` : ""} ${last.commit ? html`<span class="mono small">${last.commit.slice(0, 8)}</span>` : ""}
        · ${last.commits_analyzed} commits · ${last.files_analyzed} files · via ${last.source === "github" ? "GitHub API" : last.source === "git" ? "local git (CLI)" : last.source} · ${ago(last.scanned_at)} by ${last.scanned_by || "—"}
        ${(last.warnings || []).length ? html`<div class="small muted">${last.warnings.join(" · ")}</div>` : ""}</div>`
      : html`<div class="callout warn">No repository scan yet for this project${S.project.is_sandbox ? " — the scenario ships with pre-mined evidence" : ""}. Mine a public GitHub repository here, or run <code>debtlens scan . --push</code> in your terminal for the full local history.</div>`}
    <div class="tabs">${TABS.map(([k, l]) => html`<a href="${link("evidence")}${k ? "/" + k : ""}" class="${k === tab ? "active" : ""}">${l}${k === "satd" ? ` (${ev.satd.filter((x) => x.status === "DETECTED").length})` : ""}</a>`)}</div>
    <div data-tab></div>`);
  const box = $("[data-tab]", root);
  if (tab === "satd") satdTab(box, ev);
  else if (tab === "deps") await depsTab(box);
  else if (tab === "import") importTab(box);
  else hotspotTab(box, ev);
  on(root, "click", "[data-mine]", () => mineDialog(ev.repository_url));
}

function hotspotTab(box, ev) {
  const max = Math.max(1, ...ev.files.map((f) => f.hotspot_score));
  box.innerHTML = String(card(`Hotspots — churn × complexity (${ev.total_files} files)`, ev.files.length ? html`<div class="table-wrap"><table class="data" data-tour="hotspots"><thead><tr>
      <th>File</th><th>Module</th><th class="num">Churn</th><th class="num">Lines changed</th><th class="num">Complexity</th><th class="num">Worst function</th><th class="num">LOC</th><th class="num">Authors</th><th style="min-width:140px">Hotspot</th></tr></thead><tbody>
      ${ev.files.map((f) => html`<tr><td class="mono small">${f.path}</td><td>${f.module}</td><td class="num">${f.churn}</td><td class="num">${n(f.lines_changed, 0)}</td><td class="num">${n(f.complexity, 0)}</td>
        <td class="num">${f.max_function_complexity ?? "–"}</td><td class="num">${n(f.loc, 0)}</td><td class="num">${f.authors || ""}</td><td>${bar(f.hotspot_score, max, f.hotspot_score > max * 0.5 ? "bad" : "")}</td></tr>`)}</tbody></table></div>`
    : empty("No file metrics yet."), { flush: true, actions: html`<span class="tiny muted">score = 100 · (churn / max) · (complexity / max)</span>` }));
}

function satdTab(box, ev) {
  box.innerHTML = String(card("Self-admitted technical debt", ev.satd.length ? html`<div class="table-wrap"><table class="data"><thead><tr><th>Where</th><th>Marker</th><th>Comment</th><th>Module</th><th>Status</th><th></th></tr></thead><tbody>
      ${ev.satd.map((x) => html`<tr><td class="mono small nowrap">${x.path}:${x.line}</td><td><span class="badge warn">${x.marker}</span></td><td>${x.text}</td><td>${x.module}</td>
        <td>${x.debt_key ? html`<span class="badge ok">${x.debt_key}</span>` : html`<span class="badge ${x.status === "DISMISSED" ? "" : "warn"}">${x.status.toLowerCase()}</span>`}</td>
        <td class="nowrap">${!x.debt_key && can("debt.write") ? html`<button class="btn sm" data-todebt="${x.id}">→ debt</button>` : ""}
          ${!x.debt_key && can("evidence.write") ? html`<button class="btn sm ghost" data-dismiss="${x.id}" data-to="${x.status === "DISMISSED" ? "DETECTED" : "DISMISSED"}">${x.status === "DISMISSED" ? "restore" : "dismiss"}</button>` : ""}</td></tr>`)}</tbody></table></div>`
    : empty("No TODO / FIXME / HACK / XXX markers found in comments."), { flush: true, actions: html`<span class="tiny muted">found only inside comments, never in strings</span>` }));
  on(box, "click", "[data-todebt]", async (e, b) => {
    b.disabled = true;
    try { const r = await api(`${P()}/satd/${b.dataset.todebt}/debt`, { method: "POST", body: {} }); toast(`${r.debt.key} created (${label(r.debt.category)})`, "ok"); go(`/p/${S.project.id}/debts/${r.debt.id}`); }
    catch (ex) { fail(ex); b.disabled = false; }
  });
  on(box, "click", "[data-dismiss]", async (e, b) => {
    try { await api(`${P()}/satd/${b.dataset.dismiss}`, { method: "PATCH", body: { status: b.dataset.to } }); go(`/p/${S.project.id}/evidence/satd`); } catch (ex) { fail(ex); }
  });
}

async function depsTab(box) {
  const d = await api(`${P()}/modules`);
  const maxI = Math.max(1, ...d.modules.map((m) => m.interest));
  box.innerHTML = String(html`<div class="grid side"><div><div class="graph short" data-deps></div>
      <div class="legend"><span>arrow = “imports / depends on”</span><span>node size = blast radius (modules that break if it fails)</span><span><i style="background:#c0392b"></i>high interest</span></div></div>
    ${card("Click a module", html`<p class="small muted" style="margin:0" data-info>Its dependents light up — that is its blast radius, used in the interest formula and the failure-injection simulation.</p>`)}</div>
    <div style="margin-top:16px">${card("Modules", html`<div class="table-wrap"><table class="data"><thead><tr><th>Module</th><th>Owner</th><th>Depends on</th><th>Used by</th><th class="num">Blast radius</th><th class="num">Churn</th><th class="num">Complexity</th><th class="num">Open debt</th><th style="min-width:120px">Interest / mo</th></tr></thead><tbody>
      ${d.modules.map((m) => html`<tr><td><b>${m.name}</b>${m.path ? html`<div class="tiny mono muted">${m.path}</div>` : ""}</td><td class="small">${m.owner || "—"}</td><td class="small">${m.depends_on.join(", ") || "—"}</td><td class="small">${m.used_by.join(", ") || "—"}</td>
        <td class="num">${m.blast_radius}</td><td class="num">${n(m.churn, 0)}</td><td class="num">${n(m.complexity, 0)}</td><td class="num">${m.open_debts}</td><td>${bar(m.interest, maxI, "bad")}</td></tr>`)}</tbody></table></div>`, { flush: true })}</div>`);
  const cytoscape = await loadCytoscape();
  const cy = cytoscape({ container: $("[data-deps]", box), elements: [
      ...d.modules.map((m) => ({ data: { id: m.name, label: m.name, w: 26 + 6 * m.blast_radius, heat: m.interest / maxI } })),
      ...d.dependencies.map((e) => ({ data: { id: `${e.source}>${e.target}`, source: e.source, target: e.target } }))],
    style: [{ selector: "node", style: { "background-color": (el) => `rgb(${Math.round(36 + 156 * el.data("heat"))},${Math.round(87 - 30 * el.data("heat"))},${Math.round(197 - 154 * el.data("heat"))})`,
        width: "data(w)", height: "data(w)", label: "data(label)", "font-size": 10, "text-valign": "bottom", "text-margin-y": 4 } },
      { selector: "edge", style: { width: 1.5, "line-color": "#c9ced6", "target-arrow-color": "#9aa3ad", "target-arrow-shape": "triangle", "curve-style": "bezier" } },
      { selector: ".hit", style: { "border-width": 4, "border-color": "#c0392b" } }, { selector: ".faded", style: { opacity: 0.2 } }],
    layout: { name: "cose", padding: 24, nodeRepulsion: 12000, animate: false } });
  cy.on("tap", "node", (e) => {
    cy.elements().removeClass("hit faded");
    const node = e.target;
    const dependents = node.predecessors("node");
    cy.elements().not(dependents.union(node).union(node.predecessors("edge"))).addClass("faded");
    dependents.addClass("hit");
    $("[data-info]", box).innerHTML = String(html`<b>${node.id()}</b> — if it fails, ${dependents.length ? html`these ${dependents.length} module(s) can break: ${dependents.map((x) => x.id()).join(", ")}` : "no other module depends on it"}.
      <br><a href="${link("sim", "cascade")}?module=${encodeURIComponent(node.id())}">Simulate a failure here →</a>`);
  });
}

function importTab(box) {
  if (!can("import.write")) { box.innerHTML = String(html`<div class="callout warn">Your role can't import data.</div>`); return; }
  box.innerHTML = String(html`<div class="grid c2">
    ${card("Application logs → incidents", html`<form data-logs><p class="small muted">Paste error logs (Python tracebacks, Java/JS stack traces, JSON lines). Errors are grouped by signature — exception + masked message + top frame — so 500 identical errors become one incident. A signature that returns after its incident was resolved is raised again and flagged as a regression.</p>
        <div class="field"><textarea name="text" rows="9" placeholder="2026-11-10 10:00:01 ERROR [payments] TimeoutError: upstream gateway timed out after 3000 ms"></textarea></div>
        <div class="row"><input type="file" accept=".log,.txt,.json" data-file="logs"><select name="min_severity" style="width:auto"><option value="LOW">all errors</option><option value="MEDIUM">medium and up</option><option value="HIGH">high and up</option></select>
          <button class="btn" type="submit" data-dry>Preview</button><button class="btn primary" type="submit" data-commit>Create incidents</button></div></form><div data-out="logs"></div>`)}
    ${card("CSV or JSON backlog (Jira, ServiceNow, PagerDuty…)", html`<form data-file-import><p class="small muted">Common column names are recognised (summary/title, component/module, priority/severity, status, created, resolved). Re-importing the same keys is skipped.</p>
        <div class="field"><select name="format" style="width:auto"><option value="csv">CSV</option><option value="json">JSON</option></select></div>
        <div class="field"><textarea name="text" rows="7" placeholder="id,summary,component,priority,status,created&#10;ERP-1,Hall ticket PDF shows wrong photo,exams,High,Open,2026-10-02"></textarea></div>
        <div class="row"><input type="file" accept=".csv,.json,.txt" data-file="file-import"><button class="btn" type="submit" data-dry>Preview</button><button class="btn primary" type="submit" data-commit>Import</button></div></form><div data-out="file"></div>`)}
    ${card("GitHub Issues", html`<form data-gh><p class="small muted">Imports issues (not pull requests) from a public repository. Labels map to severity (critical/high/bug…).</p>
        <div class="inline-fields"><div class="field"><label>Repository</label><input name="repo" type="text" placeholder="owner/repo or https://github.com/owner/repo" value="${S.project.repository_url && !/example/.test(S.project.repository_url) ? S.project.repository_url : ""}"></div>
          <div class="field"><label>Labels</label><input name="labels" type="text" value="bug"></div><div class="field"><label>State</label><select name="state"><option>all</option><option>open</option><option>closed</option></select></div></div>
        <div class="row"><button class="btn" type="submit" data-dry>Preview</button><button class="btn primary" type="submit" data-commit>Import</button></div></form><div data-out="gh"></div>`)}
    ${card("From your terminal", html`<p class="small">The CLI pushes a full local scan (complete git history, no API limits):</p>${codeBlock(`debtlens login ${location.origin}\ndebtlens scan . --push --project ${S.project.id}\ndebtlens ingest logs/app.log --push`)}`)}</div>`);
  copyButtons(box);
  let mode = "dry";
  on(box, "click", "[data-dry],[data-commit]", (e, b) => { mode = b.hasAttribute("data-commit") ? "commit" : "dry"; });
  const isDry = (e) => !(e.submitter ? e.submitter.hasAttribute("data-commit") : mode === "commit");
  on(box, "change", "[data-file]", async (e, inp) => {
    const f = inp.files[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast("File is larger than 8 MB", "bad");
    const form = inp.closest("form");
    form.querySelector("textarea").value = await f.text();
    if (form.querySelector("[name=format]")) form.querySelector("[name=format]").value = f.name.endsWith(".json") ? "json" : "csv";
  });
  const out = (k, markup) => { $(`[data-out=${k}]`, box).innerHTML = String(markup); };
  on(box, "submit", "[data-logs]", async (e, f) => {
    e.preventDefault();
    const d = formData(f);
    try {
      const r = await api(`${P()}/import/logs`, { method: "POST", body: { text: d.text, min_severity: d.min_severity, dry_run: isDry(e) } });
      out("logs", html`<p class="small" style="margin-top:10px">${r.lines} lines → ${r.events} error events → <b>${r.groups.length} incident candidate(s)</b>${r.dry_run ? " (preview)" : ""}</p>
        ${r.groups.length ? html`<table class="data"><thead><tr><th>Incident</th><th>Module</th><th>Severity</th><th class="num">Events</th><th>Action</th></tr></thead><tbody>${r.groups.map((g) => html`<tr><td>${g.title}<div class="tiny mono muted">${g.file || ""}</div></td><td>${g.module}</td><td>${sev(g.severity)}</td><td class="num">${g.count}</td>
          <td class="small">${{ create: "new incident", count: `adds to ${g.existing_key}`, recurred: `recurred after ${g.existing_key} was resolved` }[g.action]}${g.created_key ? html` → <b>${g.created_key}</b>` : ""}</td></tr>`)}</tbody></table>` : ""}`);
      if (!r.dry_run) toast("Logs ingested", "ok");
    } catch (ex) { fail(ex); }
  });
  on(box, "submit", "[data-file-import]", async (e, f) => {
    e.preventDefault();
    const d = formData(f);
    const body = { format: d.format, dry_run: isDry(e) };
    if (d.format === "json") { try { body.data = JSON.parse(d.text); } catch { return toast("That is not valid JSON", "bad"); } } else body.text = d.text;
    try { out("file", importResult(await api(`${P()}/import/incidents`, { method: "POST", body }))); } catch (ex) { fail(ex); }
  });
  on(box, "submit", "[data-gh]", async (e, f) => {
    e.preventDefault();
    try { out("gh", importResult(await api(`${P()}/import/github-issues`, { method: "POST", body: { ...formData(f), dry_run: isDry(e) } }))); } catch (ex) { fail(ex); }
  });
}

function importResult(r) {
  const rows = r.dry_run ? r.would_create : r.created;
  return html`<p class="small" style="margin-top:10px">${r.dry_run ? html`<b>Preview:</b> ${rows.length} would be created` : html`<b>${rows.length} created</b>`}, ${r.skipped.length} skipped as already imported.
      ${r.errors && r.errors.length ? html`<br><span class="muted">${r.errors.slice(0, 5).join(" · ")}</span>` : ""}</p>
    ${r.dry_run && rows.length ? html`<table class="data"><thead><tr><th>Key</th><th>Title</th><th>Module</th><th>Severity</th><th>Status</th></tr></thead><tbody>${rows.slice(0, 25).map((x) => html`<tr><td class="key">${x.key || ""}</td><td>${x.title}</td><td>${x.module}</td><td>${sev(x.severity)}</td><td>${x.status}</td></tr>`)}</tbody></table>` : ""}
    ${!r.dry_run && rows.length ? html`<p class="small">${rows.join(", ")}</p>` : ""}`;
}

async function mineDialog(url) {
  const { modal } = await import("../lib.js");
  const m = modal({ title: "Mine a GitHub repository", body: html`<form><p class="small muted">DebtLens downloads the code (tarball) and recent commit history through the GitHub API, then computes churn, McCabe complexity, TODO/FIXME markers and the import graph. Public repositories only; large repos are sampled.</p>
      <div class="field"><label>Repository URL</label><input name="url" type="text" required value="${safeUrl(url) && !/example\//.test(url) ? url : ""}" placeholder="https://github.com/pallets/flask"></div>
      <div class="field"><label>Commits to analyse</label><input name="max_commits" type="number" min="10" max="300" value="120"></div><div data-status class="small muted"></div></form>`,
    foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Start mining</button>`,
    onSubmit: async (f, close) => {
      $("[data-status]", f).innerHTML = String(html`<span class="spinner"></span> Mining… this can take 10–40 seconds.`);
      try {
        const r = await api(`${P()}/evidence/github`, { method: "POST", body: formData(f) });
        toast(`Mined ${r.files_analyzed} files and ${r.commits_analyzed} commits`, "ok");
        close(); go(`/p/${S.project.id}/evidence`);
      } catch (ex) { $("[data-status]", f).textContent = ex.message; throw ex; }
    } });
  return m;
}
