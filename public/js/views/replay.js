// Live replay: one simulated day of a load spike, played back minute by minute as the customer's phone and the
// on-call engineer's screens would show it. It animates the engine's trace for that day (spike.replay) and nothing
// else: no requests reach the server and the browser is never really blocked. The frozen device is drawn, so
// pause, close and Esc always work.
import { esc, html, n } from "../lib.js";

const HOUR_BUSY = 6;      // real seconds per busy simulated hour at 1×
const HOUR_QUIET = 0.6;   // real seconds per quiet hour
const MAX_SECONDS = 80;   // a whole replay at 1× stays under this
const SPEEDS = [0.5, 1, 2, 4];
const pad = (x) => String(x).padStart(2, "0");
const clock = (min) => { const m = Math.min(1439, Math.floor(min)); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }; // day ends 23:59
const ease = (f) => (f >= 1 ? 1 : f <= 0 ? 0 : f * f * (3 - 2 * f));
const reducedMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

/** Indian-style counts: 4,500 · 3.2 lakh · 1.4 crore. */
export function count(v) {
  v = Math.max(0, +v || 0);
  if (v >= 1e7) return `${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)} crore`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)} lakh`;
  return Math.round(v).toLocaleString("en-IN");
}

/** A value given once per hour, eased in over the first minutes of each hour. */
function hourly(arr, min, ramp = 12) {
  const h = Math.max(0, Math.min(23, Math.floor(min / 60)));
  const a = h ? arr[h - 1] : arr[0];
  return a + (arr[h] - a) * ease((min - h * 60) / ramp);
}
const wobble = (min, i) => 1 + 0.03 * Math.sin(min * 0.83 + i * 1.7) + 0.015 * Math.sin(min * 2.9 + i * 0.6);

function rng(seed) { // small deterministic generator, so a rehearsal looks like the real thing
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** "Priya, booking…" → "Priya"; "A customer paying…" → "the customer"; "The Sharma family, …" → "the Sharma family". */
export function whoName(who) {
  const w = String(who || "").trim();
  const art = /^(a|an)\s+([^\s,]+)/i.exec(w);
  if (art) return `the ${art[2]}`;
  if (!w.includes(", ")) return "the customer";
  const name = w.split(", ")[0].trim();
  return /^the\s/i.test(name) ? "the" + name.slice(3) : name;
}

function fallbackJourney(r, project) {
  const entry = Object.entries(r.event.entry || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m]) => m);
  const mods = entry.length ? entry : r.replay.modules.slice(0, 4);
  return {
    app: (project && project.name) || "The app", who: "A customer using the app", peak_rpm: 10000, color: "#2457c5",
    steps: mods.map((m, i) => ({ module: m, label: i ? `Use ${m}` : `Open the app (${m})`, ok: `${m}: done`, slow: `Waiting for ${m}…`,
      fail: `${m} is not responding. Please try again.` })),
  };
}

// ------------------------------------------------------------------ the model of one lane (today / after the fixes)
function makeLane(r, side) {
  const tr = r.replay[side], mods = r.replay.modules;
  const byMod = Object.fromEntries(r.modules.map((m) => [m.module, m]));
  const util = mods.map((m) => (byMod[m] ? byMod[m][side === "after" ? "utilisation_after" : "utilisation_before"] : Array(24).fill(0)));
  const entry = r.event.entry || {};
  const share = mods.map((m) => +entry[m] || 0);
  const change = Array.from({ length: 24 }, () => ({}));
  tr.events.forEach((e) => { if (STATE_KINDS.has(e.kind)) change[e.hour][e.module] = e.minute; });
  return {
    side, tr, mods, util, share, total: share.reduce((a, b) => a + b, 0) || 1, change,
    profile: side === "after" && r.replay.profile_after ? r.replay.profile_after : r.profile,
    severity: Object.fromEntries(r.modules.map((m) => [m.module, m.severity])),
  };
}

// Trace events that change a module's state; the rest ("situation", "situation_end", "prevented") only tell the story.
const STATE_KINDS = new Set(["overload", "cascade", "outage", "deploy", "fault", "recovered"]);
const INCIDENT_KINDS = new Set(["overload", "cascade", "outage", "deploy", "fault"]);

/** Each module's state at a minute: {s: 0 up / 1 failed itself / 2 failing because a dependency failed, from, kind}. */
function statesAt(L, min) {
  const h = Math.max(0, Math.min(23, Math.floor(min / 60)));
  const now = L.tr.states[h], prev = h ? L.tr.states[h - 1] : null;
  const kinds = L.tr.kinds || [];
  return L.mods.map((m, i) => {
    const s = now[i], p = prev ? prev[i] : 0, c = L.change[h][m];
    if (s !== p && (s === 0 || p === 0) && c !== undefined && min < c) {
      return { s: p, from: p === 2 ? L.tr.cause[h - 1][i] : null, kind: p && kinds[h - 1] ? kinds[h - 1][i] : null };
    }
    return { s, from: s === 2 ? L.tr.cause[h][i] : null, kind: s && kinds[h] ? kinds[h][i] : null };
  });
}
const failingShare = (L, st) => Math.min(1, st.reduce((a, x, i) => a + (x.s ? L.share[i] : 0), 0) / L.total);

// ------------------------------------------------------------------ public entry point
/**
 * Open the live replay for a load-spike result.
 * @param {object} r  POST /simulate/spike result (needs r.replay)
 * @param {{mode?: "before"|"after"|"side", project?: object, opener?: Element, onReport?: Function, onClose?: Function}} opts
 */
export function openReplay(r, opts = {}) {
  if (!r || !r.replay) return () => {};
  const J = r.journey && r.journey.steps && r.journey.steps.length ? r.journey : fallbackJourney(r, opts.project);
  const firstName = whoName(J.who);
  const peakRpm = +J.peak_rpm || 10000;
  const lanesData = { before: makeLane(r, "before"), after: makeLane(r, "after") };
  const bots = r.bots || null;
  const planKeys = (r.plan.selected || []).map((x) => x.key);
  const planHours = r.plan.hours_used;

  // Busy hours play slowly, quiet ones fast; the window starts two hours before anything happens.
  const busy = Array.from({ length: 24 }, (_, h) => r.profile[h] >= 1.5
    || ["before", "after"].some((s) => {
      const L = lanesData[s];
      return L.tr.states[h].some((x) => x) || (h && L.tr.states[h - 1].some((x) => x)) || L.util.some((u) => u[h] >= 0.85);
    }));
  const firstBusy = busy.indexOf(true), lastBusy = busy.lastIndexOf(true);
  const startMin = firstBusy < 0 ? 0 : Math.max(0, firstBusy - 2) * 60;
  const endMin = firstBusy < 0 ? 1440 : Math.min(24, lastBusy + 3) * 60;
  const nBusy = busy.slice(startMin / 60, endMin / 60).filter(Boolean).length;
  const nQuiet = (endMin - startMin) / 60 - nBusy;
  const busySec = Math.max(1.5, Math.min(HOUR_BUSY, (MAX_SECONDS - nQuiet * HOUR_QUIET) / Math.max(1, nBusy)));
  const secPerMin = (min) => (busy[Math.floor(min / 60)] ? busySec : HOUR_QUIET) / 60;
  const cum = [0]; // real seconds at the start of each simulated minute
  for (let m = startMin; m < endMin; m++) cum.push(cum[cum.length - 1] + secPerMin(m));
  const totalSec = cum[cum.length - 1];
  const minuteAt = (sec) => {
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= sec) lo = mid; else hi = mid - 1; }
    const frac = lo < cum.length - 1 ? (sec - cum[lo]) / (cum[lo + 1] - cum[lo]) : 0;
    return Math.min(endMin, startMin + lo + Math.max(0, Math.min(0.999, frac)));
  };

  const firstDown = (m) => Math.min(...["before", "after"].map((sd) => {
    const e = lanesData[sd].tr.events.find((x) => x.module === m && x.kind !== "recovered");
    return e ? e.minute : 9999;
  }));
  // Modules worth a tile: anything exposed to the spike, ever down, or running hot.
  const show = r.replay.modules.map((m, i) => ({ m, i })).filter(({ m, i }) => {
    const mm = r.modules.find((x) => x.module === m) || {};
    return (mm.exposure > 0) || ["before", "after"].some((s) => lanesData[s].tr.states.some((st) => st[i])) || (mm.peak_utilisation_before >= 0.6);
  }).sort((a, b) => firstDown(a.m) - firstDown(b.m) || ((r.event.entry || {})[b.m] || 0) - ((r.event.entry || {})[a.m] || 0)
    || ((r.modules.find((x) => x.module === b.m) || {}).exposure || 0) - ((r.modules.find((x) => x.module === a.m) || {}).exposure || 0)).slice(0, 12);
  const tilesFor = () => (mode === "side" ? show.slice(0, 6) : show);
  const quietFor = () => r.replay.modules.length - tilesFor().length;
  const entryIdx = r.replay.modules.indexOf(J.steps[0].module);
  const peakHour = r.profile.indexOf(Math.max(...r.profile));

  // ---------------------------------------------------------------- DOM
  const root = document.createElement("div");
  root.className = "rp";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", `Live replay: ${r.event.name}`);
  root.tabIndex = -1;
  root.innerHTML = String(html`<div class="rp-top">
      <span class="rp-live"><i></i>LIVE REPLAY</span>
      <div class="rp-title"><b>${r.event.name}</b><span>${J.app} · simulated day ${r.replay.run + 1} of ${r.runs} · peak ${n(r.peak)}× normal traffic at ${pad(peakHour)}:00</span></div>
      <div class="rp-clock" data-clock aria-label="Simulated time">${clock(startMin)}</div>
      <div class="rp-seg" role="group" aria-label="What to watch">
        <button data-mode="before" title="Today, with the open debt (1)">Today</button><button data-mode="after" title="The same day after the fixes (2)">After the fixes</button><button data-mode="side" title="Both at once (3)">Side by side</button></div>
      <div class="rp-ctl">
        <button data-act="play" title="Play / pause (Space)" aria-label="Play">▶</button>
        <button data-act="restart" title="Restart (R)" aria-label="Restart">↺</button>
        <button data-act="speed" title="Speed (S)">1×</button>
        <button data-act="fx" aria-pressed="true" title="Frozen-device effects (E)">Freeze effects</button>
        <button data-act="sound" aria-pressed="false" title="Sound (M)" aria-label="Sound">Sound off</button>
        <button data-act="full" title="Full screen (F)" aria-label="Full screen">⛶</button>
        <button data-act="close" title="Close (Esc)" aria-label="Close">✕</button></div></div>
    <div class="rp-strip" data-strip></div>
    <div class="rp-lanes" data-lanes></div>
    <div class="rp-foot"><span>Space play/pause · R restart · 1 2 3 view · S speed · E freeze · M sound · F full screen · Esc close</span>
      <span>Simulated by the DebtLens load-spike model (hourly; minutes are illustrative). Nothing is really frozen.</span></div>
    <div class="rp-intro" data-intro><div class="rp-intro-box">
      <div class="rp-live"><i></i>LIVE REPLAY</div>
      <h2>${r.event.name}</h2>
      <p>${r.event.description || ""}</p>
      <p class="rp-dim">The phone: ${J.who || "a customer"}, on ${J.app}. The dashboards: what the on-call engineer sees at the same time. This is simulated day ${r.replay.run + 1} of ${r.runs}, chosen because it is typical: ${n(r.replay.before.total_hours_lost)} engineer-hours lost today (average ${n(r.before.hours_lost)} h), ${n(r.replay.after.total_hours_lost)} h after the fixes (average ${n(r.after.hours_lost)} h).</p>
      <div class="rp-intro-go"><button class="rp-big" data-act="start">▶ Start the day</button>
        <button data-mode="side" data-start class="rp-alt">Side by side</button></div>
      <p class="rp-dim small">Starts at ${clock(startMin)}${firstBusy > 0 ? ", two hours before the traffic builds" : ""}. Space starts and pauses.</p></div></div>`);

  // ---------------------------------------------------------------- per-lane views
  const fixesLine = planKeys.length ? `Fixed before the event: ${planKeys.slice(0, 3).join(", ")}${planKeys.length > 3 ? ` +${planKeys.length - 3}` : ""} (${n(planHours)} h of work)` : "No fix changes this event";
  const laneHtml = (side) => html`<section class="rp-lane ${side}" data-lane="${side}">
      <div class="rp-lane-head"><b>${side === "before" ? "Today, with the open debt" : "After the fixes"}</b><span class="rp-nr">(Not Responding)</span>
        <span class="rp-sub">${side === "before" ? `${r.debts.filter((d) => d.capacity_effect || d.resilience_effect).length} open debts weaken capacity or resilience` : fixesLine}</span></div>
      <div class="rp-lane-body">
        <div class="rp-col-phone"><div class="rp-cap">What ${firstName} sees</div>
          <div class="rp-phone"><div class="rp-screen" data-screen>
            <div class="rp-status"><span data-ptime>${clock(startMin)}</span><span>▂▄▆█ 4G ▮</span></div>
            <div class="rp-app" style="background:${/^#[0-9a-f]{3,8}$/i.test(J.color || "") ? J.color : "#2457c5"}">${J.app}</div>
            <div class="rp-who">${J.who || ""}</div>
            <ol class="rp-steps">${J.steps.map((s, i) => html`<li data-step="${i}"><i></i><span>${s.label}</span></li>`)}</ol>
            <div class="rp-msg" data-msg></div>
            <div class="rp-pfoot" data-pfoot>Attempt 1</div>
            <div class="rp-anr" data-anr hidden><div class="rp-anr-box"><b>${J.app} isn't responding</b><span>Close app</span><span>Wait</span></div></div>
          </div></div></div>
        <div class="rp-col-ops"><div class="rp-cap">What the on-call engineer sees</div>
          <div class="rp-kpis">
            <div class="rp-kpi rpm"><div class="v" data-k="rpm">0</div><div class="l">requests / min</div></div>
            <div class="rp-kpi"><div class="v" data-k="fail">0%</div><div class="l">failing right now</div></div>
            <div class="rp-kpi"><div class="v" data-k="lost">0</div><div class="l">requests failed today</div></div>
            <div class="rp-kpi"><div class="v" data-k="hours">0 h</div><div class="l">engineer hours lost</div></div>
            <div class="rp-kpi"><div class="v" data-k="inc">0</div><div class="l">incidents</div></div></div>
          ${bots ? html`<div class="rp-bots" data-bots><div class="rp-mix"><i class="h"></i><i class="b"></i><i class="x"></i></div><div class="rp-mix-t" data-mixt></div></div>` : ""}
          <div class="rp-tiles">${tilesFor().map(({ m }) => html`<div class="rp-tile" data-mod="${m}"><div class="rp-tile-h"><b>${m}</b><span class="rp-chip">OK</span></div>
              <div class="rp-meter"><i></i></div><div class="rp-tile-f"><span data-load>0%</span><span data-why></span></div></div>`)}
            ${quietFor() > 0 ? html`<div class="rp-tile rp-quiet">+${quietFor()} more ${quietFor() === 1 ? "module" : "modules"}${mode === "side" ? "" : ", quiet all day"}</div>` : ""}</div>
          ${mode === "side" ? html`<div class="rp-cap rp-cap-feed">Alerts</div><div class="rp-feed" data-feed></div>` : ""}</div>
        ${mode === "side" ? "" : html`<div class="rp-col-feed"><div class="rp-cap">Alerts</div><div class="rp-feed" data-feed></div></div>`}</div>
      <div class="rp-veil"></div>
      <div class="rp-end" data-end hidden></div></section>`;

  // ---------------------------------------------------------------- strip: traffic over the day and when it failed
  const maxP = Math.max(...r.profile, 1);
  const stripHtml = () => {
    const W = 1000, bw = W / 24;
    const rows = mode === "side" ? ["before", "after"] : [mode];
    const Hh = 48 + rows.length * 7;
    const bars = r.profile.map((p, h) => {
      const hgt = Math.max(1.5, Math.sqrt(p / maxP) * 42);
      const pa = lanesData.after.profile[h];
      const ha = Math.max(1.5, Math.sqrt(pa / maxP) * 42);
      return `<rect x="${(h * bw + 2).toFixed(1)}" y="${(44 - hgt).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${hgt.toFixed(1)}" class="tb"/>`
        + (bots && mode !== "before" && pa < p - 0.01 ? `<rect x="${(h * bw + 2).toFixed(1)}" y="${(44 - ha).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${ha.toFixed(1)}" class="tp"/>` : "");
    }).join("");
    const fails = rows.map((sd, k) => Array.from({ length: 24 }, (_, h) => `<rect data-f="${sd}:${h}" x="${(h * bw + 2).toFixed(1)}" y="${48 + k * 7}" width="${(bw - 4).toFixed(1)}" height="5" class="fc"/>`).join("")).join("");
    const x0 = (startMin / 1440 * W).toFixed(1), x1 = (endMin / 1440 * W).toFixed(1);
    const shade = `<rect x="0" y="0" width="${x0}" height="${Hh}" class="sh"/><rect x="${x1}" y="0" width="${(W - x1).toFixed(1)}" height="${Hh}" class="sh"/>`;
    // Text stays out of the stretched SVG so it never distorts on wide screens.
    return `<div class="rp-strip-box"><span class="rp-peak" style="left:${((peakHour + 0.5) / 24 * 100).toFixed(2)}%">${n(maxP)}×</span>
      <svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-label="Traffic over the day" style="height:${Hh + 10}px">${bars}${fails}${shade}
        <line data-cursor x1="0" x2="0" y1="0" y2="${Hh}" class="cur" vector-effect="non-scaling-stroke"/></svg>
      <div class="rp-rows">${rows.map((sd) => `<span>${sd === "before" ? "today" : "after"}</span>`).join("")}</div>
      <div class="rp-hours">${Array.from({ length: 8 }, (_, k) => `<span style="left:${(k * 3 / 24 * 100).toFixed(2)}%">${pad(k * 3)}:00</span>`).join("")}</div></div>
      <div class="rp-strip-l"><span><i class="tb"></i>traffic, × a normal peak</span>${bots && mode !== "before" ? `<span><i class="tp"></i>reaching the servers after the fixes</span>` : ""}<span><i class="fc"></i>requests failing</span></div>`;
  };

  // ---------------------------------------------------------------- state
  let mode = opts.mode === "after" || opts.mode === "side" ? opts.mode : "before";
  let playing = false, ended = false, started = false, elapsed = 0, minute = startMin, speedIx = 1;
  let fx = true, sound = false, raf = 0, last = performance.now(), lastBeep = 0, lastStrip = 0;
  const baseTitle = document.title;
  const random = rng(r.replay.run + 7);
  let lanes = [], alertSeq = 0;

  function laneState(side) {
    const L = lanesData[side];
    return {
      L, side, el: null, min: startMin, hours: 0, inc: 0, failed: 0, evIx: 0, frozen: false, freezeUntil: 0, nextFreeze: 0,
      lastDraw: 0, severe: false, st: statesAt(L, startMin), cur: L.util.map(() => 0), fail: 0, maxFail: Array(24).fill(0),
      phone: { kind: "idle", i: 0, status: "", until: 0, attempt: 1, served: 0, failed: 0 }, feed: [], alerts: new Set(),
    };
  }

  function build() {
    const box = root.querySelector("[data-lanes]");
    const sides = mode === "side" ? ["before", "after"] : [mode];
    root.classList.toggle("side", mode === "side");
    box.innerHTML = sides.map((s) => String(laneHtml(s))).join("");
    lanes = sides.map((s) => { const X = laneState(s); X.el = box.querySelector(`[data-lane="${s}"]`); return X; });
    root.querySelector("[data-strip]").innerHTML = stripHtml();
    root.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    lanes.forEach((X) => { catchUp(X, minute, true); draw(X, performance.now(), true); });
    drawStrip(true);
  }

  // ---------------------------------------------------------------- simulation step for a lane (data only)
  function catchUp(X, toMin, silent = false) {
    const L = X.L;
    const from = Math.floor(X.min), to = Math.floor(toMin);
    for (let m = from; m < to; m++) { // requests that failed during each whole minute
      const st = statesAt(L, m);
      const f = failingShare(L, st);
      X.failed += peakRpm * hourly(L.profile, m) * f;
      const h = Math.floor(m / 60);
      X.maxFail[h] = Math.max(X.maxFail[h], f);
    }
    X.min = toMin;
    const evs = L.tr.events;
    while (X.evIx < evs.length && evs[X.evIx].minute <= toMin) {
      const e = evs[X.evIx++];
      if (INCIDENT_KINDS.has(e.kind)) { X.inc += 1; X.hours += +e.cost_hours || 0; }
      pushAlert(X, alertFor(e, X.side), silent);
      if (!INCIDENT_KINDS.has(e.kind)) { if (!silent && e.kind === "situation") beep([440, 440], 0.1, 0.04); continue; }
      if (!silent) {
        if (e.severity === "CRITICAL") { beep([880, 660]); if (fx && !reducedMotion() && !X.frozen) shake(X); } else beep([660]);
      } else if (!silent) beep([523], 0.08, 0.03);
    }
    syntheticAlerts(X, toMin, silent);
    if (toMin >= endMin && !X.alerts.has("end")) {
      X.alerts.add("end");
      X.hours = L.tr.total_hours_lost; X.inc = L.tr.incidents;
      pushAlert(X, { t: clock(endMin - 1), cls: "info", text: `Day over: ${n(L.tr.total_hours_lost)} engineer-hours lost, ${L.tr.incidents} ${L.tr.incidents === 1 ? "incident" : "incidents"}.` }, silent);
    }
    X.st = statesAt(L, toMin);
    X.fail = failingShare(L, X.st);
    const hr = Math.min(23, Math.floor(toMin / 60));
    // A module that overloaded this hour shows at least that hour's load, so the tile agrees with its alert.
    X.cur = L.util.map((u, i) => {
      const v = hourly(u, toMin) * wobble(toMin, i);
      return X.st[i].s === 1 && X.st[i].kind === "overload" ? Math.max(v, u[hr]) : v;
    });
    X.severe = X.fail >= 0.5 || (entryIdx >= 0 && X.st[entryIdx].s > 0);
  }

  function syntheticAlerts(X, toMin, silent) {
    const h = Math.min(23, Math.floor(toMin / 60));
    for (let k = Math.floor(startMin / 60); k <= h; k++) {
      const p = r.profile[k], prev = k ? r.profile[k - 1] : r.profile[0];
      if (p >= 2 && prev < 2 && !X.alerts.has(`up${k}`)) {
        X.alerts.add(`up${k}`);
        pushAlert(X, { t: clock(k * 60), cls: "info", text: `Traffic climbing: ${n(p)}× a normal peak, ${count(peakRpm * p)} requests a minute.` }, silent);
        if (bots && !X.alerts.has("bots")) {
          X.alerts.add("bots");
          const txt = X.side === "after" && bots.blocked_in_plan
            ? `Bot traffic: ${Math.round(bots.share * 100)}% of the extra requests come from bots. The edge rule from ${bots.mitigated_by.join(", ")} is blocking ${Math.round(bots.blocked * 100)}% of them.`
            : `Bot traffic: ${Math.round(bots.share * 100)}% of the extra requests come from bots, and nothing is stopping them${bots.mitigated_by.length ? ` (${bots.mitigated_by.join(", ")} is still open)` : ""}.`;
          pushAlert(X, { t: clock(k * 60 + 1), cls: X.side === "after" && bots.blocked_in_plan ? "ok" : "high", text: txt }, silent);
        }
      }
      if (k === peakHour && p >= 2 && !X.alerts.has("peak")) {
        X.alerts.add("peak");
        pushAlert(X, { t: clock(k * 60 + 2), cls: "info", text: `Peak hour: ${n(p)}× normal traffic.` }, silent);
      }
    }
  }

  function alertFor(e, side) {
    const t = clock(e.minute);
    if (e.kind === "situation") {
      const what = e.effect === "capacity" ? ` ${e.module === "*" ? "Every module" : e.module} is down to ${Math.round((e.factor || 0) * 100)}% of its capacity${e.mitigated ? " (softened by the fix)" : ""}.` : "";
      return { t, cls: "high", text: `⚠ ${e.label}.${what}` };
    }
    if (e.kind === "situation_end") return { t, cls: "info", text: `${e.label}.` };
    if (e.kind === "prevented") return { t, cls: "ok", text: `✓ ${e.label}` };
    const cls = e.kind === "recovered" ? "ok" : (e.severity || "MEDIUM").toLowerCase();
    const page = e.severity === "CRITICAL" ? " Paging on-call." : "";
    const cost = ` About ${n(e.cost_hours)} engineer-hours to handle.`;
    if (e.kind === "overload") {
      const u = Math.round(e.utilisation * 100);
      return { t, cls, text: (u >= 100 ? `${e.module} overloaded: ${u}% of its capacity.` : `${e.module} went down at ${u}% load, too close to its limit.`) + page + cost };
    }
    if (e.kind === "cascade") return { t, cls, text: `${e.module} failing: it depends on ${e.from}, which is down.${page}${cost}` };
    if (e.kind === "outage") return { t, cls, text: `${e.module} stopped answering: what it depends on outside is down.${page}${cost}` };
    if (e.kind === "deploy") return { t, cls, text: `${e.module} broken by a new release.${page}${cost}` };
    if (e.kind === "fault") return { t, cls, text: `${e.module} crashed on its own (a random fault).${page}${cost}` };
    return { t, cls, text: `${e.module} recovered.` };
  }

  function pushAlert(X, a, silent) {
    a.id = ++alertSeq;
    X.feed.unshift(a);
    if (X.feed.length > 60) X.feed.pop();
    X.feedDirty = true;
    if (!silent && a.cls === "critical") X.flash = performance.now();
  }

  // ---------------------------------------------------------------- the customer's phone (runs in real time)
  function phone(X, now) {
    const P = X.phone;
    if (P.kind !== "idle" && now < P.until) return;
    const at = (i) => {
      const k = X.L.mods.indexOf(J.steps[i].module);
      return k < 0 ? { s: 0, u: 0 } : { s: X.st[k].s, u: X.cur[k] };
    };
    const start = (i) => {
      const m = at(i);
      P.kind = "step"; P.i = i;
      if (m.s) { P.status = "wait"; P.until = now + (i === 0 ? 1300 : 1600); }
      else if (m.u >= 0.85) { P.status = "slow"; P.until = now + 1300 + 900 * Math.min(1, (m.u - 0.85) / 0.15); }
      else { P.status = "ok"; P.until = now + 430; }
    };
    if (P.kind === "idle") start(0);
    else if (P.kind === "step") {
      if (P.status === "ok") {
        if (P.i + 1 < J.steps.length) start(P.i + 1);
        else { P.kind = "done"; P.until = now + 2300; P.served += 1; }
      } else if (P.status === "slow") {
        const m = at(P.i);
        if (m.s) { P.status = "wait"; P.until = now + 900; } else { P.status = "ok"; P.until = now + 430; }
      } else if (P.status === "wait") {
        if (P.i === 0) { P.kind = "anr"; P.until = now + 2800; } else { P.status = "fail"; P.until = now + 2400; }
      } else { P.failed += 1; P.attempt += 1; start(0); }
    } else if (P.kind === "anr") { P.failed += 1; P.attempt += 1; start(0); }
    else { P.attempt = 1; start(0); }
    X.phoneDirty = true;
  }

  // ---------------------------------------------------------------- drawing
  function draw(X, now, force = false) {
    const el = X.el;
    el.querySelector("[data-ptime]").textContent = clock(X.min);
    const K = (k, v) => { const d = el.querySelector(`[data-k="${k}"]`); if (d.textContent !== v) d.textContent = v; };
    const rpm = peakRpm * hourly(r.profile, X.min) * wobble(X.min, 99);
    K("rpm", count(rpm));
    K("fail", `${Math.round(X.fail * 100)}%`);
    el.querySelector('[data-k="fail"]').parentElement.classList.toggle("bad", X.fail > 0.005);
    K("lost", count(X.failed));
    K("hours", `${n(X.hours, 1)} h`);
    K("inc", String(X.inc));
    el.querySelector('[data-k="hours"]').parentElement.classList.toggle("bad", X.hours > 0);
    if (bots) {
      const p = hourly(r.profile, X.min);
      const humans = p <= 1 ? p : 1 + (p - 1) * (1 - bots.share);
      const botsNow = p - humans;
      const blocked = X.side === "after" && bots.blocked_in_plan ? botsNow * bots.blocked : 0;
      const [hi, bi, xi] = el.querySelectorAll(".rp-mix i");
      hi.style.width = `${(humans / p) * 100}%`; bi.style.width = `${((botsNow - blocked) / p) * 100}%`; xi.style.width = `${(blocked / p) * 100}%`;
      el.querySelector("[data-mixt]").textContent = botsNow / p < 0.02 ? "Traffic: real customers"
        : blocked ? `Bots are ${Math.round((botsNow / p) * 100)}% of requests right now; ${count(peakRpm * blocked)} a minute blocked at the edge (${bots.mitigated_by.join(", ")} fixed)`
          : `Bots are ${Math.round((botsNow / p) * 100)}% of requests right now, and they all reach the servers`;
    }
    for (const { m, i } of tilesFor()) {
      const t = el.querySelector(`[data-mod="${CSS.escape(m)}"]`);
      if (!t) continue;
      const s = X.st[i].s, u = X.cur[i];
      const cls = s === 1 ? "down" : s === 2 ? "cascade" : u >= 0.85 ? "hot" : "ok";
      const chip = s === 1 ? ({ outage: "OUTAGE", deploy: "BAD RELEASE", fault: "CRASHED" }[X.st[i].kind] || "DOWN") : { ok: "OK", hot: "HOT", cascade: "FAILING" }[cls];
      if (t.dataset.s !== cls + chip) { t.dataset.s = cls + chip; t.className = `rp-tile ${cls}`; t.querySelector(".rp-chip").textContent = chip; }
      t.querySelector(".rp-meter i").style.width = `${Math.min(100, (u / 1.5) * 100)}%`;
      t.querySelector("[data-load]").textContent = `load ${Math.round(u * 100)}%`;
      t.querySelector("[data-why]").textContent = s === 2 && X.st[i].from ? `← ${X.st[i].from}` : "";
    }
    if (X.feedDirty || force) { // new alerts slide in on top; the ones already shown stay put
      X.feedDirty = false;
      const box = el.querySelector("[data-feed]");
      const row = (a, still) => `<div class="rp-alert ${a.cls}${still ? " still" : ""}"><time>${a.t}</time><span>${esc(a.text)}</span></div>`;
      if (force) box.innerHTML = X.feed.map((a) => row(a, true)).join("");
      else box.insertAdjacentHTML("afterbegin", X.feed.filter((a) => a.id > (X.drawnId || 0)).map((a) => row(a, false)).join(""));
      X.drawnId = X.feed.length ? X.feed[0].id : 0;
      while (box.children.length > 60) box.lastElementChild.remove();
    }
    if (X.phoneDirty || force) { X.phoneDirty = false; drawPhone(X); }
    X.el.classList.toggle("alarm", now - (X.flash || -1e9) < 900);
    const endBox = el.querySelector("[data-end]");
    if (ended && endBox.hidden) { endBox.innerHTML = String(endCard(X)); endBox.hidden = false; }
    else if (!ended && !endBox.hidden) endBox.hidden = true;
    X.lastDraw = now;
  }

  function drawPhone(X) {
    const el = X.el, P = X.phone;
    el.querySelectorAll("[data-step]").forEach((li, i) => {
      let c = "todo";
      if (P.kind === "done" || (P.kind === "step" && i < P.i)) c = "done";
      else if (P.kind === "anr" && i === 0) c = "now frozen";
      else if (P.kind === "step" && i === P.i) c = P.status === "ok" ? "done now" : P.status === "fail" ? "now fail" : "now slow";
      if (li.className !== c) li.className = c;
    });
    const s = J.steps[Math.min(P.i, J.steps.length - 1)];
    const msg = el.querySelector("[data-msg]");
    let h = "";
    if (P.kind === "done") h = `<div class="rp-ok"><b>✓</b> ${esc(J.steps[J.steps.length - 1].ok)}</div>`;
    else if (P.kind === "anr") h = `<div class="rp-wait"><span class="rp-spin frozen"></span> ${esc(J.steps[0].slow)}</div>`;
    else if (P.kind === "step" && P.status === "fail") h = `<div class="rp-err"><b>!</b> ${esc(s.fail)}<u>Retry</u></div>`;
    else if (P.kind === "step" && (P.status === "slow" || P.status === "wait")) h = `<div class="rp-wait"><span class="rp-spin${X.severe && fx ? " stutter" : ""}"></span> ${esc(s.slow)}</div>`;
    else if (P.kind === "step") h = `<div class="rp-okline">${esc(s.ok)}</div>`;
    if (msg.innerHTML !== h) msg.innerHTML = h;
    el.querySelector("[data-anr]").hidden = P.kind !== "anr";
    el.querySelector("[data-screen]").classList.toggle("dim", P.kind === "anr");
    el.querySelector("[data-pfoot]").textContent = P.kind === "done" ? `Done on attempt ${P.attempt}` : `Attempt ${P.attempt}${P.served ? ` · ${P.served} completed` : ""}${P.failed ? ` · ${P.failed} failed` : ""}`;
  }

  function endCard(X) {
    const L = X.L, tr = L.tr;
    const other = lanesData[X.side === "before" ? "after" : "before"].tr;
    const peakF = Math.max(...tr.failed_share);
    const ph = tr.failed_share.indexOf(peakF);
    const saved = r.replay.before.total_hours_lost - r.replay.after.total_hours_lost;
    return html`<div class="rp-end-box"><b>Day over${X.side === "after" ? ", after the fixes" : ""}</b>
      <div class="rp-end-n"><span><em>${n(tr.total_hours_lost)} h</em>engineer hours lost</span><span><em>${tr.incidents}</em>${tr.incidents === 1 ? "incident" : "incidents"}</span>
        <span><em>${count(X.failed)}</em>requests failed</span><span><em>${Math.round(peakF * 100)}%</em>failing at worst${peakF ? ` (${pad(ph)}:00)` : ""}</span></div>
      <p>${X.side === "before" ? (saved > 0.05 ? `With the fixes, the same day costs ${n(other.total_hours_lost)} h: ${n(saved)} h saved.` : "The fixes would not change this day.")
        : `Fixed before the event: ${planKeys.join(", ") || "nothing"}. Today this day costs ${n(other.total_hours_lost)} h.`}
        Over all ${r.runs} simulated days the plan saves ${n(r.saved_hours.mean)} h on average.</p>
      <div class="rp-end-go">${mode === "side" ? "" : X.side === "before" ? html`<button data-mode="after" class="rp-big">▶ Same day, after the fixes</button>` : html`<button data-mode="before">▶ Today again</button>`}
        ${mode === "side" ? "" : html`<button data-mode="side">Side by side</button>`}<button data-act="restart">↺ Replay</button>
        ${opts.onReport ? html`<button data-act="report" class="${X.side === "after" || mode === "side" ? "rp-big" : ""}">Read the report →</button>` : ""}</div></div>`;
  }

  function drawStrip(force = false) {
    const svg = root.querySelector("[data-strip] svg");
    if (!svg) return;
    const W = 1000;
    svg.querySelector("[data-cursor]").setAttribute("x1", (minute / 1440 * W).toFixed(1));
    svg.querySelector("[data-cursor]").setAttribute("x2", (minute / 1440 * W).toFixed(1));
    for (const X of lanes) {
      for (let h = 0; h < 24; h++) {
        const f = X.maxFail[h];
        const c = svg.querySelector(`[data-f="${X.side}:${h}"]`);
        if (!c) continue;
        const o = f > 0 ? 0.25 + 0.75 * f : 0;
        if (force || c.dataset.o !== String(o)) { c.dataset.o = String(o); c.style.opacity = String(o); }
      }
    }
    root.querySelector("[data-clock]").textContent = clock(minute);
  }

  function shake(X) {
    X.el.classList.remove("shake");
    void X.el.offsetWidth; // restart the animation
    X.el.classList.add("shake");
  }

  let ac = null;
  function beep(freqs, dur = 0.12, vol = 0.05) {
    if (!sound) return;
    const now = performance.now();
    if (now - lastBeep < 220) return;
    lastBeep = now;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      let t = ac.currentTime;
      for (const f of freqs) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "square"; o.frequency.value = f;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
        t += dur + 0.03;
      }
    } catch { /* no audio on this device */ }
  }

  // ---------------------------------------------------------------- the loop
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (playing && !ended) {
      elapsed = Math.min(totalSec, elapsed + dt * SPEEDS[speedIx]);
      minute = minuteAt(elapsed);
      if (elapsed >= totalSec) { minute = endMin; ended = true; playing = false; syncPlay(); }
    }
    let hung = false;
    for (const X of lanes) {
      if (X.frozen) {
        if (now < X.freezeUntil) {  // a hung device: nothing on it moves, then it all lands at once
          X.phone.until += dt * 1000;
          catchUp(X, minute);
          hung = true;
          continue;
        }
        X.frozen = false;
        X.el.classList.remove("hung");
      }
      catchUp(X, minute);
      if (playing && fx && X.severe && now >= X.nextFreeze) {
        draw(X, now); // the screen hangs on the latest picture, errors and all
        X.frozen = true;
        X.freezeUntil = now + (650 + random() * 1000) / (SPEEDS[speedIx] > 2 ? 1.6 : 1);
        X.nextFreeze = X.freezeUntil + 1100 + random() * 1800;
        X.el.classList.add("hung");
        hung = true;
        continue;
      }
      if (!X.severe) X.nextFreeze = Math.max(X.nextFreeze, now + 500);
      if (playing || !started) phone(X, now);
      const every = X.severe && fx && playing ? 330 + random() * 260 : 90;
      if (now - X.lastDraw >= every || (!playing && now - X.lastDraw > 250)) draw(X, now);
    }
    const t = hung ? `${baseTitle} (Not Responding)` : baseTitle;
    if (document.title !== t) document.title = t;
    if (now - lastStrip > 120) { lastStrip = now; drawStrip(); }
  }

  function syncPlay() {
    const b = root.querySelector('[data-act="play"]');
    b.textContent = playing ? "❚❚" : "▶";
    b.setAttribute("aria-label", playing ? "Pause" : "Play");
    root.classList.toggle("paused", !playing);
  }
  function play(v = !playing) {
    if (ended && v) restart();
    playing = v; started = started || v;
    root.querySelector("[data-intro]").hidden = started;
    if (v && sound && ac && ac.state === "suspended") ac.resume();
    syncPlay();
  }
  function restart() {
    elapsed = 0; minute = startMin; ended = false;
    build();
  }
  function setMode(m) {
    if (!["before", "after", "side"].includes(m)) return;
    const replayEnded = ended;
    mode = m;
    if (replayEnded) { elapsed = 0; minute = startMin; ended = false; playing = true; }
    build();
    syncPlay();
  }
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
  }

  function act(a) {
    if (a === "start") play(true);
    else if (a === "play") play();
    else if (a === "restart") { restart(); started = true; root.querySelector("[data-intro]").hidden = true; playing = true; syncPlay(); }
    else if (a === "speed") { speedIx = (speedIx + 1) % SPEEDS.length; root.querySelector('[data-act="speed"]').textContent = `${SPEEDS[speedIx]}×`; }
    else if (a === "fx") {
      fx = !fx;
      root.querySelector('[data-act="fx"]').setAttribute("aria-pressed", String(fx));
      if (!fx) lanes.forEach((X) => { X.frozen = false; X.el.classList.remove("hung"); });
    } else if (a === "sound") {
      sound = !sound;
      const b = root.querySelector('[data-act="sound"]');
      b.setAttribute("aria-pressed", String(sound)); b.textContent = sound ? "Sound on" : "Sound off";
      if (sound) beep([660], 0.06, 0.03);
    } else if (a === "full") toggleFull();
    else if (a === "report") { const f = opts.onReport; close(); if (f) f(); }
    else if (a === "close") close();
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act],[data-mode]");
    if (!b || !root.contains(b)) return;
    if (b.dataset.mode) { setMode(b.dataset.mode); if (b.hasAttribute("data-start")) play(true); } else act(b.dataset.act);
  });
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    const map = { " ": "play", r: "restart", s: "speed", e: "fx", m: "sound", f: "full", escape: "close" };
    if (k in map) { e.preventDefault(); act(started || k !== " " ? map[k] : "start"); }
    else if (k === "1" || k === "2" || k === "3") { e.preventDefault(); setMode({ 1: "before", 2: "after", 3: "side" }[k]); }
  };
  const onHash = () => close();

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("hashchange", onHash);
    if (document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
    document.title = baseTitle;
    document.body.style.overflow = prevOverflow;
    if (ac) ac.close().catch(() => {});
    root.remove();
    if (opts.opener && opts.opener.focus) opts.opener.focus();
    if (opts.onClose) opts.onClose();
  }

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.body.appendChild(root);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("hashchange", onHash);
  build();
  syncPlay();
  root.focus();
  raf = requestAnimationFrame(frame);
  return close;
}
