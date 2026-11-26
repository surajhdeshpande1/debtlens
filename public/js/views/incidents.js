// M2 Incidents + M3 5 Whys: list, report (with live duplicate check), detail.
import { $, api, ago, date, debounce, download, fail, formData, html, hrs, modal, n, on, sev, status, toast } from "../lib.js";
import { can, go, link, S } from "../app.js";
import { card, empty, head, incidentTable, moduleOptions, scoreBars, sevOptions } from "./_parts.js";

const P = () => `/projects/${S.project.id}`;

export async function render(root, ctx) {
  const sub = ctx.sub[0];
  if (sub === "new") return renderNew(root);
  if (sub) return renderDetail(root, sub);
  return renderList(root);
}

async function modules() {
  const r = await api(`${P()}/modules`);
  return r.modules.map((m) => m.name);
}

// ------------------------------------------------------------------ list
async function renderList(root) {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const filters = { status: q.get("status") || "", severity: q.get("severity") || "", module: q.get("module") || "", q: q.get("q") || "", source: q.get("source") || "" };
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const [list, mods] = await Promise.all([api(`${P()}/incidents?limit=500${qs ? "&" + qs : ""}`), modules()]);
  root.innerHTML = String(html`${head("Incidents", "Every production failure with its severity and status. Open one for its 5 Whys and similar past incidents.",
      html`${can("import.write") ? html`<a class="btn" href="${link("evidence", "import")}">Import</a>` : ""}<button class="btn" data-csv>Export CSV</button>
      ${can("incident.write") ? html`<a class="btn primary" href="${link("incidents", "new")}">Report incident</a>` : ""}`)}
    <section class="card"><form class="table-tools" data-filters>
      <input type="search" name="q" placeholder="Search title, description or key" value="${filters.q}">
      <select name="status"><option value="">Any status</option>${["OPEN", "INVESTIGATING", "RESOLVED", "OPEN,INVESTIGATING"].map((s) => html`<option value="${s}" ${filters.status === s ? "selected" : ""}>${s === "OPEN,INVESTIGATING" ? "not resolved" : s.toLowerCase()}</option>`)}</select>
      <select name="severity"><option value="">Any severity</option>${sevOptions(filters.severity || "-")}</select>
      <select name="module"><option value="">Any module</option>${moduleOptions(mods, filters.module)}</select>
      <select name="source"><option value="">Any source</option>${["manual", "seed", "logs", "import", "github", "simulation"].map((s) => html`<option ${filters.source === s ? "selected" : ""}>${s}</option>`)}</select>
      <button class="btn" type="submit">Filter</button>${qs ? html`<a class="btn ghost" href="${link("incidents")}">Clear</a>` : ""}
      <span class="grow"></span><span class="muted small">${list.total} incident${list.total === 1 ? "" : "s"}</span></form>
      ${incidentTable(list.items, { cols: ["key", "title", "module", "severity", "status", "whys", "debts", "occ", "reported"], none: "No incidents match these filters." })}</section>`);
  on(root, "submit", "[data-filters]", (e, f) => {
    e.preventDefault();
    const params = new URLSearchParams(Object.entries(formData(f)).filter(([, v]) => v)).toString();
    go(`/p/${S.project.id}/incidents${params ? "?" + params : ""}`);
  });
  on(root, "change", "[data-filters] select", (e, s) => s.form.requestSubmit());
  on(root, "click", "[data-csv]", () => download(`${P()}/incidents.csv`, `${S.project.key}-incidents.csv`).catch(fail));
}

// ------------------------------------------------------------------ report a new incident
function whyInputs(values = []) {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    rows.push(html`<div class="why-row"><span>W${i + 1}</span><input type="text" name="why" value="${values[i] || ""}"
      placeholder="${["Why did it fail? (the symptom)", "Why did that happen?", "And why was that possible?", "Why…", "Root cause"][i]}"></div>`);
  }
  return html`<div class="why-inputs">${rows}</div>`;
}

function verdictBox(r) {
  if (!r) return "";
  const msg = {
    duplicate: "Looks like a duplicate of an open incident — consider adding to it instead.",
    regression: "This looks like a regression: a very similar incident in the same module was resolved before.",
    related: "Related incidents exist — their fixes and lessons may help.",
    new: "No similar incident found — this looks new.",
  }[r.verdict];
  return html`<div class="verdict ${r.verdict}"><b>${r.verdict === "new" ? "New" : r.verdict[0].toUpperCase() + r.verdict.slice(1)}.</b> ${msg}
    <span class="tiny muted">(${r.method === "minilm" ? "MiniLM + TF-IDF" : "char n-gram + TF-IDF"}, α = ${r.alpha}, τ = ${r.tau})</span></div>
    ${r.matches.slice(0, 4).map((m) => html`<div class="match"><div class="row between"><span><span class="key mono">${m.key}</span> <a href="${link("incidents", m.id)}" target="_blank" rel="noopener">${m.title}</a></span>
      <span class="row tight">${status(m.status)}${m.same_module ? html`<span class="chip">same module</span>` : ""}${m.would_be_regression ? html`<span class="badge warn">regression</span>` : ""}</span></div>
      ${m.fix ? html`<div class="fix"><b>Fix:</b> ${m.fix}${m.lessons ? html` · <b>Lesson:</b> ${m.lessons}` : ""}</div>` : ""}${scoreBars(m)}</div>`)}`;
}

async function renderNew(root) {
  if (!can("incident.write")) { root.innerHTML = String(html`${head("Report incident")}<div class="callout warn">Your role (${S.me.principal.role_label}) can't report incidents. Switch to Developer, QA or Tech Lead.</div>`); return; }
  const mods = await modules();
  root.innerHTML = String(html`${head("Report an incident", "Describe what failed. DebtLens checks — as you type — whether this has happened before and what fixed it.", "", html`<a href="${link("incidents")}">Incidents</a> / new`)}
    <div class="grid side"><form class="card" data-form><div class="card-body">
      <div class="field"><label for="t">What failed?</label><input id="t" name="title" type="text" required minlength="5" maxlength="250" placeholder="e.g. Checkout times out when the card network is slow"></div>
      <div class="inline-fields">
        <div class="field"><label>Module</label><select name="module">${moduleOptions(mods)}<option value="unassigned">unassigned</option></select></div>
        <div class="field"><label>Severity</label><select name="severity">${sevOptions("HIGH")}</select></div>
        <div class="field"><label>Effort so far (hours)</label><input name="effort_hours" type="number" min="0" step="0.5" value="2"></div>
      </div>
      <div class="field"><label>Description</label><textarea name="description" rows="4" placeholder="Error messages, impact, what you saw in the logs"></textarea></div>
      ${can("rca.write") ? html`<h4 style="margin-top:6px">5 Whys (optional now, you can add it later)</h4>
        <p class="small muted">Start with the symptom and keep asking “why?”. Answers that match an existing cause are merged into the same node of the causal graph.</p>${whyInputs()}` : ""}
      <div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Report incident</button><a class="btn ghost" href="${link("incidents")}">Cancel</a></div>
    </div></form>
    <section class="card"><div class="card-head"><h3>Has this happened before?</h3><span class="spinner hidden" data-spin></span></div><div class="card-body" data-check>${empty("Start typing the title…")}</div></section></div>`);
  const form = $("[data-form]", root);
  const check = debounce(async () => {
    const d = formData(form);
    if ((d.title || "").trim().length < 4) return;
    $("[data-spin]", root).classList.remove("hidden");
    try {
      const r = await api(`${P()}/incidents/check`, { method: "POST", body: { title: d.title, description: d.description, module: d.module } });
      $("[data-check]", root).innerHTML = String(verdictBox(r));
    } catch (e) { fail(e); } finally { $("[data-spin]", root).classList.add("hidden"); }
  }, 450);
  on(root, "input", "[name=title],[name=description]", check);
  on(root, "change", "[name=module]", check);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = formData(form);
    const whys = [].concat(d.why || []).filter((w) => w.trim());
    const body = { title: d.title, description: d.description, module: d.module, severity: d.severity, effort_hours: d.effort_hours };
    if (whys.length) body.whys = whys;
    try {
      const r = await api(`${P()}/incidents`, { method: "POST", body });
      const merged = (r.whys || []).filter((w) => w.merged).length;
      toast(`${r.incident.key} reported${merged ? ` — ${merged} answer(s) merged into existing causes` : ""}`, "ok");
      go(`/p/${S.project.id}/incidents/${r.incident.id}`);
    } catch (ex) { fail(ex); }
  });
}

// ------------------------------------------------------------------ detail
async function resolveId(sub) {
  if (/^\d+$/.test(sub)) return +sub;
  const r = await api(`${P()}/incidents?q=${encodeURIComponent(sub)}&limit=20`);
  const hit = r.items.find((i) => i.key === sub);
  if (!hit) throw new Error(`No incident ${sub}`);
  return hit.id;
}

async function renderDetail(root, sub) {
  const id = await resolveId(sub);
  const d = await api(`${P()}/incidents/${id}`);
  const i = d.incident;
  const reg = d.regressions.find((r) => r.incident_id === i.id);
  const later = d.regressions.filter((r) => r.regressed_from_id === i.id);
  root.innerHTML = String(html`${head(html`<span class="mono" style="color:var(--accent-strong)">${i.key}</span> ${i.title}`, "",
      html`${can("incident.write") ? html`<select data-status aria-label="Status">${["OPEN", "INVESTIGATING", "RESOLVED"].map((s) => html`<option value="${s}" ${s === i.status ? "selected" : ""}>${s.toLowerCase()}</option>`)}</select>
        <button class="btn" data-edit>Edit</button>` : ""}`, html`<a href="${link("incidents")}">Incidents</a> / ${i.key}`)}
    <div class="row tight" style="margin:-6px 0 14px">${sev(i.severity)} ${status(i.status)} <span class="chip">${i.module}</span>
      <span class="muted small">reported ${date(i.reported_at, true)} by ${i.reported_by || "—"} · source ${i.source}${i.occurrences > 1 ? ` · seen ×${i.occurrences}` : ""}${i.resolved_at ? ` · resolved ${date(i.resolved_at, true)}` : ""} · effort ${hrs(i.effort_hours)}</span></div>
    ${reg ? html`<div class="callout warn"><b>Regression.</b> This came back ${n(reg.days_to_recurrence)} days after
      <a href="${link("incidents", reg.regressed_from_id)}">${reg.regressed_from_key} ${reg.regressed_from_title}</a> was resolved (similarity ${n(reg.similarity, 2)} ≥ τ ${d.tau}).</div>` : ""}
    ${later.length ? html`<div class="callout bad"><b>Came back ${later.length}×</b> after it was fixed: ${later.map((r, k) => html`${k ? ", " : ""}<a href="${link("incidents", r.incident_id)}">${r.incident_key}</a>`)}. The fix did not address the root cause.</div>` : ""}
    <div class="grid side"><div class="stack">
      ${card("Description", i.description ? html`<p style="white-space:pre-wrap;margin:0">${i.description}</p>` : html`<p class="muted" style="margin:0">No description.</p>`)}
      ${card("5 Whys — causal chain", d.whys.length ? html`<ol class="whys">${d.whys.map((w, k) => html`<li class="${k === d.whys.length - 1 ? "root" : ""}">${w.answer}
          <div class="meta">${w.cause_label && w.cause_label !== w.answer ? html`merged into cause “<a href="${link("causal", w.cause_id)}">${w.cause_label}</a>” · ` : html`<a href="${link("causal", w.cause_id)}">cause node</a> · `}
          ${w.shared_with ? html`<b>shared with ${w.shared_with} other incident${w.shared_with === 1 ? "" : "s"}</b>` : "only this incident"}${w.category ? ` · ${w.category.toLowerCase()}` : ""}</div></li>`)}</ol>`
        : empty("No root-cause analysis yet."), { attrs: html`data-tour="whys"`, actions: can("rca.write") ? html`<button class="btn sm" data-whys>${d.whys.length ? "Edit 5 Whys" : "Run 5 Whys"}</button>` : "" })}
      ${card("Resolution", d.resolution ? html`<p style="margin:0 0 6px"><b>Fix:</b> ${d.resolution.action_taken}</p>${d.resolution.lessons_learned ? html`<p style="margin:0 0 6px"><b>Lesson learned:</b> ${d.resolution.lessons_learned}</p>` : ""}
          <p class="small muted" style="margin:0">by ${d.resolution.fixed_by || "—"} · ${date(d.resolution.resolved_at, true)}${d.resolution.effort_hours ? ` · ${hrs(d.resolution.effort_hours)}` : ""}</p>`
        : empty("Not resolved yet."), { actions: can("incident.write") ? html`<button class="btn sm" data-resolve>${d.resolution ? "Edit" : "Record fix"}</button>` : "" })}
      ${card("Linked technical debt", d.debts.length ? html`<table class="data"><tbody>${d.debts.map((x) => html`<tr><td class="key">${x.key}</td><td><a href="${link("debts", x.id)}">${x.title}</a></td><td>${status(x.status)}</td><td class="num">${hrs(x.principal)}</td></tr>`)}</tbody></table>`
        : empty("No debt linked. Create a debt item for the structural weakness behind this incident."), { flush: !!d.debts.length, actions: can("debt.write") ? html`<a class="btn sm" href="${link("debts", "new")}?incident=${i.id}&module=${encodeURIComponent(i.module)}">New debt from this</a>` : "" })}
    </div><div class="stack">
      ${card("Similar incidents", d.similar.matches.length ? d.similar.matches.map((m) => html`<div class="match"><div class="row between"><span><span class="key mono">${m.key}</span> <a href="${link("incidents", m.id)}">${m.title}</a></span>${status(m.status)}</div>
          <div class="tiny muted">${m.module}${m.same_module ? " (same module)" : ""} · shared terms: ${(m.shared_terms || []).slice(0, 6).join(", ") || "—"}</div>${scoreBars(m)}</div>`)
        : empty("Nothing similar above the 0.2 threshold."), { actions: html`<span class="tiny muted">${d.similar.semantic_method === "minilm" ? "MiniLM + TF-IDF" : "char n-gram + TF-IDF"} · α ${d.similar.alpha}</span>` })}
    </div></div>`);
  on(root, "change", "[data-status]", async (e, s) => {
    try { await api(`${P()}/incidents/${i.id}`, { method: "PATCH", body: { status: s.value } }); toast("Status updated", "ok"); renderDetail(root, String(i.id)); } catch (ex) { fail(ex); }
  });
  on(root, "click", "[data-whys]", () => {
    modal({ title: `5 Whys — ${i.key}`, body: html`<form><p class="small muted">One answer per line, from the symptom down to the root cause. Matching answers merge into existing cause nodes.</p>${whyInputs(d.whys.map((w) => w.answer))}</form>`,
      foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" type="submit" form="">Save chain</button>`,
      onSubmit: async (form, close) => {
        const whys = [].concat(formData(form).why || []).filter((w) => w.trim());
        if (!whys.length) return toast("Add at least the first why", "bad");
        const r = await api(`${P()}/incidents/${i.id}/whys`, { method: "PUT", body: { whys } });
        toast(r.converged.length ? `Saved — ${r.converged.length} answer(s) converged onto existing causes` : "5 Whys saved", "ok");
        close(); renderDetail(root, String(i.id));
      } });
    fixSubmit();
  });
  on(root, "click", "[data-resolve]", () => {
    const r = d.resolution || {};
    modal({ title: `Record the fix — ${i.key}`, body: html`<form>
        <div class="field"><label>What fixed it?</label><textarea name="action_taken" required minlength="5">${r.action_taken || ""}</textarea></div>
        <div class="field"><label>Lesson learned</label><textarea name="lessons_learned">${r.lessons_learned || ""}</textarea></div>
        <div class="inline-fields"><div class="field"><label>Effort (hours)</label><input name="effort_hours" type="number" min="0" step="0.5" value="${r.effort_hours ?? i.effort_hours ?? ""}"></div></div></form>`,
      foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" type="submit" form="">Mark resolved</button>`,
      onSubmit: async (form, close) => {
        await api(`${P()}/incidents/${i.id}/resolution`, { method: "PUT", body: formData(form) });
        toast("Resolved — the fix is now searchable in the knowledge base", "ok"); close(); renderDetail(root, String(i.id));
      } });
    fixSubmit();
  });
  on(root, "click", "[data-edit]", async () => {
    const mods = await modules();
    modal({ title: `Edit ${i.key}`, body: html`<form>
      <div class="field"><label>Title</label><input name="title" type="text" value="${i.title}" required minlength="5"></div>
      <div class="inline-fields"><div class="field"><label>Module</label><select name="module">${moduleOptions(mods, i.module)}<option value="unassigned">unassigned</option></select></div>
        <div class="field"><label>Severity</label><select name="severity">${sevOptions(i.severity)}</select></div>
        <div class="field"><label>Effort (h)</label><input name="effort_hours" type="number" min="0" step="0.5" value="${i.effort_hours}"></div></div>
      <div class="field"><label>Description</label><textarea name="description" rows="5">${i.description || ""}</textarea></div></form>`,
      foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" type="submit" form="">Save</button>`,
      onSubmit: async (form, close) => { await api(`${P()}/incidents/${i.id}`, { method: "PATCH", body: formData(form) }); toast("Saved", "ok"); close(); renderDetail(root, String(i.id)); } });
    fixSubmit();
  });
}

/** Modal footers sit outside the <form>; wire their submit button to it. */
function fixSubmit() {
  const back = document.querySelector(".modal-back:last-of-type");
  const btn = back && back.querySelector(".modal-foot [type=submit]");
  const form = back && back.querySelector("form");
  if (btn && form) {
    form.id = form.id || "f" + Math.random().toString(36).slice(2);
    btn.setAttribute("form", form.id);
  }
}
