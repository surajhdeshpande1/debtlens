# DebtLens — Developer Incident & Technical Debt Management

**DebtLens connects each production incident to its root cause and to the technical debt that made it possible.
It then prices that debt in hours lost per month and works out what to fix in the next sprint.**
You can use it as a website or as a terminal tool (`debtlens`); both run the same analysis engine.

- **Website:** https://debtlens-cloud.vercel.app (try any industry scenario, no account needed)
- **Terminal:** `pipx install debtlens`
- **College:** Mini Project BISA531P, Dept. of Information Science & Engineering, Basaveshwar Engineering College, Bagalkot (2026–27)

![Tech Lead home view](docs/img/home-tech-lead.jpg)

## Why

When production breaks, teams restore service and close the ticket. The weakness that allowed the failure stays
in the code, undocumented and unscheduled, and the same root cause is found again and again by different
people. DebtLens keeps that chain visible:

**evidence** (Git history, logs, imports) → **causality** (5 Whys merged into one causal graph) →
**economics** (principal, interest, break-even) → **decision** (an exact sprint plan within the hours you have).

## What it does

| Module | What you get |
|---|---|
| **M1 Workspace** | Organisation → projects → members. Six roles (Admin, Tech Lead, Developer, QA, Manager, Viewer), checked by the server on every request. API tokens for the CLI and CI. |
| **M2 Incidents** | Reporting with a live “has this happened before?” check, severity, module, lifecycle, search and filters, CSV export. |
| **M3 Causal analysis** | Guided 5 Whys. Every answer becomes a reusable cause node, and answers that match an existing cause merge into it. Systemic causes are ranked by convergence and betweenness centrality. Similar causes are clustered with DBSCAN. |
| **M4 Debt registry** | Debt items linked to incidents, root causes and prerequisites, with category, status and assignee. |
| **M5 Repository evidence** | Churn × McCabe-complexity hotspots, TODO/FIXME markers found only inside comments, and the module import graph. Comes from the full local git history (CLI) or any public GitHub repository (website). |
| **M6 Intelligence** | Hybrid similarity (TF-IDF + MiniLM sentence embeddings) for duplicates, knowledge search and regression detection, with measured accuracy. |
| **M7 Ledger & optimiser** | Interest *I(d) = Σ w(sev)·effort + λ₁·churn + λ₂·blast radius* and a break-even flag for each item. An exact precedence-constrained 0/1 knapsack picks what to fix, compared live with greedy and with v1's planner. |
| **M8 Knowledge & reports** | Lessons learned, PDF/CSV/JSON exports, CI quality gate, activity log. |
| **Simulation Lab** | **Industry scenarios** side by side · **What-if** economics sliders · **Monte Carlo** sprint forecast with paired 95% confidence intervals · **Failure injection** (independent-cascade model) with drill incidents. |

Every role gets its own home screen. For example, a Developer sees their own debt and the TODOs in their code,
QA sees regressions and fixes to verify, and a Manager sees the plan to approve and the hours it saves.
Examiners can take the **guided tour**, which walks through these features on live sandbox data.

## Try it

**Website.** Open the site, pick a scenario (FinTech payments, HealthTech hospital, E-commerce, College ERP, or
DebtLens auditing its own v1) and a role. You get a private 24-hour copy to change freely. Create a team to
get real accounts.

**Terminal.**

```bash
pipx install debtlens                 # or: pip install debtlens
debtlens scenarios
debtlens demo healthtech              # dashboard of a scenario (offline)
debtlens plan --scenario fintech --budget 40
debtlens simulate forecast --scenario college
debtlens scan .                       # mine your own repository
debtlens ingest logs/app.log          # error logs -> incident candidates
debtlens ci --scenario self --max-open-critical 0   # exit code 1 when a limit is crossed

debtlens login https://debtlens-cloud.vercel.app --token dlt_…   # connect to your team
debtlens use 3 && debtlens scan . --push && debtlens incidents new
```

Semantic similarity in the CLI needs `pip install "debtlens[ml]"` and then `debtlens model download`
(23 MB, once). Without them the CLI falls back to TF-IDF on character n-grams and says so.

**Run the whole website offline** (demo without internet, MySQL 8 or SQLite):

```bash
pip install "debtlens[all]"
debtlens serve --db "mysql+pymysql://debtlens:debtlens@localhost/debtlens"   # or just: debtlens serve
```

See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for Windows + MySQL 8 steps.

## Architecture

```
public/            plain HTML, CSS and JavaScript (ES modules); Cytoscape.js and Chart.js served locally
app.py             Vercel entry point -> debtlens.api.create_app()
debtlens/api/      Flask REST API (/api/v1), SQLAlchemy models, auth (bcrypt + JWT + API tokens), RBAC, sandboxes
debtlens/core/     the analysis engine, pure Python, shared by the API and the CLI
debtlens/cli/      the `debtlens` command (Typer + Rich)
debtlens/scenarios five labelled industry scenarios (JSON)
tests/             123 tests: engine checked against scikit-learn, networkx and radon; API, roles and sandboxes
```

- **Database:** TiDB Cloud Starter (MySQL-compatible, TLS) on Vercel; MySQL 8 or SQLite locally. The tables keep
  the Demo-1 names (`user`, `project`, `module`, `assignment`, `technical_debt`, `incident`, `root_cause`,
  `resolution`) and add causal-graph, evidence, plan and simulation tables. See [db/schema.sql](db/schema.sql).
- **Hosting:** one Vercel Python Function (Flask) in Singapore (`sin1`). Static files come from the CDN.
- **Semantic model:** `sentence-transformers/all-MiniLM-L6-v2` (int8 ONNX, CPU), downloaded from Hugging Face
  at runtime. Vectors are cached in the database by text hash.

## Measured accuracy (live in Intelligence → Evaluation)

Each scenario's incidents carry hand-labelled duplicate groups and true regressions. Every incident in a group
is used as a query, and a hit is another member of the same group.

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
python -m pytest tests -q                      # 123 tests
DATABASE_URL=sqlite:///dev.db flask --app app run    # website on http://127.0.0.1:5000
python scripts/build_package.py                # build the PyPI package into dist/
```

## Team

| Member | Owns (and defends in the viva) |
|---|---|
| Suraj H Deshpande | Architecture, M1 workspace (accounts, roles), Simulation Lab, terminal tool, deployment |
| Sushma Hiremath | M2 incidents, M3 5 Whys and the causal graph, M6 similarity and regressions |
| Sushma K Patil | M5 repository evidence, data imports (logs, CSV/JSON, GitHub Issues), CI quality gate |
| Sushma Mathapati | M4 debt registry, M7 ledger, optimiser and what-if, M8 reports |
