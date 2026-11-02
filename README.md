# DebtLens: An Incident-Driven Technical Debt Intelligence and Remediation Platform

**Basaveshwar Engineering College Bagalkote**  
**Department of Information Science and Engineering**  
**Course / Code:** 5th Semester Mini Project — BISA531P (Academic Year 2026-27)  

### Project Associates
1. **Suraj H Deshpande** (2BA24IS171) — *System Architecture & Mathematical Formulations*
2. **Sushma Hiremath** (2BA24IS172) — *Causal Network & Centrality Engine*
3. **Sushma Krishnagouda Patil** (2BA24IS173) — *Repository Evidence & AST Static Analysis*
4. **Sushma Mathapati** (2BA24IS174) — *Payoff 0/1 Knapsack & Executive Reporting*

### Project Guide
- **Prof. P. R. Muttannavar**, Assistant Professor, Dept. of Information Science & Engineering

---

## 1. Executive Summary & Problem Addressed
When software failures occur in production, teams typically restore service quickly and close the ticket. The underlying structural weakness that permitted the failure remains unquantified, undocumented, and unscheduled.

**DebtLens** treats the missing linkage between incidents, root causes, and technical debt as a first-class engineering concern:
1. **Ingests repository evidence**: Extracts code churn, cyclomatic complexity (McCabe AST), module dependencies (blast radius via DFS), and self-admitted debt markers (`TODO`, `FIXME`, `HACK`).
2. **Directed Causal Graph (5-Whys)**: Normalizes and converges root causes across incidents, measuring systemic significance using **NetworkX Degree and Betweenness Centrality**.
3. **Debt Pricing & Break-Even Ledger**: Represents every debt item as a financial instrument with an effort principal $P(d)$ and accruing interest $I(d)$. Flags when $I(d) > P(d)$ (break-even point exceeded).
4. **Payoff Optimiser**: Formulates remediation scheduling as a **constrained 0/1 knapsack dynamic programming problem** over topologically ordered debt dependencies.
5. **Modern Light-Themed Web Platform**: Built with React 18, TypeScript, Tailwind CSS, Recharts, and interactive Cytoscape.js directed graph visualization.

---

## Live Cloud Deployment (Vercel & Supabase)

The complete DebtLens platform is deployed and live on Vercel:

🌐 **Production Website**: **[https://debtlens-platform.vercel.app](https://debtlens-platform.vercel.app)**  
*(Also accessible at: [https://frontend-five-taupe-cj6iikpdis.vercel.app](https://frontend-five-taupe-cj6iikpdis.vercel.app))*

- **Global 24/7 Availability**: Hosted on Vercel's global Edge CDN, accessible from any device (laptop, mobile, tablet) without local servers.
- **Supabase Cloud Backend**: Direct cloud connection to Supabase PostgreSQL with real-time persistence.
- **Embedded FinTech Corpus Engine**: Seamlessly executes all 8 modules (M1–M8), including 0/1 knapsack dynamic programming, AST complexity evaluation, DBSCAN clustering, and pairwise incident comparisons directly in the browser with `localStorage` state persistence when offline.
- **Local Dev Fallback**: Automatically connects to local FastAPI (`http://127.0.0.1:8000`) when running locally.

---

### Supabase Cloud Database Setup (3 Minutes)

1. Create a free project at **[supabase.com](https://supabase.com)**.
2. In your Supabase Dashboard, open the **SQL Editor**, paste the contents of [`supabase_schema.sql`](file:///c:/Users/suraj/Desktop/Mini%20project%20ISE/supabase_schema.sql), and click **Run**.  
   *(This creates all 12 relational tables, Row-Level Security policies, and seeds the realistic FinTech enterprise corpus).*
3. Under **Project Settings -> API**, copy your **Project URL** and **anon public Key**.
4. In Vercel (or in `frontend/.env.local`):
   - Set `VITE_SUPABASE_URL = https://your-project.supabase.co`
   - Set `VITE_SUPABASE_ANON_KEY = your-anon-key`
5. The web platform will immediately display **"Supabase Cloud (PostgreSQL)"** in the top navbar and synchronize all incident logs, debt items, and causal graphs directly to Supabase!

---

## 2. Core Mathematical Formulations (Section 7.3)

### A. Hybrid Incident Similarity
$$\text{sim}(i, j) = \alpha \cdot \cos(\text{tfidf}_i, \text{tfidf}_j) + (1 - \alpha) \cdot \cos(\text{emb}_i, \text{emb}_j)$$
- Fast, CPU-resident hybrid combining TF-IDF lexical frequency and semantic subword embeddings.
- DBSCAN over cosine distance clusters root causes without requiring fixed $k$ and isolates one-off incidents as noise.
- **Regression Detection**: Incident $i$ is flagged as a regression of resolved incident $j$ when $\text{sim}(i, j) \ge \tau$, both affect the same module, and $i$ occurs after the resolution timestamp of $j$.

### B. Accrued Technical Debt Interest
$$I(d) = \sum_{k \in \text{incidents}(d)} \left[ \text{severity\_weight}(k) \cdot \text{resolution\_effort}(k) \right] + \lambda_1 \cdot \text{churn}(d) + \lambda_2 \cdot \text{blast\_radius}(d)$$
- $\text{blast\_radius}(d)$: Number of transitively dependent modules discovered via Depth-First Search (DFS) on the module import graph.
- **Break-Even Condition**: A debt item is past break-even when $I(d) > P(d)$.

### C. Remediation Planning (Payoff Optimiser)
$$\text{Maximize } \sum R(d) \cdot x(d) \quad \text{subject to} \quad \sum P(d) \cdot x(d) \le B, \quad x(d) \in \{0, 1\}$$
- Solved via 0/1 Knapsack dynamic programming with quantized effort steps.
- Prerequisite constraints are strictly enforced via topological sorting of the debt dependency graph before dynamic programming packing.

---

## 3. Advanced Features & Interactive Tools

| Feature | Module | Description |
| :--- | :--- | :--- |
| **Interactive Causal Graph** | M3 | Cytoscape.js canvas with Force-directed (CoSE), Tree (Breadthfirst), and Radial layouts, node search, and direct cause-to-debt registration. |
| **AST Code Playground** | M5 | Live in-browser Python AST parser analyzing McCabe complexity, branches (`if`, `loops`, `exceptions`, `bool_ops`), and SATD markers (`TODO`/`FIXME`), with 1-click benchmark presets. |
| **Pairwise Similarity Comparator** | M6 | Pick any 2 incidents, tune $\alpha$ weight, and view lexical vs semantic cosine scores with shared domain tokens. |
| **2D Segmented Knapsack Bar** | M7 | Visual sprint capacity packing bar with interactive "Force Include" constraint locks, transitive prerequisite closure, and ROI metrics. |
| **Interactive Lifecycle Stepper** | M2/M4 | 1-click status progression bars across Incident intake (`Open` -> `Investigating` -> `Resolved`) and Technical Debt (`Identified` -> `Prioritized` -> `In Progress` -> `Remediated`). |
| **Direct CSV Data Exports** | M2/M4 | 1-click RFC-4180 compliant CSV exports for the entire Incident Register and Technical Debt Ledger. |
| **Economic Trajectory Area Chart** | M8 | 30-day cumulative failure drag curve vs fixed principal break-even line. |
| **Viva Voce Defense Guide** | M8 | 10+ essential viva questions and model answers for student defense before department faculty and external examiners. |

---

## 4. Quick Start & Execution

### Prerequisites
- Python 3.11+
- Node.js v18+ and npm

### One-Click Launch (Windows)
Double-click:
```bat
start_all.bat
```
This starts both the FastAPI backend and React frontend dev server in parallel!

---

### Manual Launch

#### 1. Backend Service (FastAPI)
```bash
cd backend
venv\Scripts\activate
python run.py
```
- **Backend API URL**: `http://127.0.0.1:8000`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`

#### 2. Frontend Application (React 18 + TypeScript + Vite)
```bash
cd frontend
npm run dev
```
- **Web Application URL**: `http://localhost:5173`

---

## 5. Seeded Test Accounts (RBAC)

| Role | Email | Password | Representative Associate |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@debtlens.io` | `password123` | Suraj H Deshpande |
| **Technical Lead** | `lead@debtlens.io` | `password123` | Sushma Hiremath |
| **Developer** | `dev@debtlens.io` | `password123` | Sushma Krishnagouda Patil |
| **Viewer** | `viewer@debtlens.io` | `password123` | Sushma Mathapati |

*You can also switch active roles instantly from the top-right RBAC pill in the navigation bar!*

---

## 6. Running Automated Tests

To run the complete analytical test suite:
```bash
cd backend
venv\Scripts\pytest -v
```
All 13 test cases covering hybrid similarity, DBSCAN, knapsack DP with transitive closure, causal centrality, AST complexity, SATD scanning, CSV exports, and ReportLab PDF generation pass 100% with 0 warnings.
