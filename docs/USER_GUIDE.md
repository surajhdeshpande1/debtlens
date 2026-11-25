# DebtLens user guide: website, terminal, scenario packs and recording

Suraj H Deshpande · checked against DebtLens 2.0.0 on 25 November 2026

## Start here

DebtLens links each production incident to the technical debt that caused it, prices that debt in engineer-hours lost, and plans what to fix first within the hours you have. You can use it on the website, [debtlens-bec.vercel.app](https://debtlens-bec.vercel.app), or in a terminal with the `debtlens` command. Both run the same engine and open the same scenario packs.

| You want to | Use | Read |
| --- | --- | --- |
| Show a scenario to judges without installing anything | Website | 1, 5, 7 |
| Log your own incidents and debts | Website | 3 |
| Plan fixes and test a busy day before it happens | Website or terminal | 4, 9 |
| Work offline, or show the engine in a terminal | Terminal | 8, 9, 10 |
| Keep a backup video of the demo | Either | 11 |

The website needs only a browser. The terminal needs Python on your laptop (section 8).

```mermaid
flowchart TB
  W["Website<br/>debtlens-bec.vercel.app"] -->|HTTPS| A["API: Flask /api/v1<br/>one Vercel function, or debtlens serve"]
  T["Terminal: debtlens"] -.->|API token| A
  A -->|stores data| D["Database<br/>TiDB online · SQLite or MySQL on a laptop"]
  A --> E["Engine: debtlens.core<br/>similarity · causal graph · ledger · planner · simulations"]
  T -->|runs it directly| E
  P["Scenario packs (.json)"] --> E
```

Both front ends call the same engine, so a pack gives the same numbers in the browser and in the terminal. The terminal needs no database unless it connects to a website with a token.

## 1. Open the website and sign in

Open [debtlens-bec.vercel.app](https://debtlens-bec.vercel.app) in Chrome, Edge or Firefox. Everything except API tokens works without an account; an account is for keeping your own team's data.

### Try a scenario without an account

1. Scroll to **Try a live scenario** (five industry scenarios) or **Scenario packs** (seven systems on their busiest day).
2. On a card, pick the role you want to play from the dropdown. Tech Lead is selected by default.
3. Press **Open**. You land on that project's Home page as a named person from the scenario.

This is your private sandbox: change anything you like, nobody else sees it, and it expires 24 hours after you open it. The top bar of a sandbox holds:

- **Sandbox · *name* as *role***: change the role here at any time; the page reloads as that person.
- **The scenario dropdown**: opens another scenario or pack in one step, which is handy on stage.
- **▶ Tour**: starts the guided tour.
- **Reset**: puts back the original data. Your changes are discarded, so the browser asks first.
- **Exit**: leaves the sandbox and returns to the home page.

**▶ Guided tour for examiners** on a scenario card (or **▶ Guided tour** on a pack card) opens that scenario as Tech Lead and walks through the main features on its data.

### Create a team account

1. In the sign-in card, open the **Create a team** tab. Enter your name, the team or organisation, your email and a password of at least 8 characters, then press **Create team**. You become the team's admin.
2. On the Projects page, under **New project**, choose **Start from**: an empty project, an industry scenario or a scenario pack. Give it a name, add a repository URL if you have one, and press **Create project**.
3. Add teammates and API tokens on **Team & settings** (section 2).

Next time, use the **Sign in** tab with your email and password. The top bar then shows your name and role, **Projects** and **Sign out**, plus a project switcher once you have more than one project.

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

Each role also gets its own Home page. For a demo, play the Tech Lead: it can do everything in this guide except create projects and manage team members, which need the Admin.

## 2. Every page on the website

The left menu has the same 11 pages in every project, sandbox or real. The tag before each name (M1 to M8) is the module number used in the report and the viva.

| Page | What it shows | What you can do there |
| --- | --- | --- |
| Home | Your role's view. A Tech Lead sees the highest-risk debt, a 40-hour sprint plan preview, systemic root causes, incidents still without 5 Whys and incidents per month | **Report incident**, open the planner |
| Incidents (M2) | Every incident with module, severity, status, 5 Whys and linked debt | Search and filter by status, severity, module or source; **Export CSV**; **Import**; **Report incident**; open one to edit it, run 5 Whys or record the fix |
| Causal analysis (M3) | The causal graph: each 5 Whys answer is a cause node, with arrows from a symptom to the deeper cause. Also the most systemic causes and the DBSCAN clusters | Switch the layout (**Clusters**, **Layered**, **Fit**); click a cause to see its incidents and debt; **Edit** or **Merge…** causes |
| Debt registry (M4) | Each debt item with principal, interest per month, risk, break-even and linked incidents | Filter by status; **Fix playbooks**; **Export ledger CSV**; **Add debt**; on an item, change its status, tick playbook steps or pick another playbook |
| Repository evidence (M5) | Tabs: **Hotspots** (churn × complexity), **TODO / FIXME**, **Dependency graph**, **Import data** | **Mine a GitHub repo**; turn a TODO into a debt item with **→ debt**; import logs, a CSV or JSON backlog, or GitHub Issues |
| Intelligence (M6) | Tabs: **Knowledge search**, **Similar incidents**, **Regressions**, **Evaluation (measured)** | Search past incidents in plain words; tune the regression threshold τ; see the measured accuracy of each method |
| Ledger & optimiser (M7) | Interest by category and by module, and the full risk-ranked ledger | Sprint planner: effort budget, method, categories, must-include items; **Approve as sprint plan** |
| Simulation Lab | Tabs: **Industry scenarios**, **What-if economics**, **Sprint forecast**, **Failure injection**, **Load spike**, **Run history** | See section 4 |
| Knowledge & reports (M8) | Lessons learned from every fixed incident, and the activity log | **Download PDF**; incidents and debt ledger as CSV; project snapshot as JSON; **Run gate now** (CI quality gate); a GitHub Actions file to copy |
| Team & settings (M1) | Project settings, the roles table, team members, API tokens | Change name, repository, α and τ (Tech Lead, Admin); **Add member** or **Create demo team** (Admin); **Create token** for the terminal |
| Terminal (CLI) | A short terminal guide with commands to copy | Copy commands; also open without signing in from **Terminal** on the home page |

The small line at the bottom of Home says which similarity engine is running: “MiniLM sentence embeddings + TF-IDF (hybrid)” is the normal case.

## 3. Record your own incidents and debts on the website

Report the incident first, then add the debt behind it, then link the two: the debt's price is computed from those links. You need a role that can write (Admin, Tech Lead, Developer or QA; debt needs Admin, Tech Lead or Developer).

### Report an incident

1. Open **Incidents** and press **Report incident** (Home has the same button).
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

1. Open **Debt registry** and press **Add debt**, or use **New debt from this** on an incident.
2. Fill **Title** (the weakness, for example “Separate connection pools for API and batch jobs”), **Module**, **Category**, **Principal (hours to fix)**, and optionally **Priority** (Tech Lead or Admin), **File**, **Assignee** and **Description**.
3. Select the **Incidents it caused** (Ctrl-click for several), any debt that **Must be fixed first**, and its **Root cause** from the causal graph.
4. Press **Add debt**. Its page shows the price: principal, interest per month, break-even and a risk score from 0 to 120, with the interest split into incident cost, churn pressure and blast radius.
5. Below the price is the **Fix playbook** matched to the item. Tick steps as they are done, or choose another playbook from the dropdown.
6. When it is fixed, set the status to **Remediated**: “Paid off — interest stops accruing”.

### Bring in data you already have

- **Repository evidence → Import data** takes application logs (**Preview**, then **Create incidents**), a CSV or JSON backlog from Jira, ServiceNow or PagerDuty (columns like `id,summary,component,priority,status,created`), or GitHub Issues by repository, labels and state.
- **Repository evidence → Mine a GitHub repo** reads a public repository: give its URL and the number of commits, then **Start mining**.
- On the **TODO / FIXME** tab, **→ debt** turns a marker in the code into a debt item.
- From the terminal: `debtlens scan . --push`, `debtlens ingest app.log --push` and `debtlens import backlog.csv --commit` (section 9).

In a sandbox all of this works but is deleted after 24 hours. In a team project it stays.

## 4. Plan fixes and run simulations on the website

Use **Ledger & optimiser** to pick what to fix this sprint, and **Simulation Lab** to test that choice against other assumptions, many possible futures, a failure or a busy day. Every simulation is open to every role.

### Plan the sprint

1. Open **Ledger & optimiser** and find **Sprint planner**.
2. Drag **Effort budget** (4 to 200 hours; 40 by default).
3. Leave **Method** on “Exact (auto: tree DP / branch & bound)”, or pick Greedy or v1 naive DP to compare.
4. Optionally limit **Only categories** or add items under **Must include**.
5. Read the plan: the items chosen, the interest they retire per month, and how much better it is than greedy and v1.
6. **Approve as sprint plan** (Manager, Tech Lead or Admin) saves it, and its items become Prioritized.

### The Simulation Lab tabs

| Tab | Set | Press | You get |
| --- | --- | --- | --- |
| Industry scenarios | Nothing | **Open as sandbox**, **Switch sandbox to** or **Add as project** | The five scenarios side by side: interest against principal, and hours saved by the optimal plan over 8 sprints |
| What-if economics | The cost assumptions (λ weights) | **Save as project settings** or **Reset to project values** | The value of the optimal plan at each budget, and the items whose rank or break-even changed |
| Sprint forecast | Budget per sprint, sprints, Monte Carlo runs, new debt per sprint, incident rate, seed | **Run forecast** | Cumulative incident hours with a p10–p90 band, open debt per sprint, and a paired comparison of policies with 95% confidence intervals |
| Failure injection | The module to fail, spread probability p (0.35), runs (3,000) | **Inject failure**; **Raise a drill incident** | The chance each dependent module fails, the worst case, and the debt on the failure paths |
| Load spike | Event, **Hours to fix before it**, **Simulated days** (300); for a custom spike also peak, start hour and length | **Simulate the day** | The busy day hour by hour, before and after the fixes (below) |
| Run history | Nothing | Nothing | Every simulation run in this project |

### Read a load-spike result

- **Event**: the dropdown has **Rush-hour traffic** (the project's own busy day), **Bot attacks** (packs only) and Custom spike, where you set the peak, the start hour and how long it lasts.
- **The four numbers**: incidents expected, engineer hours lost, requests failing and the chance of a clean day, each now and after the fixes.
- **What to fix before the event**: the plan within your hours, the hours each item protects and its playbook. Below it: “Saves *X* h on this day (95% CI)” and what the regular sprint plan would save instead.
- **Load against capacity**: an hour-by-hour heat map per module; switch between **Now** and **After the fixes**.
- **Modules under pressure** and **Debt that matters on this day** explain why those fixes were chosen.
- **▶ Live replay** and **Side by side** play one typical day minute by minute (section 7).

For RailYatra's Tatkal opening with 40 hours, the result is 131.7 engineer hours lost now and 46.1 h after the fixes; the spike plan saves 85.7 h against 34.6 h for the regular sprint plan.

## 5. Scenario packs: open, download, edit and upload

A scenario pack is one JSON file that holds a whole system: modules, incidents with 5 Whys, debt, its busiest day and a bot attack. DebtLens computes every page and simulation from it, as it does for a real project. Seven packs come built in.

| Code | System | Busiest day | Bot attack (`-e` key) | Customer in the replay |
| --- | --- | --- | --- | --- |
| `tatkal` | RailYatra, train tickets | Tatkal opening, 25× at 10:00 | Tatkal booking bots (`tatkal-bots`) | Priya, booking Tatkal tickets to Bengaluru for two |
| `broker` | NiveshTrade, stock broking | Union Budget day, 12× at 11:00 | Credential-stuffing attack (`credential-stuffing`) | Rahul, buying shares at the 09:15 open |
| `food` | ZaikaNow, food delivery | IPL final night, 9× at 21:00 | Coupon-abuse bots (`coupon-bots`) | Arjun, ordering dinner at the innings break |
| `stream` | KhelStream, sports streaming | World Cup final, 20× at 21:00 | Restreaming bots (`restream-bots`) | The Sharma family, watching the final on TV |
| `rides` | SawariGo, ride-hailing | New Year's Eve, 8× at 23:00 | Fare-scraping bots (`fare-scrapers`) | Neha, heading home at 23:45 |
| `taxfiling` | TaxSetu, income-tax e-filing | ITR deadline night, 15× at 22:00 | Credential stuffing on PAN login (`pan-login-bots`) | Mr Kulkarni, filing ITR-1 at 23:30 on 31 July |
| `tickets` | ShowPass, event tickets | Stadium tour on-sale, 30× at 12:00 | Scalper bots at the drop (`scalper-bots`) | Divya, buying two tickets for the stadium show |

### Open a pack

- **Home page → Scenario packs**: pick a role on a card and press **Open**. It opens as a private 24-hour sandbox. **▶ Guided tour** opens it as Tech Lead and starts the tour.
- **Inside any sandbox**: the scenario dropdown in the top bar jumps straight to another pack.
- **In a team account**: **Projects → New project → Start from → Scenario packs** makes it a permanent project.

### Download a pack

Press **⬇ .json** on a pack card. The browser saves it as, for example, `tatkal.debtlens-pack.json`. In the terminal, `debtlens pack export tatkal -o my.json` does the same.

### Edit a pack

1. Open the file in a text editor. VS Code is free and underlines JSON mistakes in red; Notepad also works.
2. Change what you need. Good live edits: rename the system (`name`), raise the busiest day (`spike.profile` or `spike.peak`), add an incident, or change a customer step in `journey`.
3. Keep the JSON valid: double quotes around every text, a comma between items, none after the last one.
4. Save it as UTF-8 with a `.json` ending.

Section 6 explains every field.

### Upload a pack

1. On the home page, scroll to the last card under **Scenario packs**: **Open a pack file**.
2. Press **Choose or drop a .json file**, or drag the file onto it. The limit is 400 KB.
3. DebtLens checks the whole file at once. If it is valid, the card shows its name, counts and event, and **Open pack** becomes active.
4. Pick a role and press **Open pack**. It opens as a private 24-hour sandbox, shown as “*name* (uploaded)” in the scenario dropdown. **Reset** in the top bar returns to the file you uploaded.

An uploaded pack is never stored as a team project, so keep the file and upload it again whenever you need it.

### When the upload is refused

The card lists every problem at once (the first 12, then “…and N more”), so you can fix the file in one pass. `debtlens pack validate my.json` shows the same list in the terminal.

| What it says | Fix |
| --- | --- |
| “*file* is not valid JSON” | A missing comma, an extra comma before `]` or `}`, or single quotes. `debtlens pack validate` gives the place, for example “line 6, column 3: Expecting ',' delimiter” |
| “*file* is larger than 400 KB” | Remove incidents or files, or shorten descriptions |
| “module 'order' is not listed in modules” | Add the module to `modules`, or fix its spelling where it is used |
| “'mitigated\_by' names unknown debt DEBT-9” | Every key used in an incident list, `needs`, `mitigated_by` or `tour` must exist |
| “incident INC-1: 'fixed' is required” | A resolved incident needs `fixed` (days ago), no larger than its `ago` |
| “'cat' must be one of …” | Use one of the values the message lists; section 6 has them all |

“Opens fine. Notes:” is only a warning: the pack opens, and the notes say what DebtLens fixed or ignored.

## 6. Write your own scenario pack

The quickest way is to export a built-in pack and change it. To start from nothing, copy the small pack below: it is valid as it stands, opens on the website and simulates in the terminal.

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
  "spike": {"key": "lunch-rush", "name": "Lunch break at 12:30", "description": "Everyone orders in the same ten minutes.",
            "peak": 12, "start_hour": 12, "duration": 1,
            "entry": {"app": 1.0, "orders": 1.0}, "baseline": {"app": 0.06, "orders": 0.07, "db": 0.06}},
  "events": [
    {"key": "lunch-bots", "name": "Order-spamming bots", "description": "A script places fake orders to grab the last thalis.",
     "peak": 30, "start_hour": 12, "duration": 1, "entry": {"app": 1.0, "orders": 1.0},
     "bots": {"share": 0.6, "blocked": 0.9, "mitigated_by": ["DEBT-2"]}}
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

With 20 hours to prepare, this pack loses 21.7 engineer hours at the lunch rush now and 1.0 h after the fixes; the bot attack drops from 41.5 h to 12.0 h once DEBT-2 is fixed.

### What each part does

| Field | What it is | Rules |
| --- | --- | --- |
| `code`, `name`, `key` | Pack id, display name, project key | `name` is required. `code`: 2 to 24 of a–z, 0–9 and `-`. `key`: up to 8 letters or digits |
| `people` | One entry per person, by short id | `role`: admin, tech\_lead, developer, qa, manager or viewer |
| `modules` | The parts of the system, with size and change numbers | Every module used anywhere else must be listed here |
| `dependencies` | Who calls whom | `[caller, callee]` pairs |
| `files`, `satd` | Optional file metrics and TODO/FIXME markers | `files`: path, module, churn, complexity, lines, lines changed, authors. `satd`: path, line, marker, text |
| `incidents` | Past failures with their 5 Whys | `sev`: CRITICAL, HIGH, MEDIUM or LOW. `status`: OPEN, INVESTIGATING or RESOLVED (resolved needs `fixed`). 1 to 7 whys. `ago` and `fixed` are days ago |
| `debts` | The weaknesses and their links | `cat`: ARCHITECTURAL, CODE\_SMELL, TEST\_DEBT, INFRASTRUCTURE, SECURITY\_DEBT or DOCUMENTATION. `status`: IDENTIFIED, PRIORITIZED, IN\_PROGRESS, DEFERRED or REMEDIATED. `needs` lists prerequisites. `playbook` is optional |
| `spike` | The busiest day | Either `profile` (24 hourly multipliers of a normal peak hour) or `peak`, `start_hour` and `duration`. `entry`: where users come in, 0 to 1. `baseline`: load at a normal peak hour (default 0.15) |
| `events` | Up to 4 more events, shaped like `spike` | Add `bots` for a bot attack: `share` of the extra traffic that is bots, the share `blocked` once a debt in `mitigated_by` is fixed |
| `journey` | The customer's phone in the live replay | 1 to 8 steps, each with `module`, `label`, `ok`, `slow` and `fail` texts. `peak_rpm`: requests per minute at a normal peak hour |
| `tour` | The guided tour's story | Its incident, debt and module must exist |

Limits: 400 KB, 40 modules, 300 dependencies, 300 files, 300 markers, 300 incidents, 150 debt items, 20 people and 7 whys per incident.

### Tips for a pack that tells a good story

- Give repeated incidents the same `group`, and end their 5 Whys with exactly the same root-cause sentence. Use that sentence as the debt's `cause`. The causal graph then shows one systemic cause.
- A family member reported after an earlier one was resolved, in the same module, is flagged as a regression by itself.
- The debt title picks its fix playbook (“connection pool”, “rate limit”, “timeout”, “circuit breaker”, “index”…), and the playbook decides how much the fix helps on the busiest day. Check the match with `debtlens playbooks -s my.json`.
- For a module that should overload now but hold after its fix, a good `baseline` is about 0.82 ÷ (1 + (peak − 1) × exposure).

The full reference is `docs/PACKS.md` in the repository.

## 7. Live replay on the website

The live replay plays one typical simulated day minute by minute: a customer's phone on the left, the on-call engineer's screens on the right, today and after the fixes. It is drawn, not real: no extra requests reach the server and your laptop never actually hangs.

### Start it

1. Open a pack (section 5), go to **Simulation Lab → Load spike**, choose the event and press **Simulate the day**.
2. In the box **Watch this day live**, press **▶ Live replay** (or **Side by side**).
3. On the intro screen, press **▶ Start the day**. The day starts two hours before the traffic builds.
4. Press **F** for full screen before the judges look.

### What you see

- **The phone (“What Priya sees”)**: the customer goes through the app step by step. A step near its module's limit is slow; when the module is down, the customer sees the app's own error message and tries again (“Attempt 2”, “Attempt 3”). When the way in is down, the app freezes with “*app* isn't responding”.
- **The engineer's numbers**: requests per minute, failing right now, requests failed today, engineer hours lost and incidents.
- **Module tiles**: each module's load and state: OK, HOT, DOWN, or FAILING because a module it depends on is down.
- **Alerts**: overloads, outages and cascades as they fire, with the hours each one costs.
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

When the day ends, a summary shows the engineer hours lost and incidents, with **▶ Same day, after the fixes**, **▶ Today again** and **Side by side**.

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

At 1× a whole day takes 15 to 80 seconds: busy hours play slowly, quiet hours quickly. The replay pauses itself while its browser tab is hidden or minimised.

For RailYatra's Tatkal booking bots, the day costs about 185 engineer hours today and about 86 h after the fixes, because DEBT-508 blocks most of the bots at the edge.

## 8. Install the terminal version

Install it from the GitHub repository: DebtLens is not on PyPI yet, so the `pipx install debtlens` shown on the website does not work today. You need Python 3.10 or newer, on Windows, macOS or Linux.

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

Without any account, the terminal works on the built-in scenarios, the packs, pack files and your own repository. To work on a team project instead:

1. Sign in to the website with a team account (a sandbox cannot make tokens). Open **Team & settings → API tokens**, type a name such as “my laptop” and press **Create token**.
2. Copy the line it shows, which appears only once: `debtlens login https://debtlens-bec.vercel.app --token dlt_…`. Run it in the terminal.
3. Run `debtlens projects`, then `debtlens use 3` to make project 3 the default. Commands without `-s` now work on that project.
4. `debtlens whoami` shows who you are signed in as, and `debtlens logout` forgets the token.

You can also run `debtlens login https://debtlens-bec.vercel.app --email you@example.com`: it asks for your password and creates the token itself.

## 9. Every terminal command, with examples

Most commands read one source: `-s` with a scenario code (`fintech`, `healthtech`, `ecommerce`, `college`, `self`), a pack code (`tatkal` … `tickets`) or a pack file; `--snapshot` with a snapshot file; or `-p` with a website project after `debtlens login`. With none of these and no login, they use `fintech`. Add `--json` for machine-readable output and `--help` to any command for its options.

### Look at a system

| Command | What it does | Example |
| --- | --- | --- |
| `scenarios` | The 5 industry scenarios and 7 packs | `debtlens scenarios` |
| `demo [code]` | The dashboard of a scenario or pack | `debtlens demo tatkal` |
| `dashboard` | KPIs, highest-risk debt, systemic causes, regressions | `debtlens dashboard -s broker` |
| `incidents list` | Incidents, newest first (`--status`, `-n`) | `debtlens incidents list -s tatkal -n 10` |
| `incidents show KEY` | One incident: 5 Whys, fix, similar incidents | `debtlens incidents show INC-519 -s tatkal` |
| `similar "text"` | Has this happened before, and what fixed it? | `debtlens similar "OTP SMS not arriving" -s tatkal` |
| `debt` | Debt items with principal, interest, risk, break-even (`--all` adds paid-off items) | `debtlens debt -s rides` |
| `ledger` | Totals by module and category | `debtlens ledger -s food` |
| `playbook KEY` | Fix steps for one debt item, how to verify it, what can go wrong | `debtlens playbook DEBT-508 -s tatkal` |
| `playbooks` | Which playbook each debt item uses, and why | `debtlens playbooks -s my.json` |

### Plan and simulate

| Command | What it does | Example |
| --- | --- | --- |
| `plan` | What to fix this sprint (`--budget`, `--method`, `--force DEBT-101`) | `debtlens plan -s college --budget 40` |
| `simulate whatif` | Change the cost weights and see which items change rank | `debtlens simulate whatif -s fintech --budgets 16,40,80` |
| `simulate forecast` | Monte Carlo over the next sprints (`--sprints`, `--runs`, `--seed`) | `debtlens simulate forecast -s college --sprints 12` |
| `simulate cascade MODULE` | Fail one module and see which dependents break (`--p`, `--runs`) | `debtlens simulate cascade db -s taxfiling` |
| `simulate spike` | The busiest day hour by hour and what to fix first (`-e`, `--budget`, custom `--peak --start --hours`) | `debtlens simulate spike -s tatkal --budget 60` |
| `simulate spike --live` | The live replay (section 10) | `debtlens simulate spike -s tatkal -e tatkal-bots --live --side` |

### Scenario packs

| Command | What it does | Example |
| --- | --- | --- |
| `pack list` | The 7 packs and their busiest day | `debtlens pack list` |
| `pack show REF` | What a pack or pack file contains | `debtlens pack show broker` |
| `pack export CODE` | Copy a built-in pack to a file to edit | `debtlens pack export tickets -o my.json` |
| `pack validate FILE` | Every problem in a pack file at once | `debtlens pack validate my.json` |

Any pack file also works with `-s`: `debtlens simulate spike -s my.json --budget 60`.

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
| `report` | The PDF report (`-o`, `--budget`) | `debtlens report -s tatkal -o tatkal.pdf` |
| `export` | A project or scenario as a JSON snapshot | `debtlens export -s tatkal -o snap.json` |
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
now                    5.8                131.7            30.4%                  0%
after the fixes        2.1                 46.1             7.5%                 22%
Saves 85.7 h (95% CI 82.5–88.8), better in 300 of 300 simulated days.
The regular sprint plan would save 34.6 h on this day.

What to fix before the event — 37 of 40 h
fix first                                                      module   hours  protects
DEBT-502 Virtual waiting room: a durable queue for the Tatkal window  gateway     16    41.0 h
DEBT-503 Serve seat availability from a precomputed cache      search      12    29.7 h
DEBT-510 Index PNR lookups by passenger                        pnr          3    18.8 h
…
```

```text
$ debtlens ci -s fintech
FAIL open critical incidents: 1 (limit 0)
ok   regressions in the last 30 days: 6 (no limit)
ok   debts past break-even: 12 (no limit)
FAIL — the build should stop here
```

The `ci` command returns exit code 1 on FAIL, which stops a GitHub Actions build. **Knowledge & reports** on the website has the workflow file to copy.

## 10. Live replay in the terminal

The terminal plays the same simulated day as the website, with the same customer, modules and alerts, drawn in text.

```bash
debtlens simulate spike -s tatkal -e tatkal-bots --live           # today
debtlens simulate spike -s tatkal -e tatkal-bots --live --after   # the same day after the fixes
debtlens simulate spike -s tatkal -e tatkal-bots --live --side    # both at once
debtlens simulate spike -s broker --live --speed 1                # the rush-hour event, slower
```

| Option | Does |
| --- | --- |
| `--live` | Plays the day minute by minute |
| `--after` | Plays the day after the fixes |
| `--side` | Both lanes side by side. Needs a window at least 120 columns wide; a narrower one plays today, then after the fixes |
| `--speed` | 0.25 to 8; the default is 2 |
| `--no-freeze` | Turns off the frozen-screen effect |
| `-e` | The event: leave it out for the pack's busiest day, or use a bot-attack key from section 5 |
| `--budget` | Hours to fix before the event (40 by default) |

While it plays, a lane under heavy failure behaves like a hung screen: it stops updating for a moment, turns grey and shows “(Not Responding)”, and the phone shows “*app* isn't responding · Close app / Wait”. **Ctrl+C** stops the replay at any time. At the end it prints the engineer hours lost and incidents for each lane and the debt keys fixed before the event; a stopped replay says where it stopped.

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
3. Open the pack, run **Simulation Lab → Load spike → Simulate the day**, and open the replay so its intro screen shows. Press **F** for full screen.
4. Pick the speed with **S**: 1× if you will talk over it, 2× for a short clip.
5. If you want the replay's sound, press **M** and use a tool that records system sound.
6. Keep the browser in front for the whole take. The replay pauses while its tab is hidden or minimised, and Game Bar records only the app in front.

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
4. Press Enter. When the totals print at the end, stop the recording.

On macOS or Linux, asciinema records a terminal as a small text file instead of a video: `asciinema rec -c "debtlens simulate spike -s tatkal -e tatkal-bots --live" tatkal.cast`, then `asciinema play tatkal.cast`. It does not run on Windows, except inside WSL.

### Trim and export with Clipchamp

1. Open **Clipchamp** from the Start menu and sign in with a personal Microsoft account.
2. Create a new video, import the recording and drag it onto the timeline.
3. Drag the clip's ends to cut the waiting at the start and the end. Split out and delete any long quiet stretch.
4. Add a title such as “RailYatra · Tatkal booking bots · today vs after the fixes”.
5. **Export** at 1080p. The free plan has no watermark.

### What to record for each pack

The best set is the seven bot attacks in **Side by side**, plus Tatkal's rush hour and one terminal run. The numbers are the engineer hours lost on the replayed day with 40 hours of fixes, so they differ slightly from the 300-day averages in section 4.

| Pack | Bot attack: first trouble | Bot attack: today → after | Rush hour: today → after |
| --- | --- | --- | --- |
| RailYatra (`tatkal`) | 10:03, `search`, `seats` and `gateway` go down | 185.4 → 85.8 h | 132.9 → 48.6 h |
| NiveshTrade (`broker`) | 02:04, `auth`, `orders` and `db` | 107.6 → 0.0 h | 140.9 → 62.6 h |
| ZaikaNow (`food`) | 19:02, `menu`, `orders` and `app` | 110.2 → 0.0 h | 160.2 → 64.2 h |
| KhelStream (`stream`) | 14:02, `cdn`, `playback` and `db` | 267.4 → 33.8 h | 156.3 → 66.1 h |
| SawariGo (`rides`) | 18:03, `rider` | 109.4 → 0.0 h | 112.2 → 36.8 h |
| TaxSetu (`taxfiling`) | 20:02, `notify`, `db` and `login` | 123.3 → 0.0 h | 158.9 → 46.2 h |
| ShowPass (`tickets`) | 12:01, `waitroom`, `auth`, `web` and `checkout` | 156.8 → 0.0 h | 152.3 → 41.8 h |

If you meant recording a scenario of your own rather than a video: log it on the website (section 3), or write it as a pack file (section 6) and upload it (section 5). Its replay then records the same way.

## 12. Troubleshooting

Most problems on the day come from a cold server, a hidden replay tab or a narrow terminal; each has a one-line fix.

### Website

| Problem | Fix |
| --- | --- |
| The first page is slow, or Home says “character n-gram fallback + TF-IDF (MiniLM not loaded)” | Ten minutes before the demo, open [debtlens-bec.vercel.app/api/v1/health?warm=1](https://debtlens-bec.vercel.app/api/v1/health?warm=1) and look for `"available":true`. It wakes the server and loads the model |
| “That project is not available to you.” | The sandbox expired after 24 hours, or you signed out. Open the scenario again from the home page |
| A button is missing, or “your role (…) cannot do this” | Switch to Tech Lead in the top bar (sandbox), or ask the team admin to change your role |
| No **▶ Live replay** button | Press **Simulate the day** first; the box appears above the results |
| The replay stopped moving | Its tab was hidden or minimised. Bring it to the front and press Space |
| The replay looks hung | That is the frozen-device effect; it catches up in a moment. Press E to turn it off |
| **Open pack** stays grey after choosing a file | The file has problems: read the list on the card, or run `debtlens pack validate` (section 5) |
| Your changes disappeared | Sandboxes are private and last 24 hours; **Reset** also discards changes. Use a team account to keep data |

### Terminal

| Problem | Fix |
| --- | --- |
| `pipx install debtlens` fails | It is not on PyPI yet. Install from GitHub (section 8) |
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
| Try a scenario or pack | Home page → pick a role → **Open** (private, 24 hours) |
| Upload a pack | Home page → **Open a pack file** → **Choose or drop a .json file** → **Open pack** |
| Download a pack | **⬇ .json** on a pack card |
| Switch scenario, role or start over | Top bar: scenario dropdown, role dropdown, **Reset** |
| Run the busiest day | **Simulation Lab → Load spike → Simulate the day → ▶ Live replay** |
| API token for the terminal | **Team & settings → API tokens → Create token** (team account) |

### Live replay keys

Space play or pause · R restart · 1 today · 2 after the fixes · 3 side by side · S speed · E freeze effects · M sound · F full screen · Esc close.

### Terminal

```bash
debtlens scenarios                                    # everything built in
debtlens demo tatkal                                  # dashboard of a pack
debtlens similar "payment timeout" -s fintech         # has this happened before?
debtlens plan -s college --budget 40                  # what to fix this sprint
debtlens simulate spike -s tatkal                     # the busiest day, hour by hour
debtlens simulate spike -s tatkal -e tatkal-bots --live --side   # the live replay
debtlens simulate cascade db -s taxfiling             # fail a module
debtlens pack export tickets -o my.json               # copy a pack to edit
debtlens pack validate my.json                        # check a pack file
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

- [ ] Backup videos of the seven bot attacks are on the laptop and on a pen drive
- [ ] The day before: each pack you will show rehearsed once at 2×
- [ ] Ten minutes before: the warm-up link opened, showing `"available":true`
- [ ] The first pack opened once before the judges arrive
- [ ] Browser zoom at 100%, other tabs closed, notifications off, charger in
- [ ] Windows Terminal maximised and the replay command typed, if you will show the terminal
- [ ] The local website ready (`start-sqlite.bat`) in case the internet fails

The pack-by-pack demo script, with times and numbers, is `docs/PACK_MANUAL.md` in the repository.

## Sources

Every DebtLens command, button and number in this guide was checked against the code and a run of version 2.0.0 on 25 November 2026. The recording steps come from these pages:

- [How to use Snipping Tool on Windows](https://www.microsoft.com/windows/learning-center/how-to-use-snipping-tool-on-windows-screenshots-shortcuts-and-screen-recordings) (Microsoft)
- [Record your screen with Xbox Game Bar](https://support.microsoft.com/en-us/windows/record-your-screen-with-xbox-game-bar-5328cd25-9046-4472-8a14-c485f138802c) (Microsoft Support)
- [Using the Xbox Game Bar to capture video from applications](https://www.dell.com/support/kbdoc/en-us/000103410/how-to-use-the-windows-10-game-bar-to-capture-video-from-applications) (Dell)
- [OBS Studio](https://obsproject.com/)
- [How to record the screen on your Mac](https://support.apple.com/102618) (Apple Support)
- [What is Clipchamp?](https://support.microsoft.com/en-us/Clipchamp/what-is-clipchamp) (Microsoft Support)
- [asciinema](https://github.com/asciinema/asciinema) (GitHub)

In this folder: [docs/PACKS.md](PACKS.md), [docs/PACK\_MANUAL.md](PACK_MANUAL.md) and [docs/LOCAL\_SETUP.md](LOCAL_SETUP.md).
