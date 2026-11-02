import React, { useState } from 'react';
import { 
  Play, 
  Presentation, 
  CheckCircle2, 
  ArrowRight, 
  HelpCircle, 
  Calculator, 
  GitFork, 
  AlertTriangle, 
  Coins, 
  Code2, 
  FileDown, 
  Sparkles, 
  BookmarkCheck, 
  ChevronRight, 
  Copy, 
  Check,
  Terminal,
  Layers,
  GraduationCap,
  ShieldCheck
} from 'lucide-react';
import { NavTab } from '../components/Sidebar';
import { useToast } from '../context/ToastContext';

interface DemoGuidePageProps {
  onNavigateTab: (tab: NavTab) => void;
  onOpenIncidentModal: () => void;
  onOpenDebtModal: () => void;
}

export const DemoGuidePage: React.FC<DemoGuidePageProps> = ({
  onNavigateTab,
  onOpenIncidentModal,
  onOpenDebtModal
}) => {
  const { showToast } = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    showToast('success', 'Copied to Clipboard', 'Speech snippet copied for easy reading.');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const demoSteps = [
    {
      step: 1,
      title: 'Problem Motivation & Executive Telemetry',
      module: 'M8 Executive Overview',
      tab: 'dashboard' as NavTab,
      targetName: 'Executive Dashboard',
      timeCode: '0:00 - 0:50',
      description: 'Establish the core industry problem: Engineering teams struggle to justify refactoring because SonarQube "code smells" lack business impact. DebtLens bridges this by tracking the financial failure interest caused by production incidents.',
      speakingScript: `Good morning respected professors and our guide Prof. P. R. Muttannavar. Today we present DebtLens: an Incident-Driven Technical Debt Intelligence and Payoff Remediation Scheduler.

Traditional static analysis tools like SonarQube flag code smells, but they cannot answer the fundamental engineering question: "How much money and time is this technical debt actually costing our organization in production outages?"

DebtLens solves this by linking every production outage through a directed 5-Whys causal graph directly to technical debt items, calculating compounded financial drag, and mathematically optimizing sprint remediation using 0/1 knapsack dynamic programming.`,
      actionLabel: 'Explore Live Executive Dashboard',
      keyMetrics: ['Active Incidents: 2', 'Debt Principal: 90h', 'Accrued Interest Drag: 182.2h', 'Break-Even Ratio: 86%']
    },
    {
      step: 2,
      title: 'Production Incident Intake & Directed 5-Whys Root Cause',
      module: 'M2 Incident Management',
      tab: 'incidents' as NavTab,
      targetName: 'Incident Management Register',
      timeCode: '0:50 - 1:40',
      description: 'Show how incidents are logged with severity, resolution hours, and an interactive 5-Whys diagnostic stepper that converges into root causes.',
      speakingScript: `Here in Module M2, when a production incident occurs (for example, a Stripe webhook timeout or database connection starvation), the team logs the incident with its severity and resolution effort.

Crucially, instead of treating 5-Whys as plain text in a Jira ticket, DebtLens records each why-level systematically. Notice how resolving this incident automatically calculates the inflicted economic cost and links the failure mechanism to upstream services.`,
      actionLabel: 'Inspect Incident Register & Lifecycle',
      keyMetrics: ['Severity Mapping (CRITICAL to LOW)', 'Lifecycle: Open → Investigating → Resolved', 'Hybrid Similarity Matching (TF-IDF + Semantics)']
    },
    {
      step: 3,
      title: 'Reusable Directed Causal Graph (NetworkX Graph Analytics)',
      module: 'M3 Causal Graph (5 Whys)',
      tab: 'causal' as NavTab,
      targetName: 'Directed Causal Graph',
      timeCode: '1:40 - 2:30',
      description: 'Demonstrate Cytoscape canvas visualization where root cause nodes are shared across multiple incidents. Show betweenness centrality ranking.',
      speakingScript: `In Module M3, we visualize our directed acyclic causal graph powered by NetworkX graph theory algorithms.

In a large enterprise, different incidents in different microservices frequently converge on the exact same structural root cause—such as connection pool starvation or lack of idempotency keys.

Our backend computes Betweenness Centrality CB(v) and Degree Centrality to mathematically identify which architectural flaw is the critical bottleneck in the entire software ecosystem. Clicking any node allows one-click conversion into an actionable technical debt backlog item.`,
      actionLabel: 'Launch Directed Causal Graph',
      keyMetrics: ['Betweenness Centrality CB(v)', 'Cytoscape.js Force-Directed Layout', 'Category Encoding (Database, Network, Concurrency)']
    },
    {
      step: 4,
      title: 'The Economic Debt Ledger & Break-Even Criterion',
      module: 'M4 Technical Debt Ledger',
      tab: 'debt' as NavTab,
      targetName: 'Technical Debt Registry',
      timeCode: '2:30 - 3:20',
      description: 'Explain the core pricing formula: Principal P(d) vs Accrued Interest I(d), and demonstrate the Break-Even Criterion where I(d) > P(d).',
      speakingScript: `Module M4 is the financial heart of DebtLens. We define two mathematical quantities:
First, Principal P(d): the fixed engineering hours needed to permanently refactor the flaw.
Second, Accrued Interest I(d): the compounding failure cost inflicted by all incidents caused by this defect, weighted by code churn and transitive blast radius.

Notice the "EXCEEDED" badge: when Accrued Interest exceeds Principal, the debt item is past break-even. This gives engineering leads irrefutable mathematical proof to executives that continuing to ignore this debt is more expensive than fixing it.`,
      actionLabel: 'Open Financial Debt Ledger',
      keyMetrics: ['I(d) = Σ[sev · effort] + λ₁·churn + λ₂·blast', 'Break-Even Status: I(d) > P(d)', 'Net Economic Drag Indicator']
    },
    {
      step: 5,
      title: 'Payoff Optimization: Bounded 0/1 Knapsack Dynamic Programming',
      module: 'M7 Payoff Optimiser',
      tab: 'optimiser' as NavTab,
      targetName: 'Payoff Optimiser',
      timeCode: '3:20 - 4:10',
      description: 'Demonstrate the capacity budget slider (10h to 120h). Show how the dynamic programming algorithm packs optimal debt items while enforcing topological prerequisites.',
      speakingScript: `In Module M7, we solve the remediation scheduling problem. A software team cannot fix all technical debt in one sprint; they only have a fixed capacity budget B (such as 40 engineering hours).

Greedy sorting by ROI fails because technical debt items are discrete 0/1 choices with topological dependencies—for example, you cannot add database read replicas before fixing the connection pool.

We formulate this as a constrained 0/1 Knapsack problem with prerequisite sequencing, solved via dynamic programming in O(N · B) time. Watch as I move the capacity slider: the algorithm instantly re-packs the sprint to maximize total risk reduction.`,
      actionLabel: 'Run Interactive Knapsack Optimiser',
      keyMetrics: ['Max Σ R(d)·x(d) s.t. Σ P(d)·x(d) ≤ B', 'Topological Execution Ordering', 'Real-time Sensitivity What-If Curve']
    },
    {
      step: 6,
      title: 'Static Evidence AST Playground & Automated Audit Report',
      module: 'M5 & M8 Evidence and Audit',
      tab: 'repository' as NavTab,
      targetName: 'Repository AST Playground',
      timeCode: '4:10 - 5:00',
      description: 'Show Python AST McCabe cyclomatic complexity visitor, code churn scatter plot, self-admitted technical debt (SATD), and download the PDF report.',
      speakingScript: `Finally, in Module M5, we extract physical evidence directly from code. Our backend runs Python AST visitors to compute McCabe Cyclomatic Complexity, tracks Git commit churn, and scans for Self-Admitted Technical Debt markers like TODO and FIXME.

You can paste raw code into our AST Playground and immediately inspect its branch decision count and complexity.

To conclude, with one click in the top bar, DebtLens compiles a complete ISO-compliant technical debt audit report as a downloadable PDF. The entire system is deployed live on Vercel with Google Cloud Firestore in asia-south1. Thank you, and we welcome your questions!`,
      actionLabel: 'Test AST Code Playground',
      keyMetrics: ['AST Visitor Cyclomatic Complexity', 'Git Commit Churn Correlation', 'Automated One-Click PDF Audit Report']
    }
  ];

  const vivaQuestions = [
    {
      q: 'Why did you choose 0/1 Knapsack Dynamic Programming instead of a Greedy approach?',
      a: 'A greedy algorithm (sorting by Risk/Effort ratio) only works for fractional knapsack problems where items can be partially chosen. Technical debt items are discrete indivisible units (0 or 1)—you cannot refactor half a connection pool. Furthermore, debt items have topological prerequisite constraints (e.g., DEBT-101 must be completed before DEBT-102). 0/1 Knapsack DP guarantees global optimality within capacity budget B in O(N · B) pseudo-polynomial time.',
      module: 'Module M7 (Knapsack DP)'
    },
    {
      q: 'What is the mathematical meaning of Betweenness Centrality in your causal graph?',
      a: 'Betweenness Centrality CB(v) measures the fraction of all-pairs shortest paths in the directed causal graph that pass through node v: CB(v) = Σ [σ_st(v) / σ_st]. A high betweenness centrality signifies a systemic root cause that bridges multiple independent failure chains across different microservices. Fixing a high-betweenness node eliminates the root cause for multiple classes of production incidents simultaneously.',
      module: 'Module M3 (NetworkX Causal Graph)'
    },
    {
      q: 'Explain the Accrued Interest equation I(d) and the purpose of λ₁ and λ₂.',
      a: 'I(d) = Σ [sev(k) · effort(k)] + λ₁·churn(d) + λ₂·blast_radius(d). The summation quantifies historical incident fire-fighting hours directly attributed to debt item d. λ₁ (0.15) scales Git commit churn frequency, representing developer friction and merge conflict pressure. λ₂ (1.8) scales transitive blast radius: the number of downstream modules that depend on this component, determined via Depth-First Search (DFS) traversal of the module dependency graph.',
      module: 'Module M4 (Financial Ledger)'
    },
    {
      q: 'Why DBSCAN clustering instead of K-Means for grouping root causes?',
      a: 'K-Means requires specifying the number of clusters (k) in advance, which is unknown in dynamic software incident streams, and assumes spherical clusters. DBSCAN (Density-Based Spatial Clustering of Applications with Noise) automatically discovers the natural number of clusters based on density radius (ε) and minimum sample count, and correctly classifies unique, non-repeating root causes as noise/outliers (cluster -1) rather than forcing them into artificial groups.',
      module: 'Module M6 (Incident Intelligence)'
    },
    {
      q: 'What cloud architecture and database are running this system?',
      a: 'DebtLens uses a multi-tiered architecture: The frontend is built in React 19 + TypeScript + Vite and hosted globally on Vercel with strict CSP and HSTS security headers. The database is Google Cloud Firestore located in the asia-south1 (Mumbai) cluster, maintaining 10 collections (incidents, debt_items, cause_nodes, etc.). The analytical backend runs FastAPI 0.115 on Python 3.12 utilizing NetworkX, Scikit-learn, and NumPy.',
      module: 'Cloud & System Architecture'
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-indigo-200 border border-white/15 mb-3">
            <GraduationCap className="w-4 h-4 text-indigo-300" />
            <span>Academic Mini Project BISA531P • Dept. of ISE, BEC Bagalkote</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Faculty Demonstration Lab & Viva Defense Guide
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Everything you need to deliver a flawless, high-scoring viva presentation. Follow the structured 5-minute walkthrough, trigger live actions on demand, and master the theoretical answers to tough examiner questions.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>Project Associates: <strong>Suraj, Sushma H, Sushma P, Sushma M</strong></span>
            <span>•</span>
            <span>Guide: <strong>Prof. P. R. Muttannavar</strong></span>
          </div>
        </div>

        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Step Stepper Navigation */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-2 sticky top-20">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Presentation className="w-4 h-4 text-indigo-600" />
              <span>5-Minute Presentation Flow</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">Step {activeStep + 1} of {demoSteps.length}</span>
          </div>

          <div className="space-y-1.5 pt-1">
            {demoSteps.map((s, idx) => {
              const isActive = activeStep === idx;
              return (
                <button
                  key={s.step}
                  onClick={() => setActiveStep(idx)}
                  className={`w-full text-left p-3 rounded-lg text-xs transition-all flex items-start space-x-2.5 cursor-pointer ${
                    isActive 
                      ? 'bg-indigo-50/80 text-indigo-950 font-semibold border border-indigo-200 shadow-2xs' 
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {s.step}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{s.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-1">{s.timeCode}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{s.module}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Action Buttons */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <button
              onClick={() => onNavigateTab('dashboard')}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>Launch Live App Presentation</span>
            </button>
          </div>
        </div>

        {/* Right: Active Step Script, Actions & Viva Help */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active Step Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
                  Step {demoSteps[activeStep].step} • {demoSteps[activeStep].timeCode}
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  {demoSteps[activeStep].title}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  Module: <strong>{demoSteps[activeStep].module}</strong>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab(demoSteps[activeStep].tab)}
                className="self-start sm:self-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
              >
                <span>{demoSteps[activeStep].actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Explanation / What to Highlight */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900 block mb-1">What to Highlight to Faculty:</strong>
              {demoSteps[activeStep].description}
            </div>

            {/* Exact Word-for-Word Speaking Script */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Exact Speaking Script (Read or Paraphrase to Faculty):</span>
                </span>

                <button
                  onClick={() => copyToClipboard(demoSteps[activeStep].speakingScript, activeStep)}
                  className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 cursor-pointer"
                >
                  {copiedIndex === activeStep ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIndex === activeStep ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs leading-relaxed font-sans whitespace-pre-line border border-slate-800 shadow-inner">
                {demoSteps[activeStep].speakingScript}
              </div>
            </div>

            {/* Key Technical Highlights Checklist */}
            <div>
              <span className="text-xs font-bold text-slate-900 block mb-2">Key Technical Concepts on Screen:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {demoSteps[activeStep].keyMetrics.map((km, i) => (
                  <div key={i} className="p-2 rounded-lg bg-indigo-50/50 border border-indigo-100 text-[11px] font-medium text-indigo-900 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{km}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stepper Navigation Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                disabled={activeStep === 0}
                onClick={() => setActiveStep(prev => prev - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
              >
                ← Previous Step
              </button>

              <button
                disabled={activeStep === demoSteps.length - 1}
                onClick={() => setActiveStep(prev => prev + 1)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-30 cursor-pointer"
              >
                Next Step →
              </button>
            </div>
          </div>

          {/* Core Viva Q&A Defense Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <BookmarkCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Top Faculty Viva Questions & Mathematical Defense
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Anticipated questions external examiners and professors ask, with precise academic justifications:
            </p>

            <div className="space-y-3">
              {vivaQuestions.map((vq, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-slate-50 transition-colors space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">
                      Q{idx + 1}: {vq.q}
                    </h4>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      {vq.module}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed pt-1">
                    <strong className="text-emerald-700 font-semibold">Answer: </strong>
                    {vq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
