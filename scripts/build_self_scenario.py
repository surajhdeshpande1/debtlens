"""Build debtlens/scenarios/self.json: DebtLens v2 analysing DebtLens v1.

Evidence (files, churn, complexity, TODO/FIXME markers, dependencies) is mined from the
real v1 history with the same scanner the CLI uses; incidents and debts are the
findings of the v1 audit (17 Nov 2026).

    git worktree add /tmp/v1wt origin/main
    python scripts/build_self_scenario.py /tmp/v1wt
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from debtlens.core import mining  # noqa: E402

RULES = [
    ("frontend/src/services/mockEngine.ts", "mock-engine"), ("frontend/src/services/api.ts", "data-layer"),
    ("frontend/src/services/firebase.ts", "data-layer"), ("frontend/src/services/supabase.ts", "data-layer"),
    ("frontend/src/pages/JudgeSpotlightDemoPage.tsx", "demo"), ("frontend/src/pages/DemoGuidePage.tsx", "demo"),
    ("frontend/src/pages", "pages"), ("frontend/src/components", "components"), ("frontend/src", "app-shell"),
    ("frontend", "app-shell"), ("backend/app/services/knapsack_optimiser.py", "optimiser"),
    ("backend/app/services/similarity_engine.py", "similarity"), ("backend/app/services/repo_analyzer.py", "repo-analyzer"),
    ("backend/app/services/auth_service.py", "auth"), ("backend/app/routers/auth.py", "auth"),
    ("backend/app/services", "analytics"), ("backend/app/routers", "api"), ("backend/app/models", "models"),
    ("backend/app/schemas", "models"), ("backend/tests", "tests"), ("backend", "api"), ("seed_firestore.py", "firestore"),
]
RULES.sort(key=lambda r: -len(r[0]))
DESCR = {
    "data-layer": "frontend/src/services/api.ts — 4-tier fallback: Firestore, Supabase, FastAPI, mock engine",
    "mock-engine": "45 KB in-browser imitation of the backend analytics",
    "demo": "Judge Spotlight demo and demo guide pages",
    "pages": "React pages for the 8 modules", "components": "Shared React components",
    "app-shell": "React entry, routing and styles", "optimiser": "0/1 knapsack remediation planner",
    "similarity": "TF-IDF + char n-gram similarity, DBSCAN", "repo-analyzer": "Complexity, SATD and import scanning",
    "auth": "JWT login and role checks", "analytics": "Debt economics, causal graph, PDF report",
    "api": "FastAPI application and routers", "models": "SQLAlchemy models and Pydantic schemas",
    "tests": "pytest suite", "firestore": "Firestore seed script and security rules", "docs": "Synopsis, slides and README",
}

INCIDENTS = [
    {"key": "INC-501", "title": "Live site marks only INC-105 as a regression", "desc": "On debtlens-cloud.vercel.app the regression badge appears only on INC-105 whatever incidents exist; new similar incidents are never flagged.", "module": "data-layer", "sev": "HIGH", "status": "OPEN", "ago": 12, "effort": 3, "by": "suraj", "group": "G-FAKE",
     "whys": ["The regression badge is wrong on the live site", "The Firestore code path returns a hard-coded regression flag", "Regression logic exists only in the FastAPI backend", "The FastAPI backend was never deployed, so the browser fakes analytics"]},
    {"key": "INC-502", "title": "Every incident shows DEBT-101 and DEBT-102 as linked debt", "desc": "Opening any incident on the live site lists the same two debt items, even for incidents that have no debt.", "module": "data-layer", "sev": "HIGH", "status": "OPEN", "ago": 12, "effort": 2, "by": "sushma_h", "group": "G-FAKE",
     "whys": ["Linked debts are wrong for every incident", "The Firestore and Supabase paths return a fixed list of debt ids", "The FastAPI backend was never deployed, so the browser fakes analytics"]},
    {"key": "INC-503", "title": "Anyone on the internet can edit or delete debt items", "desc": "Firestore rules allow unauthenticated writes to every collection and deletes on technical_debt_items; the web config ships in the public bundle.", "module": "firestore", "sev": "CRITICAL", "status": "OPEN", "ago": 11, "effort": 2, "by": "sushma_p",
     "whys": ["Unauthenticated users can change data", "Firestore rules check field types but not who is writing", "The deployed app has no authentication layer"]},
    {"key": "INC-504", "title": "Viewer role can approve remediation plans", "desc": "Switching the role pill to Viewer still allows every action; no endpoint checks the caller's role.", "module": "auth", "sev": "HIGH", "status": "OPEN", "ago": 11, "effort": 2, "by": "sushma_m",
     "whys": ["A viewer could perform lead-only actions", "Roles are only a dropdown in the UI", "No API endpoint checks the caller's role", "The deployed app has no authentication layer"]},
    {"key": "INC-505", "title": "Optimiser leaves 6 hours of a 40-hour budget unused", "desc": "The sprint plan dropped DEBT-107 because its prerequisite was not chosen, and nothing replaced it.", "module": "optimiser", "sev": "MEDIUM", "status": "RESOLVED", "ago": 20, "fixed": 19, "effort": 3, "by": "sushma_m", "group": "G-OPT",
     "whys": ["Sprint budget was left unused", "Items whose prerequisites were not picked were dropped after the DP", "The knapsack DP ignores prerequisites and repairs the result afterwards"],
     "fix": "Added a transitive-closure check after the DP.", "lesson": "Repairing after the DP is still not optimal."},
    {"key": "INC-506", "title": "Files of equal length always show identical churn", "desc": "Two unrelated files with about 500 lines both show churn 90, although one was never changed.", "module": "repo-analyzer", "sev": "MEDIUM", "status": "OPEN", "ago": 10, "effort": 2, "by": "sushma_p",
     "whys": ["Churn values look identical for similar-sized files", "Churn is computed as 18% of the line count", "Git history is never read"]},
    {"key": "INC-507", "title": "Paraphrased incidents not recognised as similar", "desc": "'Webhook callbacks time out' and 'merchant endpoint never acknowledges notifications' scored 0.08 similarity.", "module": "similarity", "sev": "MEDIUM", "status": "OPEN", "ago": 9, "effort": 2, "by": "sushma_h",
     "whys": ["Similar incidents were not matched", "The 'semantic' score is character n-gram TF-IDF", "The MiniLM model promised in the synopsis was never integrated"]},
    {"key": "INC-508", "title": "Demo scenario numbers never change", "desc": "FinTech, HealthTech and Supply-chain demo numbers stay the same whatever the data or inputs.", "module": "demo", "sev": "MEDIUM", "status": "OPEN", "ago": 8, "effort": 2, "by": "suraj", "group": "G-FAKE",
     "whys": ["Scenario results do not respond to inputs", "Scenario KPIs are hard-coded constants in the page", "The FastAPI backend was never deployed, so the browser fakes analytics"]},
    {"key": "INC-509", "title": "Every page waits 1.5 seconds before falling back", "desc": "Each request on the live site first tries 127.0.0.1:8000, times out after 1.5 seconds and then falls back to the browser engine.", "module": "data-layer", "sev": "LOW", "status": "OPEN", "ago": 14, "effort": 1, "by": "suraj", "group": "G-FAKE",
     "whys": ["Pages load slowly on the live site", "Each call tries localhost and times out after 1.5 seconds", "The FastAPI backend was never deployed, so the browser fakes analytics"]},
    {"key": "INC-510", "title": "Colour theme rewritten 15 times in two weeks", "desc": "18 of 29 commits changed colours or layout, leaving no time for the analytics.", "module": "components", "sev": "LOW", "status": "RESOLVED", "ago": 15, "fixed": 14, "effort": 6, "by": "suraj",
     "whys": ["The UI kept changing", "Every review led to a new palette", "There is no agreed design system"],
     "fix": "Reverted to the original layout.", "lesson": "Freeze the look; spend time on the engine."},
    {"key": "INC-511", "title": "Plan drops prerequisite-dependent items again after a budget change", "desc": "At a 60-hour budget the plan again skipped DEBT-107 and left 5 hours unused.", "module": "optimiser", "sev": "MEDIUM", "status": "OPEN", "ago": 6, "effort": 2, "by": "sushma_m", "group": "G-OPT",
     "whys": ["Sprint budget was left unused", "Items whose prerequisites were not picked were dropped after the DP", "The knapsack DP ignores prerequisites and repairs the result afterwards"]},
    {"key": "INC-512", "title": "Synopsis, code and slides describe three different stacks", "desc": "The synopsis says React, FastAPI and PostgreSQL; the code uses SQLite and Firestore; the Demo-1 slides say HTML, Flask and MySQL.", "module": "docs", "sev": "HIGH", "status": "OPEN", "ago": 10, "effort": 2, "by": "suraj", "group": "G-DOCS",
     "whys": ["An examiner sees conflicting architectures", "Synopsis, code and slides were written separately", "There is no single source of truth for the architecture"]},
    {"key": "INC-513", "title": "Demo-1 slides carry speaker notes from another project", "desc": "Notes mention intelligent tutoring, BART summaries and quiz generation; the title reads 'MANAGMENT'.", "module": "docs", "sev": "LOW", "status": "OPEN", "ago": 10, "effort": 1, "by": "sushma_h", "group": "G-DOCS",
     "whys": ["Slides contain wrong speaker notes", "The deck was built from an unrelated template", "There is no single source of truth for the architecture"]},
]
DEBTS = [
    {"key": "DEBT-501", "title": "Deploy a real backend: Flask API on Vercel with TiDB (MySQL)", "desc": "Replace the four-tier fallback with one API that computes every result.", "module": "api", "cat": "ARCHITECTURAL", "principal": 24, "status": "IN_PROGRESS", "priority": "CRITICAL", "owner": "suraj", "incidents": ["INC-501", "INC-502", "INC-508", "INC-509"], "cause": "The FastAPI backend was never deployed, so the browser fakes analytics", "ago": 12},
    {"key": "DEBT-502", "title": "Server-side authentication and role checks", "desc": "JWT login and a permission check on every endpoint.", "module": "auth", "cat": "SECURITY_DEBT", "principal": 10, "status": "IDENTIFIED", "priority": "CRITICAL", "owner": "suraj", "incidents": ["INC-503", "INC-504"], "needs": ["DEBT-501"], "cause": "The deployed app has no authentication layer", "ago": 11},
    {"key": "DEBT-503", "title": "Remove Firestore and its open rules", "desc": "Delete the client-side database path entirely.", "module": "firestore", "cat": "SECURITY_DEBT", "principal": 2, "status": "IDENTIFIED", "priority": "HIGH", "owner": "sushma_p", "incidents": ["INC-503"], "cause": "Firestore rules check field types but not who is writing", "ago": 11},
    {"key": "DEBT-504", "title": "Exact precedence-constrained optimiser", "desc": "Tree DP / branch and bound that respect prerequisites, verified against brute force.", "module": "optimiser", "cat": "CODE_SMELL", "principal": 8, "status": "IDENTIFIED", "priority": "HIGH", "owner": "sushma_m", "incidents": ["INC-505", "INC-511"], "cause": "The knapsack DP ignores prerequisites and repairs the result afterwards", "ago": 19},
    {"key": "DEBT-505", "title": "Mine churn from real git history", "desc": "git log --numstat for the CLI, GitHub API for the website.", "module": "repo-analyzer", "cat": "CODE_SMELL", "principal": 8, "status": "IDENTIFIED", "priority": "MEDIUM", "owner": "sushma_p", "incidents": ["INC-506"], "cause": "Git history is never read", "ago": 10},
    {"key": "DEBT-506", "title": "Integrate MiniLM embeddings with a measured evaluation", "desc": "ONNX MiniLM on CPU and precision@k against TF-IDF.", "module": "similarity", "cat": "ARCHITECTURAL", "principal": 10, "status": "IDENTIFIED", "priority": "MEDIUM", "owner": "sushma_h", "incidents": ["INC-507"], "needs": ["DEBT-501"], "cause": "The MiniLM model promised in the synopsis was never integrated", "ago": 9},
    {"key": "DEBT-507", "title": "Compute demo scenarios with the real engine", "desc": "Scenario datasets run through the same analysis as real projects.", "module": "demo", "cat": "ARCHITECTURAL", "principal": 12, "status": "IDENTIFIED", "priority": "HIGH", "owner": "suraj", "incidents": ["INC-508"], "needs": ["DEBT-501"], "cause": "Scenario KPIs are hard-coded constants in the page", "ago": 8},
    {"key": "DEBT-508", "title": "Freeze one design system", "desc": "One light theme, one accent colour, documented components.", "module": "components", "cat": "DOCUMENTATION", "principal": 4, "status": "IDENTIFIED", "priority": "LOW", "owner": "suraj", "incidents": ["INC-510"], "cause": "There is no agreed design system", "ago": 14},
    {"key": "DEBT-509", "title": "Single architecture document behind synopsis, code and slides", "desc": "One source of truth that the revised synopsis, report and slides are generated from.", "module": "docs", "cat": "DOCUMENTATION", "principal": 4, "status": "IDENTIFIED", "priority": "HIGH", "owner": "suraj", "incidents": ["INC-512", "INC-513"], "cause": "There is no single source of truth for the architecture", "ago": 10},
]
PEOPLE = {
    "suraj": {"name": "Suraj H Deshpande", "role": "tech_lead", "title": "Architecture, simulations, CLI"},
    "sushma_h": {"name": "Sushma Hiremath", "role": "developer", "title": "Incidents, causal graph, intelligence"},
    "sushma_p": {"name": "Sushma K Patil", "role": "developer", "title": "Repository evidence, imports"},
    "sushma_m": {"name": "Sushma Mathapati", "role": "developer", "title": "Debt ledger, optimiser, reports"},
    "guide": {"name": "Prof. P. R. Muttannavar", "role": "viewer", "title": "Project guide"},
}


def main(v1_path: str) -> None:
    root = Path(v1_path)
    hist = mining.git_history(root, None)
    scan = mining.analyze_tree(root, hist, RULES, None, {"source": "git"})
    mods = [{"name": m["name"], "path": next((p for p, n in RULES if n == m["name"]), m["name"]),
             "description": DESCR.get(m["name"], ""), "churn": m["churn"], "complexity": m["complexity"],
             "loc": m["loc"], "files": m["files"]} for m in scan["modules"]]
    mods.append({"name": "docs", "path": "docs", "description": DESCR["docs"], "churn": 0, "complexity": 0, "loc": 0, "files": 0})
    files = [[f["path"], f["module"], f["churn"], f["complexity"], f["loc"], f["lines_changed"], f["authors"]]
             for f in scan["files"]]
    satd = [[s["path"], s["line"], s["marker"], s["text"], s["module"]] for s in scan["satd"]]
    deps = sorted({(d["source"], d["target"]) for d in scan["dependencies"]})
    sc = {
        "code": "self", "order": 5, "key": "DLV1", "name": "DebtLens v1 (self-audit)", "industry": "This project",
        "tagline": "DebtLens v2 analysing the first version of DebtLens",
        "summary": "Repository evidence mined from the real v1 git history (29 commits) with the same scanner the CLI uses, plus the findings of the 17 Nov 2026 audit as incidents. The optimiser's plan for this scenario is the v2 rebuild itself.",
        "repository_url": "https://github.com/surajhdeshpande1/debtlens (branch main)",
        "tour": {"incident": "INC-501", "debt": "DEBT-501", "module": "data-layer", "budget": 40, "cascade_module": "mock-engine",
                 "headline": "v1 never deployed its backend, so the live site faked results; deploying a real API unblocks four other fixes."},
        "people": PEOPLE, "modules": mods, "dependencies": [list(d) for d in deps], "files": files, "satd": satd,
        "incidents": INCIDENTS, "debts": DEBTS,
        "evidence_source": {"commits": scan["commits_analyzed"], "files": scan["files_analyzed"]},
    }
    out = Path(__file__).resolve().parent.parent / "debtlens" / "scenarios" / "self.json"
    out.write_text(json.dumps(sc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {out} ({scan['commits_analyzed']} commits, {scan['files_analyzed']} files, {len(satd)} markers)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/v1wt")
