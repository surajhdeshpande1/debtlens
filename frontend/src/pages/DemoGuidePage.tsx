import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowRight, 
  Terminal, 
  GraduationCap, 
  FileDown, 
  Copy, 
  Check, 
  Zap, 
  SkipForward
} from 'lucide-react';
import { NavTab } from '../components/Sidebar';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';

interface DemoGuidePageProps {
  onNavigateTab: (tab: NavTab) => void;
  onOpenIncidentModal: () => void;
  onOpenDebtModal: () => void;
}

interface DemoStage {
  id: number;
  name: string;
  moduleBadge: string;
  tab: NavTab;
  heading: string;
  narrative: string;
  speakingScript: string;
  logs: string[];
  metrics: { label: string; value: string; badge?: string }[];
  visualType: 'incident' | 'causal' | 'ledger' | 'knapsack' | 'ast' | 'complete';
}

export const DemoGuidePage: React.FC<DemoGuidePageProps> = ({
  onNavigateTab,
  onOpenIncidentModal,
  onOpenDebtModal
}) => {
  const { showToast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<any>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const STAGE_DURATION_MS = 6000;

  const stages: DemoStage[] = [
    {
      id: 1,
      name: 'Incident Ingestion & Severity',
      moduleBadge: 'M2 Incident Intake',
      tab: 'incidents',
      heading: 'Simulating Production Outage (Stripe Webhook Timeout)',
      narrative: 'A real-time critical payment failure is ingested into Google Cloud Firestore. Severity weight is locked to Critical (2.5x factor).',
      speakingScript: `Respected guide Prof. P. R. Muttannavar and faculty, we begin our demonstration by simulating a real-time production outage: INC-2026-901 in our payments microservice.

Unlike plain ticketing systems, DebtLens instantly records resolution effort (12.0 hours) and maps its severity to a 2.5x economic weighting factor in Firestore.`,
      logs: [
        '[00:01] INGEST: Received production webhook failure telemetry on /v1/webhooks/stripe',
        '[00:02] TELEMETRY: Ingested INC-2026-901 into Firestore asia-south1 cluster',
        '[00:03] SEVERITY: Classified as CRITICAL (economic weight = 2.50x, resolution_hours = 12.0)',
        '[00:04] SIMILARITY: TF-IDF + subword cosine distance matched INC-103 with 78% confidence'
      ],
      metrics: [
        { label: 'Incident Ticket', value: 'INC-2026-901', badge: 'CRITICAL' },
        { label: 'Affected Module', value: 'payments', badge: 'PORTFOLIO' },
        { label: 'Resolution Effort', value: '12.0 Hours', badge: '2.5x WEIGHT' }
      ],
      visualType: 'incident'
    },
    {
      id: 2,
      name: 'Directed 5-Whys Causal Convergence',
      moduleBadge: 'M2 & M3 5-Whys Graph',
      tab: 'causal',
      heading: 'Cascading Diagnostic Chain into Shared Root Cause',
      narrative: 'The 5-Whys diagnostic engine steps through failure layers, converging into Root Cause Node #1 (Connection Pool Exhaustion).',
      speakingScript: `Next, our 5-Whys diagnostic engine executes. Instead of text notes in a Jira ticket, every why-level is a structured directed vector:
Why 1: Webhook 504 Timeout.
Why 2: DB connection pool exhausted.
Why 3: DB transaction held open during external 3rd-party HTTP call.
Why 4: Synchronous retry logic inside atomic transaction.
Why 5: Unbounded connection acquisition waiting.
Notice how this automatically locks onto shared root cause Node #1.`,
      logs: [
        '[00:05] 5-WHYS [L1]: Why did webhook fail? -> HTTP 504 Gateway Timeout on checkout',
        '[00:06] 5-WHYS [L2]: Why timeout? -> HikariCP connection pool exhausted (30/30 connections busy)',
        '[00:07] 5-WHYS [L3]: Why pool busy? -> Long-lived atomic database transactions waiting on Avalara tax API',
        '[00:08] 5-WHYS [L4]: Why waiting? -> Synchronous retry loop executing inside database lock scope',
        '[00:09] 5-WHYS [L5]: ROOT CAUSE -> Connection Pool Exhaustion under Unbounded Waiting (Node #1)'
      ],
      metrics: [
        { label: 'Causal Chain Depth', value: '5 Levels', badge: 'CONVERGED' },
        { label: 'Target Root Cause', value: 'Node #1', badge: 'HikariCP Pool' },
        { label: 'Systemic Classification', value: 'CONCURRENCY', badge: 'SHARED' }
      ],
      visualType: 'causal'
    },
    {
      id: 3,
      name: 'NetworkX Betweenness Centrality',
      moduleBadge: 'M3 Centrality Analytics',
      tab: 'causal',
      heading: 'Topological Centrality Identifies Systemic Architecture Bottleneck',
      narrative: 'NetworkX evaluates all-pairs shortest paths across the directed causal graph. Node #1 emerges as the #1 systemic bottleneck with Betweenness CB(v) = 0.2350.',
      speakingScript: `Here in Module M3, our NetworkX backend computes Betweenness Centrality across the directed causal graph:
CB(v) measures the ratio of all-pairs shortest paths passing through this node.
Node #1 scores 0.2350—the highest in the entire architecture. This proves mathematically that fixing connection pool exhaustion will eliminate failure paths for payments, orders, and settlement simultaneously.`,
      logs: [
        '[00:10] NETWORKX: Built directed causal graph: 14 nodes, 19 directed edges',
        '[00:11] ALGORITHM: Executing Betweenness Centrality CB(v) = Σ [σ_st(v) / σ_st]',
        '[00:12] RANK #1: Node #1 (Connection Pool Exhaustion) -> CB = 0.2350, Degree = 6',
        '[00:13] RANK #2: Node #4 (Unindexed Table Scans) -> CB = 0.0812, Degree = 4',
        '[00:14] TRANSFORMATION: One-click converted Node #1 into Technical Debt Item DEBT-101'
      ],
      metrics: [
        { label: 'Betweenness CB(v)', value: '0.2350', badge: 'RANK #1' },
        { label: 'Degree Centrality', value: '0.4286', badge: 'HIGH DEGREE' },
        { label: 'Transitive Impact', value: '6 Microservices', badge: 'BOTTLENECK' }
      ],
      visualType: 'causal'
    },
    {
      id: 4,
      name: 'Financial Ledger & Break-Even Criterion',
      moduleBadge: 'M4 Technical Debt Ledger',
      tab: 'debt',
      heading: 'Pricing Technical Debt: Principal P(d) vs Accrued Interest I(d)',
      narrative: 'We price the debt item. Principal P(d) is 16.0h. Accrued Interest I(d) reaches 48.5h. The item crosses break-even with +32.5h of Net Economic Drag.',
      speakingScript: `Now, in Module M4, DebtLens prices technical debt using financial rigor.
Principal P(d) is 16 hours to refactor the pool manager.
Accrued Interest I(d) is calculated using our formula: historical incident hours weighted by Git commit churn λ₁ and transitive blast radius λ₂.
Accrued Interest equals 48.5 hours! Because Interest exceeds Principal, the item crosses the Break-Even Criterion. We have spent 32.5 more hours fighting fires than it would cost to repair it permanently!`,
      logs: [
        '[00:15] FORMULATION: Computing I(d) = Σ[sev · effort] + λ₁·churn + λ₂·blast',
        '[00:16] INCIDENT COST: (2.50 weight × 12.0h) = 30.0h direct failure downtime',
        '[00:17] CHURN FACTOR: λ₁=0.15 × 45 Git edits = +6.75h code churn friction',
        '[00:18] BLAST FACTOR: λ₂=1.80 × 6 downstream services = +10.80h transitive drag',
        '[00:19] ACCRUED INTEREST: I(d) = 48.5h | PRINCIPAL: P(d) = 16.0h',
        '[00:20] BREAK-EVEN STATUS: EXCEEDED! Net Economic Drag = +32.5 hours'
      ],
      metrics: [
        { label: 'Principal P(d)', value: '16.0 hrs', badge: 'FIX EFFORT' },
        { label: 'Accrued Interest I(d)', value: '48.5 hrs', badge: 'COMPOUNDED' },
        { label: 'Break-Even Status', value: 'EXCEEDED', badge: '+32.5h DRAG' }
      ],
      visualType: 'ledger'
    },
    {
      id: 5,
      name: '0/1 Knapsack Dynamic Programming',
      moduleBadge: 'M7 Payoff Optimiser',
      tab: 'optimiser',
      heading: 'Solving Optimal Sprint Allocation under 40h Budget Constraint',
      narrative: 'Given sprint capacity B = 40h, the 0/1 Knapsack DP algorithm packs optimal discrete items, respects prerequisites, and yields 142 risk reduction points.',
      speakingScript: `In Module M7, we solve sprint scheduling. The engineering team has a capacity budget B of 40 hours.
Greedy sorting fails because items are discrete (0/1) and have prerequisite dependencies.
Our 0/1 Knapsack Dynamic Programming algorithm maximizes total risk reduction subject to Σ P(d)·x(d) ≤ 40.
In O(N · B) time, it packs DEBT-101, DEBT-102, and DEBT-104 (38.5h / 40h utilization), giving a 3.69x ROI and the exact topological execution sequence.`,
      logs: [
        '[00:21] KNAPSACK: Formulating Max Σ R(d)·x(d) s.t. Σ P(d)·x(d) ≤ 40.0h capacity',
        '[00:22] TOPOLOGY: Validating prerequisite constraints (DEBT-101 -> DEBT-102)',
        '[00:23] DYNAMIC PROG: Running 2D DP recurrence table in O(N · B) time',
        '[00:24] SOLUTION: Selected 3 items: DEBT-101 (16h), DEBT-102 (14h), DEBT-104 (8.5h)',
        '[00:25] METRICS: Total effort = 38.5h / 40h (96.2% capacity), Risk Reduced = 142 pts, ROI = 3.69x'
      ],
      metrics: [
        { label: 'Capacity Utilization', value: '38.5 / 40h', badge: '96.2% PACKED' },
        { label: 'Risk Reduction', value: '142 Points', badge: 'MAXIMIZED' },
        { label: 'Payoff Return (ROI)', value: '3.69x', badge: 'INTEREST/P' }
      ],
      visualType: 'knapsack'
    },
    {
      id: 6,
      name: 'Code AST Static Analysis & SATD',
      moduleBadge: 'M5 Repository Evidence',
      tab: 'repository',
      heading: 'Extracting McCabe Cyclomatic Complexity & Self-Admitted Debt',
      narrative: 'Python AST visitor inspects code decision branch points. Cyclomatic complexity evaluates to 14, and SATD markers (TODO, FIXME, BUG) are flagged.',
      speakingScript: `In Module M5, we extract physical evidence directly from code. Our backend runs Python AST visitors:
The visitor traverses decision constructs—If, While, For, Except—and computes a McCabe Cyclomatic Complexity of 14, which exceeds the clean code threshold of 10.
Simultaneously, our SATD scanner extracts developer comments like FIXME and HACK.`,
      logs: [
        '[00:26] AST VISITOR: Parsing Python code into Abstract Syntax Tree (ast.parse)',
        '[00:27] DECISION POINTS: Counted 13 branching constructs (If: 6, While: 1, Except: 2, BoolOp: 4)',
        '[00:28] MCCABE COMPLEXITY: CC = 1 + 13 = 14 (Risk Rating: HIGH / DANGEROUS)',
        '[00:29] SATD SCANNER: Found 3 self-admitted debt markers: # TODO (line 2), # FIXME (line 3), # HACK (line 11)'
      ],
      metrics: [
        { label: 'Cyclomatic Complexity', value: 'CC: 14', badge: 'HIGH RISK' },
        { label: 'Decision Branches', value: '13 Nodes', badge: 'AST VISITOR' },
        { label: 'SATD Comments', value: '3 Markers', badge: 'TODO/FIXME' }
      ],
      visualType: 'ast'
    },
    {
      id: 7,
      name: 'Simulation Complete & Audit PDF',
      moduleBadge: 'M8 Knowledge & Audit',
      tab: 'knowledge',
      heading: 'All 8 Modules Validated • Live Cloud Telemetry Active',
      narrative: 'The end-to-end pipeline has executed seamlessly: from incident intake to causal graph, break-even pricing, knapsack optimization, and compliance export.',
      speakingScript: `Respected professors, in under 5 minutes we have demonstrated the full end-to-end DebtLens lifecycle:
1. Real-time incident logging in M2.
2. Causal graph convergence and Betweenness Centrality in M3.
3. Financial debt pricing and Break-Even proof in M4.
4. Bounded 0/1 Knapsack optimization in M7.
5. Static AST evidence in M5.
And with one click on the Export PDF button, our system produces an executive compliance audit report. Thank you!`,
      logs: [
        '[00:30] PIPELINE: All 8 core architectural modules successfully executed and verified',
        '[00:31] FIRESTORE: Telemetry synchronized across 10 collections in asia-south1 (Mumbai)',
        '[00:32] SECURITY: TLS 1.3, Strict-Transport-Security, and Content-Security-Policy verified',
        '[00:33] STATUS: Complete autonomous pipeline test passed with 100% test assertion coverage!'
      ],
      metrics: [
        { label: 'Pipeline Status', value: '100% Passed', badge: 'VERIFIED' },
        { label: 'Database Cluster', value: 'asia-south1', badge: 'FIRESTORE' },
        { label: 'Audit Compliance', value: 'ISO-25010', badge: 'READY' }
      ],
      visualType: 'complete'
    }
  ];

  const currentStage = stages[currentStageIndex];

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalStep = 100;
    const totalDuration = STAGE_DURATION_MS / simSpeed;

    timerRef.current = setInterval(() => {
      setStageProgress((prev) => {
        if (prev >= 100) {
          setCurrentStageIndex((current) => {
            if (current >= stages.length - 1) {
              setIsRunning(false);
              showToast('success', 'Autonomous Demo Complete', 'All 7 pipeline stages successfully demonstrated!');
              return current;
            }
            const nextIdx = current + 1;
            setTerminalLogs((oldLogs) => [...oldLogs, ...stages[nextIdx].logs]);
            showToast('info', `Stage ${nextIdx + 1}: ${stages[nextIdx].name}`, stages[nextIdx].heading);
            return nextIdx;
          });
          return 0;
        }
        return prev + (intervalStep / totalDuration) * 100;
      });
    }, intervalStep);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, simSpeed, stages.length]);

  const handleStartAutoRun = () => {
    if (currentStageIndex >= stages.length - 1) {
      setCurrentStageIndex(0);
      setTerminalLogs([...stages[0].logs]);
    } else if (terminalLogs.length === 0) {
      setTerminalLogs([...stages[0].logs]);
    }
    setStageProgress(0);
    setIsRunning(true);
    showToast('success', 'Autonomous Simulation Started', 'System is now executing through the full technical debt pipeline.');
  };

  const handlePause = () => {
    setIsRunning(false);
    showToast('info', 'Simulation Paused', 'Paused at current pipeline stage.');
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStageIndex(0);
    setStageProgress(0);
    setTerminalLogs([...stages[0].logs]);
    showToast('info', 'Simulation Reset', 'Pipeline reset to Stage 1.');
  };

  const handleNextStage = () => {
    if (currentStageIndex < stages.length - 1) {
      const nextIdx = currentStageIndex + 1;
      setCurrentStageIndex(nextIdx);
      setStageProgress(0);
      setTerminalLogs((prev) => [...prev, ...stages[nextIdx].logs]);
    }
  };

  const handlePrevStage = () => {
    if (currentStageIndex > 0) {
      setCurrentStageIndex((prev) => prev - 1);
      setStageProgress(0);
    }
  };

  const handleJumpToStage = (idx: number) => {
    setCurrentStageIndex(idx);
    setStageProgress(0);
    const logsUpToStage = stages.slice(0, idx + 1).flatMap((s) => s.logs);
    setTerminalLogs(logsUpToStage);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(currentStage.speakingScript);
    setCopied(true);
    showToast('success', 'Copied to Clipboard', 'Speaking script ready for faculty presentation.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    try {
      await api.downloadPdfReport(1);
      showToast('success', 'Audit Report Downloaded', 'Technical Debt ISO-25010 compliance audit report generated.');
    } catch {
      showToast('error', 'Download Failed', 'Could not export audit report.');
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12 overflow-x-hidden select-none">
      
      {/* Top Banner & Control Deck */}
      <div className="bg-slate-900 text-white rounded-md p-5 sm:p-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-sm bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono font-semibold">
                <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                <span>BEC BAGALKOTE • BISA531P MINI PROJECT</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>AUTONOMOUS PIPELINE READY</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <span>One-Click Autonomous Demo Control Room</span>
            </h1>
            <p className="mt-1 text-xs text-slate-300 max-w-2xl leading-relaxed">
              Click <strong className="text-white">"Start 1-Click Auto-Run"</strong> to let the entire DebtLens platform autonomously execute, demonstrate, and verify every formula, chart, and algorithm while you explain each stage to your faculty.
            </p>
          </div>

          {/* Master 1-Click Playback Control Deck */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 bg-slate-950 p-2.5 rounded-md border border-slate-800 shadow-inner">
            {!isRunning ? (
              <button
                onClick={handleStartAutoRun}
                className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-600 shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer group"
              >
                <Play className="w-4 h-4 fill-white text-white group-hover:scale-110 transition-transform" />
                <span>Start 1-Click Auto-Run</span>
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="px-5 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold border border-amber-600 shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Pause className="w-4 h-4 fill-white text-white" />
                <span>Pause Simulation</span>
              </button>
            )}

            <button
              onClick={handleReset}
              className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="Reset simulation to Stage 1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed Toggle */}
            <div className="flex items-center bg-slate-900 rounded-md p-0.5 border border-slate-800 text-[11px] font-mono">
              <button
                onClick={() => setSimSpeed(1)}
                className={`px-2 py-1 rounded-sm transition-colors cursor-pointer ${
                  simSpeed === 1 ? 'bg-white/20 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                1x
              </button>
              <button
                onClick={() => setSimSpeed(2)}
                className={`px-2 py-1 rounded-sm transition-colors cursor-pointer ${
                  simSpeed === 2 ? 'bg-white/20 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                2x Fast
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
              <strong className="text-white">Stage {currentStage.id} of {stages.length}:</strong>
              <span>{currentStage.name}</span>
            </span>
            <span>{Math.round(stageProgress)}% of stage completed</span>
          </div>

          <div className="w-full h-1.5 bg-slate-950 rounded-sm overflow-hidden border border-slate-800">
            <div 
              className="h-full bg-emerald-500 transition-all duration-100 ease-linear"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Horizontal Stage Stepper Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {stages.map((st, idx) => {
          const isDone = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          return (
            <button
              key={st.id}
              onClick={() => handleJumpToStage(idx)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                isCurrent 
                  ? 'bg-blue-700 text-white border-blue-700 shadow-xs font-bold'
                  : isDone
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <div className={`w-4 h-4 rounded-sm flex items-center justify-center text-[10px] font-bold ${
                isCurrent ? 'bg-white/25 text-white' : isDone ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {isDone ? <Check className="w-2.5 h-2.5" /> : st.id}
              </div>
              <span>{st.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Stage Demonstration Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Visual Simulation Stage Card & What to Say (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Active Simulation Stage Canvas */}
          <div className="bg-white rounded-md border border-zinc-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-zinc-200">
              <div>
                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider px-2 py-0.5 rounded-sm bg-black border border-black">
                  {currentStage.moduleBadge}
                </span>
                <h2 className="text-base font-bold text-black mt-1">
                  {currentStage.heading}
                </h2>
              </div>

              <button
                onClick={() => onNavigateTab(currentStage.tab)}
                className="self-start sm:self-auto px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-black text-xs font-semibold border border-zinc-300 flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
                title="Jump directly into full module view"
              >
                <span>Jump to {currentStage.moduleBadge.split(' ')[0]}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Narrative Explanation */}
            <p className="text-xs text-zinc-700 leading-relaxed bg-zinc-50 p-3 rounded-md border border-zinc-200">
              {currentStage.narrative}
            </p>

            {/* Simulated Live Visual Card */}
            <div className="p-3.5 rounded-md border border-zinc-200 bg-zinc-50 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-black">
                <span className="flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-black" />
                  <span>Real-Time Simulated Telemetry:</span>
                </span>
                <span className="font-mono text-[10px] text-white bg-black px-2 py-0.5 rounded-sm border border-black font-bold">
                  ● ACTIVE PIPELINE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {currentStage.metrics.map((m, idx) => (
                  <div key={idx} className="p-2.5 rounded-md bg-white border border-zinc-200 shadow-2xs">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{m.label}</div>
                    <div className="text-sm font-bold text-black font-mono mt-1">{m.value}</div>
                    {m.badge && (
                      <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-300 font-mono">
                        {m.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Word-for-Word Faculty Presentation Script */}
            <div className="space-y-2 pt-2 border-t border-zinc-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-black flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-black" />
                  <span>What to Say to Faculty Right Now (Speaker Script):</span>
                </span>
                <button
                  onClick={handleCopyScript}
                  className="inline-flex items-center space-x-1 text-[11px] font-semibold text-zinc-600 hover:text-black cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-md bg-zinc-950 text-zinc-100 text-xs leading-relaxed font-sans whitespace-pre-line border border-zinc-800 shadow-inner">
                {currentStage.speakingScript}
              </div>
            </div>

            {/* Stepper Navigation */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
              <button
                disabled={currentStageIndex === 0}
                onClick={handlePrevStage}
                className="px-3 py-1.5 rounded-md border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
              >
                ← Prev Stage
              </button>

              <div className="text-xs text-zinc-500 font-mono font-semibold">
                Stage {currentStageIndex + 1} of {stages.length}
              </div>

              <button
                disabled={currentStageIndex === stages.length - 1}
                onClick={handleNextStage}
                className="px-3.5 py-1.5 rounded-md bg-black hover:bg-zinc-800 text-white text-xs font-semibold border border-black disabled:opacity-30 cursor-pointer flex items-center space-x-1 shadow-xs"
              >
                <span>Next Stage</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick PDF Trigger Bar */}
          <div className="p-4 rounded-md bg-zinc-50 border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center space-x-3">
              <FileDown className="w-5 h-5 text-black shrink-0" />
              <div>
                <div className="text-xs font-bold text-black">Executive Technical Debt Audit Report PDF</div>
                <div className="text-[11px] text-zinc-600">Download formatted compliance evidence generated during this run</div>
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 bg-black hover:bg-zinc-800 text-white border border-black rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              Export Report PDF
            </button>
          </div>

        </div>

        {/* Right Column: Live Terminal Telemetry Log (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          
          <div className="bg-black rounded-md border border-zinc-800 shadow-md overflow-hidden flex flex-col h-[520px]">
            {/* Terminal Window Header */}
            <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                <span className="text-[11px] font-mono text-zinc-300 pl-2">debtlens-telemetry-console</span>
              </div>
              <span className="text-[10px] font-mono text-white font-bold">● LIVE 200 OK</span>
            </div>

            {/* Terminal Body Stream */}
            <div 
              ref={logContainerRef}
              className="flex-1 p-4 font-mono text-xs text-zinc-300 space-y-1.5 overflow-y-auto select-text"
            >
              <div className="text-zinc-500 text-[11px] pb-1 border-b border-zinc-800">
                # DebtLens Core Autonomous Pipeline Engine (FastAPI + NetworkX + Scikit-Learn)
                <br /># Cloud Firestore asia-south1 cluster connected
              </div>

              {terminalLogs.length === 0 ? (
                <div className="text-zinc-500 italic pt-4">
                  Waiting for simulation trigger... Click "Start 1-Click Auto-Run" above.
                </div>
              ) : (
                terminalLogs.map((log, i) => {
                  const isHighlight = log.includes('BREAK-EVEN') || log.includes('RANK #1') || log.includes('SOLUTION');
                  const isError = log.includes('CRITICAL') || log.includes('EXCEEDED');
                  return (
                    <div 
                      key={i} 
                      className={`leading-relaxed text-[11px] ${
                        isError ? 'text-white font-bold' : isHighlight ? 'text-zinc-100 font-semibold' : 'text-zinc-300'
                      }`}
                    >
                      {log}
                    </div>
                  );
                })
              )}
            </div>

            {/* Terminal Status Bar */}
            <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
              <span>asia-south1 (Mumbai)</span>
              <span>NetworkX 3.2 • Scikit-Learn 1.5</span>
            </div>
          </div>

          {/* College Endorsement Card */}
          <div className="p-4 bg-white rounded-md border border-zinc-200 text-zinc-700 shadow-2xs space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-xs text-black">
              <GraduationCap className="w-4 h-4 text-black" />
              <span>Basaveshwar Engineering College, Bagalkote</span>
            </div>
            <div className="text-xs text-zinc-500">Department of Information Science & Engineering</div>
            <div className="text-xs font-semibold text-black pt-1">
              Guide: Prof. P. R. Muttannavar • BISA531P (2026-27)
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
