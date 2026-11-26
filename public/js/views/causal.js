// M3 Causal analysis: every 5 Whys chain merged into one graph; systemic causes; DBSCAN clusters.
import { $, api, fail, formData, html, loadCytoscape, modal, n, on, toast } from "../lib.js";
import { can, link, S } from "../app.js";
import { card, empty, head } from "./_parts.js";

const P = () => `/projects/${S.project.id}`;
const CAT = { SYMPTOM: "#d9480f", MECHANISM: "#a86400", ROOT: "#2457c5", PROCESS: "#6b4fbb", GENERAL: "#8a929c" };

export async function render(root, ctx) {
  const [g, cl] = await Promise.all([api(`${P()}/causal-graph`), api(`${P()}/clusters`)]);
  const ranked = g.nodes.slice(0, 10);  // server order: incidents converging, then paths through (betweenness)
  root.innerHTML = String(html`${head("Root causes", "Every 5 Whys answer as one graph, from symptom to deeper cause. Causes that many incidents share are worth fixing once.",
      html`<div class="row tight"><button class="btn sm" data-layout="cose">Clusters</button><button class="btn sm" data-layout="breadthfirst">Layered</button><button class="btn sm" data-fit>Fit</button></div>`)}
    <div class="grid side"><div>
      <div class="graph" data-tour="graph" data-graph></div>
      <div class="legend">${Object.entries(CAT).map(([k, c]) => html`<span><i style="background:${c}"></i>${k.toLowerCase()}</span>`)}<span>node size = incidents · ${g.nodes.length} causes · ${g.edges.length} links</span></div>
    </div><div data-side>${card("Select a cause", html`<p class="small muted" style="margin:0">Click a node to see the incidents that lead to it, what it causes, and the debt rooted in it.</p>`)}</div></div>
    <div class="grid c2" style="margin-top:16px">
      ${card("Most systemic causes", ranked.length ? html`<table class="data"><thead><tr><th>Cause</th><th class="num" title="incident chains that converge on this cause">Incidents</th><th class="num" title="shortest paths between other causes that pass through it (raw betweenness)">Paths through</th><th class="num">Betweenness</th><th class="num">Degree</th></tr></thead><tbody>
          ${ranked.map((c) => html`<tr class="clickable" data-pick="${c.id}"><td>${c.label} <span class="badge">${c.category.toLowerCase()}</span></td><td class="num"><b>${c.incidents}</b></td><td class="num">${n(c.paths, 1)}</td><td class="num">${n(c.betweenness, 4)}</td><td class="num">${n(c.degree, 3)}</td></tr>`)}</tbody></table>
          <p class="tiny muted" style="margin:8px 12px">Ranked by how many incident chains converge on the cause, then by shortest paths through it (betweenness, Brandes), then degree.</p>` : empty("No causes yet."), { flush: true })}
      ${card(`Root-cause clusters (DBSCAN, ε = ${n(cl.eps, 2)})`, cl.clusters.length ? html`<table class="data"><thead><tr><th>Theme</th><th class="num">Causes</th><th class="num">Cohesion</th><th>Incidents</th></tr></thead><tbody>
          ${cl.clusters.map((c) => html`<tr><td><b>${c.theme}</b><div class="tiny muted">${(c.members || []).slice(0, 3).join(" · ")}</div></td><td class="num">${c.size}</td><td class="num">${n(c.cohesion, 2)}</td>
            <td class="small">${(c.incident_keys || []).slice(0, 6).join(", ")}${(c.incident_keys || []).length > 6 ? "…" : ""}</td></tr>`)}</tbody></table>`
        : empty("Not enough similar causes to form clusters."), { flush: true, actions: html`<span class="tiny muted">${cl.semantic_method}</span>` })}
    </div>`);

  const cytoscape = await loadCytoscape();
  const cy = cytoscape({
    container: $("[data-graph]", root),
    elements: [
      ...g.nodes.map((c) => ({ data: { id: String(c.id), label: c.label.length > 42 ? c.label.slice(0, 40) + "…" : c.label, cat: c.category, w: Math.min(70, 16 + 9 * c.incidents),
        show: c.incidents >= 2 || c.category === "ROOT" ? 1 : 0 } })),
      ...g.edges.map((e) => ({ data: { id: `e${e.source}-${e.target}`, source: String(e.source), target: String(e.target), w: e.weight } })),
    ],
    style: [
      { selector: "node", style: { "background-color": (el) => CAT[el.data("cat")] || CAT.GENERAL, width: "data(w)", height: "data(w)", label: "data(label)",
        "font-size": 10, "text-wrap": "wrap", "text-max-width": 130, "text-valign": "bottom", "text-margin-y": 4, color: "#1a1e24", "border-width": 1, "border-color": "#fff",
        "text-opacity": (el) => (el.data("show") ? 1 : 0) } },
      { selector: "node:selected, node.near", style: { "text-opacity": 1 } },
      { selector: "edge", style: { width: (el) => Math.min(6, 1 + el.data("w")), "line-color": "#c9ced6", "target-arrow-color": "#c9ced6", "target-arrow-shape": "triangle", "curve-style": "bezier", "arrow-scale": 0.8 } },
      { selector: "node:selected", style: { "border-width": 4, "border-color": "#1a1e24" } },
      { selector: ".faded", style: { opacity: 0.18 } },
    ],
    layout: { name: "cose", padding: 24, nodeRepulsion: () => 14000, idealEdgeLength: () => 46, componentSpacing: 60, nodeOverlap: 12, animate: false, randomize: false },
    minZoom: 0.2, maxZoom: 3,
  });
  const select = async (id) => {
    cy.elements().removeClass("faded");
    const node = cy.getElementById(String(id));
    if (!node.length) return;
    const hood = node.closedNeighborhood().union(node.predecessors()).union(node.successors());
    cy.elements().not(hood).addClass("faded");
    cy.nodes().removeClass("near"); hood.nodes().addClass("near");
    cy.$(":selected").unselect(); node.select();
    try { showCause(root, await api(`${P()}/causes/${id}`), g, () => render(root, ctx)); } catch (e) { fail(e); }
  };
  cy.on("tap", "node", (e) => select(e.target.id()));
  cy.on("tap", (e) => { if (e.target === cy) { cy.elements().removeClass("faded"); cy.nodes().removeClass("near"); } });
  on(root, "click", "[data-layout]", (e, b) => cy.layout(b.dataset.layout === "cose"
    ? { name: "cose", padding: 24, nodeRepulsion: () => 14000, idealEdgeLength: () => 46, componentSpacing: 60, animate: true }
    : { name: "breadthfirst", directed: true, spacingFactor: 1.1, padding: 20, animate: true }).run());
  on(root, "click", "[data-fit]", () => cy.fit(undefined, 20));
  on(root, "click", "[data-pick]", (e, r) => { select(r.dataset.pick); $("[data-graph]", root).scrollIntoView({ block: "center" }); });
  if (ctx.sub[0]) select(ctx.sub[0]);
}

function showCause(root, d, g, reload) {
  const c = d.cause;
  const side = $("[data-side]", root);
  side.innerHTML = String(card(html`${c.label}`, html`<div class="row tight" style="margin-bottom:8px"><span class="badge">${c.category.toLowerCase()}</span>
      <span class="chip">${d.incidents.length} incident${d.incidents.length === 1 ? "" : "s"}</span><span class="chip">betweenness ${n(c.betweenness, 3)}</span></div>
    <h4>Incidents reaching this cause</h4>${d.incidents.length ? html`<ul class="small" style="padding-left:18px;margin:4px 0 10px">${d.incidents.map((i) => html`<li><a href="${link("incidents", i.id)}">${i.key}</a> ${i.title}</li>`)}</ul>` : html`<p class="small muted">None directly.</p>`}
    ${d.symptoms.length ? html`<h4>Caused by it (upstream symptoms)</h4><ul class="small" style="padding-left:18px;margin:4px 0 10px">${d.symptoms.map((x) => html`<li>${x.label}${x.weight > 1 ? ` (×${x.weight})` : ""}</li>`)}</ul>` : ""}
    ${d.deeper_causes.length ? html`<h4>Deeper causes</h4><ul class="small" style="padding-left:18px;margin:4px 0 10px">${d.deeper_causes.map((x) => html`<li>${x.label}${x.weight > 1 ? ` (×${x.weight})` : ""}</li>`)}</ul>` : ""}
    <h4>Debt rooted here</h4>${d.debts.length ? html`<ul class="small" style="padding-left:18px;margin:4px 0 0">${d.debts.map((x) => html`<li><a href="${link("debts", x.id)}">${x.key}</a> ${x.title}</li>`)}</ul>` : html`<p class="small muted" style="margin:0">No debt item points at this cause yet.</p>`}`,
    { actions: can("rca.write") ? html`<button class="btn sm" data-ren>Edit</button><button class="btn sm" data-merge>Merge…</button>` : "" }));
  on(side, "click", "[data-ren]", () => modal({ title: "Edit cause", body: html`<form><div class="field"><label>Label</label><input name="label" type="text" value="${c.label}" required minlength="3"></div>
      <div class="field"><label>Category</label><select name="category">${["SYMPTOM", "MECHANISM", "ROOT", "PROCESS", "GENERAL"].map((k) => html`<option ${k === c.category ? "selected" : ""}>${k}</option>`)}</select></div></form>`,
    foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button>`,
    onSubmit: async (f, close) => { await api(`${P()}/causes/${c.id}`, { method: "PATCH", body: formData(f) }); toast("Saved", "ok"); close(); reload(); } }));
  on(side, "click", "[data-merge]", () => modal({ title: "Merge duplicate causes", body: html`<form><p class="small">Fold other nodes into “${c.label}”. Their incidents, links and debts move here.</p>
      <div class="field"><label>Causes to merge in</label><select name="merge" multiple size="10" style="height:auto">${g.nodes.filter((x) => x.id !== c.id).map((x) => html`<option value="${x.id}">${x.label} (${x.incidents})</option>`)}</select>
      <div class="hint">Ctrl/Cmd-click to pick several.</div></div></form>`,
    foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Merge</button>`,
    onSubmit: async (f, close) => {
      const ids = Array.from(f.querySelector("select").selectedOptions).map((o) => +o.value);
      if (!ids.length) return toast("Pick at least one cause", "bad");
      await api(`${P()}/causes/merge`, { method: "POST", body: { keep_id: c.id, merge_ids: ids } });
      toast(`Merged ${ids.length} cause(s)`, "ok"); close(); reload();
    } }));
}
