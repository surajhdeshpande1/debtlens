// Terminal guide: the same engine as a command-line tool, installed from the GitHub repository.
import { codeBlock, copyButtons, html } from "../lib.js";
import { S } from "../app.js";
import { card, head } from "./_parts.js";

const SAMPLE = html`<div class="term"><span class="p">$</span> debtlens plan --scenario fintech --budget 40
<span class="b">PayCore · FinTech</span> — 14 open debt items, 461.3 h/month interest, 85.7% past break-even

<span class="y">Fix this sprint</span> — 39 of 40 h (tree dp, proven optimal)
debt      title                                                     hours  interest/mo
DEBT-101  Separate connection pools for API traffic and batch jobs     24         98.6
DEBT-105  Apply configurable timeouts on the UPI code path              4         42.9
DEBT-108  Invalidate the API-key cache on rotation and revocation       8         23.9
DEBT-113  Extend the checkout session TTL during the OTP step           3         11.8

Retires <span class="p">177.2 h/month</span> of interest.
vs greedy <span class="p">+7.1%</span>   vs v1 naive DP <span class="p">+2.0%</span>

<span class="p">$</span> debtlens ci --scenario fintech --max-open-critical 0
<span class="r">FAIL</span> open critical incidents: 1 (limit 0)
ok   regressions in the last 30 days: 3 (no limit)
<span class="r">FAIL</span> — the build should stop here      <span class="c"># exit code 1</span></div>`;

export async function render(root, ctx) {
  const url = location.origin;
  const signedIn = !!(S.me && S.me.principal.kind === "user");
  root.innerHTML = String(html`${head("DebtLens in your terminal", "The same engine as this website, as a command-line tool: run any built-in system and situation offline, scan your own repository, or work on your team's project.")}
    <div class="grid c2">
      <div class="stack">
        ${card("1 · Install from GitHub", html`${codeBlock(`git clone https://github.com/surajhdeshpande1/debtlens
cd debtlens
python -m venv .venv
.venv\\Scripts\\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt "typer>=0.12" "rich>=13"
python -m debtlens --version`)}<p class="small muted" style="margin:0">Python 3.10 or newer. DebtLens is not on PyPI yet, so install it from the repository; on Windows <code>scripts\\windows\\setup.bat</code> does all of this. <code>python -m debtlens model download</code> fetches the 23 MB MiniLM model once (optional; TF-IDF works without it). The user guide in the repository explains every step.</p>`)}
        ${card("2 · Run a situation (no account needed)", html`${codeBlock(`debtlens scenarios                          # 15 systems: 4 industry scenarios, 11 packs
debtlens simulate spike -s tatkal --list     # the situations this system can run
debtlens simulate spike -s tatkal -e tatkal-bots --live --side
                                            # watch the day, then read the report
debtlens simulate spike -s fintech -e acquirer-outage --report -o report.txt
debtlens simulate spike -s exam --peak 8 --start 9 --hours 2   # your own rush`)}
          <p class="small muted" style="margin:0">The report is the same one the website shows: what happened minute by minute, why each module failed, what to fix first and what to do next. Your own scenario pack files are opened on the website (start page → <b>Upload a scenario pack</b>); the terminal runs the built-in systems by name.</p>`)}
        ${card("3 · Look around a system", codeBlock(`debtlens pack list                       # the 11 packs and their busiest day
debtlens pack show grocery               # modules, incidents, debt and situations
debtlens demo healthtech                 # the dashboard
debtlens similar "lab results not showing" -s healthtech
debtlens plan -s fintech --budget 40     # what to fix this sprint
debtlens simulate forecast -s college --sprints 12
debtlens simulate cascade db -s fintech  # fail one module on purpose`))}
        ${card("4 · Your own repository", codeBlock(`cd my-project
debtlens scan .                          # churn, complexity, TODO/FIXME, import graph
debtlens scan . --since 180 --json > scan.json
debtlens ingest logs/app.log             # group errors into incident candidates`))}
        ${card("5 · Connect to the website", html`${codeBlock(`debtlens login ${url} --token <your API token>
debtlens projects
debtlens use <project-id>                # default project for later commands
debtlens scan . --push                   # upload the full local git history
debtlens simulate spike -e <situation> --report
debtlens ci --max-open-critical 0 --max-regressions 3`)}
          <p class="small muted" style="margin:0">${signedIn ? html`Create a token under <b>⚙ → Team &amp; settings → API tokens</b>.` : html`API tokens need a team account (sign in or create a team on the start page); sandboxes are anonymous.`}</p>`)}
      </div>
      <div class="stack">
        ${card("What it looks like", SAMPLE)}
        ${card("Commands", html`<table class="data"><tbody>
          ${[["scenarios", "Every built-in system: 4 industry scenarios and 11 scenario packs"],
            ["simulate spike -s CODE --list", "The situations a system can run: rushes, bots, outages, bad releases…"],
            ["simulate spike -e KEY [--live] [--report]", "Run a situation: what fails, why, what to fix first; --live plays the day"],
            ["pack list | show CODE", "The bundled packs and what each contains"],
            ["scan [path]", "Mine a repo: churn, McCabe complexity, SATD, dependencies (--push, --json)"],
            ["similar \"text\"", "Has this happened before? Hybrid TF-IDF + MiniLM search"],
            ["incidents list | show | new", "Browse and report incidents, record 5 Whys"],
            ["debt / ledger / playbook KEY", "Debt items priced in hours, and how to fix each one"],
            ["plan --budget H", "Exact precedence-constrained knapsack (--approve to save)"],
            ["simulate whatif | forecast | cascade", "What-if costs, Monte Carlo forecast, failure injection"],
            ["ingest app.log", "Logs → grouped incident candidates (--push)"],
            ["import file.csv|json", "Bring in a Jira/ServiceNow backlog"],
            ["ci", "Quality gate: exit code 1 when a limit is crossed"],
            ["report / export / analyse", "PDF report, JSON snapshot, offline analysis of a snapshot"],
            ["serve", "Run this whole website on your own laptop (MySQL or SQLite)"]].map(([c, d]) => html`<tr><td class="mono small nowrap">debtlens ${c}</td><td class="small">${d}</td></tr>`)}
          </tbody></table>`, { flush: true })}
        ${card("Run the whole website on your laptop", codeBlock(`pip install "waitress>=3.0"
debtlens serve                           # SQLite file, no setup
debtlens serve --db mysql+pymysql://debtlens:debtlens@localhost:3306/debtlens
# then open http://localhost:8000`))}
      </div></div>`);
  copyButtons(root);
}
