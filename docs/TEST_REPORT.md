# DebtLens v2 — Test report

Run on 26 November 2026 (IST), branch `v3`, which was released to `main` (the live site) the same day. Every number
below comes from a run of the code in this repository; none is typed in by hand.

## Summary

| Suite | File | Tests | Result | Time |
|---|---|---|---|---|
| Engine, situations, run report, scenario packs | `tests/test_core.py` | 126 | all passed | 27.6 s |
| REST API, roles, sandboxes, packs, run reports | `tests/test_api.py` | 37 | all passed | 8.2 s |
| Terminal tool | `tests/test_cli.py` | 18 | all passed | 5.0 s |
| **Total** | | **181** | **0 failed, 0 skipped** | **41.2 s** |

- **Local run:** Linux, Python 3.13, SQLite. The MiniLM model could not be downloaded in this environment, so the
  similarity tests ran on the TF-IDF fallback; the accuracy figures with MiniLM (sections 3 and 5a) were measured on
  the live site, which has the model. The API suite also ran on MySQL 8.0.46 on 19 November, and the v3 code runs
  on TiDB on Vercel (section 7).
- **GitHub Actions:** runs on every push with Python 3.12 (the version Vercel uses) and MiniLM switched off. On the
  release commit (`a67462d`, 26 November) it reported 180 passed and 1 skipped: the PDF text check, which needs
  `pypdf`. The workflow then builds the pip package, installs it in a clean virtual environment, runs `debtlens plan`
  and `debtlens scan`, and finally runs the DebtLens quality gate on the self-audit scenario.

How to run:

```bash
pip install -r requirements-dev.txt
python -m pytest tests -q                                   # 181 tests, SQLite
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

Load spikes and fix playbooks (added 18 November; the situation tests of v3 are in section 5b):

| Check | Test |
|---|---|
| Overload probability is 0.5 at full capacity and rises steeply past it; traffic reaches only the modules an entry point calls | `test_overload_curve_and_exposure_propagation` |
| A spike that runs past midnight is cut at the end of the simulated day, and the description says so | same test |
| The plan fits the hours available, includes every prerequisite of a chosen fix, never does worse than fixing nothing, and saves at least as much as the regular sprint plan | `test_spike_plan_fits_the_budget_includes_prerequisites_and_helps` |
| A bigger spike loses more hours; the same seed gives the same result; every scenario runs | `test_bigger_spikes_hurt_more_and_runs_are_reproducible` |
| Each debt gets the playbook its evidence points to; text with no evidence falls back to "refactor"; all 25 playbooks have steps, checks and https references | `test_playbooks_match_the_evidence_and_fall_back_when_there_is_none` |
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
plan approval, all the simulations including situations (preset and custom, saved to the run history with their
report, which every role on the team can read and download as PDF or text, and no other team can), idempotent CSV
import, log ingestion that raises a recurrence as a regression, repository scan upload with TODO → debt conversion,
fix playbooks (choose, tick steps, edit for the project, add and remove a custom one, with a Viewer refused and a
Developer unable to edit the library), and reports (the PDF lists each planned item's playbook), the CI gate and
export (which keeps the team's playbook choices and ticked steps).

## 3. Measured accuracy

Each scenario's incidents carry hand-labelled duplicate groups and true regressions. Every incident in a group is a
query; a hit is another member of the same group. Settings in use: α = 0.4, τ = 0.30. The same table is recomputed
live on the website (**Incidents → Similar & regressions → Evaluation (measured)**), where the settings in use are
highlighted. The scenario data behind it did not change in v3.

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
  difference, which we report as such). Unchanged from 19 November.
- **Reproducibility:** the same seed gives identical results (`test_forecast_is_reproducible_and_ranks_policies`).
- **Failure injection:** extremes checked (`test_cascade_extremes`); on PayCore a failure of `db` takes down 1.93
  dependent modules on average at p = 0.35 (90th percentile 4, worst case 8; 3,000 runs, seed 7).
- **Situations: the busiest day of each industry scenario** (40 h to fix before it, 300 simulated days, seed 17):

| Scenario | Busiest day | Hours lost: today → after | Requests failing | Chance of a clean day | Plan | Saves (95% CI) | Regular sprint plan saves |
|---|---|---|---|---|---|---|---|
| PayCore | Salary day, 4× | 197.4 → 45.8 h | 19.9% → 5.5% | 1% → 34% | DEBT-101, DEBT-112, DEBT-105 (40 h) | 151.6 h (145.2–158) | 134.5 h |
| CareStream HIS | Monday morning OPD rush, 3.5× | 79.2 → 20.3 h | 9.1% → 1.9% | 12% → 50% | DEBT-211, DEBT-206, DEBT-210 (30 h) | 59 h (54.3–63.6) | 59.2 h |
| ShopSwift | Diwali sale, 8× | 53.4 → 27.1 h | 7.1% → 4.6% | 6% → 13% | DEBT-301, DEBT-302, DEBT-314 (38 h) | 26.4 h (24–28.8) | 9.5 h |
| CampusOne ERP | Exam results day, 12× | 48.7 → 8.1 h | 11.9% → 1% | 10% → 68% | DEBT-401, DEBT-413, DEBT-408, DEBT-411 (35 h) | 40.6 h (37.8–43.4) | 19.2 h |

  The regular sprint plan ranks debt by its monthly interest; the plan for the day ranks it by what it protects on
  that day. They agree on CareStream (within noise) and differ most on ShopSwift, where the sale stresses modules
  that rarely fail on a normal day. DEBT-411 enters the CampusOne plan only because DEBT-401 needs it first.
  These numbers are lower than on 19 November (for example CampusOne 51.4 → 1.0 h then, 48.7 → 8.1 h now) because
  v3 removed results that were too perfect: each day now has its own turnout and capacity, modules fail at random
  at the rate of their own history, and a guarded situation still happens on some days.

## 5a. Scenario packs

`tests/test_core.py` runs every page and simulation on each of the eleven bundled packs. It checks that each pack is
valid, that every debt item matches a specific playbook, and that every situation of every pack runs. `tests/test_api.py`
opens packs by code and by upload (including a broken upload that must list its problems and a reset that keeps the
uploaded pack). `tests/test_cli.py` checks that the terminal runs packs by code and refuses a pack file with a
pointer to the website. With 40 hours to prepare and 300 simulated days; P@1 and regression F1 measured with
MiniLM on the live site:

| Code | System | Busiest day | P@1 (hybrid) | Regression F1 | Hours lost: today → after | Plan for the day saves (95% CI) | Regular plan saves |
|---|---|---|---|---|---|---|---|
| `tatkal` | RailYatra | Tatkal opening at 10 AM (25×) | 0.93 | 0.90 | 124.5 → 61.8 h | 62.7 h (58.5–66.8) | 24.3 h |
| `broker` | NiveshTrade | Union Budget day (12×) | 0.93 | 0.89 | 128.6 → 66 h | 62.6 h (59.2–66) | 34.9 h |
| `food` | ZaikaNow | IPL final night (9×) | 1.00 | 1.00 | 145.6 → 85.4 h | 60.2 h (55.8–64.5) | 41.9 h |
| `stream` | KhelStream | World Cup final (20×) | 1.00 | 1.00 | 156 → 77.8 h | 78.3 h (74.1–82.4) | 50.9 h |
| `rides` | SawariGo | New Year's Eve (8×) | 0.88 | 0.89 | 102.7 → 45.5 h | 57.2 h (53.9–60.5) | 39.1 h |
| `taxfiling` | TaxSetu | ITR deadline night (31 July) (15×) | 0.94 | 0.95 | 140.2 → 53.5 h | 86.7 h (81.9–91.5) | 51.8 h |
| `tickets` | ShowPass | Stadium tour on-sale at noon (30×) | 1.00 | 0.90 | 129 → 53.8 h | 75.3 h (70.8–79.7) | 51.3 h |
| `exam` | ParikshaNet | Entrance exam day (30×) | 0.90 | 1.00 | 305.9 → 137 h | 168.9 h (161.8–176) | 137.2 h |
| `airline` | UdanAir | Fare sale at noon (20×) | 1.00 | 1.00 | 130.8 → 50.9 h | 79.9 h (76.2–83.5) | 42.3 h |
| `appointments` | SlotSetu | New slots open at 17:00 (25×) | 1.00 | 1.00 | 108.6 → 35.2 h | 73.4 h (69.8–77) | 42 h |
| `grocery` | TurantMart | Diwali evening (10×) | 1.00 | 1.00 | 131.7 → 63.1 h | 68.6 h (64.2–73) | 40.7 h |

The four packs added in v3 (`exam`, `airline`, `appointments`, `grocery`) reuse more of the same wording within a
family of incidents, so even TF-IDF alone reaches P@1 0.85–1.00 on them. They are easier test sets than the first
seven, and we report them as such.

**Bot attacks.** Each pack has a bot attack among its situations, with one debt item that blocks most of the bots
once fixed (same settings as above):

| Code | Bot attack | Blocked by | Hours lost: today → after | Plan for the day saves (95% CI) | Regular plan saves |
|---|---|---|---|---|---|
| `tatkal` | Tatkal booking bots (60×) | DEBT-508 | 183.9 → 106 h | 77.9 h (71.1–84.6) | 5.8 h |
| `broker` | Credential-stuffing attack (32×) | DEBT-607 | 107.7 → 7.1 h | 100.6 h (97.8–103.4) | 100.8 h |
| `food` | Coupon-abuse bots (20×) | DEBT-715 | 112.9 → 28.3 h | 84.6 h (82.3–86.9) | 20.2 h |
| `stream` | Restreaming bots (32×) | DEBT-814 | 241.7 → 65.4 h | 176.3 h (170.4–182.3) | 40.4 h |
| `rides` | Fare-scraping bots (16×) | DEBT-914 | 109 → 27 h | 82 h (79.6–84.4) | 11.7 h |
| `taxfiling` | Credential stuffing on PAN login (25×) | DEBT-1014 | 119.7 → 8.7 h | 111 h (108.4–113.7) | 18.9 h |
| `tickets` | Scalper bots at the drop (50×) | DEBT-1106 | 163.7 → 55.6 h | 108.1 h (103.7–112.5) | 7.6 h |
| `exam` | Result-scraping bots (25×) | DEBT-1209 | 36.6 → 8.2 h | 28.4 h (26.3–30.6) | 15 h |
| `airline` | Seat-spinning bots (20×) | DEBT-1306 | 127.5 → 3.7 h | 123.9 h (120.8–126.9) | 118.6 h |
| `appointments` | Agents' slot-grabbing scripts (25×) | DEBT-1402 | 108 → 7.8 h | 100.2 h (97–103.3) | 41.6 h |
| `grocery` | Scripts at a limited drop (15×) | DEBT-1505 | 150 → 6.1 h | 144 h (142.3–145.6) | 132.2 h |

`test_bot_attacks_are_blocked_only_by_their_fix` checks that only the mitigating debt removes the bots' share of
the traffic, that a fifth of the blocked bots still get through, and that with no time to fix anything nothing is
blocked. `test_replay_day_is_typical_and_consistent` checks the replayed day on four situations: its module states,
failing share, incidents and hours lost agree with its own events; every change happens inside its hour, a cascade
after the failure it comes from; the day is close to the average before and after the fixes; and running it again
gives exactly the same day. `test_live_replay_in_the_terminal` plays `simulate spike --live --side` and checks the
totals it prints.

## 5b. Situations and the run report (added in v3)

The 15 systems have 88 situations of nine kinds. With 40 hours of fixes, on an average day of 300:

| Kind | Situations | Hours lost on an average day: today → after (range of the cut) | Median cut |
|---|---|---|---|
| Rush | 17 | 41% to 89% less | 58% |
| Bots | 11 | 42% to 97% less | 78% |
| Outage | 18 | 17% to 87% less | 73% |
| Bad release | 12 | 65% to 87% less | 74% |
| Database | 15 | 71% to 95% less | 89% |
| Cache | 4 | 85% to 89% less | 86% |
| Memory leak | 1 | 85% to 85% less | 85% |
| Zone lost | 2 | 70% to 89% less | 79% |
| Retry storm | 8 | 80% to 94% less | 88% |
| **All** | **88** | **17% to 97% less** | **78%** |

The smallest cut is ShowPass's payment-gateway outage (32.2 → 26.6 h), which nothing in its debt list guards against on
purpose: its report says so and recommends adding a fix. No situation reaches zero after the fixes; the lowest
average is 3 h.

| Check | Test |
|---|---|
| Every system has its busiest day and at least three other kinds of trouble; each situation is better after the fixes but never a perfect zero; hours by kind add up; the plan contains a fix that guards against the situation whenever the debt list has one | `test_every_system_has_varied_situations_that_the_right_fix_softens` |
| A "down" effect forces its failures; a guarding fix makes it happen on about one day in five; a capacity effect lowers what the module can carry, a ramp gets worse hour by hour, and a fix removes part of the loss, not all of it; an effect on `*` reaches every module | `test_situation_effects_force_failures_and_the_guarding_fix_softens_them` |
| Random faults follow each module's own incident history, a module with no history still has a small chance, and faults rise under load | `test_background_faults_follow_each_modules_history_and_rise_under_load` |
| The report keeps the average and the watched day apart and labels them; its timeline holds every incident of the watched day in order, with recovery times and the situation's own moments; hours by kind add up; it names which guarding fix is in the plan and which others would also help | `test_run_report_says_what_happened_why_and_what_to_do_next` |
| A pack's situations are checked (kind, effects, bots, journey) and share how users come in with the busiest day | `test_pack_situations_are_checked_and_share_how_users_come_in`, `test_pack_validation_checks_bots_and_the_journey` |
| Every situation run is saved with its report; the report reads back the same, downloads as PDF and text, and only the team can read it | `test_every_situation_run_saves_a_report_to_read_and_download` (API) |
| The terminal prints the same report as the website, lists a system's situations, and writes the report to a file | `test_a_situation_ends_with_the_same_report_as_the_website` (terminal) |

## 6. Browser checks

**26 November (v3).** Headless Chrome (Playwright) against the local server: the start page, opening RailYatra and
ParikshaNet, the situation cards, the live replay of Tatkal booking bots side by side, and the report of ParikshaNet's
database failover and of Result-scraping bots. The new labels (“fixed by”, “would also help”, “blocked by”) were checked on both. No page
errors. The replay's tiles were checked against their alerts at 10:06 on the Tatkal bot day: every overloaded module
shows the same load as its alert (219%, 262%, 232%, 157% today; 103% after the fixes). For all 88 situations the
replay length at 1× was computed from the replay's own pacing rules: 20 to 80 seconds.

On the preview deployment (TiDB, MiniLM), in the built-in browser of the Claude desktop app: switching a sandbox to
ParikshaNet (23 s on a cold server), running its database failover (1.5 s), the report with its labels, `report.pdf`
(200, 8.8 KB) and `report.txt` (200), **Reports → Run reports** listing the run, uploading the user guide's example pack
(checked in 0.3 s, opened in 1.5 s, with its three situations) and a broken copy (both problems listed), and the
example's database situation at a 20-hour budget: 23 → 2.4 h, as the user guide says. Choosing a second file while the
first was still being checked was fixed and re-checked: only the newest file's result is shown.

**19 November (v2).** The register → project → incident with 5 Whys → resolution → plan approval → API token → team
→ Developer-cannot-approve flow, the Evaluation page, the playbook card, and the live replay of all 19 events of that
version. No console errors.

## 7. Production check on Vercel (26 November)

https://debtlens-bec.vercel.app, one Vercel Python function in Singapore with TiDB Cloud Starter, after `v3` was
released to `main` (deployment `dpl_G7e6Knj4Xit1sPmrKgPJRZK9pz1u`, commit `a67462d`):

- `GET /api/v1/health?warm=1`: database `tidb` (TiDB v8.5.3), MiniLM downloaded and available.
- The start page shows the 15 systems and the upload card. RailYatra opened in 5.7 s; **Tatkal booking bots** ran in
  2.5 s and replayed day 2 of 300; the report said 183.9 → 106 h on an average day and 71% → 25.2% of requests
  failing, as in this report and the user guide. `report.pdf` → 200, 10.5 KB.
- `POST /api/v1/packs/validate`: a pack with an unknown situation kind is refused with the message the user guide
  quotes; the corrected pack is valid with two situations.
- The evaluation for the four new packs (section 5a) and for RailYatra (P@1 0.93, regression F1 0.90, the same as on
  19 November).
- The previous production deployment (`dpl_GVVr58NDMSpFL1wrtRTShpmYEEYR`) is kept for an instant rollback.

## 8. Not yet covered

- **Load testing of DebtLens itself:** not done. The target is a class demo and small teams, not high traffic.
- **Small labelled sets:** 8 to 20 queries per scenario, labelled by the team. The accuracy figures show the method
  works; they are not a benchmark.
- **The live replay was not played in a browser for every one of the 88 situations** in v3; it was played for a sample,
  and every situation is simulated by the tests.
