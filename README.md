# DebtLens — Developer Incident & Technical Debt Management

**DebtLens connects each production incident to its root cause and to the technical debt that made it possible.
It prices that debt in engineer-hours lost and plays a hard day for the system (a rush, bots, an outage, a bad
release) before and after the fixes. Each run ends with a report: what happened, why, and what to fix first.**
You can use it as a website or as a terminal tool (`debtlens`). Both run the same engine and give the same numbers.

- **Website:** https://debtlens-bec.vercel.app (no account needed)
- **User guide:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md): every page, the four-step run, the report, scenario packs, the terminal, recording
- **Terminal:** install from this repository; it is not on PyPI yet ([guide, section 8](docs/USER_GUIDE.md#8-install-the-terminal-version))
- **College:** Mini Project BISA531P, Dept. of Information Science & Engineering, Basaveshwar Engineering College, Bagalkot (2026–27)

![Picking a situation for RailYatra](docs/img/run-situations.jpg)

## Why

When production breaks, teams restore service and close the ticket. The weakness that allowed the failure stays
in the code, undocumented and unscheduled, and the same root cause is found again and again by different
people. DebtLens keeps that chain visible:

**evidence** (Git history, logs, imports) → **causality** (5 Whys merged into one causal graph) →
**economics** (principal, interest, break-even) → **decision** (the best set of fixes within the hours you have).

## Run a scenario in four steps

1. **Pick a system.** Fifteen are built in: a payments gateway, a hospital system, an online store, a college ERP,
   railway Tatkal booking, a stock broker, food delivery, cricket streaming, ride-hailing, income-tax e-filing,
   concert tickets, an exam portal, an airline, government appointments and quick commerce. Or upload your own
   scenario pack.
2. **Pick a situation.** Each system has five to seven, 88 in all, of nine kinds: Rush, Bots, Outage, Bad release,
   Database, Cache, Memory leak, Zone lost and Retry storm. Each card says what goes wrong, when, and which debt
   item guards against it.
3. **Watch it happen.** The live replay plays the day minute by minute: a customer's phone going through the app
   (slow steps, error messages, a frozen "isn't responding" screen) next to the on-call engineer's modules and
   alerts, today and after the fixes, side by side if you like.
4. **Read the report.** The headline, five numbers, a timeline of the day you watched, hours lost by kind of
   incident, what the situation did, why each module failed, what to fix first, what to do next and how it was
   worked out. It is saved with the run under **Reports → Run reports** and downloads as a PDF or text.

![The live replay of Tatkal booking bots, today and after the fixes](docs/img/live-replay.jpg)

**How the numbers are made.** DebtLens simulates 300 versions of the day, once with today's open debt and once
after the fixes, with the same luck both times. Each day has its own turnout (±15%) and capacity (±5%). Modules
fail at random at the rate of their own past incidents. Bots adapt and some get through, and a guarded outage
still happens on some days. So no day after the fixes is ever perfectly clean. The planner picks the fixes that protect
the most hours within your budget, valued by simulation, prerequisites included. Every number in the report says
whether it is **the average day** (plan with this) or **the day you watched** (the one the replay plays).

With 40 hours of fixes, an average day:

| System | Situation | Kind | Engineer-hours lost: today → after | Fix first |
|---|---|---|---|---|
| RailYatra | Tatkal opening at 10 AM | Rush | 124.5 → 61.8 h (50% less) | DEBT-503, DEBT-502, DEBT-507, DEBT-510 |
| RailYatra | Tatkal booking bots | Bots | 183.9 → 106 h (42% less) | DEBT-508, DEBT-502, DEBT-503 |
| PayCore | Acquiring bank outage | Outage | 38.9 → 10.4 h (73% less) | DEBT-104 |
| ParikshaNet | Database failover mid-exam | Database | 58 → 3.7 h (94% less) | DEBT-1204 |
| TurantMart | UPI provider degrades | Outage | 26.5 → 6.2 h (77% less) | DEBT-1503 |
| SlotSetu | A data-centre zone loses power | Zone lost | 105.5 → 11.9 h (89% less) | DEBT-1408, DEBT-1401, DEBT-1412 |
| CampusOne ERP | Exam results day | Rush | 48.7 → 8.1 h (83% less) | DEBT-401, DEBT-413, DEBT-408, DEBT-411 |

Across all 88 situations the fixes cut the loss by 17% to 97% (median 78%), and never to zero.

![The run report for Tatkal booking bots](docs/img/run-report.jpg)

## The website: five pages

| Page | Tabs | What it is for |
|---|---|---|
| **Overview** | — | Your role's home: key numbers, the riskiest debt, a sprint plan preview, systemic causes, the last run report |
| **Incidents** | Incidents · Root causes · Similar & regressions | Report incidents with a live "has this happened before?" check, 5 Whys merged into one causal graph, duplicates, regressions and measured accuracy |
| **Debt** | Debt items · Plan & ledger · Code evidence | Debt priced in hours, fix playbooks, the exact sprint planner, churn × complexity hotspots, TODO/FIXME markers, imports |
| **Simulate** | Run a scenario · Sprint forecast · Failure injection · What-if costs · Compare industries | The four-step run, Monte Carlo over sprints, a failure spreading through dependencies, cost assumptions, all industries side by side |
| **Reports** | Run reports · Lessons & exports | Every run's report with PDF, lessons learned, the project PDF, CSV/JSON exports, the CI quality gate |

Settings sit in the top bar: play the system as another role, and the ⚙ menu (team & settings, terminal guide,
guided tour, reset). Every role gets its own Overview: a Developer sees their own debt and TODOs, QA sees
regressions and fixes to verify, a Manager sees the plan to approve and the hours it saves.

## What it does

| Module | What you get |
|---|---|
| **M1 Workspace** | Organisation → projects → members. Six roles (Admin, Tech Lead, Developer, QA, Manager, Viewer), checked by the server on every request. API tokens for the terminal and CI. Private 24-hour sandboxes for anyone without an account. |
| **M2 Incidents** | Reporting with a live “has this happened before?” check, severity, module, lifecycle, search and filters, CSV export. |
| **M3 Causal analysis** | Guided 5 Whys. Every answer becomes a reusable cause node, and answers that match an existing cause merge into it. Systemic causes are ranked by convergence and betweenness centrality. Similar causes are clustered with DBSCAN. |
| **M4 Debt registry** | Debt items linked to incidents, root causes and prerequisites, with category, status and assignee. Each item gets one of **25 fix playbooks** (connection pools, timeouts, circuit breakers, idempotency, queues, caching, indexing, resource leaks and more): steps, how to verify, risks and references, which the team can tick off, swap or edit. |
| **M5 Repository evidence** | Churn × McCabe-complexity hotspots, TODO/FIXME markers found only inside comments, and the module import graph, from the full local git history (terminal) or any public GitHub repository (website). |
| **M6 Intelligence** | Hybrid similarity (TF-IDF + MiniLM sentence embeddings) for duplicates, knowledge search and regression detection, with measured accuracy. |
| **M7 Ledger & optimiser** | Interest *I(d) = Σ w(sev)·effort + λ₁·churn + λ₂·blast radius* and a break-even flag for each item. An exact precedence-constrained 0/1 knapsack picks what to fix, compared live with greedy and with v1's planner. |
| **M8 Knowledge & reports** | Run reports, lessons learned, PDF/CSV/JSON exports, CI quality gate, activity log. |
| **Simulation** | **Situations**: a day hour by hour with its own effects (a provider down, a bad release, a database starved, a cache expiring, a leak, a lost zone, retries piling up, bots), the fixes chosen for it and the report · **Monte Carlo** sprint forecast with paired 95% confidence intervals · **Failure injection** (independent-cascade model) with drill incidents · **What-if** cost sliders · **Industry comparison**. |

## Scenario packs

A scenario pack is one JSON file that holds a whole system: modules, incidents with 5 Whys, debt, its busiest
day and its other situations, with their effects. Eleven come built in: railway Tatkal (`tatkal`), a stock broker
on Budget day (`broker`), food delivery on IPL final night (`food`), World Cup streaming (`stream`), ride-hailing on
New Year's Eve (`rides`), income-tax e-filing on deadline night (`taxfiling`), a stadium on-sale (`tickets`),
an entrance exam (`exam`), an airline fare sale (`airline`), government appointment slots (`appointments`) and
quick commerce on Diwali evening (`grocery`).

**Pack files are opened on the website only.** Download a pack from its card (**pack file**), edit it, and upload it
on the start page (**Upload a scenario pack**). DebtLens checks the whole file, lists every problem at once, and opens a
valid pack as a private sandbox. The format, with `kind`, `effects` and `bots`, is in [docs/PACKS.md](docs/PACKS.md).
The terminal runs the built-in systems by code.

## Terminal

Install from this repository (Python 3.10 or newer). On Windows, `scripts\windows\setup.bat` does all of this.

```bash
git clone https://github.com/surajhdeshpande1/debtlens
cd debtlens
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt "typer>=0.12" "rich>=13" "waitress>=3.0"
python -m debtlens model download        # the MiniLM model, 23 MB, once
```

```bash
python -m debtlens scenarios                                            # every built-in system
python -m debtlens simulate spike -s tatkal --list                      # a system's situations
python -m debtlens simulate spike -s fintech -e acquirer-outage --report   # run one, read the report
python -m debtlens simulate spike -s tatkal -e tatkal-bots --live --side   # watch it, then the report
python -m debtlens plan -s college --budget 40                          # what to fix this sprint
python -m debtlens playbook DEBT-101 -s fintech                         # how to fix one debt item
python -m debtlens scan .                                               # mine your own repository
python -m debtlens ci -s self --max-open-critical 0                     # exit code 1 when a limit is crossed
python -m debtlens login https://debtlens-bec.vercel.app --token dlt_…  # connect to your team
```

For the short `debtlens` command, build and install the package once: `python scripts/build_package.py`, then
`pip install dist/debtlens-2.0.0-py3-none-any.whl`. Without the MiniLM model the terminal falls back to TF-IDF on
character n-grams and says so.

**Run the whole website offline** (a demo without internet): `python -m debtlens serve` (SQLite) or
`python -m debtlens serve --db "mysql+pymysql://debtlens:debtlens@localhost/debtlens"`, then open
http://localhost:8000. See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for Windows and MySQL 8.

## Architecture

```
public/              plain HTML, CSS and JavaScript (ES modules); Cytoscape.js and Chart.js served locally
app.py               Vercel entry point -> debtlens.api.create_app()
debtlens/api/        Flask REST API (/api/v1), SQLAlchemy models, auth (bcrypt + JWT + API tokens), RBAC, sandboxes
debtlens/core/       the engine, pure Python, shared by the API and the terminal
                     (similarity, causal graph, ledger, planner, situations in spike.py, the run report in report.py)
debtlens/cli/        the `debtlens` command (Typer + Rich), including the live replay
debtlens/scenarios/  five labelled industry scenarios, and the situations for the four industries
debtlens/packs/      eleven scenario packs: a system, its busiest day and its situations, in one JSON file each
tests/               181 tests: engine checked against scikit-learn, networkx and radon; situations; API, roles, sandboxes, packs
```

- **Database:** TiDB Cloud Starter (MySQL-compatible, TLS) on Vercel; MySQL 8 or SQLite locally. The tables keep
  the Demo-1 names (`user`, `project`, `module`, `assignment`, `technical_debt`, `incident`, `root_cause`,
  `resolution`) and add causal-graph, evidence, plan, playbook and simulation tables. Each saved run keeps its
  report. See [db/schema.sql](db/schema.sql).
- **Hosting:** one Vercel Python Function (Flask) in Singapore (`sin1`). Static files come from the CDN.
- **Semantic model:** `sentence-transformers/all-MiniLM-L6-v2` (int8 ONNX, CPU), downloaded from Hugging Face
  at runtime. Vectors are cached in the database by text hash.

## Measured accuracy

Live in **Incidents → Similar & regressions → Evaluation (measured)**. Each scenario's incidents carry hand-labelled
duplicate groups and true regressions. Every incident in a group is used as a query, and a hit is another member of
the same group.

| Scenario | Queries | P@1 TF-IDF | P@1 MiniLM | P@1 hybrid (α 0.4) | MRR hybrid | Cluster purity | ARI | Regression P / R / F1 (τ 0.30) |
|---|---|---|---|---|---|---|---|---|
| PayCore (FinTech) | 16 | 0.62 | 0.94 | 0.94 | 0.95 | 0.88 | 0.83 | 0.78 / 0.78 / 0.78 |
| CareStream HIS (HealthTech) | 14 | 0.57 | 0.79 | 0.79 | 0.88 | 0.93 | 0.90 | 0.86 / 0.86 / 0.86 |
| ShopSwift (E-commerce) | 13 | 1.00 | 0.85 | 0.92 | 0.96 | 1.00 | 1.00 | 0.86 / 0.86 / 0.86 |
| CampusOne ERP (College) | 14 | 0.64 | 0.93 | 0.93 | 0.96 | 1.00 | 1.00 | 1.00 / 0.86 / 0.92 |
| DebtLens v1 (self-audit) | 8 | 0.62 | 0.88 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 / 1.00 / 1.00 |

Mean precision@1 across the five scenarios: TF-IDF 0.69, MiniLM 0.87, hybrid 0.91. The hybrid matches or beats
MiniLM on every scenario and beats TF-IDF on four of five. The exception is ShopSwift, whose duplicate reports reuse
the same wording, so TF-IDF alone reaches 1.00. The defaults α = 0.4 and τ = 0.30 were chosen from these results.

## Development

```bash
pip install -r requirements-dev.txt
python -m pytest tests -q                      # 181 tests
python -m debtlens serve --port 8000           # the website on http://127.0.0.1:8000 (SQLite)
python scripts/build_package.py                # build the package into dist/
```

## Team

| Member | Owns (and defends in the viva) |
|---|---|
| Suraj H Deshpande | Architecture, M1 workspace (accounts, roles), simulation (situations, live replay, run reports), terminal tool, deployment |
| Sushma Hiremath | M2 incidents, M3 5 Whys and the causal graph, M6 similarity and regressions |
| Sushma K Patil | M5 repository evidence, data imports (logs, CSV/JSON, GitHub Issues), CI quality gate |
| Sushma Mathapati | M4 debt registry and fix playbooks, M7 ledger, optimiser and what-if, M8 reports |
