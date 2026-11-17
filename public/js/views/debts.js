// M4 Debt registry: register, link to incidents and prerequisites, see each item's price.
import { $, api, bar, date, download, fail, formData, html, hrs, label, n, on, status, toast } from "../lib.js";
import { can, go, link, S } from "../app.js";
import { card, empty, head, moduleOptions } from "./_parts.js";

const P = () => `/projects/${S.project.id}`;
const CATS = ["ARCHITECTURAL", "CODE_SMELL", "TEST_DEBT", "INFRASTRUCTURE", "SECURITY_DEBT", "DOCUMENTATION"];
const STATUSES = ["IDENTIFIED", "PRIORITIZED", "IN_PROGRESS", "REMEDIATED", "DEFERRED"];

export async function render(root, ctx) {
  const sub = ctx.sub[0];
  if (sub === "new") return renderForm(root);
  if (sub) return renderDetail(root, sub);
  return renderList(root);
}

async function renderList(root) {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const st = q.get("status") || "";
  const d = await api(`${P()}/debts${st ? "?status=" + st : ""}`);
  const maxRisk = Math.max(1, ...d.items.map((r) => r.risk || 0));
  root.innerHTML = String(html`${head("Debt registry", "Each item is a structural weakness with a price: principal (hours to fix) and interest (hours it costs every month). Sorted by risk.",
      html`<button class="btn" data-csv>Export ledger CSV</button>${can("debt.write") ? html`<a class="btn primary" href="${link("debts", "new")}">Add debt</a>` : ""}`)}
    <section class="card"><div class="table-tools"><div class="tabs" style="margin:0;border:0">${["", ...STATUSES].map((s) => html`<a href="${link("debts")}${s ? "?status=" + s : ""}" class="${s === st ? "active" : ""}">${s ? label(s) : "All"}</a>`)}</div>
      <span class="grow"></span><span class="muted small">${d.total} item${d.total === 1 ? "" : "s"}</span></div>
      ${d.items.length ? html`<div class="table-wrap"><table class="data"><thead><tr><th>Key</th><th>Debt</th><th>Module</th><th>Category</th><th>Status</th><th>Assignee</th>
        <th class="num">Principal</th><th class="num">Interest / mo</th><th style="min-width:130px">Risk</th><th>Break-even</th><th class="num">Incidents</th></tr></thead><tbody>
        ${d.items.map((r) => html`<tr><td class="key">${r.key}</td><td class="title-cell"><a href="${link("debts", r.id)}">${r.title}</a>${r.source === "satd" ? html` <span class="chip">from TODO</span>` : ""}</td>
          <td>${r.module}</td><td class="small">${label(r.category)}</td><td>${status(r.status)}</td><td class="small">${r.assigned_to || "—"}</td>
          <td class="num">${hrs(r.principal)}</td><td class="num">${r.status === "REMEDIATED" ? "–" : hrs(r.interest)}</td>
          <td>${r.status === "REMEDIATED" ? html`<span class="badge ok">paid off</span>` : bar(r.risk || 0, maxRisk, r.break_even ? "bad" : "")}</td>
          <td>${r.status === "REMEDIATED" ? "" : r.break_even ? html`<span class="badge bad">past</span>` : html`<span class="badge">${n((r.break_even_ratio || 0) * 100, 0)}%</span>`}</td>
          <td class="num">${(r.linked_incidents || []).length || ""}</td></tr>`)}</tbody></table></div>` : empty("No debt items here.")}</section>`);
  on(root, "click", "[data-csv]", () => download(`${P()}/debts.csv`, `${S.project.key}-debt-ledger.csv`).catch(fail));
}

async function renderForm(root, existing = null) {
  if (!can("debt.write")) { root.innerHTML = String(html`${head("Add debt")}<div class="callout warn">Your role (${S.me.principal.role_label}) can't create debt items.</div>`); return; }
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const [mods, incs, debts, graph] = await Promise.all([api(`${P()}/modules`), api(`${P()}/incidents?limit=500`), api(`${P()}/debts`), api(`${P()}/causal-graph`)]);
  const e = existing || { module: q.get("module") || "", incident_ids: q.get("incident") ? [+q.get("incident")] : [], prerequisite_ids: [], category: "CODE_SMELL", principal: 8, priority: "MEDIUM" };
  const picked = new Set(e.incident_ids || []);
  const pre = new Set(e.prerequisite_ids || []);
  root.innerHTML = String(html`${head(existing ? `Edit ${existing.key}` : "Add technical debt", "Name the structural weakness, estimate the hours to fix it, and link the incidents it caused — the interest is computed from those links.", "",
      html`<a href="${link("debts")}">Debt registry</a> / ${existing ? existing.key : "new"}`)}
    <form class="card" data-form><div class="card-body">
      <div class="field"><label>Title</label><input name="title" type="text" required minlength="5" maxlength="250" value="${e.title || ""}" placeholder="e.g. Separate connection pools for API and batch jobs"></div>
      <div class="inline-fields">
        <div class="field"><label>Module</label><select name="module">${moduleOptions(mods.modules.map((m) => m.name), e.module)}</select></div>
        <div class="field"><label>Category</label><select name="category">${CATS.map((c) => html`<option value="${c}" ${c === e.category ? "selected" : ""}>${label(c)}</option>`)}</select></div>
        <div class="field"><label>Principal (hours to fix)</label><input name="principal" type="number" min="0.5" step="0.5" value="${e.principal}" required></div>
        ${can("debt.prioritize") ? html`<div class="field"><label>Priority</label><select name="priority">${["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => html`<option ${p === e.priority ? "selected" : ""}>${p}</option>`)}</select></div>` : ""}
        <div class="field"><label>File (optional)</label><input name="file_path" type="text" value="${e.file_path || ""}" placeholder="src/payments/pool.py"></div>
        <div class="field"><label>Assignee</label><input name="assigned_to" type="text" value="${e.assigned_to || ""}" placeholder="name"></div>
      </div>
      <div class="field"><label>Description</label><textarea name="description" rows="3">${e.description || ""}</textarea></div>
      <div class="grid c3">
        <div class="field"><label>Incidents it caused</label><select name="incident_ids" multiple size="9" style="height:auto">${incs.items.map((i) => html`<option value="${i.id}" ${picked.has(i.id) ? "selected" : ""}>${i.key} · ${i.title}</option>`)}</select><div class="hint">Ctrl/Cmd-click for several</div></div>
        <div class="field"><label>Must be fixed first (prerequisites)</label><select name="prerequisite_ids" multiple size="9" style="height:auto">${debts.items.filter((x) => !existing || x.id !== existing.id).map((x) => html`<option value="${x.id}" ${pre.has(x.id) ? "selected" : ""}>${x.key} · ${x.title}</option>`)}</select></div>
        <div class="field"><label>Root cause (causal graph)</label><select name="root_cause_id" size="9" style="height:auto"><option value="">— none —</option>${graph.nodes.map((c) => html`<option value="${c.id}" ${c.id === e.root_cause_id ? "selected" : ""}>${c.label}</option>`)}</select></div>
      </div>
      <div class="row"><button class="btn primary" type="submit">${existing ? "Save" : "Add debt"}</button><a class="btn ghost" href="${existing ? link("debts", existing.id) : link("debts")}">Cancel</a></div>
    </div></form>`);
  $("[data-form]", root).addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const d = formData(f);
    const sel = (name) => Array.from(f.querySelector(`[name=${name}]`).selectedOptions).map((o) => +o.value);
    const body = { title: d.title, module: d.module, category: d.category, principal: d.principal, description: d.description, file_path: d.file_path || null,
      assigned_to: d.assigned_to || null, incident_ids: sel("incident_ids"), prerequisite_ids: sel("prerequisite_ids"), root_cause_id: d.root_cause_id ? +d.root_cause_id : null };
    if (d.priority && (!existing || d.priority !== existing.priority)) body.priority = d.priority;
    try {
      const r = existing ? await api(`${P()}/debts/${existing.id}`, { method: "PATCH", body }) : await api(`${P()}/debts`, { method: "POST", body });
      toast(existing ? "Saved" : `${r.debt.key} added`, "ok");
      go(`/p/${S.project.id}/debts/${r.debt.id}`);
    } catch (ex) { fail(ex); }
  });
}

async function renderDetail(root, sub) {
  let id = sub;
  if (!/^\d+$/.test(sub)) {
    const all = await api(`${P()}/debts`);
    const hit = all.items.find((x) => x.key === sub);
    if (!hit) throw new Error(`No debt ${sub}`);
    id = hit.id;
  }
  const d = await api(`${P()}/debts/${id}`);
  const x = d.debt, L = d.ledger;
  const open = x.status !== "REMEDIATED";
  const allowed = STATUSES.filter((s) => can("debt.prioritize") || !["PRIORITIZED", "DEFERRED"].includes(s) || s === x.status);
  root.innerHTML = String(html`${head(html`<span class="mono" style="color:var(--accent-strong)">${x.key}</span> ${x.title}`, "",
      html`${can("debt.write") ? html`<select data-status aria-label="Status">${allowed.map((s) => html`<option value="${s}" ${s === x.status ? "selected" : ""}>${label(s)}</option>`)}</select>
        <button class="btn" data-edit>Edit</button>` : ""}${can("debt.prioritize") ? html`<button class="btn danger" data-del>Delete</button>` : ""}`, html`<a href="${link("debts")}">Debt registry</a> / ${x.key}`)}
    <div class="row tight" style="margin:-6px 0 14px">${status(x.status)} <span class="badge">${label(x.category)}</span> <span class="badge">${x.priority.toLowerCase()} priority</span> <span class="chip">${x.module}</span>
      <span class="muted small">${x.assigned_to ? "assigned to " + x.assigned_to + " · " : ""}created ${date(x.created_at)}${x.file_path ? " · " + x.file_path : ""} · source ${x.source}</span></div>
    <div class="grid side"><div class="stack">
      ${L && open ? card("Price of this debt", html`<div class="kpis" data-tour="ledger-row" style="margin-bottom:10px">
          <div class="kpi"><div class="v">${hrs(L.principal)}</div><div class="l">Principal</div><div class="d">hours to fix once</div></div>
          <div class="kpi bad"><div class="v">${hrs(L.interest)}</div><div class="l">Interest / month</div><div class="d">hours lost while it stays</div></div>
          <div class="kpi ${L.break_even ? "bad" : ""}"><div class="v">${L.break_even ? "past" : n((L.break_even_ratio || 0) * 100, 0) + "%"}</div><div class="l">Break-even</div><div class="d">${L.break_even ? "costs more than fixing" : "of the way to break-even"}</div></div>
          <div class="kpi"><div class="v">${n(L.risk)}</div><div class="l">Risk score</div><div class="d">0–120 (×1.2 past break-even)</div></div></div>
        <table class="data"><thead><tr><th>Interest component</th><th class="num">h / month</th><th>From</th></tr></thead><tbody>
          <tr><td>Incident cost</td><td class="num">${n(L.incident_interest)}</td><td class="small">Σ severity weight × effort of ${L.linked_incidents.length} linked incident(s)</td></tr>
          <tr><td>Churn pressure</td><td class="num">${n(L.churn_interest)}</td><td class="small">λ₁ × ${L.churn_source === "file" ? "file" : "module"} churn (commits touching it)</td></tr>
          <tr><td>Blast radius</td><td class="num">${n(L.blast_interest)}</td><td class="small">λ₂ × modules that transitively depend on “${x.module}”</td></tr>
          <tr><td><b>Total</b></td><td class="num"><b>${n(L.interest)}</b></td><td class="small">churn ${n(L.churn, 0)} commits · blast radius ${L.blast_radius} module${L.blast_radius === 1 ? "" : "s"}</td></tr></tbody></table>`)
        : card("Status", html`<p style="margin:0">${open ? "Not in the ledger." : "Paid off — this item no longer accrues interest."}</p>`)}
      ${card("Description", x.description ? html`<p style="white-space:pre-wrap;margin:0">${x.description}</p>` : html`<p class="muted" style="margin:0">No description.</p>`)}
      ${card("Incidents caused by this debt", d.incidents.length ? html`<table class="data"><tbody>${d.incidents.map((i) => html`<tr><td class="key">${i.key}</td><td><a href="${link("incidents", i.id)}">${i.title}</a></td><td>${status(i.status)}</td><td class="num">${hrs(i.effort_hours)}</td></tr>`)}</tbody></table>` : empty("No incidents linked — interest comes only from churn and blast radius."), { flush: !!d.incidents.length })}
    </div><div class="stack">
      ${card("Root cause", d.root_cause ? html`<a href="${link("causal", d.root_cause.id)}">${d.root_cause.label}</a> <span class="badge">${d.root_cause.category.toLowerCase()}</span>` : html`<span class="muted">Not linked to the causal graph.</span>`)}
      ${card("Prerequisites (fix first)", d.prerequisites.length ? html`<ul class="small" style="padding-left:18px;margin:0">${d.prerequisites.map((p) => html`<li><a href="${link("debts", p.id)}">${p.key}</a> ${p.title} ${status(p.status)}</li>`)}</ul>` : html`<span class="muted small">None.</span>`)}
      ${card("Unlocks", d.unlocks.length ? html`<ul class="small" style="padding-left:18px;margin:0">${d.unlocks.map((p) => html`<li><a href="${link("debts", p.id)}">${p.key}</a> ${p.title}</li>`)}</ul>` : html`<span class="muted small">Nothing waits on this item.</span>`)}
      ${d.satd.length ? card("Found in code", html`${d.satd.map((s) => html`<div class="small"><span class="badge warn">${s.marker}</span> <span class="mono">${s.path}:${s.line}</span><br>${s.text}</div>`)}`) : ""}
    </div></div>`);
  on(root, "change", "[data-status]", async (e, s) => {
    try { await api(`${P()}/debts/${x.id}`, { method: "PATCH", body: { status: s.value } }); toast(s.value === "REMEDIATED" ? "Paid off — interest stops accruing" : "Status updated", "ok"); renderDetail(root, String(x.id)); }
    catch (ex) { fail(ex); s.value = x.status; }
  });
  on(root, "click", "[data-edit]", () => renderForm(root, { ...x, incident_ids: d.incidents.map((i) => i.id), prerequisite_ids: d.prerequisites.map((p) => p.id), root_cause_id: d.root_cause ? d.root_cause.id : null }));
  on(root, "click", "[data-del]", async () => {
    if (!confirm(`Delete ${x.key}? This cannot be undone.`)) return;
    try { await api(`${P()}/debts/${x.id}`, { method: "DELETE" }); toast("Deleted", "ok"); go(`/p/${S.project.id}/debts`); } catch (ex) { fail(ex); }
  });
}
