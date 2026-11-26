# Scenario packs

A scenario pack is a whole system in one JSON file: its modules and how they call each other, file metrics and
TODO/FIXME markers, incidents with 5 Whys chains and resolutions, debt items with prerequisites, the people who
own them, a guided-tour story, **the system's busiest day** and **its other situations** (bots, an outage, a bad
release, a starved database and so on, each with what goes wrong). Nothing in a pack is a result. DebtLens
computes every page, simulation and report from it, exactly as it does for a real project.

**Pack files are opened on the website only.** The terminal runs the built-in systems by code
(`-s tatkal`) and refuses a pack file with a pointer to the website.

## The eleven built-in packs

Numbers are what DebtLens computes with the defaults (40 hours to fix before the day, 300 simulated days,
seed 17): the average day today → after the fixes. The website and the terminal show the same numbers.

| Code | System | Busiest day | Engineer-hours lost: today → after (requests failing) | Plan for the day saves vs the regular sprint plan |
|---|---|---|---|---|
| `tatkal` | RailYatra, railways & ticketing | Tatkal opening at 10 AM, 25× at 10:00 | 124.5 → 61.8 h (28.4% → 10.4%) | 62.7 h vs 24.3 h |
| `broker` | NiveshTrade, stock broking | Union Budget day, 12× at 11:00 | 128.6 → 66 h (18.7% → 10.5%) | 62.6 h vs 34.9 h |
| `food` | ZaikaNow, food delivery | IPL final night, 9× at 21:00 | 145.6 → 85.4 h (20.6% → 14.1%) | 60.2 h vs 41.9 h |
| `stream` | KhelStream, sports streaming (OTT) | World Cup final, 20× at 21:00 | 156 → 77.8 h (25.7% → 11.7%) | 78.3 h vs 50.9 h |
| `rides` | SawariGo, ride-hailing | New Year's Eve, 8× at 23:00 | 102.7 → 45.5 h (14.9% → 5.7%) | 57.2 h vs 39.1 h |
| `taxfiling` | TaxSetu, government e-services | ITR deadline night (31 July), 15× at 22:00 | 140.2 → 53.5 h (24.3% → 9%) | 86.7 h vs 51.8 h |
| `tickets` | ShowPass, event ticketing | Stadium tour on-sale at noon, 30× at 12:00 | 129 → 53.8 h (30.7% → 12.6%) | 75.3 h vs 51.3 h |
| `exam` | ParikshaNet, online examinations | Entrance exam day, 30× at 09:00 | 305.9 → 137 h (25.4% → 12.4%) | 168.9 h vs 137.2 h |
| `airline` | UdanAir, airline booking & check-in | Fare sale at noon, 20× at 12:00 | 130.8 → 50.9 h (26% → 9.4%) | 79.9 h vs 42.3 h |
| `appointments` | SlotSetu, government appointments | New slots open at 17:00, 25× at 17:00 | 108.6 → 35.2 h (29.7% → 8%) | 73.4 h vs 42 h |
| `grocery` | TurantMart, quick commerce | Diwali evening, 10× at 19:00 | 131.7 → 63.1 h (22.7% → 7.2%) | 68.6 h vs 40.7 h |

In every pack the plan for the day beats the regular sprint plan on that day. The regular plan ranks debt by
the interest it charged in the past; the plan for the day ranks it by what it protects on that day. The right
debt to fix depends on what is coming.

### Bot attacks

Every pack has a bot attack among its situations. Bots add traffic like real users do, but one debt item (a
missing rate limit or bot check) decides how many reach the servers. Once it is fixed, most bots are turned away
at the edge. A fifth of the blocked ones adapt and get through anyway, and turning bots away still costs the front
door a little, so a bot day is never perfectly clean.

| Code | Bot attack | Bots in the extra traffic · blocked once fixed | Engineer-hours lost: today → after (requests failing) | Fix that blocks them |
|---|---|---|---|---|
| `tatkal` | Tatkal booking bots, 60× at 10:00 | 75% · 90% | 183.9 → 106 h (71% → 25.2%) | DEBT-508 (8 h) |
| `broker` | Credential-stuffing attack, 32× at 09:00 | 97% · 95% | 107.7 → 7.1 h (92.4% → 6.1%) | DEBT-607 (5 h) |
| `food` | Coupon-abuse bots, 20× at 21:00 | 85% · 90% | 112.9 → 28.3 h (68.9% → 9.1%) | DEBT-715 (8 h) |
| `stream` | Restreaming bots, 32× at 21:00 | 50% · 90% | 241.7 → 65.4 h (53.7% → 10.4%) | DEBT-814 (10 h) |
| `rides` | Fare-scraping bots, 16× at 23:00 | 60% · 90% | 109 → 27 h (40.8% → 7.3%) | DEBT-914 (6 h) |
| `taxfiling` | Credential stuffing on PAN login, 25× at 22:00 | 70% · 90% | 119.7 → 8.7 h (51.4% → 2%) | DEBT-1014 (6 h) |
| `tickets` | Scalper bots at the drop, 50× at 12:00 | 60% · 90% | 163.7 → 55.6 h (49.7% → 11.4%) | DEBT-1106 (10 h) |
| `exam` | Result-scraping bots, 25× at 18:00 | 80% · 90% | 36.6 → 8.2 h (62.1% → 7.6%) | DEBT-1209 (5 h) |
| `airline` | Seat-spinning bots, 20× at 12:00 | 70% · 90% | 127.5 → 3.7 h (37.1% → 0.1%) | DEBT-1306 (6 h) |
| `appointments` | Agents' slot-grabbing scripts, 25× at 17:00 | 75% · 90% | 108 → 7.8 h (32.3% → 0.3%) | DEBT-1402 (8 h) |
| `grocery` | Scripts at a limited drop, 15× at 18:00 | 80% · 90% | 150 → 6.1 h (45.5% → 0.6%) | DEBT-1505 (6 h) |

Each pack's other situations (an outage, a bad release, a database or cache problem, a memory leak, a lost zone or
a retry storm) are listed in the user guide, section 5, and the demo script for each system, with its numbers and
alerts, is in [PACK_MANUAL.md](PACK_MANUAL.md).

## Opening a pack on the website

* **Open** on a system's card on the start page opens a private 24-hour sandbox on **Pick a situation**, as the
  system's Tech Lead. **Take the 3-minute tour** walks through the first system.
* **pack file** on a pack's card downloads it as `<code>.debtlens-pack.json`.
* **Upload a scenario pack**, the last card under *1 · Pick a system* (also in **Simulate → Run a scenario →
  1 Pick a system** inside a sandbox), takes any pack file up to 400 KB. It is checked completely before anything is
  stored. If something is wrong, every problem is listed at once (the first 12, then "…and N more"), so the file
  can be fixed in one pass. **Open pack** opens a valid pack as a sandbox, and **⚙ → Reset this sandbox** puts it
  back to the file you uploaded. An uploaded pack is never stored as a team project.

In the terminal, the built-in packs run by code:

```bash
debtlens pack list                                   # the eleven packs and their busiest day
debtlens pack show grocery                           # what a pack contains, with its situations
debtlens simulate spike -s grocery --list            # its situations and their keys
debtlens simulate spike -s grocery -e upi-outage --report      # run one, print the report
debtlens simulate spike -s tatkal -e tatkal-bots --live --side # watch it, then the report
```

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
                 "whys": ["symptom", "mechanism", "root cause"],    // up to 7 answers
                 "fix": "what was done", "lesson": "what was learned"}],
  "debts": [{"key": "DEBT-1", "title": "…", "desc": "…", "module": "orders", "cat": "ARCHITECTURAL",
             "principal": 12, "status": "IDENTIFIED", "priority": "HIGH", "owner": "asha",
             "incidents": ["INC-1"], "needs": [], "cause": "root cause", "ago": 28,
             "file": "svc/orders/place.py", "playbook": "idempotency"}],   // playbook is optional
  "spike": {"key": "sale", "name": "Flash sale", "kind": "traffic", "description": "…",
            "profile": [24 hourly multipliers of a normal peak hour],      // or: "peak", "start_hour", "duration"
            "entry": {"orders": 1.0},       // modules users enter through, 0-1
            "baseline": {"orders": 0.08},   // utilisation at a normal peak hour (default 0.15)
            "exposure": {"reports": 0.0}},  // optional: pin how much of the extra traffic reaches a module
  "events": [                             // up to 7 more situations, shaped like "spike"
    {"key": "sale-bots", "name": "Sale bots", "kind": "bots", "description": "…",
     "peak": 30, "start_hour": 12, "duration": 1, "entry": {"orders": 1.0},
     "bots": {"share": 0.6,               // share of the extra traffic that is bots, 0-1
              "blocked": 0.9,             // share of the bots stopped once a mitigating debt is fixed
              "mitigated_by": ["DEBT-1"]}},
    {"key": "provider-down", "name": "Payment provider down", "kind": "outage", "description": "…",
     "peak": 3, "start_hour": 18, "duration": 3,
     "effects": [                         // up to 4 things that go wrong that day
       {"type": "down", "module": "orders", "start": 19, "minute": 10, "hours": 2,
        "chance": 1.0, "kind": "outage",  // "down": the module stops (kind outage or deploy) with this chance
        "label": "The payment provider stops answering",
        "mitigated_by": ["DEBT-1"], "mitigation": 0.8,   // how much a fixed guard helps (0.8 by default)
        "prevented": "The circuit breaker switched to the second provider",
        "recovered": "The provider is back"},
       {"type": "capacity", "module": "db", "start": 18, "hours": 1, "factor": 0.3,
        "ramp": false,                    // "capacity": the module keeps this share of its capacity;
        "label": "A report holds the database"}]}],       // ramp: true makes it worse hour by hour (a leak)
  "journey": {"app": "MyShop", "who": "Asha, buying a phone in the sale", "peak_rpm": 20000, "color": "#1f6feb",
              "steps": [{"module": "orders", "label": "Place the order",       // 1-8 steps, in order
                         "ok": "Order placed", "slow": "Placing your order…",
                         "fail": "Something went wrong. Please try again."}]},
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
* Situation `kind`: traffic, bots, outage, deploy, database, cache, leak, zone or retry. The website shows them as
  Rush, Bots, Outage, Bad release, Database, Cache, Memory leak, Zone lost and Retry storm.
* Effect `type`: `down` or `capacity`. An effect's `module` can be `*` for every module; `start` is an hour
  (0–23), `minute` 0–59, and `hours` how long it lasts.

A situation without its own `entry` or `baseline` uses the busiest day's. `journey` drives the customer's phone
in the live replay; `peak_rpm` is requests per minute at a normal peak hour. Without a journey, the replay builds
a simple one from the entry modules.

Every module named in an incident, debt, file, dependency, situation table, effect or journey step must be listed
in `modules`. Every key in `incidents`, `needs`, `mitigated_by` and `tour` must exist. `playbook`, if given, must
be one of the 25 playbook keys: `pool-isolation`, `timeouts`, `circuit-breaker`, `retry-backoff`, `idempotency`,
`durable-queue`, `cache-precompute`, `cache-invalidation`, `query-indexing`, `pagination-archival`, `batching`,
`concurrency-control`, `replica-fallback`, `load-testing`, `test-coverage`, `time-and-calendar`, `configuration`,
`single-source`, `reconciliation`, `access-control`, `audit-trail`, `documentation`, `data-quality`,
`resource-leaks` or `refactor`.

**Limits:** 400 KB, 40 modules, 300 dependencies, 300 files, 300 markers, 300 incidents, 150 debt items,
20 people, 7 whys per incident, 7 extra situations and 4 effects per situation.

## Writing a pack that tells a good story

* **Repeated incidents converge.** Give incidents of the same family the same `group`, and end their 5 Whys with
  exactly the same root-cause sentence. Use that sentence as the `cause` of the debt that fixes it. Reuse one
  root cause across modules to create a systemic cause.
* **Regressions appear by themselves.** A family member reported in the same module after an earlier member was
  resolved is a regression. DebtLens should flag it, and **Incidents → Similar & regressions → Evaluation
  (measured)** shows whether it did.
* **Playbooks are matched from the words.** "connection pool", "durable queue", "precomputed cache", "index",
  "row-level lock", "timeout", "circuit breaker", "rate limit", "reconcile", "idempotency key", "memory leak" and so
  on pick the playbook. The playbook decides how much capacity or resilience a fix adds in a situation. After
  uploading, **Debt → Debt items → Fix playbooks** shows which playbook each item got.
* **Give each situation one clear guard** in `mitigated_by`, so the report can say what fixes it. A situation with
  no guard is fine too: its report says that nothing in the debt list guards against it and recommends adding one.
* **Tune the busiest day.** For a module with debt that limits capacity, a good `baseline` is about
  0.82 ÷ (1 + (peak − 1) × exposure). Then the module overloads today but holds after its fix.
