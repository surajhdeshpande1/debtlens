// DebtLens front-end helpers: safe HTML templating, API client, formatting, modals, charts.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s));
const part = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(part).join("") : v === null || v === undefined || v === false ? "" : esc(v));
/** Tagged template: every interpolated value is HTML-escaped unless produced by html`` or raw(). */
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Safe(out);
}

export function el(markup) {
  const d = document.createElement("div");
  d.innerHTML = String(markup);
  return d;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
/** Delegated event listener.  Registering the same (type, selector) again on the same root
 *  replaces the earlier handler, so views can safely re-render themselves in place. */
export function on(root, type, sel, fn) {
  const reg = root.__dl || (root.__dl = {});
  if (!reg[type]) {
    reg[type] = new Map();
    root.addEventListener(type, (e) => {
      for (const [s, f] of reg[type]) {
        const t = e.target.closest(s);
        if (t && root.contains(t)) f(e, t);
      }
    });
  }
  reg[type].set(sel, fn);
}
export function formData(form) {
  const out = {};
  new FormData(form).forEach((v, k) => {
    if (k in out) out[k] = [].concat(out[k], v);
    else out[k] = v;
  });
  return out;
}
export const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ------------------------------------------------------------------ storage (may be blocked)
const mem = {};
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch { delete mem[k]; } },
};

// ------------------------------------------------------------------ API
export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}
const TOKEN = "debtlens.token";
export const auth = {
  get token() { return store.get(TOKEN); },
  set token(v) { v ? store.set(TOKEN, v) : store.del(TOKEN); },
  onExpired: null,
};
export async function api(path, { method = "GET", body, raw: wantRaw = false, quiet = false } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth.token) headers.Authorization = "Bearer " + auth.token;
  let res;
  try {
    res = await fetch("/api/v1" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new ApiError(0, "Network error — is the server running?");
  }
  if (wantRaw && res.ok) return res;
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json();
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || "Request failed";
    if ((res.status === 401 || res.status === 410) && auth.onExpired && !quiet) auth.onExpired(msg, res.status);
    throw new ApiError(res.status, msg, data);
  }
  return data;
}
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ------------------------------------------------------------------ formatting
export const n = (v, d = 1) => (v === null || v === undefined || Number.isNaN(+v) ? "–" : (+v).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: 0 }));
export const pct = (v, d = 0) => (v === null || v === undefined ? "–" : `${(+v).toFixed(d)}%`);
export const hrs = (v) => (v === null || v === undefined ? "–" : `${n(v)} h`);
export function date(iso, withTime = false) {
  if (!iso) return "–";
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  if (Number.isNaN(d)) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}
export function ago(iso) {
  if (!iso) return "–";
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 0) { const m = -s / 60; return m < 60 ? `in ${Math.round(m)} min` : `in ${Math.round(m / 60)} h`; }
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 45) return `${Math.round(s / 86400)} d ago`;
  return date(iso);
}
export const sev = (s) => html`<span class="badge sev-${s}">${(s || "").toLowerCase()}</span>`;
export const status = (s) => html`<span class="badge st-${s}">${(s || "").replace("_", " ").toLowerCase()}</span>`;
export function bar(value, max, cls = "", suffix = "") {
  const w = max > 0 ? Math.max(2, Math.min(100, (100 * value) / max)) : 0;
  return html`<span class="barcell"><span class="bar ${cls}"><span style="width:${w.toFixed(1)}%"></span></span><span class="n">${n(value)}${suffix}</span></span>`;
}
export const label = (s) => String(s || "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
export const plural = (k, word, many) => `${n(k, 0)} ${k === 1 ? word : many || word + "s"}`;

// ------------------------------------------------------------------ toast & modal
export function toast(msg, kind = "") {
  let box = $(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), kind === "bad" ? 6000 : 3500);
}
export function fail(e) { toast(e instanceof ApiError ? e.message : String(e), "bad"); console.error(e); }

/** Opens a modal; returns {root, close}. ``content`` is html``; ``onSubmit(form)`` handles the first form. */
export function modal({ title, body, foot = null, wide = false, onSubmit = null, onClose = null }) {
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = String(html`<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-head"><h2>${title}</h2><button class="btn ghost sm" data-close aria-label="Close">✕</button></div>
      <div class="modal-body">${body}</div>${foot ? html`<div class="modal-foot">${foot}</div>` : ""}</div>`);
  document.body.appendChild(back);
  const close = () => { back.remove(); document.removeEventListener("keydown", esck); onClose && onClose(); };
  const esck = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", esck);
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  on(back, "click", "[data-close]", close);
  const form = $("form", back);
  const footSubmit = $(".modal-foot [type=submit]", back);
  if (form && footSubmit) {  // footer buttons sit outside the <form>: bind them to it
    form.id = form.id || "mf" + Math.random().toString(36).slice(2);
    footSubmit.setAttribute("form", form.id);
  }
  if (form && onSubmit) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("[type=submit]", back) || $("[form]", back);
      if (btn) btn.disabled = true;
      try { await onSubmit(form, close); } catch (err) { fail(err); } finally { if (btn) btn.disabled = false; }
    });
  }
  const first = $("input, select, textarea", back);
  if (first) setTimeout(() => first.focus(), 30);
  return { root: back, close };
}
export function confirmBox(title, text, okLabel = "Confirm") {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({ title, body: html`<p>${text}</p>`, foot: html`<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>${okLabel}</button>`,
      onClose: () => { if (!done) resolve(false); } });
    on(m.root, "click", "[data-ok]", () => { done = true; m.close(); resolve(true); });
  });
}

// ------------------------------------------------------------------ lazy vendor scripts
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error("could not load " + src));
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}
export const loadChart = () => loadScript("/vendor/chart.umd.min.js").then(() => window.Chart);
export const loadCytoscape = () => loadScript("/vendor/cytoscape.min.js").then(() => window.cytoscape);

export const COLORS = { accent: "#2457c5", accent2: "#7aa2f7", ok: "#1f7a4d", warn: "#a86400", bad: "#c0392b", muted: "#8a929c", grid: "#eef0f3",
  series: ["#2457c5", "#1f7a4d", "#a86400", "#c0392b", "#6b4fbb", "#0f7b8a"] };
const charts = new WeakMap();
export async function chart(canvas, config) {
  const Chart = await loadChart();
  if (charts.has(canvas)) charts.get(canvas).destroy();
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = "#5c6571";
  const c = new Chart(canvas, { ...config, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    plugins: { legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10 } }, ...(config.options?.plugins || {}) },
    ...config.options, scales: config.options?.scales } });
  charts.set(canvas, c);
  return c;
}

export function copyButtons(root) {
  on(root, "click", "[data-copy]", async (e, b) => {
    const text = b.closest(".copy-wrap").querySelector("pre, code").innerText;
    try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1200); } catch { toast("Copy blocked by the browser"); }
  });
}
export const codeBlock = (text) => html`<div class="copy-wrap"><pre><code>${text}</code></pre><button class="btn sm" data-copy>Copy</button></div>`;
