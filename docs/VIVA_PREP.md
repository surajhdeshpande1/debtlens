# DebtLens — Viva preparation pack (Demo 2)

Each member should read **Common questions**, then their own section. Answers are short on purpose: say them in
your own words. Every file path is in this repository.

## Numbers to remember

| What | Value |
|---|---|
| Scenarios | 5: PayCore (FinTech), CareStream HIS (HealthTech), ShopSwift (E-commerce), CampusOne ERP (College), DebtLens v1 self-audit |
| Tables | 23 (8 kept from Demo 1 + 15 new) |
| Roles | 6: Admin, Tech Lead, Developer, QA, Manager, Viewer |
| Tests | 123 automated (engine 78, API 31, CLI 14); the API tests also pass on MySQL 8 |
| Similarity | sim = α·TF-IDF + (1−α)·MiniLM, α = 0.4; regression threshold τ = 0.30 |
| Accuracy | mean precision@1: TF-IDF 0.69, MiniLM 0.87, hybrid 0.91; regression F1 ≈ 0.88 |
| Interest | I(d) = Σ w(sev)·effort + λ₁·churn + λ₂·blast; w = 3.5/2.5/1.5/1.0, λ₁ = 0.15, λ₂ = 1.8 |
| PayCore at 40 h | 4 items, 39 h, retires 177.2 h/month; +7.1% vs greedy, +2.0% vs v1 |
| Forecast (PayCore, 12 sprints) | optimal plan saves ≈ 582 h vs doing nothing (95% CI ≈ 565–598 h) |

## The 5-minute live demo (Suraj drives, each member speaks to their part)

1. **Landing page** → *PayCore · FinTech* → role **Tech Lead** → *Open*. Point at the role home and KPIs.
2. **Incidents → INC-118**: regression banner, 5 Whys with “shared with 2 other incidents”, similar incidents with lexical and semantic bars. *(Sushma Hiremath)*
3. **Causal analysis**: the graph and the systemic-causes table. *(Sushma Hiremath)*
4. **Debt registry → DEBT-101**: principal 24 h vs interest 98.5 h per month, past break-even. **Ledger & optimiser**: move the budget slider, show exact vs greedy vs v1. *(Sushma Mathapati)*
5. **Repository evidence**: hotspots, TODO/FIXME → “→ debt”, dependency graph. *(Sushma K Patil)*
6. **Simulation Lab**: five industries side by side → *Sprint forecast* → *Failure injection* on `db`. *(Suraj)*
7. Switch role to **Developer** in the top bar: the home view changes, and approving a plan is refused by the server. *(Suraj)*
8. **Terminal**: `debtlens plan -s fintech --budget 40` and `debtlens ci -s fintech --max-open-critical 0` (exit code 1). *(Suraj / Sushma K Patil)*

Backup if there is no internet: `scripts\windows\start.bat` (see `docs/LOCAL_SETUP.md`). It runs the same website on your laptop's MySQL 8.

## Common questions (everyone)

**What problem does DebtLens solve?** Teams fix incidents but never record why the failure was possible. The weakness
stays and causes the next incident. DebtLens links incident → root cause → technical debt, and gives each debt item
a cost so it can be planned.

**What changed since Demo 1?** The panel asked for three things: simulate multiple scenarios (the Simulation Lab:
5 industries plus what-if, forecast and failure injection), work in the terminal (the `debtlens` CLI and a CI
gate), and host on Vercel without Supabase (Flask on Vercel with TiDB, which is MySQL-compatible).

**Why Flask and MySQL?** That is what we proposed at Demo 1. Flask runs as a single Vercel Python function. TiDB Cloud
speaks the MySQL protocol, so the same code runs on TiDB online and on MySQL 8 on our laptops.

**Is the data real?** The four industry scenarios are realistic data we wrote ourselves, modelled on real failure
patterns. The fifth scenario is mined from our real v1 repository. Anyone can also mine any public GitHub repository,
or their own repository with the CLI. Nothing in the analysis is hard-coded: every number is computed.

**How are roles enforced?** On the server. Every endpoint that reads or changes project data is wrapped in `@require("permission")`
(`debtlens/api/security.py`), and a disallowed call gets HTTP 403. The buttons in the website are only a convenience.

**What is a sandbox?** A private 24-hour copy of a scenario for a visitor without an account. It is isolated: a
sandbox token can only reach its own project, which is tested in `tests/test_api.py`.

**How do you know it works?** There are 123 automated tests. Our algorithms are compared against reference
libraries: scikit-learn for TF-IDF and DBSCAN, networkx for centrality, radon for complexity, and brute force for the
optimiser. The tests run on every push (`.github/workflows/ci.yml`).

**Limitations?** The accuracy figures come from our own labelled scenarios, which are small (8–16 queries each) and
labelled by us. Interest weights are assumptions, so the what-if page lets you change them. Website mining of GitHub
looks only at recent commits; the CLI reads the full history.

---

## Suraj H Deshpande — architecture, M1 workspace, Simulation Lab, CLI, deployment

**Code:** `debtlens/api/__init__.py`, `api/security.py`, `api/routes/auth.py`, `api/routes/sandbox.py`, `api/db.py`,
`core/simulation.py`, `debtlens/cli/main.py`, `app.py`, `vercel.json`.

- **Architecture:** a static website (CDN) calls the Flask REST API at `/api/v1`. The API and the CLI share one pure-Python engine (`debtlens/core`). The database is TiDB online and MySQL 8 offline.
- **Login:** passwords are hashed with bcrypt and never stored as plain text. A successful login returns a JWT, valid for 12 hours and signed with HS256. CLI and CI use API tokens (`dlt_…`); only their SHA-256 hash is stored.
- **Monte Carlo forecast:** each open debt keeps causing incidents. Its rate is learned from its own history, Gamma–Poisson style: (incidents + 0.5)/(age + 2) × a structural multiplier. Each sprint, a policy spends the budget (optimal, greedy, oldest first, or none). Over 200 runs we report the mean, p10–p90 and a paired 95% confidence interval. **Common random numbers:** every policy sees the same random futures, so the difference between policies is the policy alone.
- **Failure injection:** independent-cascade model. When a module fails, each module that depends on it fails with probability p × fragility, where fragility = 0.5 + 0.5 × risk/max risk. Simulated 3000 times. The most likely path is found with Dijkstra on −log(probability).

Likely questions:
- *Why JWT and not sessions?* Vercel functions are stateless. A signed token needs no session store.
- *Where is the JWT secret?* In the `JWT_SECRET` environment variable. If it is not set on Vercel, a key is derived with HMAC from the database credentials, which are already secret. It is never in the code.
- *What stops someone creating thousands of sandboxes?* A rate limit of 40 per hour per IP (`deps.rate_limit`), expired sandboxes being deleted, and a global cap.
- *Why Monte Carlo and not one calculation?* Incidents are random. One run could be lucky or unlucky. Many runs give an average and an uncertainty range.
- *How does the CLI work offline?* It imports the same engine and reads bundled scenarios, a JSON snapshot, or your own git history. Only `--project` talks to the server.

## Sushma Hiremath — M2 incidents, M3 5 Whys and causal graph, M6 intelligence

**Code:** `api/routes/incidents.py`, `core/similarity.py`, `core/tfidf.py`, `core/embeddings.py`,
`core/clustering.py`, `core/graph.py`, `core/engine.py` (`converge_cause`, `causal_graph`), `public/js/views/incidents.js`, `causal.js`, `intel.js`.

- **TF-IDF:** a word gets weight tf × idf, with idf = ln((1+n)/(1+df)) + 1. Similarity is the cosine of the two vectors. It is good when the same words are used.
- **MiniLM:** `all-MiniLM-L6-v2` turns a sentence into 384 numbers that capture meaning. “pool exhausted” is close to “no free database connections” even with no shared words. It runs on CPU with ONNX Runtime and is cached in the database.
- **Hybrid:** sim = 0.4·TF-IDF + 0.6·MiniLM.
- **Regression:** a new incident with sim ≥ 0.30, in the same module, reported after an earlier similar incident was resolved.
- **5 Whys convergence:** each answer is compared with existing cause nodes (exact match after normalising, otherwise similarity ≥ 0.84). If it matches, it reuses that node, so several incidents can share one root cause.
- **Systemic causes:** ranked by how many incident chains converge on a cause, then by betweenness centrality (Brandes' algorithm): how many shortest paths between other causes pass through it.
- **DBSCAN:** groups causes whose distance (1 − similarity) is below ε. Unlike k-means, you don't choose the number of clusters, and one-off causes stay as noise.

Likely questions:
- *Why not only MiniLM?* On ShopSwift the duplicate reports reuse the same words, and TF-IDF alone is perfect there (1.00 vs 0.85). The hybrid keeps both strengths.
- *How did you choose α and τ?* By measuring precision@1 and regression F1 on the five labelled scenarios. α = 0.4 gives a mean precision@1 of 0.91. τ = 0.30 gives the best mean F1 (0.88) with precision 0.90; τ = 0.25 ties on F1 but raises more false alarms. The Intelligence → Evaluation page recomputes all of this live and highlights the settings in use.
- *What is precision@1?* The share of queries whose top match is a true duplicate.
- *What do purity and ARI mean?* Purity: how pure each cluster is. ARI: agreement with the true groups, corrected for chance (1 = perfect, 0 = random).

## Sushma K Patil — M5 repository evidence, imports, CI gate

**Code:** `core/mining.py`, `core/ingest.py`, `api/routes/evidence.py`, `action.yml`, the `ci` and `scan` commands in `debtlens/cli/main.py`.

- **Churn:** the number of commits that touched a file in the window (`git log --numstat`), plus lines changed and authors.
- **McCabe complexity:** 1 + the number of decision points (if, for, while, and/or, except, case, …) per function, summed per file. It is checked against `radon`.
- **Hotspot score:** 100 × (churn/max churn) × (complexity/max complexity). Files that change often and are complex are the risky ones.
- **Self-admitted debt (SATD):** TODO, FIXME, HACK, XXX… found only inside comments, using the Python tokenizer and a JS comment scanner, never inside strings. One click turns a marker into a debt item.
- **Dependency graph:** from `import` statements, mapped to modules. It gives the blast radius used in the interest formula and in failure injection.
- **Log ingestion:** errors are grouped by signature, which is the exception type + the message with numbers, IDs and emails masked + the module. 500 identical errors become one incident. If a signature comes back after its incident was resolved, it is raised again and shows as a regression.
- **CI gate:** `debtlens ci --max-open-critical 0 …` exits with code 1 when a limit is crossed, so GitHub Actions stops the merge.

Likely questions:
- *Why can the website not read the full history?* The website uses the GitHub API, which is rate-limited, so it reads about 120 recent commits. The CLI runs `git log` locally with no limit.
- *How do you map files to modules?* By the first meaningful folder (skipping `src/`, `app/`…), or by explicit rules in a `debtlens.json` file.
- *Why mask numbers in log messages?* So that “timeout after 3000 ms” and “timeout after 2950 ms” count as the same error.

## Sushma Mathapati — M4 debt registry, M7 ledger and optimiser, M8 reports

**Code:** `core/economics.py`, `core/optimiser.py`, `api/routes/debts.py`, `core/engine.py` (`ledger`, `plan`, `whatif`), `api/routes/reports.py` (PDF), `public/js/views/debts.js`, `ledger.js`.

- **Principal:** the estimated hours to fix the debt once.
- **Interest (per month):** Σ over linked incidents of severity weight × effort, plus λ₁ × churn of its file or module, plus λ₂ × blast radius (the number of modules that depend on it).
- **Break-even:** interest > principal means the debt already costs more each month than fixing it once.
- **Risk score (0–120):** 100 × (0.5·I/Imax + 0.2·blast/max + 0.2·severity/max + 0.1·centrality/max), × 1.2 if past break-even.
- **Optimiser:** a 0/1 knapsack (choose items whose hours fit the budget and whose total risk is largest) with prerequisites (B cannot be chosen without A). We solve it exactly with a tree DP or branch and bound. Prerequisite cycles are merged first with Tarjan's SCC. Greedy (best value per hour) and our v1 DP are shown for comparison.
- **What-if:** change λ₁, λ₂, severity weights or risk weights and see which items change rank or cross break-even, and how the optimal plan changes with the budget.
- **Reports:** a PDF with KPIs, top risks, the plan and its comparison, systemic causes, regressions and hotspots.

Likely questions:
- *Why is greedy not enough?* Greedy picks by value per hour and can leave a large valuable item out, or waste hours. On PayCore the exact plan is 7.1% better than greedy at 40 h.
- *What was wrong with v1's planner?* It ignored prerequisites in the DP and then dropped items afterwards. The result was not optimal and left budget unused. On the CampusOne backlog at 40 h, v1 used only 17 h and the exact plan retires 60.6% more risk.
- *Is knapsack not NP-hard?* Yes, in general. Our backlogs are small (15–30 items) and hours come in half-hour steps, so DP over the budget is fast (milliseconds). Branch and bound handles prerequisite shapes the tree DP cannot.
- *Why are most items past break-even?* The scenarios focus on debt that actually caused incidents. Pure code smells with no incidents usually stay below break-even.
