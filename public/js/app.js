// DebtLens single-page app: landing, auth, shell, hash router.
import { $, api, ApiError, auth, el, fail, html, on, store, toast, ago } from "./lib.js";
import * as tour from "./tour.js";

export const S = { meta: null, me: null, project: null, projects: [], view: null, lastRun: null };

// Five pages. Each tab is a view module (views/<view>.js), optionally with a fixed first sub-route.
export const PAGES = [
  { id: "overview", label: "Overview", tabs: [{ view: "home", label: "Overview" }] },
  { id: "incidents", label: "Incidents", tabs: [{ view: "incidents", label: "Incidents" }, { view: "causal", label: "Root causes" },
    { view: "intel", label: "Similar & regressions" }] },
  { id: "debt", label: "Debt", tabs: [{ view: "debts", label: "Debt items" }, { view: "ledger", label: "Plan & ledger" },
    { view: "evidence", label: "Code evidence" }] },
  { id: "simulate", label: "Simulate", tabs: [{ view: "run", label: "Run a scenario" }, { view: "sim", sub: "forecast", label: "Sprint forecast" },
    { view: "sim", sub: "cascade", label: "Failure injection" }, { view: "sim", sub: "whatif", label: "What-if costs" },
    { view: "sim", sub: "", label: "Compare industries" }] },
  { id: "reports", label: "Reports", tabs: [{ view: "runs", label: "Run reports" }, { view: "reports", label: "Lessons & exports" }] },
];
const EXTRA = { workspace: "Team & settings", terminal: "Terminal guide" };  // reached from the ⚙ menu
const VIEWS = new Set([...PAGES.flatMap((p) => p.tabs.map((t) => t.view)), ...Object.keys(EXTRA)]);

export const can = (perm) => !!S.me && S.me.principal.permissions.includes(perm);
export const pid = () => S.project && S.project.id;
export const go = (path) => { if (location.hash !== "#" + path) location.hash = path; else route(); };
export const link = (view, id) => `#/p/${pid()}/${view}${id !== undefined ? "/" + id : ""}`;
export const isSandbox = () => !!S.me && S.me.principal.kind === "sandbox";

const app = () => $("#app");
const KIND = { traffic: "Rush", bots: "Bots", outage: "Outage", deploy: "Bad release", database: "Database", cache: "Cache",
  leak: "Memory leak", zone: "Zone lost", retry: "Retry storm" };
export const kindLabel = (k) => KIND[k] || k;

auth.onExpired = (msg, code) => {
  auth.token = null;
  S.me = null; S.project = null;
  toast(code === 410 ? "This sandbox has expired — open a fresh one." : msg, "bad");
  go("/");
};

// ------------------------------------------------------------------ boot
async function boot() {
  try { S.meta = await api("/meta"); } catch (e) { S.meta = { scenarios: [], roles: [], packs: [] }; fail(e); }
  window.addEventListener("hashchange", route);
  route();
}

async function ensureMe() {
  if (!auth.token) return null;
  if (S.me) return S.me;
  try { S.me = await api("/auth/me", { quiet: true }); } catch (e) { auth.token = null; S.me = null; return null; }
  return S.me;
}

export async function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("?")[0].split("/").filter(Boolean);
  const me = await ensureMe();
  if (parts[0] === "cli") return renderPublic("terminal");
  if (!me) {
    if (parts[0] === "p" || parts[0] === "projects") { history.replaceState(null, "", "#/"); }
    return renderLanding(parts[0] === "register" ? "register" : "login");
  }
  if (parts[0] === "login" || parts[0] === "register" || parts.length === 0) return goHome(me);
  if (parts[0] === "projects") return renderProjects();
  if (parts[0] === "p") {
    const id = +parts[1];
    const view = parts[2] || "home";
    const sub = parts.slice(3);
    if (!S.project || S.project.id !== id) {
      try {
        S.project = (await api(`/projects/${id}`)).project;
      } catch (e) {
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) { toast("That project is not available to you."); return goHome(me); }
        return fail(e);
      }
    }
    return renderShell(view, sub);
  }
  return goHome(me);
}

async function goHome(me) {
  if (me.principal.kind === "sandbox") return go(`/p/${me.principal.sandbox_project_id}/home`);
  try {
    S.projects = (await api("/projects")).projects;
  } catch (e) { return fail(e); }
  const last = +store.get("debtlens.project");
  const p = S.projects.find((x) => x.id === last) || S.projects[0];
  if (p) return go(`/p/${p.id}/home`);
  return go("/projects");
}

// ------------------------------------------------------------------ landing
export const allSystems = () => [...(S.meta.scenarios || []).filter((s) => (s.events || []).length), ...(S.meta.packs || [])];

export function systemCard(s, { current = false, action = "Open" } = {}) {
  const evs = s.events || [];
  const kinds = [...new Set(evs.map((e) => e.kind))];
  return html`<div class="sys ${current ? "current" : ""}" data-scen="${s.code}">
    <div class="ind">${s.industry}</div>
    <h3>${s.name}</h3>
    <p class="tag">${s.tagline}</p>
    <div class="sys-kinds">${kinds.slice(0, 5).map((k) => html`<span class="kind k-${k}">${kindLabel(k)}</span>`)}</div>
    <div class="row between sys-foot"><span class="muted small">${evs.length} situations · ${s.counts.incidents} incidents${s.pack ? html` · <a class="dl" href="/api/v1/packs/${s.code}" download="${s.code}.debtlens-pack.json" title="Download this system as a pack file to edit and upload">pack file</a>` : ""}</span>
      ${current ? html`<span class="badge accent">Open now</span>` : html`<button class="btn sm primary" data-open="${s.code}">${action}</button>`}</div>
  </div>`;
}

export function uploadCard() {
  const fmt = S.meta.pack_format || {};
  return html`<div class="sys upload" data-upload>
    <div class="ind">Your own system</div>
    <h3>Upload a scenario pack</h3>
    <p class="tag">A .json pack (up to ${fmt.max_kb || 400} KB): one of these after editing it, or one your team wrote. It is checked and opened as a private copy.</p>
    <label class="file-drop" data-drop><input type="file" accept=".json,application/json" data-file hidden><span data-file-label>Choose or drop a .json file</span></label>
    <button class="btn primary" data-open-file disabled>Open pack</button>
    <div class="pack-problems hidden" data-problems></div>
  </div>`;
}

const STEPS = [["Pick a system", "A payments platform, an exam portal, an airline — 15 to choose from."],
  ["Pick a situation", "A rush of users, bots, an outage, a bad release, a failing database…"],
  ["Watch it happen", "The day plays out live: what users see and what the on-call engineer sees."],
  ["Read the report", "What happened, why, what to fix first, and what changes after the fixes."]];

function renderLanding(tab) {
  document.title = "DebtLens — see what breaks on your busiest day, and what to fix first";
  const systems = allSystems();
  const v = el(html`<header class="topbar"><a class="brand" href="#/"><span class="mark">D</span>DebtLens</a><span class="grow"></span>
      <a class="btn ghost sm" href="#/cli">Terminal guide</a><a class="btn sm" href="#login" data-auth-open>Sign in</a></header>
    <main class="landing">
      <section class="hero2">
        <h1>See what breaks on your busiest day — and what to fix first.</h1>
        <p class="lead">DebtLens links every incident to the technical debt behind it, prices that debt in hours, and simulates a hard day
          for your system: before the fixes and after them.</p>
        <div class="row"><a class="btn primary lg" href="#systems" data-scroll>Run a scenario</a>
          <button class="btn lg" data-tour-open>Take the 3-minute tour</button><span class="muted small">No account needed.</span></div>
        <ol class="howto">${STEPS.map(([t, d], i) => html`<li><span class="num">${i + 1}</span><div><b>${t}</b><div class="small muted">${d}</div></div></li>`)}</ol>
      </section>
      <section id="systems">
        <div class="section-title"><h2>1 · Pick a system</h2><span class="muted small">You get a private copy for 24 hours.</span></div>
        <div class="sys-grid">${systems.map((s) => systemCard(s))}${uploadCard()}</div>
      </section>
      <section class="auth-row" id="login">
        <div><h2>Using DebtLens with your team?</h2><p class="muted">Sign in to your team's projects, or create a team and invite people.
          Each project keeps its own incidents, debt, plans and run reports.</p></div>
        <div class="auth-card">
          <div class="tabs" role="tablist"><button class="${tab === "login" ? "active" : ""}" data-tab="login">Sign in</button>
            <button class="${tab === "register" ? "active" : ""}" data-tab="register">Create a team</button></div>
          <form data-form="login" class="${tab === "login" ? "" : "hidden"}">
            <div class="field"><label for="le">Email</label><input id="le" name="email" type="email" autocomplete="username" required></div>
            <div class="field"><label for="lp">Password</label><input id="lp" name="password" type="password" autocomplete="current-password" required></div>
            <div class="form-error" data-err></div>
            <button class="btn primary" type="submit">Sign in</button>
          </form>
          <form data-form="register" class="${tab === "register" ? "" : "hidden"}">
            <div class="field"><label for="rn">Your name</label><input id="rn" name="name" type="text" required minlength="2"></div>
            <div class="field"><label for="ro">Team / organisation</label><input id="ro" name="org_name" type="text" placeholder="e.g. BEC ISE Mini Project"></div>
            <div class="field"><label for="re">Email</label><input id="re" name="email" type="email" autocomplete="username" required></div>
            <div class="field"><label for="rp">Password</label><input id="rp" name="password" type="password" minlength="8" autocomplete="new-password" required>
              <div class="hint">At least 8 characters. You become the team's admin.</div></div>
            <div class="form-error" data-err></div>
            <button class="btn primary" type="submit">Create team</button>
          </form>
        </div>
      </section>
      <div class="footer">DebtLens v${S.meta.version || "2"} · Basaveshwar Engineering College, Bagalkot · Dept. of ISE · Mini Project BISA531P (2026–27)
        · <a href="#/cli">Terminal guide</a></div>
    </main>`);
  const w = mount(v);
  if (tab === "register" || location.hash === "#/login") $("#login", w).scrollIntoView();
  on(w, "click", "[data-scroll]", (e) => { e.preventDefault(); $("#systems", w).scrollIntoView({ behavior: "smooth" }); });
  on(w, "click", "[data-auth-open]", (e) => { e.preventDefault(); $("#login", w).scrollIntoView({ behavior: "smooth" }); $("#le", w).focus({ preventScroll: true }); });
  on(w, "click", "[data-tab]", (e, b) => {
    w.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("active", x === b));
    w.querySelectorAll("[data-form]").forEach((f) => f.classList.toggle("hidden", f.dataset.form !== b.dataset.tab));
  });
  on(w, "submit", "form", async (e, f) => {
    e.preventDefault();
    const err = $("[data-err]", f);
    err.textContent = "";
    const btn = $("[type=submit]", f);
    btn.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(f));
      const r = await api(f.dataset.form === "login" ? "/auth/login" : "/auth/register", { method: "POST", body, quiet: true });
      auth.token = r.token;
      S.me = null;
      toast(f.dataset.form === "login" ? `Welcome back, ${r.user.name.split(" ")[0]}` : "Team created — you are its admin", "ok");
      go("/");
    } catch (ex) { err.textContent = ex.message; } finally { btn.disabled = false; }
  });
  on(w, "click", "[data-open]", async (e, b) => {
    busy(b, "Opening…");
    try { await openSandbox(b.dataset.open, "tech_lead"); } catch (ex) { fail(ex); busy(b, null); }
  });
  on(w, "click", "[data-tour-open]", async (e, b) => {
    busy(b, "Opening…");
    try { await openSandbox((systems[0] || {}).code || "fintech", "tech_lead", null, false); tour.start(); }
    catch (ex) { fail(ex); busy(b, null); }
  });
  wirePackUpload(w);
}

/** The pack upload card: check the file on the server first, show every problem, then open it as a sandbox. */
export function wirePackUpload(w, { onOpen = null } = {}) {
  const card = $("[data-upload]", w);
  if (!card) return;
  const input = $("[data-file]", card), label = $("[data-file-label]", card), btn = $("[data-open-file]", card);
  const box = $("[data-problems]", card), drop = $("[data-drop]", card);
  let pack = null, seq = 0;  // seq: only the newest file's check may change the card
  const show = (title, items, note = false) => {
    box.innerHTML = String(html`<b>${title}</b>${items && items.length ? html`<ul>${items.slice(0, 12).map((p) => html`<li>${p}</li>`)}</ul>${items.length > 12 ? html`<div class="muted small">…and ${items.length - 12} more</div>` : ""}` : ""}`);
    box.classList.toggle("note", note);
    box.classList.remove("hidden");
  };
  const read = async (file) => {
    const my = ++seq;
    pack = null; btn.disabled = true; box.classList.add("hidden");
    if (!file) return;
    label.textContent = file.name;
    const max = ((S.meta.pack_format || {}).max_kb || 400) * 1000;
    if (file.size > max) return show(`${file.name} is larger than ${max / 1000} KB.`);
    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch (ex) { return my === seq && show(`${file.name} is not valid JSON.`, [ex.message]); }
    if (my !== seq) return;
    try {
      const r = await api("/packs/validate", { method: "POST", body: { pack: parsed }, quiet: true });
      if (my !== seq) return;  // a newer file was chosen while this one was being checked
      if (!r.valid) return show(`${file.name} has ${r.problems.length} problem${r.problems.length === 1 ? "" : "s"} to fix:`, r.problems);
      pack = parsed;
      const i = r.info;
      label.textContent = `${file.name} — ${i.name}: ${i.counts.incidents} incidents, ${i.counts.debts} debt items, ${(i.events || []).length} situations`;
      if (r.warnings && r.warnings.length) show("Opens fine. Notes:", r.warnings, true);
      btn.disabled = false;
    } catch (ex) { if (my === seq) { pack = null; show("Could not check the file.", [ex.message]); } }
  };
  input.addEventListener("change", () => read(input.files[0]));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); read(e.dataTransfer.files[0]); });
  btn.addEventListener("click", async () => {
    if (!pack) return;
    busy(btn, "Opening…");
    try { if (onOpen) await onOpen(pack); else await openSandbox(null, "tech_lead", pack); }
    catch (ex) { show(ex.message, (ex.data && ex.data.problems) || []); busy(btn, null); }
  });
}

/** Show that a button is working (the first request after a quiet spell can take a few seconds). */
export function busy(b, label) {
  if (label) { b.dataset.label = b.textContent; b.disabled = true; b.innerHTML = `<span class="spinner sm"></span> ${label}`; }
  else { b.disabled = false; if (b.dataset.label) b.textContent = b.dataset.label; }
}

/** A private sandbox of a scenario, a bundled pack or an uploaded pack; lands on "pick a situation". */
export async function openSandbox(code, role, pack = null, toRun = true) {
  const r = await api("/sandbox", { method: "POST", body: pack ? { pack, role } : { scenario: code, role } });
  auth.token = r.token;
  S.me = null; S.project = null; S.lastRun = null;
  toast(r.persona ? `You are ${r.persona.name} — ${r.persona.title}` : "Sandbox ready", "ok");
  go(`/p/${r.project.id}/${toRun ? "run/situation" : "home"}`);
}

/** In a sandbox: switch to another system (or an uploaded pack) without leaving. */
export async function switchSystem(code, pack = null) {
  const r = await api("/sandbox/reset", { method: "POST", body: pack ? { pack } : { scenario: code } });
  auth.token = r.token; S.me = null; S.project = null; S.lastRun = null; tour.stop();
  toast(`Opened ${r.project.name}${r.persona ? ` — you are ${r.persona.name}` : ""}`, "ok");
  go(`/p/${r.project.id}/run/situation`);
}

// ------------------------------------------------------------------ project list (real teams)
async function renderProjects() {
  const me = S.me;
  let projects = [];
  try { projects = (await api("/projects")).projects; } catch (e) { fail(e); }
  S.projects = projects;
  const v = el(html`${topbar(null)}<main class="landing">
    <div class="page-head"><div><h1>${me.org ? me.org.name : "Your projects"}</h1><div class="sub">Each project is one product or service with its own incidents, debt and run reports.</div></div></div>
    ${projects.length ? html`<div class="sys-grid">${projects.map((p) => html`<a class="sys" href="#/p/${p.id}/home" style="color:inherit;text-decoration:none">
        <div class="ind">${p.industry || p.key}</div><h3>${p.name}</h3><p class="tag">${p.description || ""}</p>
        <div class="muted small">${p.counts.open_incidents} open incidents · ${p.counts.open_debts} open debts · ${p.counts.modules} modules</div></a>`)}</div>`
      : html`<div class="callout">No projects yet.${can("project.manage") ? " Create one below — start from a system or an empty project." : " Ask your admin to add you to a project."}</div>`}
    ${can("project.manage") ? html`<div class="section-title"><h2>New project</h2></div>
      <form class="card" data-new><div class="card-body"><div class="inline-fields">
        <div class="field"><label>Start from</label><select name="scenario"><option value="">Empty project</option><optgroup label="Industry scenarios">${S.meta.scenarios.map((s) => html`<option value="${s.code}">${s.name} — ${s.industry}</option>`)}</optgroup>${(S.meta.packs || []).length ? html`<optgroup label="Scenario packs">${S.meta.packs.map((s) => html`<option value="${s.code}">${s.name} — ${s.industry}</option>`)}</optgroup>` : ""}</select></div>
        <div class="field"><label>Name</label><input name="name" type="text" placeholder="e.g. Payments API"></div>
        <div class="field"><label>Repository URL (optional)</label><input name="repository_url" type="url" placeholder="https://github.com/org/repo"></div>
      </div><button class="btn primary" type="submit">Create project</button></div></form>` : ""}
  </main>`);
  const w = mount(v);
  wireTopbar(w);
  on(w, "submit", "[data-new]", async (e, f) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(f));
    if (!body.scenario && !body.name) return toast("Give the project a name", "bad");
    try {
      const r = await api("/projects", { method: "POST", body });
      toast("Project created", "ok");
      go(`/p/${r.project.id}/home`);
    } catch (ex) { fail(ex); }
  });
}

// ------------------------------------------------------------------ shell
export function pageOf(view) { return PAGES.find((p) => p.tabs.some((t) => t.view === view)) || null; }

function tabActive(t, view, sub) {
  if (t.view !== view) return false;
  if (t.sub === undefined) return true;
  const s = sub[0] || "";
  return view === "sim" ? (["forecast", "cascade", "whatif"].includes(s) ? s : "") === t.sub : s === t.sub;
}

function topbar(view) {
  const me = S.me, p = S.project;
  const sandbox = isSandbox();
  const roles = S.meta.roles || [];
  const page = view ? pageOf(view) : null;
  return html`<header class="topbar">
    <a class="brand" href="#/"><span class="mark">D</span>DebtLens</a>
    ${p ? html`<span class="proj" title="${p.description || ""}">${p.name}</span>
      ${!sandbox && S.projects.length > 1 ? html`<select data-switch aria-label="Switch project">${S.projects.map((x) => html`<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${x.name}</option>`)}</select>` : ""}
      <nav class="topnav" aria-label="Pages">${PAGES.map((pg) => html`<a href="${link(pg.tabs[0].view)}${pg.tabs[0].sub ? "/" + pg.tabs[0].sub : ""}"
        class="${page && page.id === pg.id ? "active" : ""}" data-nav="${pg.id}">${pg.label}</a>`)}</nav>` : ""}
    <span class="grow"></span>
    ${sandbox && p ? html`<label class="role-pick" title="Play this system as another role">as
        <select data-role aria-label="Play as role">${roles.map((r) => html`<option value="${r.code}" ${r.code === me.principal.role ? "selected" : ""}>${r.label}</option>`)}</select></label>` : ""}
    ${me && !sandbox ? html`<span class="small muted">${me.principal.name} · ${me.principal.role_label}</span>` : ""}
    ${me ? html`<details class="menu"><summary class="btn sm ghost" aria-label="Menu">⚙</summary><div class="menu-list">
      ${p ? html`<a href="${link("workspace")}">Team & settings</a>` : ""}
      ${p ? html`<a href="${link("terminal")}">Terminal guide</a>` : html`<a href="#/cli">Terminal guide</a>`}
      ${p && p.tour ? html`<button data-tourbtn>▶ Guided tour</button>` : ""}
      ${sandbox ? html`<button data-reset>Reset this sandbox</button><div class="menu-note">Private copy · expires ${ago(p && p.expires_at)}</div>` : html`<a href="#/projects">All projects</a>`}
      <button data-exit>${sandbox ? "Exit to the start page" : "Sign out"}</button></div></details>` : ""}
  </header>`;
}

function pagebar(view, sub) {
  const page = pageOf(view);
  if (!page || page.tabs.length < 2) return "";
  return html`<div class="pagebar"><div class="pagebar-in"><nav class="pagetabs" aria-label="${page.label}">${page.tabs.map((t) => html`<a href="${link(t.view)}${t.sub ? "/" + t.sub : ""}" class="${tabActive(t, view, sub) ? "active" : ""}">${t.label}</a>`)}</nav></div></div>`;
}

function wireTopbar(root) {
  on(root, "change", "[data-switch]", (e, s) => go(`/p/${s.value}/home`));
  on(root, "change", "[data-role]", async (e, s) => {
    if (!s.closest(".topbar")) return;
    try {
      const r = await api("/sandbox/role", { method: "POST", body: { role: s.value } });
      auth.token = r.token;
      S.me = null; S.project = null;
      toast(r.persona ? `Now playing ${r.persona.name} — ${r.persona.title}` : "Role switched", "ok");
      const parts = location.hash.split("/");
      go(`/p/${r.project.id}/${parts[3] && !/^\d+$/.test(parts[3]) ? parts[3] : "home"}`);
    } catch (ex) { fail(ex); }
  });
  on(root, "click", "[data-reset]", async () => {
    if (!confirm("Reset the sandbox to the original system? Your changes will be discarded.")) return;
    try {
      const r = await api("/sandbox/reset", { method: "POST", body: {} });
      auth.token = r.token; S.me = null; S.project = null; S.lastRun = null;
      toast("Sandbox reset", "ok");
      go(`/p/${r.project.id}/home`);
    } catch (ex) { fail(ex); }
  });
  on(root, "click", "[data-exit]", () => { auth.token = null; S.me = null; S.project = null; S.lastRun = null; tour.stop(); go("/"); });
  on(root, "click", "[data-tourbtn]", () => tour.start());
  on(root, "click", ".menu-list a, .menu-list button", (e, b) => { const d = b.closest("details"); if (d) d.open = false; });
}

/** Swap the whole screen.  Listeners attach to the returned wrapper, which is thrown away on the next mount. */
function mount(node) {
  const wrap = document.createElement("div");
  wrap.className = "screen";
  wrap.append(...node.childNodes);
  app().replaceChildren(wrap);
  window.scrollTo(0, 0);
  return wrap;
}

async function renderShell(view, sub) {
  if (!VIEWS.has(view)) view = "home";
  store.set("debtlens.project", String(S.project.id));
  const page = pageOf(view);
  const tab = page ? page.tabs.find((t) => tabActive(t, view, sub)) : null;
  document.title = `${tab ? tab.label : EXTRA[view] || "DebtLens"} · ${S.project.name} · DebtLens`;
  const frame = el(html`${topbar(view)}${pagebar(view, sub)}<main class="content" id="content"><div class="loading"><span class="spinner"></span></div></main>`);
  const w = mount(frame);
  wireTopbar(w);
  const content = $("#content", w);
  S.view = view;
  try {
    const mod = await import(`./views/${view}.js`);
    const node = document.createElement("div");
    node.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
    content.replaceChildren(node);  // attach first: graphs and charts need a sized container
    await mod.render(node, { sub, project: S.project, me: S.me, meta: S.meta });
  } catch (e) {
    content.replaceChildren(el(html`<div class="callout bad"><b>Could not load this page.</b> ${e.message || e}</div>`));
    console.error(e);
  }
  tour.sync(view, sub);
}

async function renderPublic(view) {
  const mod = await import(`./views/${view}.js`);
  const frame = el(html`<header class="topbar"><a class="brand" href="#/"><span class="mark">D</span>DebtLens</a><span class="grow"></span><a class="btn sm" href="#/">Back to the website</a></header><main class="landing" id="content"></main>`);
  const w = mount(frame);
  const node = document.createElement("div");
  $("#content", w).replaceChildren(node);
  await mod.render(node, { sub: [], project: null, me: null, meta: S.meta, public: true });
}

/** Re-render the current view (after a change). */
export function refresh() { route(); }

boot();
