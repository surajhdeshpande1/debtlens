# DebtLens user guide: website, terminal, scenario packs and recording

Suraj H Deshpande · checked against DebtLens 2.0.0 on 26 November 2026

## Start here

DebtLens links each production incident to the technical debt that caused it, prices that debt in engineer-hours lost, and shows what a hard day does to a system: a rush of users, bots, an outage, a bad release, a failing database. It plays that day before the fixes and after them, then writes a report of what happened, why, and what to fix first.

On the website, [debtlens-bec.vercel.app](https://debtlens-bec.vercel.app), a run takes four steps:

1. **Pick a system**: a payments platform, an exam portal, an airline and twelve more, or your own scenario pack.
2. **Pick a situation**: each system has four to seven, from its busiest day to an outage or a bad release.
3. **Watch it happen**: the day plays live, as the customer's phone and the on-call engineer's screens see it.
4. **Read the report**: what happened minute by minute, why each part failed, what to fix first and what to do next.

| You want to | Use | Read |
| --- | --- | --- |
| Show a system to judges without installing anything | Website | 1, 4, 7 |
| Log your own incidents and debts | Website | 3 |
| Test a hard day before it happens, and get the report | Website or terminal | 4, 9, 10 |
| Bring your own system as a scenario pack | Website | 5, 6 |
| Work offline, or show the engine in a terminal | Terminal | 8, 9, 10 |
| Keep a backup video of the demo | Either | 11 |

The website needs only a browser. The terminal needs Python on your laptop (section 8). Scenario pack files are opened on the website; the terminal runs the built-in systems by name.

```mermaid
flowchart TB
  W["Website<br/>debtlens-bec.vercel.app"] -->|HTTPS| A["API: Flask /api/v1<br/>one Vercel function, or debtlens serve"]
  P["Your scenario pack (.json)<br/>uploaded on the website"] --> W
  T["Terminal: debtlens"] -.->|API token| A
  A -->|stores data and run reports| D["Database<br/>TiDB online · SQLite or MySQL on a laptop"]
  A --> E["Engine: debtlens.core<br/>similarity · causal graph · ledger · planner · situations · report"]
  T -->|runs it directly| E
```

Both front ends call the same engine, so a situation gives the same numbers and the same report in the browser and in the terminal.

## 1. Open the website

Open [debtlens-bec.vercel.app](https://debtlens-bec.vercel.app) in Chrome, Edge or Firefox. Everything except API tokens works without an account; an account is for keeping your own team's data.

### Run a scenario without an account

1. Under **1 · Pick a system**, press **Open** on any card. Each card shows the system, its industry and the kinds of situation it can run (Rush, Bots, Outage, Bad release and so on).
2. DebtLens opens a private copy of that system for you and takes you straight to **Pick a situation**. The first request after a quiet spell can take up to 20 seconds while the server wakes; the button says **Opening…** meanwhile.
3. You play the system's Tech Lead, a named person from its story. Change the role in the top bar at any time.

**Take the 3-minute tour** at the top of the start page opens the first system and walks through every page.

This copy is yours: change anything you like, nobody else sees it, and it expires 24 hours after you open it.

### The top bar

| Part | What it does |
| --- | --- |
| **DebtLens** | Back to the start page |
| System name | The system you are working in |
| **Overview · Incidents · Debt · Simulate · Reports** | The five pages (section 2) |
| **as** *role* | Play the system as another role (sandbox): Admin, Tech Lead, Developer, QA Engineer, Manager or Viewer |
| **⚙** | **Team & settings**, **Terminal guide**, **▶ Guided tour**, **Reset this sandbox** (puts back the original data; the browser asks first) and **Exit to the start page** |

To run another system, use **Simulate → Run a scenario → 1 Pick a system**, or exit to the start page and open another card.

### Create a team account

1. At the bottom of the start page, under **Using DebtLens with your team?**, open **Create a team**. Enter your name, the team or organisation, your email and a password of at least 8 characters, then press **Create team**. You become the team's admin.
2. On the Projects page, under **New project**, choose **Start from**: an empty project, an industry scenario or a scenario pack. Give it a name, add a repository URL if you have one, and press **Create project**.
3. Add teammates and API tokens under **⚙ → Team & settings**.

Next time, use **Sign in** at the top right of the start page. The top bar then shows your name and role, a project switcher once you have more than one project, and **⚙** with **All projects** and **Sign out**.

### Roles

Every role can read every page and run every simulation. The server checks the role on each request, so a blocked action shows a message such as “your role (Viewer) cannot do this — needs 'debt.write'”.

| Role | What it can change |
| --- | --- |
| Admin | Everything, including creating projects |
| Tech Lead | Incidents, 5 Whys, imports, debt items, priorities, plan approval, repository evidence, modules and settings |
| Developer | Incidents, 5 Whys, imports, debt items, repository evidence |
| QA Engineer | Incidents, 5 Whys, imports |
| Manager | Plan approval |
| Viewer | Nothing: read only |

Each role also gets its own Overview page. For a demo, play the Tech Lead: it can do everything in this guide except create projects and manage team members, which need the Admin.

## 2. The five pages

Every project, sandbox or real, has the same five pages. A page with more than one part shows tabs under the top bar.

| Page | Tabs | What you see and do |
| --- | --- | --- |
| **Overview** | — | Your role's view. A Tech Lead sees the key numbers, the highest-risk debt, a 40-hour sprint plan preview, systemic root causes and incidents per month. **Run a scenario** and **Report incident** are at the top, and the last run report is one click away |
| **Incidents** | **Incidents** | Every incident with module, severity, status, 5 Whys and linked debt. Filter, **Export CSV**, **Import**, **Report incident**; open one to edit it, run 5 Whys or record the fix |
| | **Root causes** | The causal graph: each 5 Whys answer is a cause, with arrows from a symptom to the deeper cause. Switch the layout, click a cause to see its incidents and debt, **Edit** or **Merge…** causes |
| | **Similar & regressions** | **Knowledge search** (past incidents in plain words), **Similar incidents**, **Regressions** (tune the threshold τ) and **Evaluation (measured)**: the accuracy of each method on labelled incidents |
| **Debt** | **Debt items** | Each debt item with principal, interest per month, risk, break-even and linked incidents. **Fix playbooks**, **Export ledger CSV**, **Add debt**; on an item, change its status, tick playbook steps or pick another playbook |
| | **Plan & ledger** | Interest by category and module, the full ledger, and the **Sprint planner**: effort budget, method, categories, must-include items; **Approve as sprint plan** |
| | **Code evidence** | **Hotspots** (churn × complexity), **TODO / FIXME**, **Dependency graph** and **Import data**; **Mine a GitHub repo** |
| **Simulate** | **Run a scenario** | The four steps: pick a system, pick a situation, watch it happen, read the report (section 4) |
| | **Sprint forecast** | Many possible next sprints: how much each policy for paying down debt saves, with a 95% confidence interval |
| | **Failure injection** | Fail one module on purpose and see which modules go down with it; **Raise a drill incident** |
| | **What-if costs** | Change what an hour of work or an incident costs and see which debt items move past break-even |
| | **Compare industries** | The same engine on every industry system, side by side |
| **Reports** | **Run reports** | Every situation you ran in this project, each with its full report and PDF |
| | **Lessons & exports** | Lessons learned from fixed incidents, the activity log, **Download PDF** (project report), CSV and JSON exports, **Run gate now** (CI quality gate) and a GitHub Actions workflow to copy |

**⚙ → Team & settings** holds project settings, the roles table, team members and API tokens. **⚙ → Terminal guide** is a short guide to the terminal version. The small line at the bottom of Overview says which similarity engine is running: “MiniLM sentence embeddings + TF-IDF (hybrid)” is the normal case.

## 3. Record your own incidents and debts on the website

Report the incident first, then add the debt behind it, then link the two: the debt's price is computed from those links. You need a role that can write (Admin, Tech Lead, Developer or QA; debt needs Admin, Tech Lead or Developer).

### Report an incident

1. Press **Report incident** on Overview, or open **Incidents** and press it there.
2. Fill **What failed?** in one line, at least 5 characters, for example “Checkout times out when the card network is slow”.
3. Pick the **Module** and **Severity** (High is preselected), set **Effort so far (hours)** and add a **Description**: error messages, impact, what the logs showed.
4. Watch the card **Has this happened before?** on the right. As you type, it gives a verdict with the closest matches and their fixes:
   - **Duplicate**: an open incident looks the same, so consider adding to it instead.
   - **Regression**: a very similar incident in the same module was resolved before.
   - **Related**: similar incidents exist, and their fixes may help.
   - **New**: nothing similar was found.
5. Optionally fill the **5 Whys**, from W1 (the symptom) to W5 (the root cause). Answers that match an existing cause merge into the same node of the causal graph.
6. Press **Report incident**. You get a key such as INC-126 and its page opens.

### Work on an incident

- **Status**: the dropdown at the top moves it through open, investigating and resolved.
- **Run 5 Whys** (or **Edit 5 Whys**), then **Save chain**. A message says how many answers converged onto existing causes.
- **Record fix**: write what fixed it, the lesson learned and the effort, then **Mark resolved**. The fix becomes searchable in Knowledge search.
- **New debt from this**: opens the debt form with this incident and module already filled in.

### Add a debt item

1. Open **Debt → Debt items** and press **Add debt**, or use **New debt from this** on an incident.
2. Fill **Title** (the weakness, for example “Separate connection pools for API and batch jobs”), **Module**, **Category**, **Principal (hours to fix)**, and optionally **Priority** (Tech Lead or Admin), **File**, **Assignee** and **Description**.
3. Select the **Incidents it caused** (Ctrl-click for several), any debt that **Must be fixed first**, and its **Root cause** from the causal graph.
4. Press **Add debt**. Its page shows the price: principal, interest per month, break-even and a risk score from 0 to 120, with the interest split into incident cost, churn pressure and blast radius.
5. Below the price is the **Fix playbook** matched to the item. Tick steps as they are done, or choose another playbook from the dropdown. The playbook also decides how much the fix helps in a situation run.
6. When it is fixed, set the status to **Remediated**: “Paid off — interest stops accruing”.

### Bring in data you already have

- **Debt → Code evidence → Import data** takes application logs (**Preview**, then **Create incidents**), a CSV or JSON backlog from Jira, ServiceNow or PagerDuty (columns like `id,summary,component,priority,status,created`), or GitHub Issues by repository, labels and state.
- **Debt → Code evidence → Mine a GitHub repo** reads a public repository: give its URL and the number of commits, then **Start mining**.
- On the **TODO / FIXME** tab, **→ debt** turns a marker in the code into a debt item.
- From the terminal: `debtlens scan . --push`, `debtlens ingest app.log --push` and `debtlens import backlog.csv --commit` (section 9).

In a sandbox all of this works but is deleted after 24 hours. In a team project it stays.

## 4. Run a scenario: situations, the live day and the report

Open **Simulate → Run a scenario** (or press **Run a scenario** on Overview). The four steps sit at the top of the page; a finished step can be clicked to go back to it.

### Step 1: Pick a system

The current system is marked **Open now**. **Use this** on another card switches your sandbox to that system; your changes to the old one are discarded. The last card, **Upload a scenario pack**, opens your own pack file (section 5). In a team account this step lists your team's projects instead.

### Step 2: Pick a situation

Each card is one situation: its kind, name, what happens, when traffic peaks, **What goes wrong** (the situation's own trouble, with the module, time and length) and the debt item that guards against it.

| Kind | What happens | What the right fix does |
| --- | --- | --- |
| Rush | Many more real users than a normal busy hour | More capacity: a cache, a queue, a separate pool |
| Bots | Scripts add most of the extra traffic | Blocks most of them; a fifth adapt and get through, and turning bots away still costs the front door a little |
| Outage | Something the system depends on stops answering: a bank, an SMS provider, a gateway | A fallback or second provider: it still happens on about one day in five, and costs far less |
| Bad release | A release breaks one part of the system | Tests, a canary or a staged rollout stop it early on most days |
| Database | A failover, a batch job or a report starves the database | Separate pools, a replica, retries: cuts most of the loss, not all |
| Cache | A whole cache expires at once and everything recomputes | Refreshing ahead and precomputing cuts most of the loss |
| Memory leak | A service gets a little slower every hour | Releasing the resource: the slowdown mostly goes |
| Zone lost | One of two data-centre zones goes down | Running in both zones halves the loss instead of stopping the service |
| Retry storm | Failed work is retried again and again, piling up load | Backoff, batching or resuming cuts the extra load |

Above the cards, set **Hours you can spend on fixes before the day** (40 by default) and **Simulated days** (300 recommended; 100 is faster, 600 smoother). **Make your own rush**, the last card, takes a peak (times a normal busy hour), a start hour and a length. Press **Run this day →**.

### Step 3: Watch it happen

DebtLens simulates the day as many times as you chose, once with today's open debt and once after the best fixes that fit in your hours, with the same luck both times. This takes a second or two. The live replay then opens by itself on the intro screen: press **▶ Start the day** (section 7 explains the screen).

When the day ends, the summary has **▶ Same day, after the fixes**, **Side by side**, **↺ Replay** and **Read the report →**. Closing the replay (✕ or Esc) leaves you on step 3, which shows the average day today and after the fixes, with **▶ Watch the day** and **Read the report →**.

### Step 4: Read the report

The report says what happened and what to do about it. It is saved with the run, so it is also under **Reports → Run reports**, and it downloads as a PDF (**⬇ PDF**) or plain text (**⬇ Text**). **Print** prints it without the menus.

| Part | What it tells you |
| --- | --- |
| Headline | The day in one sentence: hours lost, requests failing, the fixes and how much they save |
| Five numbers | Engineering hours lost, requests failing, incidents a day and days with no incident, each today → after the fixes; then the hours the fixes save, with a 95% confidence interval |
| Summary | The situation, when traffic peaks, the average day before and after, what is left, and which day the replay shows |
| What happened on the day you watched | Two timelines, today and after the fixes: every incident with its start, recovery, kind, severity and hours, and the situation's own moments (it starts, it is over, a fix prevented it) |
| Hours lost by kind of incident | Overloads, knock-on failures, outages, bad releases and random faults, today and after |
| What the situation did | Each of its effects, the debt that guards against it, and what the fix changed |
| Why it failed | For each module that failed: how often, how loaded it was, which open debt took its capacity, what it depends on, and why it is safer after the fixes |
| What to fix first | The fixes in order, with hours, what each protects on this day and its playbook; and how the regular sprint plan compares |
| What to do next | Concrete next steps: the order of work, what guards a situation but did not fit, modules still at risk and the next fix there, and random faults |
| How this was worked out | The method and the model settings, so every number can be checked |

### Two kinds of number

Every number in the report says which of two views it belongs to:

- **The average day**: the mean over all the simulated days. This is the expected outcome; plan with it.
- **The day you watched**: one simulated day, picked because it is close to the average, which the replay plays. It differs a little from the average, the way any real day does.

Numbers never drop to a perfect zero after the fixes: each module also fails now and then at random, at the rate of its own past incidents, and a guarded situation still happens on some days. For PayCore's acquiring-bank outage with 40 hours, the average day costs 38.9 engineer hours today and 10.4 h after fixing DEBT-104 (a circuit breaker and a backup acquirer); the day the replay shows costs 42.4 h and 10 h.

### Plan the sprint

1. Open **Debt → Plan & ledger** and find **Sprint planner**.
2. Drag **Effort budget** (4 to 200 hours; 40 by default).
3. Leave **Method** on “Exact (auto: tree DP / branch & bound)”, or pick Greedy or v1 naive DP to compare.
4. Optionally limit **Only categories** or add items under **Must include**.
5. Read the plan: the items chosen, the interest they retire per month, and how much better it is than greedy and v1.
6. **Approve as sprint plan** (Manager, Tech Lead or Admin) saves it, and its items become Prioritized.

The sprint plan ranks debt by its monthly cost. A situation run plans for one day instead, which is why a run's report compares the two.

### The other Simulate tabs

| Tab | Set | Press | You get |
| --- | --- | --- | --- |
| Sprint forecast | Budget per sprint, sprints, Monte Carlo runs, new debt per sprint, incident rate, seed | **Run forecast** | Cumulative incident hours with a p10–p90 band, open debt per sprint, and a paired comparison of policies with 95% confidence intervals |
| Failure injection | The module to fail, spread probability p (0.35), runs (3,000) | **Inject failure**; **Raise a drill incident** | The chance each dependent module fails, the worst case, and the debt on the failure paths |
| What-if costs | The cost assumptions (λ weights) | **Save as project settings** or **Reset to project values** | The value of the optimal plan at each budget, and the items whose rank or break-even changed |
| Compare industries | Nothing | **Open as sandbox**, **Switch sandbox to** or **Add as project** | The industry systems side by side: interest against principal, and hours saved by the optimal plan over 8 sprints |

## 5. Scenario packs: download, edit and upload

A scenario pack is one JSON file that holds a whole system: modules, incidents with 5 Whys, debt, its busiest day and its other situations. DebtLens computes every page and run from it, as it does for a real project. Pack files are opened on the website only.

### The built-in systems and their situations

Four industry scenarios and eleven packs come built in. The key in backticks is the situation's name in the terminal (`-e`).

| Code | System | Busiest day | Other situations (`-e` key, kind) |
| --- | --- | --- | --- |
| `fintech` | PayCore, FinTech | Salary day, 4× at 09:00 | `acquirer-outage` outage; `batch-overrun` database; `upi-slowdown` outage; `replica-lag` database; `key-rotation` bad release |
| `healthtech` | CareStream HIS, HealthTech | Monday morning OPD rush, 3.5× at 09:00 | `sms-outage` outage; `hl7-restart` outage; `vitals-growth` database; `lab-release` bad release |
| `ecommerce` | ShopSwift, e-commerce & logistics | Diwali sale, 8× at 20:00 | `search-reindex` database; `price-lock` database; `coupon-change` bad release; `event-replay` retry storm |
| `college` | CampusOne ERP, education | Exam results day, 12× at 10:00 | `otp-outage` outage; `fee-deadline` retry storm; `attendance-sync` database; `grading-release` bad release |
| `tatkal` | RailYatra, railways & ticketing | Tatkal opening at 10 AM, 25× at 10:00 | `tatkal-bots` bots; `bank-hang` outage; `otp-throttle` outage; `chart-rush` database; `slow-release` bad release |
| `broker` | NiveshTrade, stock broking | Union Budget day, 12× at 11:00 | `credential-stuffing` bots; `exchange-line` outage; `volatile-open` retry storm; `contract-notes` database; `margin-release` bad release |
| `food` | ZaikaNow, food delivery | IPL final night, 9× at 21:00 | `coupon-bots` bots; `tablet-reconnect` retry storm; `rain-polling` retry storm; `menu-cache` cache |
| `stream` | KhelStream, sports streaming (OTT) | World Cup final, 20× at 21:00 | `restream-bots` bots; `licence-outage` outage; `ad-server` outage; `toss-entitlements` cache; `billing-batch` database |
| `rides` | SawariGo, ride-hailing | New Year's Eve, 8× at 23:00 | `fare-scrapers` bots; `rain-locations` database; `sms-outage` outage; `matching-release` bad release |
| `taxfiling` | TaxSetu, government e-services | ITR deadline night (31 July), 15× at 22:00 | `pan-login-bots` bots; `otp-outage` outage; `reminder-blast` retry storm; `refund-batch` database; `rules-release` bad release |
| `tickets` | ShowPass, event ticketing | Stadium tour on-sale at noon, 30× at 12:00 | `scalper-bots` bots; `email-outage` outage; `hot-section` database; `zone-outage` zone lost; `payment-gateway` outage |
| `exam` | ParikshaNet, online examinations | Entrance exam day, 30× at 09:00 | `result-scrapers` bots; `proctor-leak` memory leak; `otp-delay` outage; `db-failover` database; `paper-release` bad release |
| `airline` | UdanAir, airline booking & check-in | Fare sale at noon, 20× at 12:00 | `seat-spinning` bots; `fog-rebooking` rush; `gds-outage` outage; `fare-stampede` cache; `checkin-rush` rush; `payment-release` bad release |
| `appointments` | SlotSetu, government appointments | New slots open at 17:00, 25× at 17:00 | `tout-scripts` bots; `ekyc-outage` outage; `mis-overrun` database; `upload-retries` retry storm; `zone-power` zone lost; `allocation-release` bad release |
| `grocery` | TurantMart, quick commerce | Diwali evening, 10× at 19:00 | `drop-scripts` bots; `upi-outage` outage; `inventory-sync` database; `rain-surge` retry storm; `offer-flush` cache; `app-release` bad release |

A few situations have nothing in the debt list that guards against them on purpose (KhelStream's `ad-server`, ShowPass's `zone-outage` and `payment-gateway`): their reports show what the fixes can and cannot do, and recommend adding a debt item.

### Download a pack

On the start page, or in **Pick a system**, press **pack file** on a pack's card. The browser saves it as, for example, `tatkal.debtlens-pack.json`.

### Edit a pack

1. Open the file in a text editor. VS Code is free and underlines JSON mistakes in red; Notepad also works.
2. Change what you need. Good live edits: rename the system (`name`), raise the busiest day (`spike.profile`), add an incident, add a situation to `events`, or change a customer step in `journey`.
3. Keep the JSON valid: double quotes around every text, a comma between items, none after the last one.
4. Save it as UTF-8 with a `.json` ending.

Section 6 explains every field.

### Upload a pack

1. On the start page, find the last card under **1 · Pick a system**: **Upload a scenario pack**. Inside a sandbox, the same card is in **Simulate → Run a scenario → 1 Pick a system**.
2. Press **Choose or drop a .json file**, or drag the file onto it. The limit is 400 KB.
3. DebtLens checks the whole file at once. If it is valid, the card shows its name, counts and number of situations, and **Open pack** becomes active.
4. Press **Open pack**. It opens as a private 24-hour sandbox on **Pick a situation**. **⚙ → Reset this sandbox** returns to the file you uploaded.

An uploaded pack is never stored as a team project, so keep the file and upload it again whenever you need it.

### When the upload is refused

The card lists every problem at once (the first 12, then “…and N more”), so you can fix the file in one pass.

| What it says | Fix |
| --- | --- |
| “*file* is not valid JSON” | A missing comma, an extra comma before `]` or `}`, or single quotes. VS Code underlines the place |
| “*file* is larger than 400 KB” | Remove incidents or files, or shorten descriptions |
| “module 'order' is not listed in modules” | Add the module to `modules`, or fix its spelling where it is used |
| “'mitigated\_by' names unknown debt DEBT-9” | Every key used in an incident list, `needs`, `mitigated_by` or `tour` must exist |
| “incident INC-1: 'fixed' is required” | A resolved incident needs `fixed` (days ago), no larger than its `ago` |
| “'kind' must be one of …” | A situation's `kind` is traffic, bots, outage, deploy, database, cache, leak, zone or retry |
| “effects[1]: 'start' must be between 0 and 23” | An effect needs a start hour, a module (or `*` for every module) and a `label` |
| “'cat' must be one of …” | Use one of the values the message lists; section 6 has them all |

“Opens fine. Notes:” is only a warning: the pack opens, and the notes say what DebtLens fixed or ignored.

## 6. Write your own scenario pack

The quickest way is to download a built-in pack and change it. To start from nothing, copy the small pack below: it is valid as it stands and opens on the website.

```json
{
  "format": "debtlens-pack/1",
  "code": "bec-canteen",
  "name": "BEC Canteen",
  "key": "BCN",
  "industry": "Campus food ordering",
  "tagline": "Pre-order lunch before the 12:30 break",
  "summary": "Students pre-order lunch on their phones; at 12:30 the whole campus orders at once.",
  "people": {
    "ravi": {"name": "Ravi Kulkarni", "role": "tech_lead", "title": "Tech lead"},
    "asha": {"name": "Asha Rao", "role": "developer", "title": "Backend developer"}
  },
  "modules": [
    {"name": "app", "path": "web/app", "description": "Phone app front door", "churn": 20, "complexity": 40, "loc": 1200, "files": 4, "owner": "asha"},
    {"name": "orders", "path": "svc/orders", "description": "Takes and confirms orders", "churn": 35, "complexity": 120, "loc": 3000, "files": 8, "owner": "asha"},
    {"name": "db", "path": "infra/db", "description": "The one shared database", "churn": 10, "complexity": 30, "loc": 600, "files": 2, "owner": "ravi"}
  ],
  "dependencies": [["app", "orders"], ["orders", "db"]],
  "incidents": [
    {"key": "INC-1", "title": "Orders time out at the 12:30 break", "desc": "Most orders failed for ten minutes.", "module": "orders",
     "sev": "HIGH", "status": "RESOLVED", "ago": 40, "fixed": 39, "effort": 6, "by": "asha", "group": "G-POOL",
     "whys": ["Orders timed out", "Every order waited for a database connection", "Orders and reports share one small connection pool"],
     "fix": "Restarted the service.", "lesson": "A restart hides the shared pool."},
    {"key": "INC-2", "title": "Order page hangs during the lunch rush", "desc": "The same timeouts came back.", "module": "orders",
     "sev": "HIGH", "status": "OPEN", "ago": 5, "effort": 4, "by": "asha", "group": "G-POOL",
     "whys": ["The order page hung", "Requests waited for a database connection", "Orders and reports share one small connection pool"]}
  ],
  "debts": [
    {"key": "DEBT-1", "title": "Separate connection pools for orders and reports", "desc": "Give orders their own pool so reports cannot starve it.",
     "module": "orders", "cat": "ARCHITECTURAL", "principal": 8, "status": "IDENTIFIED", "priority": "HIGH", "owner": "asha",
     "incidents": ["INC-1", "INC-2"], "cause": "Orders and reports share one small connection pool", "ago": 30},
    {"key": "DEBT-2", "title": "Rate limit orders per student", "desc": "A per-account rate limit at the front door.",
     "module": "app", "cat": "SECURITY_DEBT", "principal": 4, "status": "IDENTIFIED", "priority": "MEDIUM", "owner": "ravi",
     "incidents": [], "ago": 10}
  ],
  "spike": {"key": "lunch-rush", "name": "Lunch break at 12:30", "kind": "traffic", "description": "Everyone orders in the same ten minutes.",
            "peak": 12, "start_hour": 12, "duration": 1,
            "entry": {"app": 1.0, "orders": 1.0}, "baseline": {"app": 0.06, "orders": 0.07, "db": 0.06}},
  "events": [
    {"key": "lunch-bots", "name": "Order-spamming bots", "kind": "bots", "description": "A script places fake orders to grab the last thalis.",
     "peak": 30, "start_hour": 12, "duration": 1, "entry": {"app": 1.0, "orders": 1.0},
     "bots": {"share": 0.85, "blocked": 0.9, "mitigated_by": ["DEBT-2"]}},
    {"key": "pool-leak", "name": "Reports hold the database", "kind": "database",
     "description": "At 12:20 the daily sales report starts on the same database and holds its connections until 13:00.",
     "peak": 10, "start_hour": 12, "duration": 1,
     "effects": [{"type": "capacity", "module": "db", "start": 12, "minute": 20, "hours": 1, "factor": 0.3,
                  "mitigated_by": ["DEBT-1"], "mitigation": 0.6, "label": "The sales report holds the database's connections",
                  "recovered": "The report finishes"}]}
  ],
  "journey": {"app": "BEC Canteen", "who": "Sneha, ordering lunch at 12:30", "peak_rpm": 3000, "color": "#0f766e",
    "steps": [
      {"module": "app", "label": "Open the canteen app", "ok": "Menu loaded", "slow": "Loading the menu...", "fail": "Server busy. Try again."},
      {"module": "orders", "label": "Order one veg thali", "ok": "Order placed", "slow": "Placing your order...", "fail": "Order failed. Please try again."}
    ]},
  "tour": {"incident": "INC-2", "debt": "DEBT-1", "module": "orders", "budget": 20, "cascade_module": "db",
           "headline": "The lunch rush keeps timing out because orders share a pool with reports."}
}
```

With 20 hours to prepare, the average of 300 simulated days is: the lunch rush, 19 engineer hours lost today and 4 h after fixing both debt items; the bots, 41.7 h and 11.1 h; the database situation, 23 h and 2.4 h after fixing DEBT-1 alone.

### What each part does

| Field | What it is | Rules |
| --- | --- | --- |
| `code`, `name`, `key` | Pack id, display name, project key | `name` is required. `code`: 2 to 24 of a–z, 0–9 and `-`. `key`: up to 8 letters or digits |
| `people` | One entry per person, by short id | `role`: admin, tech\_lead, developer, qa, manager or viewer |
| `modules` | The parts of the system, with size and change numbers | Every module used anywhere else must be listed here |
| `dependencies` | Who calls whom | `[caller, callee]` pairs |
| `files`, `satd` | Optional file metrics and TODO/FIXME markers | `files`: path, module, churn, complexity, lines, lines changed, authors. `satd`: path, line, marker, text |
| `incidents` | Past failures with their 5 Whys | `sev`: CRITICAL, HIGH, MEDIUM or LOW. `status`: OPEN, INVESTIGATING or RESOLVED (resolved needs `fixed`). Up to 7 whys. `ago` and `fixed` are days ago |
| `debts` | The weaknesses and their links | `cat`: ARCHITECTURAL, CODE\_SMELL, TEST\_DEBT, INFRASTRUCTURE, SECURITY\_DEBT or DOCUMENTATION. `status`: IDENTIFIED, PRIORITIZED, IN\_PROGRESS, DEFERRED or REMEDIATED. `needs` lists prerequisites. `playbook` is optional |
| `spike` | The busiest day | Either `profile` (24 hourly multipliers of a normal peak hour) or `peak`, `start_hour` and `duration`. `kind`: usually traffic. `entry`: where users come in, 0 to 1. `baseline`: load at a normal peak hour (default 0.15) |
| `events` | Up to 7 more situations, shaped like `spike` | `kind`: traffic, bots, outage, deploy, database, cache, leak, zone or retry. Without `entry`, users come in as on the busiest day. Add `bots` for a bot attack: the `share` of the extra traffic that is bots, the share `blocked` once a debt in `mitigated_by` is fixed |
| `effects` (in a situation) | Up to 4 things that go wrong that day | `type`: `down` (the module stops; `chance` 0 to 1 that it happens, `kind` outage or deploy) or `capacity` (the module keeps `factor` of its capacity; `ramp: true` makes it worse hour by hour, as a leak). `module` (or `*` for all), `start` hour, `minute`, `hours`, a `label`; `mitigated_by` debts and how much they help (`mitigation`, 0.8 by default); optional `prevented` and `recovered` texts for the replay |
| `journey` | The customer's phone in the live replay | 1 to 8 steps, each with `module`, `label`, `ok`, `slow` and `fail` texts. `peak_rpm`: requests per minute at a normal peak hour |
| `tour` | The guided tour's story | Its incident, debt and module must exist |

Limits: 400 KB, 40 modules, 300 dependencies, 300 files, 300 markers, 300 incidents, 150 debt items, 20 people, 7 whys per incident, 7 extra situations and 4 effects per situation.

### Tips for a pack that tells a good story

- Give repeated incidents the same `group`, and end their 5 Whys with exactly the same root-cause sentence. Use that sentence as the debt's `cause`. The causal graph then shows one systemic cause.
- A family member reported after an earlier one was resolved, in the same module, is flagged as a regression by itself.
- The debt title picks its fix playbook (“connection pool”, “rate limit”, “timeout”, “circuit breaker”, “queue”, “cache”, “memory leak”, “regression tests”…), and the playbook decides how much the fix helps. After uploading, **Debt → Debt items → Fix playbooks** shows which playbook each item got.
- Give each situation one clear guard in `mitigated_by`, so the report can say what fixes it. A situation with no guard is fine too: its report recommends adding one.
- For a module that should overload on the busiest day but hold after its fix, a good `baseline` is about 0.82 ÷ (1 + (peak − 1) × exposure).

The full reference is `docs/PACKS.md` in the repository.

## 7. The live replay

The live replay plays the day you watch minute by minute: a customer's phone on the left, the on-call engineer's screens on the right, today and after the fixes. It is drawn, not real: no extra requests reach the server and your laptop never actually hangs.

### Start it

1. Run a situation (section 4). The replay opens by itself on its intro screen.
2. Press **▶ Start the day**, or **Side by side**. The day starts two hours before the traffic builds.
3. Press **F** for full screen before the judges look.

To watch again later: **▶ Watch the day** on step 3 or on any report. For an older report this re-runs the same simulation with the same seed, so it is exactly the same day.

### What you see

- **The phone** (“What Priya sees” on RailYatra; every system has its own customer): the customer goes through the app step by step. A step near its module's limit is slow; when the module is down, the customer sees the app's own error message and tries again (“Attempt 2”, “Attempt 3”). When the way in is down, the app freezes with “*app* isn't responding”.
- **The engineer's numbers**: requests per minute, failing right now, requests failed today, engineer hours lost and incidents.
- **Module tiles**: each module's load and state: OK, HOT, DOWN (overloaded), OUTAGE (what it depends on outside is down), BAD RELEASE, CRASHED (a random fault), or FAILING because a module it depends on is down.
- **Alerts**: the situation's own moments (“⚠ The main acquiring bank stops answering authorisations.”, and when it is over), overloads, outages, bad releases, crashes and knock-on failures as they fire, with the hours each one costs. After the fixes, a prevented situation shows in green (“✓ The circuit breaker tripped in 20 seconds…”).
- **The bot bar** (bot attacks only): how much of the traffic is bots right now, and after the fixes, how much is blocked at the edge.
- **The traffic strip** across the top: traffic over the day and the share of requests failing.

### The frozen device

While half or more of the requests fail, or the way in is down, the screen acts like a hung laptop: it stops updating for a moment, turns pale, the title shows “(Not Responding)”, the cursor becomes a wait cursor, and then it catches up all at once. Pause, close and Esc always work. Turn the effect off with **Freeze effects** (or E) if you prefer a calm replay.

### The three views

| View | Button | Key | Shows |
| --- | --- | --- | --- |
| Today | **Today** | 1 | The day with today's open debt |
| After the fixes | **After the fixes** | 2 | The same day, same customers and same luck, with the plan in place |
| Side by side | **Side by side** | 3 | Both lanes at once, with the alerts under each |

When the day ends, a summary shows the engineer hours lost and incidents, with **▶ Same day, after the fixes** (or **▶ Today again**), **Side by side**, **↺ Replay** and **Read the report →**.

### Keys and buttons

| Key | Button | Does |
| --- | --- | --- |
| Space | ▶ | Play or pause |
| R | ↺ | Restart the day |
| 1, 2, 3 | Today, After the fixes, Side by side | Change the view |
| S | 1× | Speed: ½×, 1×, 2×, 4× |
| E | Freeze effects | Frozen-device effect on or off |
| M | Sound off | Sound on or off (off at the start) |
| F | ⛶ | Full screen |
| Esc | ✕ | Close the replay |

At 1× a replay lasts 20 to 80 seconds: busy hours play slowly, quiet hours quickly. The replay pauses itself while its browser tab is hidden or minimised.

For RailYatra's Tatkal booking bots with 40 hours, the day the replay shows costs 185.4 engineer hours today and 104 h after the fixes, because DEBT-508 blocks most of the bots at the edge; the average day is 183.9 h and 106 h.

## 8. Install the terminal version

Install it from the GitHub repository: DebtLens is not on PyPI yet. You need Python 3.10 or newer, on Windows, macOS or Linux.

### Windows

1. Install Python 3.12 from python.org and tick **Add python.exe to PATH** on the first screen. Install Git for Windows, or download the code as a ZIP from the GitHub page (**Code → Download ZIP**) and unzip it.
2. Open **Command Prompt** and run:

```bat
git clone https://github.com/surajhdeshpande1/debtlens
cd debtlens
scripts\windows\setup.bat
```

`setup.bat` makes a virtual environment (`.venv`), installs everything, prepares a MySQL database if MySQL 8 is installed (it asks for the MySQL root password; without MySQL, ignore that step) and downloads the MiniLM model (23 MB) once.

3. In every new Command Prompt window, start with:

```bat
cd debtlens
.venv\Scripts\activate
python -m debtlens --version
```

It prints `DebtLens 2.0.0`.

4. For the short `debtlens` command, which looks better in a demo, build and install the package once:

```bat
pip install build
python scripts\build_package.py
pip install --force-reinstall --no-deps dist\debtlens-2.0.0-py3-none-any.whl
debtlens --version
```

Repeat step 4 whenever you pull new code. Until you do it, type `python -m debtlens` wherever this guide says `debtlens`: they are the same program.

### macOS or Linux

```bash
git clone https://github.com/surajhdeshpande1/debtlens
cd debtlens
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt "typer>=0.12" "rich>=13" "waitress>=3.0"
python -m debtlens model download
```

Then follow step 4 above, with `/` in place of `\`.

### Run the website on your own laptop

Use this when there is no internet, or as a backup in the viva. You get the same website as on Vercel.

| You have | Start it with |
| --- | --- |
| No MySQL | `scripts\windows\start-sqlite.bat`, or `debtlens serve` on any system |
| MySQL 8, after `setup.bat` | `scripts\windows\start.bat`, or `debtlens serve --db mysql+pymysql://debtlens:debtlens@localhost:3306/debtlens` |

Open http://localhost:8000; the `.bat` files open it for you. **Ctrl+C** stops the server. If port 8000 is busy, add `--port 8080`. `docs/LOCAL_SETUP.md` in the repository has the MySQL details.

### Connect the terminal to the website (optional)

Without any account, the terminal works on the 15 built-in systems and your own repository. To work on a team project instead:

1. Sign in to the website with a team account (a sandbox cannot make tokens). Open **⚙ → Team & settings → API tokens**, type a name such as “my laptop” and press **Create token**.
2. Copy the line it shows, which appears only once: `debtlens login https://debtlens-bec.vercel.app --token dlt_…`. Run it in the terminal.
3. Run `debtlens projects`, then `debtlens use 3` to make project 3 the default. Commands without `-s` now work on that project, and situation runs are saved with their reports under **Reports → Run reports**.
4. `debtlens whoami` shows who you are signed in as, and `debtlens logout` forgets the token.

You can also run `debtlens login https://debtlens-bec.vercel.app --email you@example.com`: it asks for your password and creates the token itself.

## 9. Every terminal command, with examples

Most commands read one source: `-s` with a built-in system (`fintech`, `healthtech`, `ecommerce`, `college`, `self`, or a pack code from `tatkal` to `grocery`); `--snapshot` with a snapshot file; or `-p` with a website project after `debtlens login`. With none of these and no login, they use `fintech`. Add `--json` for machine-readable output and `--help` to any command for its options. A pack file given to `-s` is refused with a pointer to the website, where pack files are opened.

### Look at a system

| Command | What it does | Example |
| --- | --- | --- |
| `scenarios` | The 5 industry scenarios and 11 packs | `debtlens scenarios` |
| `pack list` | The 11 packs and their busiest day | `debtlens pack list` |
| `pack show CODE` | What a pack contains: modules, incidents, debt and its situations | `debtlens pack show grocery` |
| `demo [code]` | The dashboard of a system | `debtlens demo tatkal` |
| `dashboard` | KPIs, highest-risk debt, systemic causes, regressions | `debtlens dashboard -s broker` |
| `incidents list` | Incidents, newest first (`--status`, `-n`) | `debtlens incidents list -s tatkal -n 10` |
| `incidents show KEY` | One incident: 5 Whys, fix, similar incidents | `debtlens incidents show INC-519 -s tatkal` |
| `similar "text"` | Has this happened before, and what fixed it? | `debtlens similar "OTP SMS not arriving" -s tatkal` |
| `debt` | Debt items with principal, interest, risk, break-even (`--all` adds paid-off items) | `debtlens debt -s rides` |
| `ledger` | Totals by module and category | `debtlens ledger -s food` |
| `playbook KEY` | Fix steps for one debt item, how to verify it, what can go wrong | `debtlens playbook DEBT-508 -s tatkal` |
| `playbooks` | Which playbook each debt item uses, and why | `debtlens playbooks -s exam` |

### Run a situation

| Command | What it does | Example |
| --- | --- | --- |
| `simulate spike --list` | The situations a system can run | `debtlens simulate spike -s tatkal --list` |
| `simulate spike` | A situation: before and after the fixes, what to fix first, the modules under pressure (`-e`, `--budget`, `--runs`, `--seed`) | `debtlens simulate spike -s tatkal --budget 60` |
| `simulate spike --report` | The full report, the same as the website's (`-o file.txt` also writes it to a file) | `debtlens simulate spike -s fintech -e acquirer-outage --report -o report.txt` |
| `simulate spike --live` | The live replay, then the report (section 10) | `debtlens simulate spike -s tatkal -e tatkal-bots --live --side` |
| `simulate spike --peak P --start H --hours N` | Your own rush | `debtlens simulate spike -s exam --peak 8 --start 9 --hours 2` |

### Plan and simulate

| Command | What it does | Example |
| --- | --- | --- |
| `plan` | What to fix this sprint (`--budget`, `--method`, `--force DEBT-101`) | `debtlens plan -s college --budget 40` |
| `simulate whatif` | Change the cost weights and see which items change rank | `debtlens simulate whatif -s fintech --budgets 16,40,80` |
| `simulate forecast` | Monte Carlo over the next sprints (`--sprints`, `--runs`, `--seed`) | `debtlens simulate forecast -s college --sprints 12` |
| `simulate cascade MODULE` | Fail one module and see which dependents break (`--p`, `--runs`) | `debtlens simulate cascade db -s taxfiling` |

### Your own repository and data

| Command | What it does | Example |
| --- | --- | --- |
| `scan [path]` | Churn, McCabe complexity, TODO/FIXME and the import graph from git history (`--since`, `--top`, `-o`, `--push`) | `debtlens scan . --since 180` |
| `ingest LOGFILE` | Groups error lines into incident candidates (`--min-severity`, `--push`) | `debtlens ingest logs/app.log` |
| `import FILE` | A Jira or ServiceNow CSV/JSON backlog into a website project (preview; `--commit` creates them) | `debtlens import backlog.csv --commit` |

### Reports and CI

| Command | What it does | Example |
| --- | --- | --- |
| `ci` | Quality gate: exit code 1 when a limit is crossed | `debtlens ci -s fintech --max-open-critical 0` |
| `report` | The project PDF report (`-o`, `--budget`) | `debtlens report -s tatkal -o tatkal.pdf` |
| `export` | A project or system as a JSON snapshot | `debtlens export -s tatkal -o snap.json` |
| `analyse FILE` | The full analysis of a snapshot, offline | `debtlens analyse snap.json` |

### Website, server and model

| Command | What it does |
| --- | --- |
| `login URL`, `logout`, `whoami` | Connect to a DebtLens website, disconnect, show who you are (section 8) |
| `projects`, `use ID` | List the team's projects; set the default one |
| `incidents new` | Report an incident on a website project, with duplicate check and 5 Whys (`--title`, `--why`, `-y`) |
| `plan --approve`, `playbook KEY --done 1,2`, `simulate cascade MODULE --drill` | Save the plan, tick playbook steps, raise a drill incident on the website project |
| `scan . --push`, `ingest app.log --push` | Upload the results to the website project |
| `serve` | Run the whole website locally (`--port`, `--db`) |
| `model download`, `model status` | Get the MiniLM model (23 MB, once); check whether semantic similarity is available |

### What the output looks like (shortened)

```text
$ debtlens simulate spike -s tatkal
Tatkal opening at 10 AM — peak 25× normal traffic. …

Expected over the day (300 simulated days)
                 incidents  engineer hours lost  failed requests  no incident at all
now                    5.5                124.5            28.4%                  4%
after the fixes        2.9                 61.8            10.4%                 29%
Saves 62.7 h (95% CI 58.5–66.8), better in 272 of 300 simulated days.
The regular sprint plan would save 24.3 h on this day.

What to fix before the event — 37 of 40 h
fix first                                              module   hours  protects
DEBT-503 Serve seat availability from a precomputed cache  search      12    27.2 h
DEBT-502 Virtual waiting room: a durable queue for …       gateway     16    26.2 h
DEBT-507 Separate priority queue for OTP SMS               notify       6     9.1 h
DEBT-510 Index PNR lookups by passenger mobile number      pnr          3     9.1 h
…
```

```text
$ debtlens simulate spike -s fintech -e acquirer-outage --report
DebtLens run report: Acquiring bank outage — PayCore
FinTech · Provider outage · budget 40 h · 300 simulated days · seed 17 · 2026-11-26 02:46 UTC
──────────────────────────────────────────────────────────────────────────────────────
Acquiring bank outage: PayCore loses about 38.9 h of engineering time on an average day and 6.6% of
requests fail. Fixing 1 debt item first (40 h of the 40 h budget) cuts that to 10.4 h and 1.2%: 73% less
time lost.
…
WHAT HAPPENED ON THE DAY YOU WATCHED (DAY 7)
──────────────────────────────────────────────────────────────────────────────────────
Today, with the open debt:
  …
  13:18–14:14   ledger failed on its own (a random fault: a crashed process, a bad node or a full disk).
                [Random fault, high, 10 h]
  18:40         The main acquiring bank stops answering authorisations. [Situation]
  18:41–20:07   gateway stopped working: the main acquiring bank stops answering authorisations.
                [Outage, critical, 23.6 h]
  19:03–20:09   checkout failed because gateway, which it depends on, was down.
                [Knock-on failure, critical, 8.8 h]

After the fixes:
  …
  18:40         The circuit breaker tripped in 20 seconds and sent payments to the backup acquirer.
                [Prevented]
…
WHAT TO DO NEXT
──────────────────────────────────────────────────────────────────────────────────────
 1. To be ready for “Acquiring bank outage”, fix in this order: DEBT-104 (40 h).
 2. Do not rely on the regular sprint plan for this day: it saves 3 h, the plan above 28.5 h.
…
```

```text
$ debtlens ci -s fintech
FAIL open critical incidents: 1 (limit 0)
ok   regressions in the last 30 days: 3 (no limit)
ok   debts past break-even: 12 (no limit)
ok   highest debt risk score: 108 (no limit)
ok   monthly interest (hours): 461.3 (no limit)

FAIL — the build should stop here
```

The `ci` command returns exit code 1 on FAIL, which stops a GitHub Actions build. **Reports → Lessons & exports** on the website has the workflow file to copy.

## 10. Live replay and report in the terminal

The terminal plays the same simulated day as the website, with the same customer, modules and alerts, drawn in text, and then prints the report.

```bash
debtlens simulate spike -s tatkal -e tatkal-bots --live           # today
debtlens simulate spike -s tatkal -e tatkal-bots --live --after   # the same day after the fixes
debtlens simulate spike -s tatkal -e tatkal-bots --live --side    # both at once
debtlens simulate spike -s broker --live --speed 1                # the busiest day, slower
debtlens simulate spike -s exam -e db-failover --live -o exam.txt # and keep the report
```

| Option | Does |
| --- | --- |
| `--live` | Plays the day minute by minute, then prints the report |
| `--after` | Plays the day after the fixes |
| `--side` | Both lanes side by side. Needs a window at least 120 columns wide; a narrower one plays today, then after the fixes |
| `--speed` | 0.25 to 8; the default is 2 |
| `--no-freeze` | Turns off the frozen-screen effect |
| `-e` | The situation: leave it out for the busiest day, or use a key from `--list` |
| `--budget` | Hours to fix before the day (40 by default) |
| `-o FILE` | Also writes the report to a text file |

While it plays, a lane under heavy failure behaves like a hung screen: it stops updating for a moment, turns grey and shows “(Not Responding)”, and the phone shows “*app* isn't responding · Close app / Wait”. **Ctrl+C** stops the replay at any time. At the end it prints the engineer hours lost and incidents for each lane, then the full report; a stopped replay says where it stopped.

`--live` cannot be combined with `--json`.

### Make the terminal look good for a demo

1. Use **Windows Terminal** (free in the Microsoft Store, built into Windows 11) rather than the old Command Prompt window: the colours and box lines draw properly.
2. Maximise the window, or press **F11** for full screen, so `--side` gets its 120 columns. In Command Prompt, `mode con` shows the current width.
3. Make the font larger with **Ctrl and +** so the judges can read it, then check the width again.
4. Run the command once before the demo; the first run on a cold laptop takes a few extra seconds.

## 11. Record the scenarios on video

Record every replay once as a backup video, so the demo still works if the internet or the laptop lets you down on the day. Every tool below is free.

| Tool | Runs on | Start and stop | What it records | Saved in |
| --- | --- | --- | --- | --- |
| Snipping Tool | Windows 11 | **Win + Shift + R**, select an area, **Start**; **Stop** in its bar | Any part of the screen, with the microphone | Videos > Screen Recordings |
| Xbox Game Bar | Windows 10 and 11 | **Win + Alt + R** to start, again to stop | The app in front, with system sound; **Win + Alt + M** turns the microphone on or off | Videos > Captures, as MP4 |
| OBS Studio | Windows, macOS, Linux | **Start Recording**, **Stop Recording** | The whole screen or one window, with full control of quality | The folder you choose |
| Screenshot | macOS | **Shift-Command-5**, then **Record**; stop in the menu bar or with Command-Control-Escape | The whole screen, a window or a part of it | The desktop, as .mov |

### Get ready for each take

1. Turn on **Do not disturb** so no notification pops up in the video, and close other tabs.
2. Set the browser zoom to 100% (**Ctrl + 0**).
3. Open the system, pick the situation and press **Run this day →**. The replay opens on its intro screen. Press **F** for full screen.
4. Pick the speed with **S**: 1× if you will talk over it, 2× for a short clip.
5. If you want the replay's sound, press **M** and use a tool that records system sound.
6. Keep the browser in front for the whole take. The replay pauses while its tab is hidden or minimised, and Game Bar records only the app in front.
7. At the end of the day, press **Read the report →** and scroll slowly through the report: it makes a good closing shot.

### Record the website with Snipping Tool (Windows 11)

1. With the replay's intro screen showing, press **Win + Shift + R**.
2. Drag over the whole screen to select it.
3. Choose your microphone if you want to narrate, then press **Start**.
4. Click **▶ Start the day** (or **Side by side**) and let the day finish.
5. Press **Stop** in the Snipping Tool bar. The video is saved in **Videos > Screen Recordings**.

### Record with Xbox Game Bar

1. If **Win + G** does nothing, turn Game Bar on: open Settings (**Win + I**), search for “xbox” and switch it on.
2. For the replay's sound, open the Game Bar (**Win + G**), go to **Settings → Capturing** and set the audio to **All**.
3. Click the browser window, press **Win + Alt + R**, start the day, and press **Win + Alt + R** again when it ends.
4. The MP4 is in **Videos > Captures**, named after the app with the date and time.

Game Bar does not record the desktop or File Explorer, only the app you are in.

### Record with OBS Studio (the most control)

1. Install OBS Studio from [obsproject.com](https://obsproject.com).
2. Under **Sources**, press **+** and add **Display Capture** (the whole screen) or **Window Capture** (only the browser or the terminal).
3. In **Settings → Output**, set the **Recording Path** and the format MP4. In **Settings → Video**, set 1920×1080 and 30 fps.
4. If the video stutters, pick the hardware encoder (Intel QuickSync, AMD or NVIDIA) in **Settings → Output** instead of x264.
5. Press **Start Recording**, play the day, then press **Stop Recording**.

### Record the terminal replay

1. Open Windows Terminal, maximise it, make the font larger (**Ctrl and +**), and check it is still at least 120 columns wide for `--side`.
2. Type the command but do not press Enter yet:

```bash
debtlens simulate spike -s tatkal -e tatkal-bots --live --side --speed 1
```

3. Start recording the terminal window: **Win + Alt + R**, or a Window Capture in OBS.
4. Press Enter. When the report has printed at the end, stop the recording.

On macOS or Linux, asciinema records a terminal as a small text file instead of a video: `asciinema rec -c "debtlens simulate spike -s tatkal -e tatkal-bots --live" tatkal.cast`, then `asciinema play tatkal.cast`. It does not run on Windows, except inside WSL.

### Trim and export with Clipchamp

1. Open **Clipchamp** from the Start menu and sign in with a personal Microsoft account.
2. Create a new video, import the recording and drag it onto the timeline.
3. Drag the clip's ends to cut the waiting at the start and the end. Split out and delete any long quiet stretch.
4. Add a title such as “RailYatra · Tatkal booking bots · today vs after the fixes”.
5. **Export** at 1080p. The free plan has no watermark.

### What to record for each system

A good set is each system's busiest day plus its most striking situation, in **Side by side**, and one terminal run. All numbers are with 40 hours of fixes and 300 simulated days: the average day, and the day the replay shows.

| System | Situation (`-e` key) | Average day: today → after | The day you watch: today → after | Fix first |
| --- | --- | --- | --- | --- |
| PayCore (`fintech`) | Salary day (`salary-day`) | 197.4 → 45.8 h | 184 → 46.2 h | DEBT-101, DEBT-112, DEBT-105 |
| PayCore (`fintech`) | Acquiring bank outage (`acquirer-outage`) | 38.9 → 10.4 h | 42.4 → 10 h | DEBT-104 |
| CareStream HIS (`healthtech`) | Monday morning OPD rush (`opd-rush`) | 79.2 → 20.3 h | 81.5 → 15.8 h | DEBT-211, DEBT-206, DEBT-210 |
| CareStream HIS (`healthtech`) | SMS gateway outage on a Monday (`sms-outage`) | 55.8 → 9.5 h | 58.2 → 10.8 h | DEBT-206, DEBT-211, DEBT-210 |
| ShopSwift (`ecommerce`) | Diwali sale (`diwali-sale`) | 53.4 → 27.1 h | 54.4 → 25.7 h | DEBT-301, DEBT-302, DEBT-314 |
| ShopSwift (`ecommerce`) | Order events replayed (`event-replay`) | 51.4 → 3 h | 51.5 → 0 h | DEBT-306, DEBT-301 |
| CampusOne ERP (`college`) | Exam results day (`results-day`) | 48.7 → 8.1 h | 42.9 → 10 h | DEBT-401, DEBT-413, DEBT-408… |
| CampusOne ERP (`college`) | Biometric sync floods the database (`attendance-sync`) | 44.4 → 3 h | 36.9 → 3 h | DEBT-413 |
| RailYatra (`tatkal`) | Tatkal opening at 10 AM (`tatkal-10am`) | 124.5 → 61.8 h | 135.2 → 61.7 h | DEBT-503, DEBT-502, DEBT-507… |
| RailYatra (`tatkal`) | Tatkal booking bots (`tatkal-bots`) | 183.9 → 106 h | 185.4 → 104 h | DEBT-508, DEBT-502, DEBT-503 |
| NiveshTrade (`broker`) | Union Budget day (`budget-day`) | 128.6 → 66 h | 120 → 64.8 h | DEBT-608, DEBT-602, DEBT-613… |
| NiveshTrade (`broker`) | Credential-stuffing attack (`credential-stuffing`) | 107.7 → 7.1 h | 106.1 → 6 h | DEBT-607 |
| ZaikaNow (`food`) | IPL final night (`ipl-final`) | 145.6 → 85.4 h | 151.2 → 86.7 h | DEBT-701, DEBT-709, DEBT-711… |
| ZaikaNow (`food`) | Coupon-abuse bots (`coupon-bots`) | 112.9 → 28.3 h | 114.7 → 31.5 h | DEBT-715, DEBT-710, DEBT-712… |
| KhelStream (`stream`) | World Cup final (`world-cup-final`) | 156 → 77.8 h | 169.3 → 82.8 h | DEBT-808, DEBT-809, DEBT-801 |
| KhelStream (`stream`) | Restreaming bots (`restream-bots`) | 241.7 → 65.4 h | 249.1 → 59.3 h | DEBT-814, DEBT-809, DEBT-808… |
| SawariGo (`rides`) | New Year's Eve (`new-years-eve`) | 102.7 → 45.5 h | 103.6 → 45.8 h | DEBT-910, DEBT-906, DEBT-901… |
| SawariGo (`rides`) | Fare-scraping bots (`fare-scrapers`) | 109 → 27 h | 113.9 → 27.5 h | DEBT-914, DEBT-903, DEBT-911… |
| TaxSetu (`taxfiling`) | ITR deadline night (31 July) (`itr-deadline`) | 140.2 → 53.5 h | 141.4 → 52 h | DEBT-1009, DEBT-1006, DEBT-1001… |
| TaxSetu (`taxfiling`) | Credential stuffing on PAN login (`pan-login-bots`) | 119.7 → 8.7 h | 133.4 → 8 h | DEBT-1014, DEBT-1009, DEBT-1008… |
| ShowPass (`tickets`) | Stadium tour on-sale at noon (`stadium-drop`) | 129 → 53.8 h | 138.8 → 51.8 h | DEBT-1101, DEBT-1108, DEBT-1102… |
| ShowPass (`tickets`) | Scalper bots at the drop (`scalper-bots`) | 163.7 → 55.6 h | 168.1 → 54.3 h | DEBT-1106, DEBT-1101, DEBT-1108… |
| ParikshaNet (`exam`) | Entrance exam day (`entrance-exam`) | 305.9 → 137 h | 301.4 → 139.9 h | DEBT-1211, DEBT-1205, DEBT-1203… |
| ParikshaNet (`exam`) | Database failover mid-exam (`db-failover`) | 58 → 3.7 h | 58.3 → 0 h | DEBT-1204 |
| UdanAir (`airline`) | Fare sale at noon (`noon-sale`) | 130.8 → 50.9 h | 125.8 → 50.3 h | DEBT-1301, DEBT-1309, DEBT-1302… |
| UdanAir (`airline`) | Seat-spinning bots (`seat-spinning`) | 127.5 → 3.7 h | 126.7 → 0 h | DEBT-1306, DEBT-1301, DEBT-1309… |
| SlotSetu (`appointments`) | New slots open at 17:00 (`slot-release`) | 108.6 → 35.2 h | 106.3 → 34.5 h | DEBT-1401, DEBT-1412, DEBT-1410… |
| SlotSetu (`appointments`) | A data-centre zone loses power (`zone-power`) | 105.5 → 11.9 h | 105.5 → 13 h | DEBT-1408, DEBT-1401, DEBT-1412 |
| TurantMart (`grocery`) | Diwali evening (`diwali-evening`) | 131.7 → 63.1 h | 131.8 → 64.9 h | DEBT-1508, DEBT-1509, DEBT-1507… |
| TurantMart (`grocery`) | Scripts at a limited drop (`drop-scripts`) | 150 → 6.1 h | 152.3 → 10 h | DEBT-1505, DEBT-1509, DEBT-1508… |

If you meant recording a scenario of your own rather than a video: log it on the website (section 3), or write it as a pack file (section 6) and upload it (section 5). Its replay and report then record the same way.

## 12. Troubleshooting

Most problems on the day come from a cold server, a hidden replay tab or a narrow terminal; each has a one-line fix.

### Website

| Problem | Fix |
| --- | --- |
| **Opening…** takes 10 to 20 seconds, or Overview says “character n-gram fallback + TF-IDF (MiniLM not loaded)” | The server was asleep. Ten minutes before the demo, open [debtlens-bec.vercel.app/api/v1/health?warm=1](https://debtlens-bec.vercel.app/api/v1/health?warm=1) and look for `"available":true`. It wakes the server and loads the model |
| “That project is not available to you.” | The sandbox expired after 24 hours, or you signed out. Open the system again from the start page |
| A button is missing, or “your role (…) cannot do this” | Switch to Tech Lead in the top bar (sandbox), or ask the team admin to change your role |
| The replay did not open after **Run this day →** | Press **▶ Watch the day** on step 3 |
| The replay stopped moving | Its tab was hidden or minimised. Bring it to the front and press Space |
| The replay looks hung | That is the frozen-device effect; it catches up in a moment. Press E to turn it off |
| **Open pack** stays grey after choosing a file | The file has problems: read the list on the card (section 5) |
| An older report's **▶ Watch the day** shows “Loading the day…” | It re-runs the same simulation with the same seed; wait a few seconds |
| Your changes disappeared | Sandboxes are private and last 24 hours; **Reset this sandbox** also discards changes. Use a team account to keep data |

### Terminal

| Problem | Fix |
| --- | --- |
| `pipx install debtlens` fails | It is not on PyPI yet. Install from GitHub (section 8) |
| “pack files are opened on the website” | `-s` takes a built-in system by name. Upload your pack file on the website (section 5) |
| “unknown scenario …” | Use a code from `debtlens scenarios`; `simulate spike --list` shows a system's situations |
| `python` is not recognised | Reinstall Python with **Add python.exe to PATH** ticked, or type `py` instead of `python` |
| `debtlens` is not recognised | Activate the environment (`.venv\Scripts\activate`), use `python -m debtlens`, or build the package (section 8, step 4) |
| PowerShell refuses to run `activate` | Use Command Prompt, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once |
| Boxes and lines look broken | Use Windows Terminal instead of the old console window |
| `--side` plays the lanes one after the other | The window is narrower than 120 columns. Maximise it or make the font smaller |
| “MiniLM not available”, or `similar` gives weak matches | Run `debtlens model download` once with internet; `debtlens model status` checks it |
| Port 8000 is busy | `debtlens serve --port 8080`, then open http://localhost:8080 |
| MySQL errors with `start.bat` | Use `start-sqlite.bat`, or follow `docs/LOCAL_SETUP.md` |
| “that is a sandbox token” on `debtlens login` | Make the token while signed in to a team account, not a sandbox |

### Recording

| Problem | Fix |
| --- | --- |
| **Win + G** does nothing | Turn on Xbox Game Bar in Settings (search “xbox”) |
| Game Bar video is empty or shows the wrong window | Click the browser or terminal before **Win + Alt + R**, and do not switch windows during the take |
| No sound in the video | Press M in the replay; in Game Bar set the audio to **All**; in Snipping Tool check its sound buttons before **Start** |
| The video stutters | Close other apps, record at 30 fps, and pick the hardware encoder in OBS |

## 13. Quick reference

### Website

| What | Where |
| --- | --- |
| Live site | [debtlens-bec.vercel.app](https://debtlens-bec.vercel.app) |
| Run a scenario | Start page → **Open** on a system → pick a situation → **Run this day →** |
| Read a report | Day's end → **Read the report →**, or **Reports → Run reports** |
| Download a report | **⬇ PDF** or **⬇ Text** on the report |
| Upload a pack | Start page → **Upload a scenario pack** → **Choose or drop a .json file** → **Open pack** |
| Download a pack | **pack file** on a pack's card |
| Another system, role, or start over | **Simulate → Run a scenario → 1 Pick a system**; **as** *role* in the top bar; **⚙ → Reset this sandbox** |
| API token for the terminal | **⚙ → Team & settings → API tokens → Create token** (team account) |

### Live replay keys

Space play or pause · R restart · 1 today · 2 after the fixes · 3 side by side · S speed · E freeze effects · M sound · F full screen · Esc close.

### Terminal

```bash
debtlens scenarios                                    # every built-in system
debtlens pack show grocery                            # a pack and its situations
debtlens simulate spike -s tatkal --list              # a system's situations
debtlens simulate spike -s fintech -e acquirer-outage --report   # run one, read the report
debtlens simulate spike -s tatkal -e tatkal-bots --live --side   # watch it, then the report
debtlens similar "payment timeout" -s fintech         # has this happened before?
debtlens plan -s college --budget 40                  # what to fix this sprint
debtlens simulate cascade db -s taxfiling             # fail a module
debtlens serve                                        # the website on http://localhost:8000
```

### Recording shortcuts

| Shortcut | Does |
| --- | --- |
| Win + Shift + R | Snipping Tool screen recording (Windows 11) |
| Win + Alt + R | Start or stop a Game Bar recording |
| Win + Alt + M | Microphone on or off during a Game Bar recording |
| Win + G | Open Xbox Game Bar |
| Shift-Command-5 | Screen recording on a Mac |

### Demo-day checklist

- [ ] Backup videos of the situations you will show are on the laptop and on a pen drive
- [ ] The day before: each situation you will show rehearsed once at 2×, report included
- [ ] Ten minutes before: the warm-up link opened, showing `"available":true`
- [ ] The first system opened once before the judges arrive
- [ ] Browser zoom at 100%, other tabs closed, notifications off, charger in
- [ ] Windows Terminal maximised and the replay command typed, if you will show the terminal
- [ ] The local website ready (`start-sqlite.bat`) in case the internet fails

The system-by-system demo script, with times and numbers, is `docs/PACK_MANUAL.md` in the repository.

## Sources

Every DebtLens command, button and number in this guide was checked against the code and a run of version 2.0.0 on 26 November 2026, with the defaults (40 hours, 300 simulated days, seed 17). The recording steps come from these pages:

- [How to use Snipping Tool on Windows](https://www.microsoft.com/windows/learning-center/how-to-use-snipping-tool-on-windows-screenshots-shortcuts-and-screen-recordings) (Microsoft)
- [Record your screen with Xbox Game Bar](https://support.microsoft.com/en-us/windows/record-your-screen-with-xbox-game-bar-5328cd25-9046-4472-8a14-c485f138802c) (Microsoft Support)
- [Using the Xbox Game Bar to capture video from applications](https://www.dell.com/support/kbdoc/en-us/000103410/how-to-use-the-windows-10-game-bar-to-capture-video-from-applications) (Dell)
- [OBS Studio](https://obsproject.com/)
- [How to record the screen on your Mac](https://support.apple.com/102618) (Apple Support)
- [What is Clipchamp?](https://support.microsoft.com/en-us/Clipchamp/what-is-clipchamp) (Microsoft Support)
- [asciinema](https://github.com/asciinema/asciinema) (GitHub)

In this folder: [docs/PACKS.md](PACKS.md), [docs/PACK\_MANUAL.md](PACK_MANUAL.md) and [docs/LOCAL\_SETUP.md](LOCAL_SETUP.md).
