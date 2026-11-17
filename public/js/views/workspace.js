// M1 Workspace: project settings, team & roles (enforced on the server), API tokens for the CLI.
import { $, api, ago, codeBlock, copyButtons, fail, formData, html, modal, on, toast } from "../lib.js";
import { can, go, S } from "../app.js";
import { card, empty, head } from "./_parts.js";

const P = () => `/projects/${S.project.id}`;

export async function render(root) {
  const sandbox = S.me.principal.kind === "sandbox";
  const [team, tokens] = await Promise.all([api("/team"), sandbox ? Promise.resolve({ tokens: [] }) : api("/auth/tokens")]);
  const p = S.project;
  const perms = S.meta.permissions || {};
  const roles = S.meta.roles || [];
  root.innerHTML = String(html`${head("Team & settings", "Organisation → project → members. Every permission below is checked by the server on each request, not just hidden in the page.")}
    <div class="grid c2">
      ${card("Project", html`<form data-proj>
          <div class="field"><label>Name</label><input name="name" type="text" value="${p.name}" ${can("settings.write") ? "" : "disabled"}></div>
          <div class="field"><label>Description</label><textarea name="description" rows="3" ${can("settings.write") ? "" : "disabled"}>${p.description || ""}</textarea></div>
          <div class="field"><label>Repository</label><input name="repository_url" type="text" value="${p.repository_url || ""}" ${can("settings.write") ? "" : "disabled"}></div>
          <div class="inline-fields"><div class="field"><label>Similarity α (word share)</label><input name="alpha" type="number" min="0" max="1" step="0.05" value="${p.settings.alpha}" ${can("settings.write") ? "" : "disabled"}></div>
            <div class="field"><label>Regression threshold τ</label><input name="tau" type="number" min="0.05" max="0.99" step="0.05" value="${p.settings.tau}" ${can("settings.write") ? "" : "disabled"}></div></div>
          ${can("settings.write") ? html`<button class="btn primary" type="submit">Save</button>` : html`<p class="small muted">Only a Tech Lead or Admin can change project settings.</p>`}
          ${can("project.manage") && !p.is_sandbox ? html`<button class="btn danger" type="button" data-delproj style="margin-left:8px">Delete project</button>` : ""}</form>`)}
      ${card("Roles and what they may do", html`<div class="table-wrap"><table class="data"><thead><tr><th>Permission</th>${roles.map((r) => html`<th class="center">${r.label}</th>`)}</tr></thead><tbody>
          ${Object.entries(perms).map(([k, rs]) => html`<tr><td class="mono small">${k}</td>${roles.map((r) => html`<td class="center">${rs.includes(r.code) ? "✓" : ""}</td>`)}</tr>`)}</tbody></table></div>`, { flush: true })}
    </div>
    <div class="grid c2" style="margin-top:16px">
      ${card(sandbox ? "Scenario team (personas)" : "Team members", team.members.length ? html`<table class="data"><thead><tr><th>Name</th>${sandbox ? "" : html`<th>Email</th>`}<th>Role</th><th>Title</th>${sandbox ? "" : html`<th>Last sign-in</th><th></th>`}</tr></thead><tbody>
          ${team.members.map((m) => html`<tr><td>${m.name}</td>${sandbox ? "" : html`<td class="small">${m.email || "—"}</td>`}
            <td>${!sandbox && can("project.manage") ? html`<select data-role-of="${m.id}">${roles.map((r) => html`<option value="${r.code}" ${r.code === m.role ? "selected" : ""}>${r.label}</option>`)}</select>` : html`<span class="badge">${m.role_label}</span>`}</td>
            <td class="small">${m.title || ""}</td>${sandbox ? "" : html`<td class="small">${m.last_login_at ? ago(m.last_login_at) : "never"}${m.is_active ? "" : html` <span class="badge bad">disabled</span>`}</td>
            <td>${can("project.manage") && m.id !== S.me.principal.user_id ? html`<button class="btn sm ghost" data-toggle="${m.id}" data-active="${m.is_active ? 1 : 0}">${m.is_active ? "disable" : "enable"}</button>` : ""}</td>`}</tr>`)}</tbody></table>` : empty("No members."),
        { flush: true, actions: !sandbox && can("project.manage") ? html`<button class="btn sm" data-demo>Create demo team</button><button class="btn sm primary" data-add>Add member</button>` : sandbox ? html`<span class="tiny muted">switch persona with the role menu at the top</span>` : "" })}
      ${card("API tokens (CLI & CI)", sandbox ? html`<p class="small" style="margin-top:0">The terminal tool signs in with a personal API token. Sandboxes are anonymous, so tokens need a real account — <a href="#/register">create a team</a> (free).</p>
          <p class="small muted">Without an account the CLI still works fully offline on your own repository and the bundled scenarios.</p>`
        : html`${tokens.tokens.length ? html`<table class="data" style="margin-bottom:10px"><thead><tr><th>Name</th><th>Token</th><th>Last used</th><th></th></tr></thead><tbody>
            ${tokens.tokens.map((t) => html`<tr><td>${t.name}</td><td class="mono small">${t.prefix}…</td><td class="small">${t.revoked ? html`<span class="badge">revoked</span>` : t.last_used_at ? ago(t.last_used_at) : "never"}</td>
              <td>${t.revoked ? "" : html`<button class="btn sm ghost" data-revoke="${t.id}">revoke</button>`}</td></tr>`)}</tbody></table>` : ""}
          <form class="row" data-token><input name="name" type="text" placeholder="e.g. my laptop" style="max-width:220px"><button class="btn primary" type="submit">Create token</button></form><div data-newtoken></div>`)}
    </div>`);
  copyButtons(root);
  on(root, "submit", "[data-proj]", async (e, f) => {
    e.preventDefault();
    const d = formData(f);
    try { const r = await api(P(), { method: "PATCH", body: { name: d.name, description: d.description, repository_url: d.repository_url, alpha: +d.alpha, tau: +d.tau } }); S.project = r.project; toast("Saved", "ok"); }
    catch (ex) { fail(ex); }
  });
  on(root, "click", "[data-delproj]", async () => {
    if (prompt(`Type the project key (${p.key}) to delete “${p.name}” and all its data.`) !== p.key) return;
    try { await api(P(), { method: "DELETE" }); S.project = null; toast("Project deleted", "ok"); go("/projects"); } catch (ex) { fail(ex); }
  });
  on(root, "change", "[data-role-of]", async (e, s) => {
    try { await api(`/team/${s.dataset.roleOf}`, { method: "PATCH", body: { role: s.value } }); toast("Role changed — it applies on their next request", "ok"); } catch (ex) { fail(ex); render(root); }
  });
  on(root, "click", "[data-toggle]", async (e, b) => {
    try { await api(`/team/${b.dataset.toggle}`, { method: "PATCH", body: { is_active: b.dataset.active !== "1" } }); render(root); } catch (ex) { fail(ex); }
  });
  on(root, "click", "[data-add]", () => modal({ title: "Add a team member", body: html`<form>
      <div class="field"><label>Name</label><input name="name" type="text" required minlength="2"></div>
      <div class="field"><label>Email</label><input name="email" type="email" required></div>
      <div class="inline-fields"><div class="field"><label>Role</label><select name="role">${roles.map((r) => html`<option value="${r.code}" ${r.code === "developer" ? "selected" : ""}>${r.label}</option>`)}</select></div>
        <div class="field"><label>Title</label><input name="title" type="text" placeholder="Backend engineer"></div></div>
      <div class="field"><label>Temporary password</label><input name="password" type="text" required minlength="8"><div class="hint">Share it privately; they can change it after signing in.</div></div></form>`,
    foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Add member</button>`,
    onSubmit: async (f, close) => { await api("/team", { method: "POST", body: formData(f) }); toast("Member added", "ok"); close(); render(root); } }));
  on(root, "click", "[data-demo]", () => modal({ title: "Create a demo team", body: html`<form><p class="small">Creates one account per role inside your team — handy for a viva or walkthrough: tech.lead@, developer@, qa@, manager@ and viewer@<b>${(S.me.org || {}).slug || "team"}</b>.demo, all with the password you choose.</p>
      <div class="field"><label>Password for the demo accounts</label><input name="password" type="text" required minlength="8"></div></form>`,
    foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Create</button>`,
    onSubmit: async (f, close) => {
      const r = await api("/team/demo", { method: "POST", body: formData(f) });
      close();
      modal({ title: "Demo accounts ready", body: html`<table class="data"><tbody>${[...r.created, ...r.updated].map((x) => html`<tr><td class="mono small">${x.email}</td><td>${x.role}</td></tr>`)}</tbody></table>` });
      render(root);
    } }));
  on(root, "submit", "[data-token]", async (e, f) => {
    e.preventDefault();
    try {
      const r = await api("/auth/tokens", { method: "POST", body: formData(f) });
      $("[data-newtoken]", root).innerHTML = String(html`<div class="callout warn" style="margin-top:10px"><b>Copy it now — it is shown only once.</b>${codeBlock(`debtlens login ${location.origin} --token ${r.token}`)}</div>`);
      toast("Token created", "ok");
    } catch (ex) { fail(ex); }
  });
  on(root, "click", "[data-revoke]", async (e, b) => { try { await api(`/auth/tokens/${b.dataset.revoke}`, { method: "DELETE" }); render(root); } catch (ex) { fail(ex); } });
}
