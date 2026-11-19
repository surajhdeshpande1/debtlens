# Scenario packs

A scenario pack is a whole system in one JSON file: its modules and how they call each other, file metrics and
TODO/FIXME markers, incidents with 5 Whys chains and resolutions, debt items with prerequisites, the people who
own them, a guided-tour story and **the system's busiest day** (a load-spike event). Nothing in a pack is a
result. DebtLens computes every page and simulation from it, exactly as it does for a real project.

DebtLens ships seven packs, and any pack file can be opened on the website or passed to the terminal.

## The seven packs

Numbers are what DebtLens computes with the default settings (40 hours to prepare, 300 simulated days,
seed 17). The website shows the same numbers.

| Code | System | Busiest day | Hours lost on the day: now → after the spike plan | Spike plan saves vs the regular sprint plan |
|---|---|---|---|---|
| `tatkal` | RailYatra, train ticketing | Tatkal opening at 10 AM, 25× | 131.7 → 46.1 h (30.4% → 7.5% of requests failing) | 85.7 h vs 34.6 h |
| `broker` | NiveshTrade, stock broking | Union Budget day, 12× at 11:00 | 141.1 → 59.7 h (18.3% → 8.5%) | 81.4 h vs 45.3 h |
| `food` | ZaikaNow, food delivery | IPL final night, 9× at 21:00 | 152.8 → 61.5 h (20.1% → 11.3%) | 91.3 h vs 60.5 h |
| `stream` | KhelStream, cricket streaming | World Cup final, 20× in the last overs | 149.5 → 51.5 h (23.7% → 9.6%) | 98.0 h vs 50.2 h |
| `rides` | SawariGo, ride-hailing | New Year's Eve, 8× at 23:00 | 113.1 → 28.4 h (14.1% → 3.5%) | 84.7 h vs 53.9 h |
| `taxfiling` | TaxSetu, income-tax e-filing | ITR deadline night, 15× from 22:00 | 151.8 → 38.0 h (25.3% → 5.9%) | 113.8 h vs 71.1 h |
| `tickets` | ShowPass, event ticketing | Stadium tour on-sale, 30× at noon | 146.8 → 42.0 h (36.8% → 11.9%) | 104.7 h vs 67.4 h |

In every pack the spike plan beats the regular sprint plan. The regular plan ranks debt by the interest it
charged in the past, while the spike plan ranks it by what it protects on the day. The right debt to fix depends
on what is coming.

Each pack has 10 modules, 20 incidents (with 6 or 7 families of repeated incidents and the regressions they
imply), 13 or 14 debt items and 7 people (one for each role).

## Opening a pack

**On the website** (home page → *Scenario packs*):

* **Open** on a card opens a private 24-hour sandbox in the role you pick. **Guided tour** walks through it.
  Inside a sandbox, the drop-down in the top bar jumps straight to any other scenario or pack.
* **⬇ .json** downloads the pack file.
* **Open a pack file** takes any pack (.json, up to 400 KB). It is checked completely before anything is stored.
  If something is wrong, every problem is listed at once, so the file can be fixed in one pass. **Reset** in the
  top bar puts an uploaded pack back to the file you uploaded.

**In the terminal**, every command that takes `--scenario` (`-s`) accepts a pack code or a pack file:

```bash
debtlens pack list                        # the seven packs and their busiest day
debtlens pack show broker                 # what a pack contains
debtlens demo tatkal                      # dashboard
debtlens simulate spike -s tatkal         # the busiest day, hour by hour
debtlens simulate cascade db -s taxfiling # fail a module and watch it spread
debtlens plan -s rides --budget 40        # what to fix this sprint
debtlens pack export tickets -o my.json   # copy a pack to edit
debtlens pack validate my.json            # every problem at once
debtlens simulate spike -s my.json --budget 60
```

## A live demo with a pack (about 5 minutes)

1. Open **RailYatra** as Tech Lead and press **Guided tour**. The home screen tells the story: Tatkal at
   10:00 double-books berths, and passengers are charged without tickets.
2. **Incidents → INC-519**. It is flagged as a regression of INC-503. Its 5 Whys meet the same root cause as
   two earlier incidents.
3. **Causal analysis**. The berth-locking cause, the shared OTP queue and the missing reconciliation each
   reach three incidents.
4. **Simulation Lab → Load spike → Simulate the day**. At 10:00 search, the gateway, SMS and PNR overload, and
   131.7 engineer hours and 30% of requests are lost. The plan is a waiting room, an availability cache, an OTP
   queue and a PNR index (37 h). It cuts the loss to 46.1 h and saves 85.7 h, against 34.6 h for the regular
   sprint plan.
5. Change **Hours to fix before it** to 80, or pick **Custom spike** (say 40× at 09:00) and simulate again.
   Judges can choose the numbers.
6. **Failure injection → db**. The central database takes down about 1.4 dependent modules on average and 7 in
   the worst case.
7. In the terminal, run `debtlens simulate spike -s tatkal`. It gives the same numbers.

To show that DebtLens is not tied to the bundled data, download a pack, change it in front of the judges (rename
the system, raise the spike peak, add an incident) and upload it with **Open a pack file**.

## Format

```jsonc
{
  "format": "debtlens-pack/1",            // optional, recommended
  "code": "my-system",                    // 2-24 of a-z 0-9 -; made from the name if missing
  "name": "My System",                    // required
  "key": "MYS",                           // project key, up to 8 letters/digits
  "industry": "Logistics", "tagline": "…", "summary": "…", "order": 1,
  "people": {"asha": {"name": "Asha Rao", "role": "tech_lead", "title": "Engineering lead"}},
  "modules": [{"name": "orders", "path": "svc/orders", "description": "…",
               "churn": 40, "complexity": 150, "loc": 4000, "files": 9, "owner": "asha"}],
  "dependencies": [["orders", "db"]],                     // [caller, callee]
  "files": [["svc/orders/place.py", "orders", 30, 25, 700, 1200, 3]],
               // path, module, churn, complexity, loc, lines changed, authors
  "satd": [["svc/orders/place.py", 41, "TODO", "dedupe by order id"]],
               // path, line, marker, text (module comes from files, or give it as a 5th item)
  "incidents": [{"key": "INC-1", "title": "…", "desc": "…", "module": "orders",
                 "sev": "HIGH", "status": "RESOLVED", "ago": 30, "fixed": 29, "effort": 6, "by": "asha",
                 "group": "G-DUP",                                  // same group = the same problem again
                 "whys": ["symptom", "mechanism", "root cause"],    // 1-7 answers
                 "fix": "what was done", "lesson": "what was learned"}],
  "debts": [{"key": "DEBT-1", "title": "…", "desc": "…", "module": "orders", "cat": "ARCHITECTURAL",
             "principal": 12, "status": "IDENTIFIED", "priority": "HIGH", "owner": "asha",
             "incidents": ["INC-1"], "needs": [], "cause": "root cause", "ago": 28,
             "file": "svc/orders/place.py", "playbook": "idempotency"}],   // playbook is optional
  "spike": {"key": "sale", "name": "Flash sale", "description": "…",
            "profile": [24 hourly multipliers of a normal peak hour],       // or: "peak", "start_hour", "duration"
            "entry": {"orders": 1.0},       // modules users enter through, 0-1
            "baseline": {"orders": 0.08},   // utilisation at a normal peak hour (default 0.15)
            "exposure": {"reports": 0.0}},  // optional: pin how much of the spike reaches a module
  "tour": {"incident": "INC-1", "debt": "DEBT-1", "module": "orders", "budget": 40,
           "cascade_module": "db", "headline": "One sentence that tells the story."}
}
```

Times are **days ago** (`ago`, `fixed`), so a pack always looks current. Allowed values:

* `sev`: CRITICAL, HIGH, MEDIUM or LOW.
* Incident `status`: OPEN, INVESTIGATING or RESOLVED. A RESOLVED incident needs `fixed`, and `fixed` cannot be
  more days ago than `ago`.
* `cat`: ARCHITECTURAL, CODE_SMELL, TEST_DEBT, INFRASTRUCTURE, SECURITY_DEBT or DOCUMENTATION.
* Debt `status`: IDENTIFIED, PRIORITIZED, IN_PROGRESS, DEFERRED or REMEDIATED.
* `role`: admin, tech_lead, developer, qa, manager or viewer.

Every module named in an incident, debt, file, dependency or spike table must be listed in `modules`. Every key
in `incidents`, `needs` and `tour` must exist. `playbook` must be one of the 24 playbook keys
(`debtlens playbooks`).

**Limits:** 400 KB, 40 modules, 300 dependencies, 300 files, 300 markers, 300 incidents, 150 debt items,
20 people and 7 whys per incident.

## Writing a pack that tells a good story

* **Repeated incidents converge.** Give incidents of the same family the same `group`, and end their 5 Whys with
  exactly the same root-cause sentence. Use that sentence as the `cause` of the debt that fixes it. Reuse one
  root cause across modules to create a systemic cause.
* **Regressions appear by themselves.** A family member reported in the same module after an earlier member was
  resolved is a regression. DebtLens should flag it, and the Intelligence page measures whether it did.
* **Playbooks are matched from the words.** "connection pool", "durable queue", "precomputed cache", "index",
  "row-level lock", "timeout", "circuit breaker", "rate limit", "reconcile", "idempotency key" and so on pick
  the playbook. That playbook decides how much capacity or resilience a fix adds on the busiest day. Run
  `debtlens playbooks -s my.json` to check what was matched.
* **Tune the busiest day.** For a module with debt that limits capacity, a good `baseline` is about
  0.82 ÷ (1 + (peak − 1) × exposure). Then the module overloads now but holds after its fix.
