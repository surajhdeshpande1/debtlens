# DebtLens v2 — Test report

Run on 19 November 2026 (IST), branch `v2`. Every number below comes from a run of the code in this repository;
none is typed in by hand.

## Summary

| Suite | File | Tests | Result | Time |
|---|---|---|---|---|
| Engine and scenario packs | `tests/test_core.py` | 93 | all passed | 3.2 s |
| REST API, roles, sandboxes, packs | `tests/test_api.py` | 35 | all passed on SQLite, and again on MySQL 8.0.46 | 7.3 s / 28.3 s |
| Terminal tool | `tests/test_cli.py` | 16 | all passed | 2.3 s |
| **Total** | | **144** | **0 failed, 0 skipped** | **12.7 s** |

- **Local run:** Linux, Python 3.13, with the MiniLM model loaded (`DEBTLENS_MODEL_DIR` set).
- **GitHub Actions:** runs on every push with Python 3.12 (the version Vercel uses) and MiniLM switched off, so the TF-IDF
  fallback is tested too. The workflow then builds the pip package, installs it in a clean virtual environment,
  runs `debtlens plan` and `debtlens scan`, and finally runs the DebtLens quality gate on the self-audit scenario.

How to run:

```bash
pip install -r requirements-dev.txt
python -m pytest tests -q                                   # 144 tests, SQLite
DEBTLENS_TEST_DATABASE_URL=mysql+pymysql://user:pass@localhost/debtlens_test \
  python -m pytest tests/test_api.py -q                     # the API suite on a real MySQL 8 server
```

## 1. Algorithms checked against reference implementations

Each algorithm is written by the team in plain Python. The tests compare it with a well-known library or with brute
force. The libraries are installed only for the tests (`requirements-dev.txt`) and are not used by the application.

| What we wrote | Compared with | Test | Agreement |
|---|---|---|---|
| Word TF-IDF and cosine similarity | scikit-learn `TfidfVectorizer` | `test_word_tfidf_matches_sklearn` | every pair within 1e-9 |
| Character n-grams (3–5, word-bounded) | scikit-learn `char_wb` analyser | `test_char_ngrams_match_sklearn_char_wb` | identical n-gram lists |
| DBSCAN clustering | scikit-learn `DBSCAN` (precomputed distances) | `test_dbscan_matches_sklearn` | identical labels, 53 points |
| Brandes betweenness and degree centrality | NetworkX | `test_centrality_matches_networkx` (6 random graphs) | within 1e-9 |
| Exact knapsack, tree DP | brute force over all subsets | `test_tree_dp_is_optimal` (25 random backlogs) | same optimum |
| Exact knapsack, branch and bound | brute force | `test_branch_and_bound_is_optimal_on_dags` (25 random backlogs) | same optimum |
| McCabe complexity | Radon | `test_python_complexity_matches_radon` | same highest function complexity on a real source file |
| Interest formula | the worked example in the synopsis | `test_interest_formula_matches_synopsis` | exact |

Other engine tests: regression rules (same module, after the fix), transitive blast radius, Tarjan SCC and topological
sort, the Demo 1 planner wasting budget where the exact one does not, forced/blocked items and prerequisite cycles,
real `git log` mining on a temporary repository, TODO/FIXME found only in comments, log grouping by signature, CSV
normalisation, all five scenarios end to end, the evaluation settings, forecast reproducibility, and cascade extremes
(p = 1 fails everything downstream, p = 0 fails nothing).

Load spikes and fix playbooks (added 18 November):

| Check | Test |
|---|---|
| Overload probability is 0.5 at full capacity and rises steeply past it; traffic reaches only the modules an entry point calls | `test_overload_curve_and_exposure_propagation` |
| A spike that runs past midnight is cut at the end of the simulated day, and the description says so | same test |
| The plan fits the hours available, includes every prerequisite of a chosen fix, never does worse than fixing nothing, and saves at least as much as the regular sprint plan | `test_spike_plan_fits_the_budget_includes_prerequisites_and_helps` |
| A bigger spike loses more hours; the same seed gives the same result; every scenario runs | `test_bigger_spikes_hurt_more_and_runs_are_reproducible` |
| Each debt gets the playbook its evidence points to; text with no evidence falls back to "refactor"; all 24 playbooks have steps, checks and https references | `test_playbooks_match_the_evidence_and_fall_back_when_there_is_none` |
| A choice made in the scenario or by the team wins over matching; project edits are used; custom playbooks are cleaned (no `javascript:` links) | `test_playbook_choices_and_project_edits_win_over_matching` |

## 2. Security and roles (API suite)

| Check | Test |
|---|---|
| A request without a token, or with a bad one, gets HTTP 401 | `test_requires_auth` |
| Register, sign in, API tokens (`dlt_…`, only the SHA-256 hash stored) | `test_register_login_tokens` |
| Repeated failed sign-ins are rate-limited | `test_login_rate_limit` |
| Roles are enforced by the server, not the interface | `test_team_roles_enforced_server_side` |
| Allowed and refused actions across all six roles | `test_role_matrix` (12 role–action cases) |
| Only Admin and Tech Lead may change debt priority | `test_debt_priority_needs_tech_lead` |
| One organisation cannot read another's projects | `test_org_isolation` |
| A sandbox token reaches only its own project; reset restores the scenario | `test_sandbox_isolation_and_reset` |
| Expired sandboxes are refused (HTTP 410) | `test_sandbox_expiry` |
| Bad input returns a clear 400 error, never a crash | `test_validation_errors` |
| The database engine starts lazily without a deadlock (the Vercel cold-start path) | `test_lazy_engine_from_environment_does_not_deadlock` |

Workflow tests cover the incident lifecycle with 5 Whys and the duplicate check, debt links with cycle detection,
plan approval, all the simulations including load spikes (preset and custom, saved to the run history), idempotent CSV
import, log ingestion that raises a recurrence as a regression, repository scan upload with TODO → debt conversion,
fix playbooks (choose, tick steps, edit for the project, add and remove a custom one, with a Viewer refused and a
Developer unable to edit the library), and reports (the PDF lists each planned item's playbook), the CI gate and
export (which keeps the team's playbook choices and ticked steps).

## 3. Measured accuracy

Each scenario's incidents carry hand-labelled duplicate groups and true regressions. Every incident in a group is a
query; a hit is another member of the same group. Settings in use: α = 0.4, τ = 0.30. The same table is recomputed
live on the website (Intelligence → Evaluation), where the settings in use are highlighted.

| Scenario | Queries | P@1 TF-IDF | P@1 MiniLM | P@1 hybrid | Cluster purity | ARI | Regression P / R / F1 |
|---|---|---|---|---|---|---|---|
| PayCore (FinTech) | 16 | 0.62 | 0.94 | 0.94 | 0.88 | 0.83 | 0.78 / 0.78 / 0.78 |
| CareStream HIS (HealthTech) | 14 | 0.57 | 0.79 | 0.79 | 0.93 | 0.90 | 0.86 / 0.86 / 0.86 |
| ShopSwift (E-commerce) | 13 | 1.00 | 0.85 | 0.92 | 1.00 | 1.00 | 0.86 / 0.86 / 0.86 |
| CampusOne ERP (College) | 14 | 0.64 | 0.93 | 0.93 | 1.00 | 1.00 | 1.00 / 0.86 / 0.92 |
| DebtLens v1 (self-audit) | 8 | 0.62 | 0.88 | 1.00 | 1.00 | 1.00 | 1.00 / 1.00 / 1.00 |
| **Mean** | | **0.69** | **0.87** | **0.91** | | | **0.90 / 0.87 / 0.88** |

Choice of τ, mean over the five scenarios at α = 0.4:

| τ | 0.25 | **0.30** | 0.35 | 0.40 | 0.45 |
|---|---|---|---|---|---|
| Precision | 0.82 | **0.90** | 0.94 | 1.00 | 1.00 |
| Recall | 0.97 | **0.87** | 0.73 | 0.60 | 0.40 |
| F1 | 0.88 | **0.88** | 0.82 | 0.73 | 0.51 |

τ = 0.25 and τ = 0.30 tie on F1; 0.30 is used because it raises fewer false alarms.

## 4. Optimiser against greedy and the Demo 1 planner (budget 40 h)

Value is the total risk removed. The Demo 1 planner ignored prerequisites inside its dynamic programme and dropped
items afterwards, so it can leave hours unused.

| Scenario | Exact (method) | Greedy | Demo 1 planner | Exact vs greedy | Exact vs Demo 1 |
|---|---|---|---|---|---|
| PayCore | 230.9 in 39 h (tree DP) | 215.5 in 33 h | 226.3 in 37 h | +7.1% | +2.0% |
| CareStream HIS | 207.0 in 40 h (branch and bound) | 199.9 in 38 h | 181.4 in 34 h | +3.6% | +14.1% |
| ShopSwift | 259.3 in 38 h (tree DP) | 259.3 in 38 h | 259.3 in 38 h | 0% | 0% |
| CampusOne ERP | 285.2 in 39 h (tree DP) | 274.4 in 37 h | 177.5 in 17 h | +4.0% | +60.6% |
| DebtLens v1 | 312.2 in 40 h (tree DP) | 284.0 in 26 h | 217.6 in 18 h | +9.9% | +43.5% |

Each exact plan takes under a millisecond. On ShopSwift every method finds the same plan, which is expected when the
best items are also the best value per hour.

## 5. Simulations

- **Forecast (PayCore, 12 sprints of 40 h, 200 runs):** incident hours with the optimal policy 176.5, greedy 179.6,
  oldest first 200.5, no remediation 758.4. The optimal policy saves 581.9 h against no remediation (paired 95% CI
  565.3–598.5 h, better in 200 of 200 runs) and 3.2 h against greedy (95% CI −0.2–6.5 h: not a significant
  difference, which we report as such).
- **Reproducibility:** the same seed gives identical results (`test_forecast_is_reproducible_and_ranks_policies`).
- **Failure injection:** extremes checked (`test_cascade_extremes`); on PayCore a failure of `db` takes down 1.93
  dependent modules on average at p = 0.35 (90th percentile 4, worst case 8).
- **Load spikes (each scenario's preset event, 40 h to fix before it, 300 simulated days, seed 17):**

| Scenario | Event | Hours lost: now → after fixes | Requests failing | Chance of a clean day | Plan | Saves (95% CI) | Regular sprint plan saves |
|---|---|---|---|---|---|---|---|
| PayCore | Salary day, 4× | 211.6 → 25.0 h | 20.3% → 2.6% | 0% → 33% | DEBT-101, 112, 105 (40 h) | 186.6 h (181.0–192.1) | 163.1 h |
| CareStream HIS | Monday OPD rush, 3.5× | 85.7 → 6.6 h | 8.7% → 0.4% | 0% → 77% | 5 items (40 h) | 79.1 h (75.8–82.4) | 79.1 h |
| ShopSwift | Diwali sale, 8× | 58.3 → 18.6 h | 8.2% → 4.8% | 0% → 2% | DEBT-301, 302, 314 (38 h) | 39.8 h (37.6–41.9) | 9.3 h |
| CampusOne ERP | Exam results day, 12× | 51.4 → 1.0 h | 11.3% → 0.1% | 1% → 96% | DEBT-401, 413, 408 + 411 (35 h) | 50.3 h (48.2–52.4) | 24.0 h |

  The regular sprint plan ranks debt by its monthly interest; the spike plan ranks it by what it protects on the day.
  They agree on CareStream and differ most on ShopSwift, where the sale stresses modules that rarely fail on a normal
  day. DEBT-411 enters the CampusOne plan only because DEBT-401 needs it first. The self-audit scenario has no
  traffic event of its own, and its default custom spike finds nothing worth fixing (1.8 h lost either way).

## 5a. Scenario packs

`tests/test_core.py` runs every page and simulation on each of the seven bundled packs. It checks that each pack is
valid, that every debt item matches a specific playbook, and that each pack's own load-spike event is used. It
also checks that the spike plan cuts the hours lost on the day by at least 40% and does at least as well as the
regular sprint plan. `tests/test_api.py` opens packs by code and by upload (including a broken upload that must
list its problems and a reset that keeps the uploaded pack), and `tests/test_cli.py` exports, validates and
simulates a pack file. With MiniLM on, 40 hours to prepare and 300 simulated days:

| Code | System | Busiest day | P@1 (hybrid) | Regression F1 | Hours lost: now → after | Spike plan saves (95% CI) | Regular plan saves |
|---|---|---|---|---|---|---|---|
| `tatkal` | RailYatra | Tatkal opening at 10 AM (25×) | 0.93 | 0.90 | 131.7 → 46.1 h | 85.7 h (82.5–88.8) | 34.6 h |
| `broker` | NiveshTrade | Union Budget day (12×) | 0.93 | 0.89 | 141.1 → 59.7 h | 81.4 h (78.6–84.3) | 45.3 h |
| `food` | ZaikaNow | IPL final night (9×) | 1.00 | 1.00 | 152.8 → 61.5 h | 91.3 h (88.4–94.2) | 60.5 h |
| `stream` | KhelStream | World Cup final (20×) | 1.00 | 1.00 | 149.5 → 51.5 h | 98.0 h (95.0–100.9) | 50.2 h |
| `rides` | SawariGo | New Year's Eve (8×) | 0.88 | 0.89 | 113.1 → 28.4 h | 84.7 h (82.6–86.9) | 53.9 h |
| `taxfiling` | TaxSetu | ITR deadline night (31 July) (15×) | 0.94 | 0.95 | 151.8 → 38.0 h | 113.8 h (111.1–116.4) | 71.1 h |
| `tickets` | ShowPass | Stadium tour on-sale at noon (30×) | 1.00 | 0.90 | 146.8 → 42.0 h | 104.7 h (101.8–107.7) | 67.4 h |

## 6. Browser checks

Headless Chromium (Playwright) against the local server, 17–18 November 2026: register → create a project from a
scenario → report an incident with 5 Whys and the duplicate check → record a resolution → approve a plan → create an
API token → add a demo team → sign in as a Developer, who cannot approve a plan. The Intelligence → Evaluation page
was re-checked on 18 November: it shows α = 0.4 marked "in use" and τ = 0.30 highlighted. The Load spike tab (chart,
plan, heatmap with its now/after switch), the playbook card on a debt page (ticking steps, choosing another playbook,
editing it for the project) and the playbook library were checked the same day. No console errors.

## 7. Production check on Vercel (18 November)

https://debtlens-bec.vercel.app, one Vercel Python function in Singapore with TiDB Cloud Starter:

- `GET /api/v1/health?warm=1`: database `tidb` (TiDB v8.5.3), MiniLM downloaded and 386 scenario texts embedded in 5.5 s.
- A CampusOne sandbox opened in the browser; the Load spike tab gave the same figures as the table above (3.4 → 0.1
  incidents, 51 h → 1 h, 11.3% → 0.1% of requests failing).
- A write on TiDB: ticking a playbook step (`PUT …/debts/1/playbook` → 200), then reading it back.
- `report.pdf` → 200, 11.7 KB; a custom spike at 22:00 for 3 h → 200, with the midnight note.

## 8. Not yet covered

- **Load testing of DebtLens itself:** not done. The target is a class demo and small teams, not high traffic.
- **Small labelled sets:** 8 to 16 queries per scenario, labelled by the team. The accuracy figures show the method
  works; they are not a benchmark.
