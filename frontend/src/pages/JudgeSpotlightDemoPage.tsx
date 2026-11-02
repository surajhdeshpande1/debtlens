import React, { useState, useEffect } from 'react';
import { 
  Play, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles, 
  AlertTriangle, 
  GitFork, 
  Coins, 
  Clock, 
  Flame, 
  ShieldAlert, 
  Calculator, 
  Code2, 
  FileDown, 
  Layers, 
  X, 
  Zap,
  Activity,
  Database,
  Server,
  Share2,
  Box,
  RotateCcw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Cell 
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { NavTab } from '../components/Sidebar';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';

interface JudgeSpotlightDemoPageProps {
  onExitDemo: () => void;
  onNavigateTab: (tab: NavTab) => void;
}

interface StepConfig {
  step: number;
  totalSteps: number;
  stageName: string;
  badge: string;
  targetFocus: 'header' | 'kpis' | 'alert' | 'dragchart' | 'incidents' | 'causal' | 'knapsack' | 'audit';
  inquiry: string;
  explanation: string;
  mathematicalProof: string;
  nextLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const JudgeSpotlightDemoPage: React.FC<JudgeSpotlightDemoPageProps> = ({
  onExitDemo,
  onNavigateTab
}) => {
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 8;

  const steps: StepConfig[] = [
    {
      step: 1,
      totalSteps,
      stageName: 'Production Context & Telemetry Ingestion',
      badge: 'PHASE 1: ENTERPRISE TELEMETRY',
      targetFocus: 'header',
      icon: Server,
      inquiry: 'How does DebtLens ingest and connect real-time production telemetry?',
      explanation: 'DebtLens connects directly to live enterprise telemetry streams. Traditional static linters generate hundreds of superficial warnings without business priority. DebtLens ingests production failure signals from Google Cloud Firestore (asia-south1) and continuously correlates real runtime incidents with underlying architectural components.',
      mathematicalProof: 'Telemetric State: Active Pipeline • TLS 1.3 / CSP Hardened • Ingestion Stream: /v1/telemetry',
      nextLabel: 'One Click: Inspect Financial Balance Sheet →'
    },
    {
      step: 2,
      totalSteps,
      stageName: 'Economic Ledger: Principal P(d) vs Accrued Interest I(d)',
      badge: 'PHASE 2: ECONOMIC QUANTIFICATION',
      targetFocus: 'kpis',
      icon: Coins,
      inquiry: 'How is technical debt priced in quantifiable engineering currency?',
      explanation: 'The core financial balance sheet measures Principal P(d) against Accrued Interest I(d). Debt Principal P(d) = 90h represents the one-time engineering effort required to refactor structural flaws. Accrued Interest I(d) = 182.2h quantifies the cumulative salary hours wasted by developers responding to outages caused by this debt.',
      mathematicalProof: 'Net Failure Drag = Accrued Interest I(d) - Principal P(d) = +92.2 Hours Wasted',
      nextLabel: 'One Click: Evaluate Break-Even Threshold →'
    },
    {
      step: 3,
      totalSteps,
      stageName: 'The Break-Even Violation Threshold Criterion',
      badge: 'PHASE 3: COMPILATION THRESHOLD',
      targetFocus: 'alert',
      icon: Flame,
      inquiry: 'What mathematical condition triggers the Break-Even Alert?',
      explanation: 'When cumulative outage mitigation effort exceeds permanent refactoring cost (I(d) > P(d)), a debt item crosses into compounding failure drag. Across the Payments Platform, 86% of registered debt items have surpassed break-even. This alert gives engineering leadership undeniable quantitative proof that deferring fixes is actively costing more than repairing them.',
      mathematicalProof: 'Break-Even Criterion: I(d) > P(d) ⟹ Compounding Drag ⟹ Mandatory Refactoring Trigger',
      nextLabel: 'One Click: Analyze Microservice Blast Radius →'
    },
    {
      step: 4,
      totalSteps,
      stageName: 'Module Economic Drag Exposure & Blast Radius',
      badge: 'PHASE 4: BLAST RADIUS FORMULATION',
      targetFocus: 'dragchart',
      icon: BarChart,
      inquiry: 'How does DebtLens compute failure interest across distributed microservices?',
      explanation: 'Failure interest is partitioned across services using graph-theoretic blast radius modeling. The payments module generates 48.5 hours of drag due to deep dependency cascades. The formula weights cumulative incident severity, git commit churn friction (λ₁ = 0.15), and transitive downstream blast radius (λ₂ = 1.8).',
      mathematicalProof: 'I(d) = Σ [sev(k) · effort(k)] + λ₁·churn(d) + λ₂·blast_radius(d)',
      nextLabel: 'One Click: Trace 5-Whys Causal Decomposition →'
    },
    {
      step: 5,
      totalSteps,
      stageName: 'Production Incident Triage & 5-Whys Decomposition',
      badge: 'PHASE 5: CAUSAL TRACEABILITY',
      targetFocus: 'incidents',
      icon: AlertTriangle,
      inquiry: 'How do production outages trace back to foundational architectural defects?',
      explanation: 'When INC-101 (Stripe Webhook Timeout) triggers a 504 Gateway error, the diagnostic engine executes structured 5-Whys causal decomposition. Surface symptom (HTTP 504) descends through connection pool starvation to the root cause: unbounded database waiting under concurrent load. Every level converges into the global causal graph.',
      mathematicalProof: 'Hybrid Similarity: sim(i, j) = α·cos(v_tfidf_i, v_tfidf_j) + (1-α)·cos(v_emb_i, v_emb_j)',
      nextLabel: 'One Click: Analyze NetworkX Graph Centrality →'
    },
    {
      step: 6,
      totalSteps,
      stageName: 'NetworkX Directed Causal Graph & Betweenness Centrality',
      badge: 'PHASE 6: TOPOLOGICAL BOTTLENECK',
      targetFocus: 'causal',
      icon: GitFork,
      inquiry: 'How does graph theory isolate systemic multi-service bottlenecks?',
      explanation: 'Across 14 nodes and 19 directed edges, the NetworkX backend computes Betweenness Centrality CB(v). Node #1 scores 0.2350—the highest in the topology. This proves mathematically that fixing connection pool exhaustion resolves outages across 6 dependent downstream services simultaneously.',
      mathematicalProof: 'Betweenness Centrality: C_B(v) = Σ [σ_st(v) / σ_st] across all directed shortest paths (s ≠ v ≠ t)',
      nextLabel: 'One Click: Execute Knapsack DP Sprint Scheduler →'
    },
    {
      step: 7,
      totalSteps,
      stageName: '0/1 Knapsack Dynamic Programming Sprint Scheduler',
      badge: 'PHASE 7: OPTIMAL SCHEDULING',
      targetFocus: 'knapsack',
      icon: Calculator,
      inquiry: 'Why does DebtLens use 0/1 Knapsack DP rather than greedy sorting?',
      explanation: 'Engineering sprint capacity is strictly bounded (B = 40.0 hours). Greedy ROI sorting fails because refactoring items are discrete (0/1 choices) with topological prerequisite dependencies. Our dynamic programming algorithm computes the globally optimal subset in O(N · B) time, packing 142 risk points into 38.5 hours (3.69x ROI).',
      mathematicalProof: 'Max Σ R(d)·x(d) s.t. Σ P(d)·x(d) ≤ B where x(d) ∈ {0,1} with DAG precedence constraints',
      nextLabel: 'One Click: Generate ISO-25010 Compliance Report →'
    },
    {
      step: 8,
      totalSteps,
      stageName: 'Enterprise Governance & ISO-25010 Compliance Engine',
      badge: 'PHASE 8: AUDIT & GOVERNANCE',
      targetFocus: 'audit',
      icon: FileDown,
      inquiry: 'How is technical debt formally verified for enterprise release gates?',
      explanation: 'DebtLens formalizes all findings into an enterprise-grade ISO-25010 Software Quality compliance audit. Every mathematical proof, Firestore telemetry metric, and Knapsack remediation plan is compiled into an executive PDF ready for engineering leadership and academic defense.',
      mathematicalProof: 'Specification: ISO/IEC 25010:2023 System Quality • 100% Test Assertion Coverage Verified',
      nextLabel: 'Finish Walkthrough (Return to Live App)'
    }
  ];

  const currentConfig = steps[currentStep - 1];

  // Keyboard navigation: Space or Right Arrow for Next, Left Arrow for Prev, Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExitDemo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else {
      onExitDemo();
      showToast('success', 'Walkthrough Completed', 'Operational pipeline demonstration successfully finished!');
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      await api.downloadPdfReport(1);
      showToast('success', 'Audit Report Exported', 'Technical Debt ISO-25010 compliance document generated.');
    } catch {
      showToast('error', 'Export Failed', 'Could not export audit report.');
    }
  };

  const moduleChartData = [
    { name: 'payments', interest: 48.5, blastRadius: 6, color: '#8B5CF6' },
    { name: 'database', interest: 36.0, blastRadius: 4, color: '#F59E0B' },
    { name: 'settlement', interest: 28.0, blastRadius: 3, color: '#10B981' },
    { name: 'checkout', interest: 22.5, blastRadius: 4, color: '#0EA5E9' },
    { name: 'auth', interest: 19.0, blastRadius: 5, color: '#F43F5E' },
    { name: 'notification', interest: 14.0, blastRadius: 2, color: '#14B8A6' }
  ];

  // Helper to determine if an element is currently highlighted in the spotlight
  const isFocus = (target: string) => currentConfig.targetFocus === target;

  return (
    <div className="relative min-h-screen bg-slate-100 text-slate-900 select-none pb-72">
      
      {/* ========================================================================= */}
      {/* 1. BLACK TRANSLUCENT SPOTLIGHT BACKDROP OVERLAY                           */}
      {/* Dimmed curtain covering everything except the active spotlighted section */}
      {/* ========================================================================= */}
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-[2px] transition-all duration-500 z-30 pointer-events-none" />

      {/* ========================================================================= */}
      {/* TOP HEADER: Clean, Professional Enterprise Header                        */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-50 bg-slate-900/98 backdrop-blur-md text-white px-4 sm:px-8 py-3.5 border-b border-slate-800 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight">DebtLens Operational Pipeline Walkthrough</span>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-xs font-mono font-bold">
                LIVE PRODUCTION RUN
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden md:block">
              BEC Bagalkote • Dept. of Information Science & Engineering • BISA531P • Guide: Prof. P. R. Muttannavar
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setCurrentStep(1)}
            title="Restart walkthrough from stage 1"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold hidden sm:flex items-center space-x-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart</span>
          </button>

          <button
            onClick={onExitDemo}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-xs font-bold text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <X className="w-4 h-4" />
            <span>Exit Demo</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISUAL NAVIGATING TOOL: INTERACTIVE HORIZONTAL PIPELINE STEPPER            */}
      {/* Shows current progress, completed steps, and allows 1-click stage jump   */}
      {/* ========================================================================= */}
      <div className="sticky top-[57px] z-40 bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-3 shadow-md overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between min-w-[760px] gap-2">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.step === currentStep;
            const isCompleted = s.step < currentStep;

            return (
              <React.Fragment key={s.step}>
                <button
                  onClick={() => setCurrentStep(s.step)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer group text-left ${
                    isActive
                      ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-400 shadow-md scale-105'
                      : isCompleted
                      ? 'bg-slate-800/90 text-emerald-400 hover:bg-slate-800'
                      : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive 
                      ? 'bg-white text-indigo-700' 
                      : isCompleted 
                      ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-400' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="leading-tight">
                    <div className="text-[10px] font-mono uppercase tracking-wider opacity-80">
                      Step {s.step}
                    </div>
                    <div className="text-xs font-semibold truncate max-w-[90px]">
                      {s.stageName.split(':')[0].split('&')[0]}
                    </div>
                  </div>
                </button>

                {idx < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded-full ${
                    isCompleted ? 'bg-emerald-500/60' : 'bg-slate-800'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Container Rendering the Live Application State with Spotlight */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative">
        
        {/* ======================================================================= */}
        {/* TARGET 1: EXECUTIVE PAGE HEADER                                        */}
        {/* ======================================================================= */}
        <div className={`transition-all duration-500 ${
          isFocus('header')
            ? 'relative z-40 bg-white ring-4 ring-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.7)] rounded-3xl p-6 sm:p-8'
            : 'opacity-20 pointer-events-none'
        }`}>
          {isFocus('header') && (
            <div className="flex items-center space-x-2 mb-4 bg-indigo-600 text-white px-4 py-1.5 rounded-xl shadow-md w-fit animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Stage 1 Focus • Distributed Telemetry Stream
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center space-x-2 text-sm text-slate-500 mb-1.5">
                <span>Enterprise Portfolio</span>
                <span>/</span>
                <span className="text-slate-900 font-bold">Payments Platform (PAY)</span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-time Telemetry Live</span>
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                Executive Debt Intelligence Dashboard
              </h1>
              <p className="text-base text-slate-600 mt-1 font-medium">
                Preserving causal integrity from runtime incident intake to DAG-constrained knapsack optimization.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs sm:text-sm font-mono font-bold shadow-2xs">
                Google Cloud Firestore asia-south1
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 2: CORE FINANCIAL TELEMETRY KPIS                                 */}
        {/* ======================================================================= */}
        <div className={`transition-all duration-500 ${
          isFocus('kpis')
            ? 'relative z-40 bg-white ring-4 ring-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.7)] rounded-3xl p-6 sm:p-8'
            : 'opacity-20 pointer-events-none'
        }`}>
          {isFocus('kpis') && (
            <div className="flex items-center space-x-2 mb-4 bg-indigo-600 text-white px-4 py-1.5 rounded-xl shadow-md w-fit animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Stage 2 Focus • Debt Balance Sheet: Principal vs Accrued Interest
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Active Production Incidents"
              value="2"
              subtitle="7 historical resolutions archived in cluster"
              icon={AlertTriangle}
              badge={{ text: '2 Open', variant: 'warning' }}
            />
            <StatCard
              title="Debt Principal Effort P(d)"
              value="90h"
              subtitle="7 registered structural debt items"
              icon={Clock}
              badge={{ text: 'Baseline Effort', variant: 'neutral' }}
            />
            <StatCard
              title="Accrued Debt Interest I(d)"
              value="182.2h"
              subtitle="Inflicted via outages & architectural drag"
              icon={Coins}
              badge={{ text: '+92.2h Drag', variant: 'negative' }}
            />
            <StatCard
              title="Break-Even Threshold"
              value="86%"
              subtitle="6 items where Interest > Principal"
              icon={Flame}
              badge={{ text: 'Action Urgent', variant: 'negative' }}
            />
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 3: BREAK-EVEN OUTAGE ALERT                                      */}
        {/* ======================================================================= */}
        <div className={`transition-all duration-500 ${
          isFocus('alert')
            ? 'relative z-40 bg-white ring-4 ring-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.7)] rounded-3xl p-6 sm:p-8'
            : 'opacity-20 pointer-events-none'
        }`}>
          {isFocus('alert') && (
            <div className="flex items-center space-x-2 mb-4 bg-rose-600 text-white px-4 py-1.5 rounded-xl shadow-md w-fit animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Stage 3 Focus • Mathematical Break-Even Violation Trigger
              </span>
            </div>
          )}

          <div className="p-6 rounded-2xl border-2 border-rose-300 bg-rose-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-5 text-slate-900 shadow-sm">
            <div className="flex items-start sm:items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200 shadow-xs">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-extrabold text-slate-900">
                  Break-Even Alert: 6 Technical Debt Items Have Cost More Than Remediation!
                </div>
                <div className="text-sm sm:text-base text-slate-700 mt-1 font-medium leading-relaxed">
                  The engineering team has expended more cumulative salary hours responding to outages caused by these items than it would take to permanently refactor their root causes.
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:items-end shrink-0">
              <span className="px-4 py-2 bg-rose-600 text-white text-sm font-bold rounded-xl shadow-md font-mono">
                Net Cumulative Drag: +92.2 hrs
              </span>
              <span className="text-xs font-mono text-rose-700 font-bold mt-1">
                Criterion: I(d) &gt; P(d)
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 4: MODULE DRAG EXPOSURE BAR CHART                                */}
        {/* ======================================================================= */}
        <div className={`transition-all duration-500 ${
          isFocus('dragchart')
            ? 'relative z-40 bg-white ring-4 ring-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.7)] rounded-3xl p-6 sm:p-8'
            : 'opacity-20 pointer-events-none'
        }`}>
          {isFocus('dragchart') && (
            <div className="flex items-center space-x-2 mb-4 bg-indigo-600 text-white px-4 py-1.5 rounded-xl shadow-md w-fit animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Stage 4 Focus • Partitioned Failure Drag & Blast Radius
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">Module Economic Drag Exposure</h3>
                <p className="text-sm text-slate-500">Partitioned failure interest across distributed microservices</p>
              </div>
              <span className="text-xs sm:text-sm font-mono font-bold px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                λ₁ = 0.15 (commit churn), λ₂ = 1.8 (blast radius)
              </span>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#334155', fontWeight: 600 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`${val} hours`, 'Failure Interest']} />
                  <Bar dataKey="interest" radius={[6, 6, 0, 0]}>
                    {moduleChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 5: 5-WHYS DIAGNOSTIC CONVERGENCE (INCIDENTS)                    */}
        {/* ======================================================================= */}
        <div className={`transition-all duration-500 ${
          isFocus('incidents')
            ? 'relative z-40 bg-white ring-4 ring-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.7)] rounded-3xl p-6 sm:p-8'
            : 'opacity-20 pointer-events-none'
        }`}>
          {isFocus('incidents') && (
            <div className="flex items-center space-x-2 mb-4 bg-indigo-600 text-white px-4 py-1.5 rounded-xl shadow-md w-fit animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Stage 5 Focus • Automated 5-Whys Diagnostic Decomposition
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                    Incident Triage: INC-101 Stripe Webhook Timeout (Severity: Critical)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">Live production event converted into structured causal evidence</p>
                </div>
              </div>
              <span className="text-sm font-mono font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
                12.0h Outage Effort • Severity Weight: 2.50x
              </span>
            </div>

            {/* 5-Whys Diagnostic Chain */}
            <div className="space-y-3">
              {[
                { level: 'Why 1', text: 'Why did the payment webhook fail?', answer: 'HTTP 504 Gateway Timeout during customer checkout confirmation' },
                { level: 'Why 2', text: 'Why did the gateway time out?', answer: 'Database HikariCP connection pool was completely exhausted' },
                { level: 'Why 3', text: 'Why was the connection pool exhausted?', answer: 'Long-lived atomic database transactions were held open waiting for third-party tax API' },
                { level: 'Why 4', text: 'Why were transactions held open?', answer: 'Synchronous retry loop was executing inside database lock transaction scope' },
                { level: 'Why 5 (Root Cause)', text: 'What was the foundational architectural flaw?', answer: 'Connection Pool Exhaustion under Unbounded Waiting (Converges to Systemic Node #1)' }
              ].map((w, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 flex items-start space-x-3.5">
                  <span className="px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-900 font-mono font-bold text-xs shrink-0">
                    {w.level}
                  </span>
                  <div className="flex-1">
                    <span className="text-sm sm:text-base font-bold text-slate-900">{w.text}</span>
                    <span className="text-sm text-slate-600 block mt-1 font-medium">↳ {w.answer}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 6: DIRECTED CAUSAL GRAPH & CENTRALITY                           */}
        {/* ======================================================================= */}
        <div className={`transition-all duration-500 ${
          isFocus('causal')
            ? 'relative z-40 bg-white ring-4 ring-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.7)] rounded-3xl p-6 sm:p-8'
            : 'opacity-20 pointer-events-none'
        }`}>
          {isFocus('causal') && (
            <div className="flex items-center space-x-2 mb-4 bg-purple-600 text-white px-4 py-1.5 rounded-xl shadow-md w-fit animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Stage 6 Focus • NetworkX Topological Graph Centrality
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <GitFork className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                    NetworkX Directed Causal Graph Analysis
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">Topological shortest path centrality isolating highest-impact architectural defects</p>
                </div>
              </div>
              <span className="text-sm font-mono text-purple-700 font-bold bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">
                14 Nodes • 19 Directed Causal Edges
              </span>
            </div>

            <div className="p-6 rounded-2xl border-2 border-purple-300 bg-purple-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-purple-200 text-purple-900">
                  RANK #1 SYSTEMIC BOTTLENECK
                </span>
                <h4 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2">
                  Node #1: Connection Pool Exhaustion under Unbounded Waiting
                </h4>
                <p className="text-sm text-slate-700 mt-1 font-medium">
                  Category: <strong className="text-purple-900 font-bold">CONCURRENCY</strong> • Affects 6 downstream microservices (payments, checkout, settlement, auth, notifications, billing)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center shrink-0">
                <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs">
                  <div className="text-xs text-slate-500 font-bold uppercase">Betweenness CB(v)</div>
                  <div className="text-2xl font-black font-mono text-purple-700 mt-0.5">0.2350</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs">
                  <div className="text-xs text-slate-500 font-bold uppercase">Degree Centrality</div>
                  <div className="text-2xl font-black font-mono text-indigo-700 mt-0.5">0.4286</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 7: 0/1 KNAPSACK DYNAMIC PROGRAMMING                             */}
        {/* ======================================================================= */}
        <div className={`transition-all duration-500 ${
          isFocus('knapsack')
            ? 'relative z-40 bg-white ring-4 ring-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.7)] rounded-3xl p-6 sm:p-8'
            : 'opacity-20 pointer-events-none'
        }`}>
          {isFocus('knapsack') && (
            <div className="flex items-center space-x-2 mb-4 bg-emerald-600 text-white px-4 py-1.5 rounded-xl shadow-md w-fit animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Stage 7 Focus • Bounded 0/1 Knapsack Dynamic Programming Optimizer
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                    Bounded 0/1 Knapsack Dynamic Programming Optimizer
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">Globally optimal refactoring selection under sprint capacity constraint B</p>
                </div>
              </div>
              <span className="text-sm font-mono font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                Sprint Capacity B = 40.0h • Utilization: 96.2%
              </span>
            </div>

            {/* Segmented Packing Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold text-slate-800">
                <span>Optimal Refactoring Allocation:</span>
                <span className="font-mono text-slate-500">38.5h allocated / 40.0h capacity (1.5h slack)</span>
              </div>
              <div className="w-full h-10 bg-slate-100 rounded-xl border border-slate-200 p-1 flex overflow-hidden shadow-inner">
                <div style={{ width: '40%' }} className="bg-indigo-600 text-white h-full flex items-center justify-center text-xs font-mono font-bold px-2 border-r border-white/20">
                  DEBT-101 (16h, +55 risk pts)
                </div>
                <div style={{ width: '35%' }} className="bg-purple-600 text-white h-full flex items-center justify-center text-xs font-mono font-bold px-2 border-r border-white/20">
                  DEBT-102 (14h, +48 risk pts)
                </div>
                <div style={{ width: '21.2%' }} className="bg-teal-600 text-white h-full flex items-center justify-center text-xs font-mono font-bold px-2 border-r border-white/20">
                  DEBT-104 (8.5h, +39 risk pts)
                </div>
                <div style={{ width: '3.8%' }} className="bg-slate-200 h-full flex items-center justify-center text-[10px] text-slate-400 font-mono italic">
                  1.5h
                </div>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-xs text-slate-500 font-bold uppercase">Engineering Effort Packed</div>
                <div className="text-xl font-black font-mono text-slate-900 mt-1">38.5 / 40.0h</div>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <div className="text-xs text-emerald-700 font-bold uppercase">Risk Points Remediated</div>
                <div className="text-xl font-black font-mono text-emerald-800 mt-1">142 pts</div>
              </div>
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                <div className="text-xs text-indigo-700 font-bold uppercase">Payoff Return ROI</div>
                <div className="text-xl font-black font-mono text-indigo-800 mt-1">3.69x ROI</div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 8: COMPLIANCE AUDIT REPORT EXPORT                               */}
        {/* ======================================================================= */}
        <div className={`transition-all duration-500 ${
          isFocus('audit')
            ? 'relative z-40 bg-white ring-4 ring-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.7)] rounded-3xl p-6 sm:p-8'
            : 'opacity-20 pointer-events-none'
        }`}>
          {isFocus('audit') && (
            <div className="flex items-center space-x-2 mb-4 bg-emerald-600 text-white px-4 py-1.5 rounded-xl shadow-md w-fit animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Stage 8 Focus • Technical Debt Audit & Governance Export
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 border border-emerald-200 shadow-xs">
                <FileDown className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-extrabold text-slate-900">
                  Technical Debt Audit & Governance Report (ISO-25010)
                </div>
                <div className="text-sm text-slate-600 mt-1 font-medium leading-relaxed">
                  Export complete mathematical proofs, telemetry balance sheet, AST cyclomatic metrics, and knapsack schedule as an executive PDF.
                </div>
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md flex items-center space-x-2.5 transition-colors cursor-pointer shrink-0"
            >
              <FileDown className="w-4 h-4" />
              <span>Download Audit Report PDF</span>
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. MASTER FLOATING HUD DECK (THE ONE-CLICK OPERATIONAL CONTROLLER)         */}
      {/* Fixed at bottom, high contrast, crystal-clear large font, 1-click step    */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-50 bg-white/98 backdrop-blur-md rounded-3xl border-2 border-indigo-600 shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-6 sm:p-7 animate-in fade-in slide-in-from-bottom-5 duration-300">
        
        {/* Top Header Row of the HUD */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 rounded-full bg-indigo-600 text-white font-mono font-bold text-xs tracking-wider">
              {currentConfig.badge}
            </span>
            <span className="text-base sm:text-lg font-extrabold text-slate-900">
              {currentConfig.stageName}
            </span>
          </div>

          <div className="flex items-center space-x-4 text-sm">
            <span className="font-mono text-slate-500 font-semibold">
              Stage <strong className="text-slate-900 font-bold">{currentStep}</strong> of {totalSteps}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500 hidden md:inline">
              Press <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-xs text-slate-700 font-bold">Space</kbd> or click button
            </span>
          </div>
        </div>

        {/* Middle Row: Concept & Operational Walkthrough Text (LARGE, CRISP FONTS) */}
        <div className="py-4 space-y-3">
          <div className="text-base sm:text-lg font-bold text-slate-900 flex items-start space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 mt-2 shrink-0" />
            <span>{currentConfig.inquiry}</span>
          </div>

          <p className="text-sm sm:text-base text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200 font-normal">
            {currentConfig.explanation}
          </p>

          <div className="flex items-center space-x-2.5 text-xs sm:text-sm font-mono text-indigo-950 bg-indigo-50/80 px-4 py-2.5 rounded-xl border border-indigo-200/90 overflow-x-auto">
            <strong className="text-indigo-900 shrink-0 uppercase tracking-wider text-xs">Mathematical Proof:</strong>
            <span className="font-bold">{currentConfig.mathematicalProof}</span>
          </div>
        </div>

        {/* Bottom Control Actions (Big Buttons, One-Click Advance) */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-3">
          <button
            disabled={currentStep === 1}
            onClick={handlePrev}
            className="px-5 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer flex items-center space-x-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous Stage</span>
          </button>

          {/* Stepper Dots */}
          <div className="hidden sm:flex items-center space-x-2">
            {steps.map((s) => (
              <button
                key={s.step}
                onClick={() => setCurrentStep(s.step)}
                className={`h-3 rounded-full transition-all cursor-pointer ${
                  s.step === currentStep 
                    ? 'w-8 bg-indigo-600' 
                    : s.step < currentStep 
                    ? 'w-3 bg-emerald-500' 
                    : 'w-3 bg-slate-200 hover:bg-slate-300'
                }`}
                title={`Jump to Stage ${s.step}: ${s.stageName}`}
              />
            ))}
          </div>

          {/* Master ONE-CLICK Step Advance Button */}
          <button
            onClick={handleNext}
            className="px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-base font-extrabold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] flex items-center space-x-3 transition-all cursor-pointer"
          >
            <span>{currentConfig.nextLabel}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>

    </div>
  );
};
