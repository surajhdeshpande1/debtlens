# DebtLens — Viva preparation pack (Demo 2)

Each member should read **Common questions**, then their own section. Answers are short on purpose: say them in
your own words. Every file path is in this repository.

## Numbers to remember

| What | Value |
|---|---|
| Systems | 15 on the website: 4 industries (PayCore, CareStream HIS, ShopSwift, CampusOne ERP) + 11 scenario packs; plus the DebtLens v1 self-audit for accuracy and the CI gate |
| Situations | 88 of 9 kinds: Rush, Bots, Outage, Bad release, Database, Cache, Memory leak, Zone lost, Retry storm (5 to 7 per system) |
| Tables | 24 (8 kept from Demo 1 + 16 new) |
| Roles | 6: Admin, Tech Lead, Developer, QA, Manager, Viewer |
| Tests | 181 automated (engine, situations and packs 126, API 37, CLI 18); the API tests also pass on MySQL 8 |
| Similarity | sim = α·TF-IDF + (1−α)·MiniLM, α = 0.4; regression threshold τ = 0.30 |
| Accuracy | mean precision@1: TF-IDF 0.69, MiniLM 0.87, hybrid 0.91; regression F1 ≈ 0.88 |
| Interest | I(d) = Σ w(sev)·effort + λ₁·churn + λ₂·blast; w = 3.5/2.5/1.5/1.0, λ₁ = 0.15, λ₂ = 1.8 |
| PayCore at 40 h | 4 items, 39 h, retires 177.2 h/month; +7.1% vs greedy, +2.0% vs v1 |
| Forecast (PayCore, 12 sprints) | optimal plan saves ≈ 582 h vs doing nothing (95% CI ≈ 565–598 h) |
| Situation (CampusOne results day, 12×) | 48.7 h lost → 8.1 h after 35 h of fixes; requests failing 11.9% → 1%; clean day 10% → 68% |
| Situation (PayCore acquiring bank outage) | 38.9 h → 10.4 h after DEBT-104 (40 h); the regular sprint plan saves only 3 h of it |
| All 88 situations | the fixes cut the hours lost by 17% to 97% (median 78%), never to zero |
| Playbooks | 25 built-in; matched from the debt's own words; editable per project |
| Website | https://debtlens-bec.vercel.app |

## The 5-minute live demo (Suraj drives, each member speaks to their part)

1. **Start page** → *PayCore* → **Open**. It lands on *Pick a situation* as Ananya Rao, the Tech Lead. Open
   **Overview** and point at the role home and KPIs.
2. **Incidents → INC-118**: regression banner, 5 Whys with “shared with 2 other incidents”, similar incidents with lexical and semantic bars. *(Sushma Hiremath)*
3. **Incidents → Root causes**: the graph and the systemic-causes table. *(Sushma Hiremath)*
4. **Debt → Debt items → DEBT-101**: principal 24 h vs interest 98.6 h per month, past break-even. **Debt → Plan & ledger**: move the budget slider, show exact vs greedy vs v1. *(Sushma Mathapati)*
5. **Debt → Code evidence**: hotspots, TODO/FIXME → “→ debt”, dependency graph. *(Sushma K Patil)*
6. **Simulate → Run a scenario** → *Acquiring bank outage* → **Run this day →**. The replay opens: **▶ Start the day**,
   F for full screen, then **Side by side**. At 18:40 the bank stops answering and checkout freezes; after the fixes
   the circuit breaker trips in 20 seconds. Then **Read the report →**: the timeline, why it failed, what to fix first
   (DEBT-104), and **⬇ PDF**. *(Suraj)*
7. **Debt → DEBT-101 → Fix playbook**: tick a step, show *matched on …*, choose another playbook, and
   *Edit for this project*. Then **Fix playbooks** for the whole library. *(Sushma Mathapati)*
8. Switch role to **Developer** with **as** in the top bar: the home view changes, and approving a plan is refused by the server. *(Suraj)*
9. **Terminal**: `debtlens simulate spike -s fintech -e acquirer-outage --report` (the same report), `debtlens plan -s fintech --budget 40`
   and `debtlens ci -s fintech --max-open-critical 0` (exit code 1). *(Suraj / Sushma K Patil)*

The system-by-system script, with the alerts and numbers to expect, is `docs/PACK_MANUAL.md`.

Backup if there is no internet: `scripts\windows\start.bat` (see `docs/LOCAL_SETUP.md`). It runs the same website on your laptop's MySQL 8.

## Common questions (everyone)

**What problem does DebtLens solve?** Teams fix incidents but never record why the failure was possible. The weakness
stays and causes the next incident. DebtLens links incident → root cause → technical debt, and gives each debt item
a cost so it can be planned.

**What changed since Demo 1?** The panel asked for three things. *Simulate multiple scenarios*: the Simulate page
runs 88 situations across 15 systems, each ending in a report, plus a Monte Carlo forecast, failure injection,
what-if costs and an industry comparison. *Work in the terminal*:
the `debtlens` CLI, offline or connected, with a CI gate. *Help the engineers*: every debt item has a fix playbook
(steps, how to verify, references) on its page, in the CLI and in the PDF report. We also chose to host on Vercel
without Supabase (Flask on Vercel with TiDB, which is MySQL-compatible).

**Why Flask and MySQL?** That is what we proposed at Demo 1. Flask runs as a single Vercel Python function. TiDB Cloud
speaks the MySQL protocol, so the same code runs on TiDB online and on MySQL 8 on our laptops.

**Is the data real?** The four industry scenarios are realistic data we wrote ourselves, modelled on real failure
patterns. The fifth scenario is mined from our real v1 repository. Anyone can also mine any public GitHub repository,
or their own repository with the CLI. Nothing in the analysis is hard-coded: every number is computed.

**What are scenario packs?** Eleven more systems, each with its busiest day and four to six other situations:
Tatkal at 10 AM, Budget day for a stock broker, IPL final night for food delivery, a World Cup final for streaming, New
Year's Eve for ride-hailing, the ITR deadline night, a stadium ticket on-sale, an entrance exam, an airline fare sale,
government appointment slots and Diwali evening for quick commerce. Each pack is one JSON file with modules,
dependencies, incidents, 5 Whys, debt and its situations. DebtLens computes everything from it, as it does for a real
project. A pack is downloaded from its card, edited, and uploaded on the website; the terminal runs the built-in
packs by name only. An uploaded pack is checked completely first and every problem is listed at once
(`core/packs.py`). In all eleven, the plan for the busiest day saves more than the regular sprint plan: in the Tatkal
pack 62.7 h against 24.3 h, because the regular plan fixes the debt that cost the most in the past and not the debt
that breaks at 10:00.

**What is a situation?** One hard day: a rush, bots, a provider outage, a bad release, a starved database, a cache that
expires at once, a memory leak, a lost data-centre zone or a retry storm. Each says when traffic peaks and what goes
wrong (a module down, or left with part of its capacity), and which debt items guard against it. DebtLens simulates 300
versions of that day before and after the best fixes that fit the hours you have, then writes the report.

**What is in the report?** The headline, five numbers (hours lost, requests failing, incidents, days with no incident,
hours saved with a 95% confidence interval), a minute-by-minute timeline of the day you watched, hours lost by kind of
incident, what the situation did and which fix guards against it, why each module failed, what to fix first, what to
do next and how it was worked out. It is saved with the run and downloads as PDF or text; the terminal prints the same
report.

**Why are the results never perfect?** Because real days are not. Each simulated day has its own turnout and capacity,
modules fail at random at the rate of their own past incidents, a guarded outage still happens on about one day in
five, and a fifth of the bots that a fix blocks adapt and get through. Across the 88 situations the fixes cut the loss
by 17% to 97%, never to zero. Every number in the report says whether it is the average day or the day you watched.

**What is the live replay?** After a situation is run, the live replay opens by itself and plays one simulated day
minute by minute: a customer's phone going through the app (slow steps, error messages, an "isn't responding" freeze when the
way in is down) and the on-call engineer's screens (load per module, failures spreading to callers, alerts, hours
lost). It shows today and the same day after the fixes, alone or side by side, and also runs in the terminal
(`debtlens simulate spike --live`). The day shown is the one of the 300 simulated days that is closest to the
average both before and after the fixes, so it is typical, not the worst case.

*Does it really hang the laptop?* No, and that is deliberate. A real hang on the presentation laptop could crash
the demo, and flooding our free server would break it for everyone. The replay draws a hung device instead: the
lane stops updating, turns pale, says "(Not Responding)" and shows a wait cursor, then catches up. Esc, pause and
close always work, and no extra requests reach the server.

*How are bot attacks modelled?* A bot event says what share of the extra traffic is bots, what share of them a fix
blocks, and which debt items are that fix (a rate limit, a bot check). Bots load the modules like real users until
that debt is fixed; then most of the blocked share never reaches them (a fifth adapt and get through, and turning
bots away still costs the front door a tenth of serving them). The planner can choose that debt like any other. On
Tatkal the bot attack costs 183.9 h on an average day; the plan for the day, which starts with the 8-hour rate limit
DEBT-508, saves 77.9 h, while the regular sprint plan saves 5.8 h because it does not include DEBT-508.

*Are the minutes in the replay real?* The model works in whole hours. Inside an hour, overloads are spread over the
first ten minutes, cascades follow a minute or so after the failure they come from, and recoveries come later. Those
minutes only make the replay readable; the totals are the model's.

**How are roles enforced?** On the server. Every endpoint that reads or changes project data is wrapped in `@require("permission")`
(`debtlens/api/security.py`), and a disallowed call gets HTTP 403. The buttons in the website are only a convenience.

**What is a sandbox?** A private 24-hour copy of a scenario for a visitor without an account. It is isolated: a
sandbox token can only reach its own project, which is tested in `tests/test_api.py`.

**How do you know it works?** There are 181 automated tests. Our algorithms are compared against reference
libraries: scikit-learn for TF-IDF and DBSCAN, networkx for centrality, radon for complexity, and brute force for the
optimiser. The tests run on every push (`.github/workflows/ci.yml`).

**Limitations?** The accuracy figures come from our own labelled scenarios, which are small (8–20 queries each) and
labelled by us. Interest weights are assumptions, so the what-if page lets you change them. Website mining of GitHub
looks only at recent commits; the CLI reads the full history.

---

## Suraj H Deshpande — architecture, M1 workspace, Simulate and run reports, CLI, deployment

**Code:** `debtlens/api/__init__.py`, `api/security.py`, `api/routes/auth.py`, `api/routes/sandbox.py`, `api/db.py`,
`core/simulation.py`, `core/spike.py`, `core/report.py`, `debtlens/cli/main.py`, `app.py`, `vercel.json`.

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

**Situations** (`core/spike.py`, `engine.spike`, Simulate → Run a scenario, `debtlens simulate spike`):

- **The day** is 24 hourly traffic multipliers, e.g. results day: 12× a normal peak at 10:00, then tailing off. Each system has its busiest day and other situations; you can also set your own rush.
- **Who gets the traffic:** each situation says where users come in (on results day: `results`, `auth` and `notifications`). Load flows to every module those call, through the dependency graph.
- **What debt does to a module:** each open debt's playbook says how much capacity it costs (a shared pool, a slow query) and how much fragility it adds (no timeout, no circuit breaker). Load = baseline × traffic ÷ the capacity left.
- **Every day is different:** turnout is log-normal around the forecast (σ = 0.15) and each module's capacity varies by about 5%.
- **Overload:** P(overload) = 1/(1 + e^−(ρ−1)/0.05), where ρ is load ÷ capacity: 50% at full capacity, almost certain at 1.2. A module that goes down stays down until ρ drops below 0.9.
- **Cascades:** each hour a down module can take each caller down with probability 0.6 × fragility.
- **Random faults:** each module also fails on its own at the rate of its incidents in the last 180 days ((n + 0.25) per 180 days), and more often under load: × (1 + 3·min(ρ, 1.5)).
- **What goes wrong:** a situation's effects either take a module down (with a chance) or leave it a share of its capacity, from a start time for some hours; a leak gets worse hour by hour. A fix that guards against an effect removes 80% of it by default: a guarded outage still happens on about one day in five.
- **Cost:** every incident costs severity weight × the module's mean incident effort, so hours lost are comparable with the ledger.
- **The plan:** 300 simulated days. For each module we try every combination of its open debts (the four with the biggest effect, if it has more) and value it by simulation, then pick the best combination per module within the hours available, exactly, as a multiple-choice knapsack, with prerequisites added. Fixes that protect less than half an hour are left out, and the next fixes worth doing are valued on top of the plan for the report's "what to do next".
- **Fair comparison:** the same random numbers are used before and after (common random numbers), so the saving is caused by the fixes alone, and we report a paired 95% confidence interval.
- **The report** (`core/report.py`) is built from the same result: the average of the 300 days, and the day you watched (the one closest to the average before and after), always labelled apart.

Likely questions:
- *Why not just use the sprint plan?* The sprint plan ranks debt by its monthly interest. A situation stresses different things: on PayCore's acquiring bank outage the plan for the day saves 28.5 h, the regular plan only 3 h.
- *Why logistic and not a hard limit?* Real systems degrade before 100% and some survive a little above it. A hard cliff would make the result jump on tiny changes.
- *Where do capacity and fragility numbers come from?* From the playbook that matches the debt (e.g. a shared connection pool: 30% capacity lost). They are assumptions, shown on each playbook and editable per project.
- *Is it validated?* It is a model, not a measurement. The tests check its logic: more traffic never loses fewer hours, effects force their failures and a guarding fix softens them but never removes them, random faults follow each module's history, the plan fits the hours and its prerequisites, and the report's numbers add up to the simulation's.

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
- *How did you choose α and τ?* By measuring precision@1 and regression F1 on the five labelled scenarios. α = 0.4 gives a mean precision@1 of 0.91. τ = 0.30 gives the best mean F1 (0.88) with precision 0.90; τ = 0.25 ties on F1 but raises more false alarms. The Incidents → Similar & regressions → Evaluation (measured) page recomputes all of this live and highlights the settings in use.
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

## Sushma Mathapati — M4 debt registry and fix playbooks, M7 ledger and optimiser, M8 reports

**Code:** `core/economics.py`, `core/optimiser.py`, `api/routes/debts.py`, `core/engine.py` (`ledger`, `plan`, `whatif`), `api/routes/reports.py` (PDF), `public/js/views/debts.js`, `ledger.js`.

- **Principal:** the estimated hours to fix the debt once.
- **Interest (per month):** Σ over linked incidents of severity weight × effort, plus λ₁ × churn of its file or module, plus λ₂ × blast radius (the number of modules that depend on it).
- **Break-even:** interest > principal means the debt already costs more each month than fixing it once.
- **Risk score (0–120):** 100 × (0.5·I/Imax + 0.2·blast/max + 0.2·severity/max + 0.1·centrality/max), × 1.2 if past break-even.
- **Optimiser:** a 0/1 knapsack (choose items whose hours fit the budget and whose total risk is largest) with prerequisites (B cannot be chosen without A). We solve it exactly with a tree DP or branch and bound. Prerequisite cycles are merged first with Tarjan's SCC. Greedy (best value per hour) and our v1 DP are shown for comparison.
- **What-if:** change λ₁, λ₂, severity weights or risk weights and see which items change rank or cross break-even, and how the optimal plan changes with the budget.
- **Reports:** a project PDF with KPIs, top risks, the plan and its comparison, each planned item's fix playbook, systemic causes, regressions and hotspots; and a run report for every situation (Reports → Run reports).
- **Fix playbooks** (`core/playbooks.py`, `api/routes/playbooks.py`): 25 built-in playbooks, each with the problem, steps, how to verify it worked, risks, and references (Azure architecture patterns, the AWS Builders' Library, Google's SRE book). A debt is matched by weighted keywords: a phrase or a strong word scores 3, a plain word 1, matches in the title count double, and a matching category adds 1. Below 3.5 points it falls back to "refactor". The team can choose another playbook, tick steps as they go, edit a playbook for the project or add its own; a scenario can also fix the choice.

Likely questions:
- *Why is greedy not enough?* Greedy picks by value per hour and can leave a large valuable item out, or waste hours. On PayCore the exact plan is 7.1% better than greedy at 40 h.
- *What was wrong with v1's planner?* It ignored prerequisites in the DP and then dropped items afterwards. The result was not optimal and left budget unused. On the CampusOne backlog at 40 h, v1 used only 17 h and the exact plan retires 60.6% more risk.
- *Is knapsack not NP-hard?* Yes, in general. Our backlogs are small (15–30 items) and hours come in half-hour steps, so DP over the budget is fast (milliseconds). Branch and bound handles prerequisite shapes the tree DP cannot.
- *Why are most items past break-even?* The scenarios focus on debt that actually caused incidents. Pure code smells with no incidents usually stay below break-even.
- *Why keyword matching and not MiniLM for playbooks?* It is explainable: the card shows exactly which words matched, and a wrong match is fixed by choosing another playbook. With only 25 playbooks, a few strong terms each are enough.
- *What if the match is wrong?* The team picks the right one from the list; the choice is saved per debt and used by the CLI, the PDF and the situation simulations.
