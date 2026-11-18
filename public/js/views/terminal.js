// Terminal (CLI) guide: the same engine as a pip-installable command-line tool.
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
  root.innerHTML = String(html`${head("DebtLens in your terminal", "Engineers live in the terminal. The CLI runs the exact same analysis engine as this website — offline on your own repository, or connected to your team's project.")}
    <div class="grid c2">
      <div class="stack">
        ${card("1 · Install", html`${codeBlock("pipx install debtlens        # or: pip install debtlens")}<p class="small muted" style="margin:0">Python 3.10+. Works on Windows, macOS and Linux. <code>debtlens model download</code> fetches the 23 MB MiniLM model once for semantic similarity (optional — TF-IDF works without it).</p>`)}
        ${card("2 · Try it offline (no account)", codeBlock(`debtlens scenarios                       # 5 industry scenarios + 7 scenario packs
debtlens demo healthtech                 # dashboard of a scenario
debtlens similar "lab results not showing" --scenario healthtech
debtlens plan --scenario fintech --budget 40
debtlens simulate forecast --scenario college --sprints 12
debtlens simulate cascade db --scenario fintech
debtlens simulate spike --scenario tatkal  # Tatkal at 10 AM, hour by hour`))}
        ${card("Scenario packs", html`${codeBlock(`debtlens pack list                       # the 7 bundled packs and their busiest day
debtlens pack show broker                # what a pack contains
debtlens pack export tickets -o my.json  # copy one to edit
debtlens pack validate my.json           # every problem at once
debtlens simulate spike -s my.json --budget 60
debtlens plan -s my.json --budget 40`)}
          <p class="small muted" style="margin:0">A pack is a whole system in one JSON file: modules, dependencies, files, TODO markers, incidents with 5 Whys, debt with prerequisites and its own load-spike event. Every command accepts a pack code or file with <code>--scenario</code>, and the website opens a pack file from its home page. Format: <code>docs/PACKS.md</code>.</p>`)}
        ${card("3 · Your own repository", codeBlock(`cd my-project
debtlens scan .                          # churn, complexity, TODO/FIXME, import graph
debtlens scan . --since 180 --json > scan.json
debtlens ingest logs/app.log             # group errors into incident candidates`))}
        ${card("4 · Connect to the website", html`${codeBlock(`debtlens login ${url} --token <your API token>
debtlens projects
debtlens use <project-id>                # default project for later commands
debtlens scan . --push                   # upload the full local git history
debtlens incidents new                   # interactive report + 5 Whys
debtlens ci --max-open-critical 0 --max-regressions 3`)}
          <p class="small muted" style="margin:0">${signedIn ? html`Create a token under <b>Team &amp; settings → API tokens</b>.` : html`API tokens need a team account — <a href="#/register">create one</a>; sandboxes are anonymous.`}</p>`)}
      </div>
      <div class="stack">
        ${card("What it looks like", SAMPLE)}
        ${card("Commands", html`<table class="data"><tbody>
          ${[["scan [path]", "Mine a repo: churn, McCabe complexity, SATD, dependencies (--push, --json)"],
            ["similar \"text\"", "Has this happened before? Hybrid TF-IDF + MiniLM search"],
            ["incidents list | show | new", "Browse and report incidents, record 5 Whys"],
            ["debt / ledger", "Debt items with principal, interest, risk, break-even"],
            ["plan --budget H", "Exact precedence-constrained knapsack (--approve to save)"],
            ["simulate whatif | forecast | cascade | spike", "The Simulation Lab from the terminal"],
            ["pack list | show | validate | export", "Scenario packs: bundled systems or your own .json file"],
            ["ingest app.log", "Logs → grouped incident candidates (--push)"],
            ["import file.csv|json", "Bring in a Jira/ServiceNow backlog"],
            ["ci", "Quality gate: exit code 1 when a limit is crossed"],
            ["report / export / analyse", "PDF report, JSON snapshot, offline analysis of a snapshot"],
            ["serve", "Run this whole website locally (MySQL or SQLite) — the offline demo"]].map(([c, d]) => html`<tr><td class="mono small nowrap">debtlens ${c}</td><td class="small">${d}</td></tr>`)}
          </tbody></table>`, { flush: true })}
        ${card("Run the whole website offline", codeBlock(`pip install "debtlens[server]"
debtlens serve --db mysql+pymysql://debtlens:debtlens@localhost/debtlens
# or without MySQL:  debtlens serve            (SQLite file)
# then open http://localhost:8000`))}
      </div></div>`);
  copyButtons(root);
}
