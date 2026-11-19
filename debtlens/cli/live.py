"""``debtlens simulate spike --live``: the website's Live replay, drawn in the terminal.

It plays back the same simulated day as the website (the spike result's ``replay`` trace): the customer's journey
on the left of each lane, the modules and alerts the on-call engineer sees, minute by minute. Busy hours play slowly
and quiet hours fast. When most requests fail, the lane "hangs" for a moment — it stops updating and says
(Not Responding) — but nothing is really blocked: Ctrl+C always stops the replay.
"""
from __future__ import annotations

import math
import random
import time

from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from ..core import spike as SPIKE

HOUR_BUSY, HOUR_QUIET, MAX_SECONDS = 6.0, 0.6, 80.0
BARS = " ▁▂▃▄▅▆▇█"


def count(v: float) -> str:
    """Indian-style counts: 4,500 · 3.2 lakh · 1.4 crore."""
    v = max(0.0, float(v or 0))
    if v >= 1e7:
        return f"{v / 1e7:.{0 if v >= 1e8 else 1}f} crore"
    if v >= 1e5:
        return f"{v / 1e5:.{0 if v >= 1e6 else 1}f} lakh"
    return f"{round(v):,}"


def clock(minute: float) -> str:
    m = min(int(minute), 1439)  # the end of the day reads 23:59, not 00:00
    return f"{(m // 60) % 24:02d}:{m % 60:02d}"


def hourly(values: list[float], minute: float, ramp: float = 12.0) -> float:
    """A value given once per hour, eased in over the first minutes of each hour (as on the website)."""
    h = max(0, min(SPIKE.HOURS - 1, int(minute // 60)))
    a = values[h - 1] if h else values[0]
    f = max(0.0, min(1.0, (minute - h * 60) / ramp))
    return a + (values[h] - a) * f * f * (3 - 2 * f)


def timeline(r: dict) -> tuple[int, int, list[bool], float]:
    """Window of the day to play (from two hours before anything happens) and how long a busy hour lasts."""
    rp = r["replay"]
    util = [m.get("utilisation_before", [0] * 24) for m in r["modules"]] + [m.get("utilisation_after", [0] * 24) for m in r["modules"]]
    busy = []
    for h in range(SPIKE.HOURS):
        down = any(any(rp[s]["states"][h]) or (h and any(rp[s]["states"][h - 1])) for s in ("before", "after"))
        busy.append(r["profile"][h] >= 1.5 or down or any(u[h] >= 0.85 for u in util))
    if True not in busy:
        return 0, 1440, busy, HOUR_BUSY
    first = busy.index(True)
    last = SPIKE.HOURS - 1 - busy[::-1].index(True)
    start, end = max(0, first - 2) * 60, min(24, last + 3) * 60
    n_busy = sum(busy[start // 60:end // 60])
    n_quiet = (end - start) // 60 - n_busy
    busy_sec = max(1.5, min(HOUR_BUSY, (MAX_SECONDS - n_quiet * HOUR_QUIET) / max(1, n_busy)))
    return start, end, busy, busy_sec


class Lane:
    """One side of the replay: today (open debt) or after the fixes."""

    def __init__(self, r: dict, side: str, journey: dict):
        self.r, self.side, self.journey = r, side, journey
        self.tr = r["replay"][side]
        self.mods = r["replay"]["modules"]
        by_mod = {m["module"]: m for m in r["modules"]}
        key = "utilisation_after" if side == "after" else "utilisation_before"
        self.util = [by_mod[m][key] if m in by_mod else [0.0] * 24 for m in self.mods]
        entry = r["event"].get("entry") or {}
        self.share = [float(entry.get(m, 0.0)) for m in self.mods]
        self.total = sum(self.share) or 1.0
        self.profile = r["replay"].get("profile_after") if side == "after" else r["profile"]
        self.minute = 0.0
        self.hours = self.failed = 0.0
        self.incidents = 0
        self.ev = 0
        self.alerts: list[tuple[str, str, str]] = []
        self.states = [0] * len(self.mods)
        self.cause: list = [None] * len(self.mods)
        self.load = [0.0] * len(self.mods)
        self.failing = 0.0
        self.frozen_until = 0.0
        self.next_freeze = 0.0
        self.shown: Panel | None = None
        self.phone = {"kind": "idle", "i": 0, "status": "", "until": 0.0, "attempt": 1, "served": 0, "failed": 0}

    def start(self, minute: float) -> None:
        self.minute = minute
        self.states = SPIKE.state_at(self.tr, self.mods, int(minute))

    def advance(self, minute: float) -> None:
        peak_rpm = float(self.journey.get("peak_rpm") or 10000)
        for m in range(int(self.minute), int(minute)):
            st = SPIKE.state_at(self.tr, self.mods, m)
            f = min(1.0, sum(s for s, x in zip(self.share, st) if x) / self.total)
            self.failed += peak_rpm * hourly(self.profile, m) * f
        self.minute = minute
        evs = self.tr["events"]
        while self.ev < len(evs) and evs[self.ev]["minute"] <= minute:
            e = evs[self.ev]
            self.ev += 1
            if e["kind"] != "recovered":
                self.incidents += 1
                self.hours += float(e.get("cost_hours") or 0)
            self.alerts.append(alert(e))
        self.states = SPIKE.state_at(self.tr, self.mods, int(minute))
        h = max(0, min(23, int(minute // 60)))
        prev_h = max(0, h - 1)
        self.cause = [self.tr["cause"][h][i] if s == 2 and self.tr["states"][h][i] == 2 else
                      (self.tr["cause"][prev_h][i] if s == 2 else None) for i, s in enumerate(self.states)]
        self.load = [hourly(u, minute) * (1 + 0.03 * math.sin(minute * 0.83 + i * 1.7)) for i, u in enumerate(self.util)]
        self.failing = min(1.0, sum(s for s, x in zip(self.share, self.states) if x) / self.total)

    def entry_down(self) -> bool:
        first = self.journey["steps"][0]["module"]
        return first in self.mods and bool(self.states[self.mods.index(first)])

    def severe(self) -> bool:
        return self.failing >= 0.5 or self.entry_down()

    def step_phone(self, now: float) -> None:
        """The customer's journey runs in real time against the current state of each module."""
        P, steps = self.phone, self.journey["steps"]
        if P["kind"] != "idle" and now < P["until"]:
            return

        def at(i: int) -> tuple[int, float]:
            m = steps[i]["module"]
            if m not in self.mods:
                return 0, 0.0
            k = self.mods.index(m)
            return self.states[k], self.load[k]

        def begin(i: int) -> None:
            s, u = at(i)
            P.update(kind="step", i=i)
            if s:
                P.update(status="wait", until=now + (1.3 if i == 0 else 1.6))
            elif u >= 0.85:
                P.update(status="slow", until=now + 1.3 + 0.9 * min(1.0, (u - 0.85) / 0.15))
            else:
                P.update(status="ok", until=now + 0.43)

        if P["kind"] == "idle":
            begin(0)
        elif P["kind"] == "step":
            if P["status"] == "ok":
                if P["i"] + 1 < len(steps):
                    begin(P["i"] + 1)
                else:
                    P.update(kind="done", until=now + 2.3, served=P["served"] + 1)
            elif P["status"] == "slow":
                s, _ = at(P["i"])
                P.update(status="wait", until=now + 0.9) if s else P.update(status="ok", until=now + 0.43)
            elif P["status"] == "wait":
                if P["i"] == 0:
                    P.update(kind="anr", until=now + 2.8)
                else:
                    P.update(status="fail", until=now + 2.4)
            else:
                P.update(failed=P["failed"] + 1, attempt=P["attempt"] + 1)
                begin(0)
        elif P["kind"] == "anr":
            P.update(failed=P["failed"] + 1, attempt=P["attempt"] + 1)
            begin(0)
        else:
            P["attempt"] = 1
            begin(0)


def alert(e: dict) -> tuple[str, str, str]:
    sev = (e.get("severity") or "MEDIUM").upper()
    style = {"CRITICAL": "bold red", "HIGH": "red", "MEDIUM": "yellow"}.get(sev, "white")
    page = " Paging on-call." if sev == "CRITICAL" else ""
    cost = f" About {e.get('cost_hours', 0):g} engineer-hours to handle."
    if e["kind"] == "overload":
        u = round(e["utilisation"] * 100)
        text = (f"{e['module']} overloaded: {u}% of its capacity." if u >= 100
                else f"{e['module']} went down at {u}% load, too close to its limit.") + page + cost
    elif e["kind"] == "cascade":
        text = f"{e['module']} failing: it depends on {e['from']}, which is down.{page}{cost}"
    else:
        text, style = f"{e['module']} recovered.", "green"
    return clock(e["minute"]), text, style


def sparkline(profile: list[float], minute: float, window: tuple[int, int]) -> Text:
    top = max(profile) or 1.0
    t = Text()
    for h, p in enumerate(profile):
        ch = BARS[max(1, min(8, round(math.sqrt(p / top) * 8)))]
        style = "bold yellow" if h == int(minute // 60) else ("blue" if window[0] <= h * 60 < window[1] else "grey35")
        t.append(ch * 2, style=style)
    return t


def render_lane(L: Lane, r: dict, frozen: bool, compact: bool) -> Panel:
    j, P = L.journey, L.phone
    head = Text()
    if L.side == "before":
        head.append("Today, with the open debt", style="bold red")
    else:
        head.append("After the fixes", style="bold green")
    if frozen:
        head.append("  (Not Responding)", style="bold bright_white on red")
    k = Table.grid(padding=(0, 2))
    p = hourly(r["profile"], L.minute)
    k.add_row(Text(f"{count(float(j.get('peak_rpm') or 10000) * p)}/min", style="bold"),
              Text(f"failing {round(L.failing * 100)}%", style="bold red" if L.failing > 0.005 else "bold green"),
              Text(f"failed {count(L.failed)}"), Text(f"lost {L.hours:.1f} h", style="red" if L.hours else ""),
              Text(f"incidents {L.incidents}"))
    parts: list = [head, k]
    bots = r.get("bots")
    if bots and p > 1.02:
        humans = 1 + (p - 1) * (1 - bots["share"])
        b = p - humans
        blocked = b * bots["blocked"] if L.side == "after" and bots.get("blocked_in_plan") else 0.0
        msg = (f"bots {round(b / p * 100)}% of requests · {count(float(j.get('peak_rpm') or 10000) * blocked)}/min blocked at the edge "
               f"({', '.join(bots['mitigated_by'])} fixed)" if blocked else
               f"bots {round(b / p * 100)}% of requests · nothing stops them")
        parts.append(Text(msg, style="dark_orange"))
    t = Table(box=None, pad_edge=False, show_header=False, padding=(0, 1))
    t.add_column(width=13 if compact else 16, no_wrap=True)
    t.add_column(width=12 if compact else 18, no_wrap=True)
    t.add_column(width=5, justify="right")
    t.add_column(no_wrap=True)
    order = sorted(range(len(L.mods)), key=lambda i: (-(L.states[i] > 0), -L.load[i]))[: 7 if compact else 10]
    for i in order:
        s, u = L.states[i], L.load[i]
        state = (Text("DOWN", style="bold white on red") if s == 1 else
                 Text(f"FAILING ← {L.cause[i] or '?'}", style="bold black on dark_orange") if s == 2 else
                 Text("HOT", style="bold black on yellow") if u >= 0.85 else Text("OK", style="green"))
        width = 10 if compact else 16
        fill = max(0, min(width, round(u / 1.5 * width)))
        color = "red" if s else "yellow" if u >= 0.85 else "green"
        t.add_row(Text(L.mods[i], style="bold"), Text("█" * fill + "·" * (width - fill), style=color), f"{round(u * 100)}%", state)
    parts.append(t)
    steps = j["steps"]
    ph = Text("📱 ", style="bold")
    who = (j.get("who") or "The customer").split(", ")[0]
    ph.append(f"{who} on {j.get('app') or 'the app'}: ", style="bold")
    for i in range(len(steps)):
        if P["kind"] == "done" or (P["kind"] == "step" and (i < P["i"] or (i == P["i"] and P["status"] == "ok"))):
            ph.append("✓", style="green")
        elif P["kind"] == "anr" and i == 0 or (P["kind"] == "step" and i == P["i"] and P["status"] == "fail"):
            ph.append("✗", style="bold red")
        elif P["kind"] == "step" and i == P["i"]:
            ph.append("⟳", style="yellow")
        else:
            ph.append("○", style="grey50")
    cur = steps[min(P["i"], len(steps) - 1)]
    if P["kind"] == "done":
        ph.append(f"  {steps[-1]['ok']}", style="bold green")
    elif P["kind"] == "anr":
        ph.append(f"  {j.get('app') or 'The app'} isn't responding · Close app / Wait", style="bold white on grey30")
    elif P["status"] == "fail":
        ph.append(f"  {cur['fail']}", style="bold red")
    elif P["status"] in ("slow", "wait"):
        ph.append(f"  {cur['label']}: {cur['slow']}", style="yellow")
    else:
        ph.append(f"  {cur['label']}: {cur['ok']}", style="green")
    ph.append(f"   attempt {P['attempt']}", style="grey50")
    if compact:
        ph.no_wrap, ph.overflow = True, "ellipsis"
    parts.append(ph)
    for tm, text, style in L.alerts[-1: -(4 if compact else 6): -1]:
        parts.append(Text.assemble((f"{tm} ", "grey62"), (text, style), overflow="ellipsis", no_wrap=True))
    return Panel(Group(*parts), border_style=("red" if L.side == "before" else "green") if not frozen else "grey50",
                 style="grey62" if frozen else "")


def run(r: dict, console: Console, mode: str = "before", speed: float = 2.0, effects: bool = True) -> dict:
    """Play the replay. ``mode``: before, after or side. Returns each lane's totals."""
    if not r.get("replay"):
        raise ValueError("this spike result has no replay")
    journey = r.get("journey") or {
        "app": "the app", "who": "A customer", "peak_rpm": 10000,
        "steps": [{"module": m, "label": f"Use {m}", "ok": "done", "slow": "waiting…", "fail": f"{m} is not responding"}
                  for m in sorted(r["event"].get("entry") or {}, key=lambda m: -r["event"]["entry"][m])[:4] or r["replay"]["modules"][:4]]}
    start, end, busy, busy_sec = timeline(r)
    sides = ["before", "after"] if mode == "side" else [mode]
    lanes = [Lane(r, s, journey) for s in sides]
    for L in lanes:
        L.start(start)
    rng = random.Random(r["replay"]["run"] + 7)
    compact = mode == "side"
    ev = r["event"]
    peak_h = r["profile"].index(max(r["profile"]))

    def frame(minute: float, now: float) -> Group:
        top = Text.assemble(("● LIVE REPLAY  ", "bold red"), (ev["name"], "bold"), (f" · {journey.get('app')}", ""),
                            (f"   {clock(minute)}", "bold bright_white"),
                            (f"   simulated day {r['replay']['run'] + 1} of {r['runs']} · peak {max(r['profile']):g}× at {peak_h:02d}:00", "grey62"))
        strip = Text.assemble(("traffic ", "grey62"), sparkline(r["profile"], minute, (start, end)), ("  00:00 → 23:00", "grey50"))
        panels = []
        for L in lanes:
            frozen = now < L.frozen_until
            if frozen and L.shown is not None:
                panels.append(L.shown)  # a hung device: the last picture stays on screen
                continue
            L.shown = render_lane(L, r, frozen, compact)
            panels.append(L.shown)
        body = Table.grid(expand=True, padding=(0, 1))
        for _ in panels:
            body.add_column(ratio=1)
        body.add_row(*panels)
        foot = Text("Ctrl+C stops · hourly model, minutes illustrative · nothing is really frozen", style="grey42")
        return Group(top, strip, body, foot)

    elapsed, minute, last = 0.0, float(start), time.monotonic()
    with Live(frame(minute, last), console=console, refresh_per_second=12, transient=False) as live:
        try:
            while True:
                now = time.monotonic()
                dt, last = min(0.25, now - last), now
                elapsed += dt * speed
                # map real seconds onto simulated minutes: busy hours slowly, quiet hours fast
                minute = float(start)
                left = elapsed
                while minute < end:
                    per_min = (busy_sec if busy[int(minute // 60)] else HOUR_QUIET) / 60
                    step = 60 - minute % 60
                    if left >= per_min * step:
                        left -= per_min * step
                        minute += step
                    else:
                        minute += left / per_min
                        break
                minute = min(minute, float(end))
                for L in lanes:
                    L.advance(minute)
                    if now >= L.frozen_until:
                        if effects and L.severe() and now >= L.next_freeze:
                            L.frozen_until = now + 0.7 + rng.random() * 0.9
                            L.next_freeze = L.frozen_until + 1.1 + rng.random() * 1.8
                        elif not L.severe():
                            L.next_freeze = max(L.next_freeze, now + 0.5)
                        L.step_phone(now)
                    else:
                        L.phone["until"] += dt
                if minute >= end:
                    for L in lanes:  # the day is over: show the exact totals of the simulated day
                        L.hours, L.incidents = L.tr["total_hours_lost"], L.tr["incidents"]
                        L.frozen_until = 0.0
                    live.update(frame(minute, now + 1e6))
                    break
                live.update(frame(minute, now))
                time.sleep(0.05)
        except KeyboardInterrupt:
            pass
    return {L.side: {"hours_lost": L.hours, "incidents": L.incidents, "failed_requests": L.failed, "until": clock(minute),
                     "finished": minute >= end} for L in lanes}
