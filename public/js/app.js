// DebtLens single-page app: landing, auth, shell, hash router.
import { $, api, ApiError, auth, codeBlock, copyButtons, el, fail, html, modal, on, store, toast, ago, n } from "./lib.js";
import * as tour from "./tour.js";

export const S = { meta: null, me: null, project: null, projects: [], view: null };

export const NAV = [
  { group: "Overview" },
  { id: "home", label: "Home", m: "⌂" },
  { group: "Operate" },
  { id: "incidents", label: "Incidents", m: "M2" },
  { id: "causal", label: "Causal analysis", m: "M3" },
  { id: "debts", label: "Debt registry", m: "M4" },
  { id: "evidence", label: "Repository evidence", m: "M5" },
  { id: "intel", label: "Intelligence", m: "M6" },
  { id: "ledger", label: "Ledger & optimiser", m: "M7" },
  { id: "sim", label: "Simulation Lab", m: "SIM" },
  { id: "reports", label: "Knowledge & reports", m: "M8" },
  { group: "Workspace" },
  { id: "workspace", label: "Team & settings", m: "M1" },
  { id: "terminal", label: "Terminal (CLI)", m: ">_" },
];

export const can = (perm) => !!S.me && S.me.principal.permissions.includes(perm);
export const pid = () => S.project && S.project.id;
export const go = (path) => { if (location.hash !== "#" + path) location.hash = path; else route(); };
export const link = (view, id) => `#/p/${pid()}/${view}${id !== undefined ? "/" + id : ""}`;

const app = () => $("#app");

auth.onExpired = (msg, code) => {
  auth.token = null;
  S.me = null; S.project = null;
  toast(code === 410 ? "This sandbox has expired — open a fresh one." : msg, "bad");
  go("/");
};

// ------------------------------------------------------------------ boot
async function boot() {
  try { S.meta = await api("/meta"); } catch (e) { S.meta = { scenarios: [], roles: [] }; fail(e); }
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
function scenarioCard(s) {
  const roles = S.meta.roles || [];
  return html`<div class="scen" data-scen="${s.code}">
    <div class="ind">${s.industry}</div>
    <h3>${s.name}</h3>
    <div class="tag">${s.tagline}</div>
    <div class="stats">${s.counts.incidents} incidents · ${s.counts.debts} debt items · ${s.counts.modules} modules</div>
    <div class="row tight">
      <select aria-label="Role" data-role>${roles.map((r) => html`<option value="${r.code}" ${r.code === "tech_lead" ? "selected" : ""}>${r.label}</option>`)}</select>
      <button class="btn primary" data-open="${s.code}">Open</button>
    </div>
    <button class="btn sm ghost" data-tour="${s.code}">▶ Guided tour for examiners</button>
  </div>`;
}

function renderLanding(tab) {
  document.title = "DebtLens — Developer Incident & Technical Debt Management";
  const v = el(html`<header class="topbar"><a class="brand" href="#/"><span class="mark">D</span>DebtLens</a><span class="grow"></span>
      <a class="btn ghost" href="#/cli">Terminal</a><a class="btn" href="#/login">Sign in</a></header>
    <main class="landing">
      <section class="hero">
        <div>
          <h1>Developer Incident &amp; Technical Debt Management</h1>
          <p class="lead">DebtLens links every production incident to the root cause behind it and the technical debt that made it possible —
            then prices that debt in hours lost per month and tells you exactly what to fix in your next sprint.</p>
          <ul class="points">
            <li>5 Whys that converge: one root cause, many incidents, measured on a causal graph</li>
            <li>Evidence from your own Git history: churn, complexity hotspots, TODO/FIXME debt</li>
            <li>Interest ledger, exact knapsack sprint planner, Monte Carlo forecast, failure injection</li>
            <li>Same engine in the browser and in your terminal: <code>pipx install debtlens</code></li>
          </ul>
        </div>
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
      <div class="section-title"><h2>Try a live scenario</h2><span class="muted small">No account needed — you get a private copy for 24 hours. Pick the role you want to play.</span></div>
      <div class="scen-grid">${(S.meta.scenarios || []).map(scenarioCard)}</div>
      <div class="section-title"><h2>Works in your terminal too</h2><span class="muted small"><a href="#/cli">Full CLI guide →</a></span></div>
      <div class="grid c2">
        <div>${codeBlock("pipx install debtlens\ndebtlens scan .              # mine your repo's git history\ndebtlens similar \"payment timeout\"\ndebtlens plan --budget 40     # what to fix this sprint\ndebtlens simulate forecast\ndebtlens ci --max-open-critical 0")}</div>
        <div class="callout"><b>Why a CLI?</b> Engineers live in the terminal. <code>debtlens scan</code> reads the full local git history (no GitHub limits),
          <code>debtlens ingest app.log</code> turns error logs into incidents, and <code>debtlens ci</code> fails a build when risk crosses your limit.
          Push results to this website with <code>--push</code>.</div>
      </div>
      <div class="footer">DebtLens v${S.meta.version || "2"} · Basaveshwar Engineering College, Bagalkot · Dept. of ISE · Mini Project BISA531P (2026–27)</div>
    </main>`);
  const w = mount(v);
  copyButtons(w);
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
  on(w, "click", "[data-open],[data-tour]", async (e, b) => {
    const card = b.closest("[data-scen]");
    const code = card.dataset.scen;
    const role = b.dataset.tour ? "tech_lead" : $("[data-role]", card).value;
    b.disabled = true;
    try {
      await openSandbox(code, role);
      if (b.dataset.tour) tour.start();
    } catch (ex) { fail(ex); } finally { b.disabled = false; }
  });
}

export async function openSandbox(code, role) {
  const r = await api("/sandbox", { method: "POST", body: { scenario: code, role } });
  auth.token = r.token;
  S.me = null; S.project = null;
  toast(r.persona ? `You are ${r.persona.name} — ${r.persona.title}` : "Sandbox ready", "ok");
  go(`/p/${r.project.id}/home`);
}

// ------------------------------------------------------------------ project list (real teams)
async function renderProjects() {
  const me = S.me;
  let projects = [];
  try { projects = (await api("/projects")).projects; } catch (e) { fail(e); }
  S.projects = projects;
  const v = el(html`${topbar()}<main class="landing">
    <div class="page-head"><div><h1>${me.org ? me.org.name : "Your projects"}</h1><div class="sub">Each project is one product or service with its own repository, incidents and debt ledger.</div></div></div>
    ${projects.length ? html`<div class="scen-grid">${projects.map((p) => html`<a class="scen" href="#/p/${p.id}/home" style="color:inherit;text-decoration:none">
        <div class="ind">${p.industry || p.key}</div><h3>${p.name}</h3><div class="tag">${p.description || ""}</div>
        <div class="stats">${p.counts.open_incidents} open incidents · ${p.counts.open_debts} open debts · ${p.counts.modules} modules</div></a>`)}</div>`
      : html`<div class="callout">No projects yet.${can("project.manage") ? " Create one below — start from an industry scenario or an empty project." : " Ask your admin to add you to a project."}</div>`}
    ${can("project.manage") ? html`<div class="section-title"><h2>New project</h2></div>
      <form class="card" data-new><div class="card-body"><div class="inline-fields">
        <div class="field"><label>Start from</label><select name="scenario"><option value="">Empty project</option>${S.meta.scenarios.map((s) => html`<option value="${s.code}">${s.name} — ${s.industry} scenario</option>`)}</select></div>
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
function topbar() {
  const me = S.me, p = S.project;
  const sandbox = me && me.principal.kind === "sandbox";
  const roles = S.meta.roles || [];
  return html`<header class="topbar">
    <a class="brand" href="#/"><span class="mark">D</span>DebtLens</a>
    ${p ? html`<span class="sep"></span><span class="proj">${p.name}</span><span class="badge accent">${p.key}</span>
      ${p.scenario_info ? html`<span class="muted small">${p.scenario_info.industry} scenario</span>` : ""}
      ${!sandbox && S.projects.length > 1 ? html`<select data-switch aria-label="Switch project">${S.projects.map((x) => html`<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${x.name}</option>`)}</select>` : ""}` : ""}
    <span class="grow"></span>
    ${sandbox ? html`<span class="sandbox-pill" title="Private copy — changes are yours only">Sandbox · ${p && p.persona ? p.persona.name : "visitor"} as
        <select data-role aria-label="Play as role">${roles.map((r) => html`<option value="${r.code}" ${r.code === me.principal.role ? "selected" : ""}>${r.label}</option>`)}</select>
        <span class="tiny">expires ${ago(p && p.expires_at)}</span></span>
      <button class="btn sm" data-tourbtn>▶ Tour</button><button class="btn sm" data-reset>Reset</button><button class="btn sm ghost" data-exit>Exit</button>`
    : me ? html`<span class="small">${me.principal.name}</span><span class="badge">${me.principal.role_label}</span>
      <a class="btn sm ghost" href="#/projects">Projects</a><button class="btn sm ghost" data-exit>Sign out</button>` : ""}
  </header>`;
}

function sidebar(view) {
  return html`<nav class="sidebar"><div class="nav">${NAV.map((x) => x.group ? html`<div class="nav-group">${x.group}</div>`
    : html`<a href="${link(x.id)}" class="${x.id === view ? "active" : ""}" data-nav="${x.id}"><span class="mtag">${x.m}</span>${x.label}</a>`)}</div>
    <div class="nav-group" style="margin-top:18px">Signed in as</div>
    <div class="small" style="padding:0 10px">${S.me.principal.name}<br><span class="muted">${S.me.principal.role_label}</span></div></nav>`;
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
    if (!confirm("Reset the sandbox to the original scenario? Your changes will be discarded.")) return;
    try {
      const r = await api("/sandbox/reset", { method: "POST", body: {} });
      auth.token = r.token; S.me = null; S.project = null;
      toast("Sandbox reset", "ok");
      go(`/p/${r.project.id}/home`);
    } catch (ex) { fail(ex); }
  });
  on(root, "click", "[data-exit]", () => { auth.token = null; S.me = null; S.project = null; tour.stop(); go("/"); });
  on(root, "click", "[data-tourbtn]", () => tour.start());
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
  if (!NAV.find((x) => x.id === view)) view = "home";
  store.set("debtlens.project", String(S.project.id));
  document.title = `${NAV.find((x) => x.id === view).label} · ${S.project.name} · DebtLens`;
  const frame = el(html`${topbar()}<div class="layout">${sidebar(view)}<main class="content" id="content"><div class="loading"><span class="spinner"></span></div></main></div>`);
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
  const frame = el(html`<header class="topbar"><a class="brand" href="#/"><span class="mark">D</span>DebtLens</a><span class="grow"></span><a class="btn" href="#/">Back to the website</a></header><main class="landing" id="content"></main>`);
  const w = mount(frame);
  const node = document.createElement("div");
  $("#content", w).replaceChildren(node);
  await mod.render(node, { sub: [], project: null, me: null, meta: S.meta, public: true });
}

/** Re-render the current view (after a change). */
export function refresh() { route(); }

boot();
