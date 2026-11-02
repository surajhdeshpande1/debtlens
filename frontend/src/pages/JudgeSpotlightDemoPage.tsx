import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  GitFork, 
  Coins, 
  Clock, 
  Flame, 
  ShieldAlert, 
  Calculator, 
  FileDown, 
  Layers, 
  X, 
  Server,
  RotateCcw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
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
      stageName: 'Production Telemetry Stream',
      badge: 'PHASE 1: TELEMETRY INGEST',
      targetFocus: 'header',
      icon: Server,
      inquiry: 'Where does the data come from?',
      explanation: 'DebtLens connects directly to live production telemetry (Google Cloud Firestore asia-south1). Rather than showing static code smell warnings, it tracks real outages occurring across our payments platform.',
      mathematicalProof: 'Cluster: Firestore asia-south1 • Stream: /v1/telemetry • TLS 1.3 / CSP Hardened',
      nextLabel: 'Advance to Financial Balance Sheet →'
    },
    {
      step: 2,
      totalSteps,
      stageName: 'Debt Balance Sheet: Principal vs Interest',
      badge: 'PHASE 2: ECONOMIC QUANTIFICATION',
      targetFocus: 'kpis',
      icon: Coins,
      inquiry: 'What are Principal P(d) and Accrued Interest I(d)?',
      explanation: 'Principal P(d) = 90h is the one-time engineering effort to permanently refactor the code. Accrued Interest I(d) = 182.2h is the cumulative salary hours wasted by developers responding to recurring outages.',
      mathematicalProof: 'Net Failure Drag = Accrued Interest (182.2h) - Principal (90h) = +92.2 Hours Wasted',
      nextLabel: 'Advance to Break-Even Alert →'
    },
    {
      step: 3,
      totalSteps,
      stageName: 'Break-Even Violation Trigger',
      badge: 'PHASE 3: BREAK-EVEN THRESHOLD',
      targetFocus: 'alert',
      icon: Flame,
      inquiry: 'What triggers the Break-Even Alert?',
      explanation: 'When failure response hours exceed the refactoring cost (Interest > Principal), the debt crosses break-even. 86% of items have exceeded break-even, proving that delaying refactoring costs more than fixing it.',
      mathematicalProof: 'Break-Even Criterion: I(d) > P(d) ⟹ Compounding Drag ⟹ Immediate Refactoring Trigger',
      nextLabel: 'Advance to Module Blast Radius →'
    },
    {
      step: 4,
      totalSteps,
      stageName: 'Module Drag & Architectural Blast Radius',
      badge: 'PHASE 4: BLAST RADIUS FORMULATION',
      targetFocus: 'dragchart',
      icon: BarChart,
      inquiry: 'Which microservice causes the most failure drag?',
      explanation: 'The payments module generates 48.5h of failure drag because multiple services depend on it. Our equation combines incident severity, commit churn (λ₁ = 0.15), and downstream blast radius (λ₂ = 1.8).',
      mathematicalProof: 'I(d) = Σ [sev(k) · effort(k)] + 0.15·churn(d) + 1.8·blast_radius(d)',
      nextLabel: 'Advance to 5-Whys Incident Triage →'
    },
    {
      step: 5,
      totalSteps,
      stageName: 'Incident Triage & 5-Whys Causal Chain',
      badge: 'PHASE 5: CAUSAL TRACEABILITY',
      targetFocus: 'incidents',
      icon: AlertTriangle,
      inquiry: 'How are production outages linked to architectural debt?',
      explanation: 'When an outage strikes (INC-101: 504 Timeout), the 5-Whys diagnostic engine drills down from surface symptoms to the root cause: connection pool exhaustion under unbounded waiting.',
      mathematicalProof: '5-Whys Root Cause: HikariCP Starvation ⟹ Converges to Systemic Node #1',
      nextLabel: 'Advance to Causal Graph Centrality →'
    },
    {
      step: 6,
      totalSteps,
      stageName: 'NetworkX Causal Graph & Centrality',
      badge: 'PHASE 6: TOPOLOGICAL BOTTLENECK',
      targetFocus: 'causal',
      icon: GitFork,
      inquiry: 'How do we identify the #1 systemic bottleneck?',
      explanation: 'Using NetworkX graph theory, we compute Betweenness Centrality CB(v). Node #1 scores 0.2350 (rank #1), proving that resolving it will eliminate outages across 6 microservices simultaneously.',
      mathematicalProof: 'Betweenness Centrality: CB(v) = Σ [σ_st(v) / σ_st] across all directed shortest paths',
      nextLabel: 'Advance to 0/1 Knapsack Optimizer →'
    },
    {
      step: 7,
      totalSteps,
      stageName: '0/1 Knapsack Dynamic Programming Optimizer',
      badge: 'PHASE 7: OPTIMAL SCHEDULING',
      targetFocus: 'knapsack',
      icon: Calculator,
      inquiry: 'How do we decide what to fix in a 40-hour sprint?',
      explanation: 'With a bounded sprint capacity (B = 40h), our 0/1 Knapsack dynamic programming algorithm packs items DEBT-101, 102, and 104 into 38.5 hours, eliminating 142 risk points (3.69x ROI).',
      mathematicalProof: 'Max Σ R(d)·x(d) s.t. Σ P(d)·x(d) ≤ 40.0h, x(d) ∈ {0,1} with DAG precedence',
      nextLabel: 'Advance to ISO-25010 Audit Export →'
    },
    {
      step: 8,
      totalSteps,
      stageName: 'ISO-25010 Compliance Audit & Governance',
      badge: 'PHASE 8: AUDIT & GOVERNANCE',
      targetFocus: 'audit',
      icon: FileDown,
      inquiry: 'How is this verified for compliance and release gates?',
      explanation: 'DebtLens automatically compiles telemetry metrics, mathematical proofs, and knapsack refactoring plans into an ISO-25010 Software Quality compliance PDF report ready for release audits.',
      mathematicalProof: 'Specification: ISO/IEC 25010:2023 System Quality • 100% Test Assertion Coverage Verified',
      nextLabel: 'Finish Walkthrough (Return to Dashboard)'
    }
  ];

  const currentConfig = steps[currentStep - 1];

  // Auto-scroll the active spotlighted element smoothly into view so it's NEVER covered
  useEffect(() => {
    const el = document.getElementById(`spotlight-target-${currentConfig.targetFocus}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, currentConfig.targetFocus]);

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
    <div className="relative min-h-screen bg-slate-100 text-slate-900 select-none pb-44">
      
      {/* ========================================================================= */}
      {/* 1. BLACK TRANSLUCENT SPOTLIGHT BACKDROP OVERLAY                           */}
      {/* Dimmed curtain covering everything except the active spotlighted section */}
      {/* ========================================================================= */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-[2px] transition-all duration-300 z-30 pointer-events-none" />

      {/* ========================================================================= */}
      {/* TOP HEADER: Clean, Professional Enterprise Header                        */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-40 bg-slate-900 text-white px-4 sm:px-6 py-2.5 border-b border-slate-800 shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm sm:text-base tracking-tight">DebtLens Operational Walkthrough</span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800 text-[11px] font-mono font-semibold">
                LIVE PRODUCTION RUN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">
              BEC Bagalkote • Dept. of ISE • Guide: Prof. P. R. Muttannavar
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentStep(1)}
            title="Restart walkthrough from stage 1"
            className="p-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold hidden sm:flex items-center space-x-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart</span>
          </button>

          <button
            onClick={onExitDemo}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit Demo</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISUAL NAVIGATING TOOL: COMPACT HORIZONTAL PIPELINE STEPPER                */}
      {/* Slim 40px ribbon, shows progress and allows 1-click stage jump            */}
      {/* ========================================================================= */}
      <div className="sticky top-[49px] z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 sm:px-6 py-2 shadow-sm overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between min-w-[700px] gap-1.5">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.step === currentStep;
            const isCompleted = s.step < currentStep;

            return (
              <React.Fragment key={s.step}>
                <button
                  onClick={() => setCurrentStep(s.step)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer text-left shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white font-bold ring-1 ring-indigo-400 shadow-sm'
                      : isCompleted
                      ? 'bg-slate-800/80 text-emerald-400 hover:bg-slate-800'
                      : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded flex items-center justify-center shrink-0 ${
                    isActive 
                      ? 'bg-white text-indigo-700' 
                      : isCompleted 
                      ? 'bg-emerald-950 text-emerald-400' 
                      : 'text-slate-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {s.step}. {s.stageName.split(':')[0].split('&')[0]}
                  </span>
                </button>

                {idx < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 min-w-[8px] rounded-full ${
                    isCompleted ? 'bg-emerald-500/70' : 'bg-slate-800'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Container Rendering the Live Application State with Spotlight */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative">
        
        {/* ======================================================================= */}
        {/* TARGET 1: EXECUTIVE PAGE HEADER                                        */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-header"
          className={`scroll-mt-36 transition-all duration-300 ${
            isFocus('header')
              ? 'relative z-40 bg-white ring-2 ring-indigo-500 shadow-2xl rounded-2xl p-5 sm:p-6'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('header') && (
            <div className="inline-flex items-center space-x-1.5 mb-3 bg-indigo-600 text-white px-2.5 py-1 rounded-md shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 1 Focus • Distributed Telemetry Stream</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
                <span>Enterprise Portfolio</span>
                <span>/</span>
                <span className="text-slate-900 font-bold">Payments Platform (PAY)</span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center space-x-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-time Telemetry Live</span>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Executive Debt Intelligence Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium">
                Preserving causal integrity from runtime incident intake to DAG-constrained knapsack optimization.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-mono font-bold">
                Google Cloud Firestore asia-south1
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 2: CORE FINANCIAL TELEMETRY KPIS                                 */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-kpis"
          className={`scroll-mt-36 transition-all duration-300 ${
            isFocus('kpis')
              ? 'relative z-40 bg-white ring-2 ring-indigo-500 shadow-2xl rounded-2xl p-5 sm:p-6'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('kpis') && (
            <div className="inline-flex items-center space-x-1.5 mb-3 bg-indigo-600 text-white px-2.5 py-1 rounded-md shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 2 Focus • Debt Balance Sheet: Principal vs Accrued Interest</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div 
          id="spotlight-target-alert"
          className={`scroll-mt-36 transition-all duration-300 ${
            isFocus('alert')
              ? 'relative z-40 bg-white ring-2 ring-indigo-500 shadow-2xl rounded-2xl p-5 sm:p-6'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('alert') && (
            <div className="inline-flex items-center space-x-1.5 mb-3 bg-rose-600 text-white px-2.5 py-1 rounded-md shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 3 Focus • Mathematical Break-Even Violation Trigger</span>
            </div>
          )}

          <div className="p-4 sm:p-5 rounded-xl border border-rose-200 bg-rose-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-900 shadow-xs">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">
                  Break-Even Alert: 6 Technical Debt Items Have Cost More Than Remediation!
                </div>
                <div className="text-xs sm:text-sm text-slate-700 mt-0.5 font-medium leading-relaxed">
                  The team has expended more hours responding to failures caused by these items than it would take to permanently refactor their root causes.
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:items-end shrink-0">
              <span className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg shadow-2xs font-mono">
                Net Cumulative Drag: +92.2 hrs
              </span>
              <span className="text-[11px] font-mono text-rose-700 font-bold mt-0.5">
                Criterion: I(d) &gt; P(d)
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 4: MODULE DRAG EXPOSURE BAR CHART                                */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-dragchart"
          className={`scroll-mt-36 transition-all duration-300 ${
            isFocus('dragchart')
              ? 'relative z-40 bg-white ring-2 ring-indigo-500 shadow-2xl rounded-2xl p-5 sm:p-6'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('dragchart') && (
            <div className="inline-flex items-center space-x-1.5 mb-3 bg-indigo-600 text-white px-2.5 py-1 rounded-md shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 4 Focus • Partitioned Failure Drag & Blast Radius</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Module Economic Drag Exposure</h3>
                <p className="text-xs text-slate-500">Partitioned failure interest across distributed microservices</p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                λ₁ = 0.15 (churn), λ₂ = 1.8 (blast radius)
              </span>
            </div>

            <div className="h-56 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -15, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`${val} hours`, 'Failure Interest']} />
                  <Bar dataKey="interest" radius={[4, 4, 0, 0]}>
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
        <div 
          id="spotlight-target-incidents"
          className={`scroll-mt-36 transition-all duration-300 ${
            isFocus('incidents')
              ? 'relative z-40 bg-white ring-2 ring-indigo-500 shadow-2xl rounded-2xl p-5 sm:p-6'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('incidents') && (
            <div className="inline-flex items-center space-x-1.5 mb-3 bg-indigo-600 text-white px-2.5 py-1 rounded-md shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 5 Focus • Automated 5-Whys Diagnostic Decomposition</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Incident Triage: INC-101 Stripe Webhook Timeout (Severity: Critical)
                  </h3>
                  <p className="text-xs text-slate-500">Live production event converted into structured causal evidence</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                12.0h Outage Effort • Severity: 2.50x
              </span>
            </div>

            {/* 5-Whys Diagnostic Chain */}
            <div className="space-y-2">
              {[
                { level: 'Why 1', text: 'Why did the payment webhook fail?', answer: 'HTTP 504 Gateway Timeout during customer checkout confirmation' },
                { level: 'Why 2', text: 'Why did the gateway time out?', answer: 'Database HikariCP connection pool was completely exhausted' },
                { level: 'Why 3', text: 'Why was the connection pool exhausted?', answer: 'Long-lived atomic database transactions were held open waiting for third-party tax API' },
                { level: 'Why 4', text: 'Why were transactions held open?', answer: 'Synchronous retry loop was executing inside database lock transaction scope' },
                { level: 'Why 5 (Root Cause)', text: 'What was the foundational architectural flaw?', answer: 'Connection Pool Exhaustion under Unbounded Waiting (Converges to Systemic Node #1)' }
              ].map((w, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-start space-x-2.5">
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono font-bold text-[11px] shrink-0">
                    {w.level}
                  </span>
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-slate-900">{w.text}</span>
                    <span className="text-slate-600 block mt-0.5 font-medium">↳ {w.answer}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 6: DIRECTED CAUSAL GRAPH & CENTRALITY                           */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-causal"
          className={`scroll-mt-36 transition-all duration-300 ${
            isFocus('causal')
              ? 'relative z-40 bg-white ring-2 ring-indigo-500 shadow-2xl rounded-2xl p-5 sm:p-6'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('causal') && (
            <div className="inline-flex items-center space-x-1.5 mb-3 bg-purple-600 text-white px-2.5 py-1 rounded-md shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 6 Focus • NetworkX Topological Graph Centrality</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                  <GitFork className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    NetworkX Directed Causal Graph Analysis
                  </h3>
                  <p className="text-xs text-slate-500">Topological shortest path centrality isolating highest-impact architectural defects</p>
                </div>
              </div>
              <span className="text-xs font-mono text-purple-700 font-bold bg-purple-50 px-2.5 py-0.5 rounded border border-purple-200">
                14 Nodes • 19 Directed Edges
              </span>
            </div>

            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-200 text-purple-900">
                  RANK #1 SYSTEMIC BOTTLENECK
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-1.5">
                  Node #1: Connection Pool Exhaustion under Unbounded Waiting
                </h4>
                <p className="text-xs text-slate-700 mt-0.5 font-medium">
                  Category: <strong className="text-purple-900 font-bold">CONCURRENCY</strong> • Affects 6 downstream microservices (payments, checkout, settlement, auth, notifications, billing)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center shrink-0">
                <div className="p-2.5 bg-white rounded-lg border border-purple-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Betweenness CB(v)</div>
                  <div className="text-lg font-bold font-mono text-purple-700 mt-0.5">0.2350</div>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-purple-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Degree Centrality</div>
                  <div className="text-lg font-bold font-mono text-indigo-700 mt-0.5">0.4286</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 7: 0/1 KNAPSACK DYNAMIC PROGRAMMING                             */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-knapsack"
          className={`scroll-mt-36 transition-all duration-300 ${
            isFocus('knapsack')
              ? 'relative z-40 bg-white ring-2 ring-indigo-500 shadow-2xl rounded-2xl p-5 sm:p-6'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('knapsack') && (
            <div className="inline-flex items-center space-x-1.5 mb-3 bg-emerald-600 text-white px-2.5 py-1 rounded-md shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 7 Focus • Bounded 0/1 Knapsack Dynamic Programming Optimizer</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Bounded 0/1 Knapsack Dynamic Programming Optimizer
                  </h3>
                  <p className="text-xs text-slate-500">Globally optimal refactoring selection under sprint capacity constraint B</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                Sprint Capacity B = 40.0h • Utilization: 96.2%
              </span>
            </div>

            {/* Segmented Packing Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-800">
                <span>Optimal Refactoring Allocation:</span>
                <span className="font-mono text-slate-500">38.5h allocated / 40.0h capacity (1.5h slack)</span>
              </div>
              <div className="w-full h-8 bg-slate-100 rounded-lg border border-slate-200 p-0.5 flex overflow-hidden shadow-inner">
                <div style={{ width: '40%' }} className="bg-indigo-600 text-white h-full flex items-center justify-center text-[11px] font-mono font-bold px-1.5 border-r border-white/20">
                  DEBT-101 (16h, +55 risk)
                </div>
                <div style={{ width: '35%' }} className="bg-purple-600 text-white h-full flex items-center justify-center text-[11px] font-mono font-bold px-1.5 border-r border-white/20">
                  DEBT-102 (14h, +48 risk)
                </div>
                <div style={{ width: '21.2%' }} className="bg-teal-600 text-white h-full flex items-center justify-center text-[11px] font-mono font-bold px-1.5 border-r border-white/20">
                  DEBT-104 (8.5h, +39 risk)
                </div>
                <div style={{ width: '3.8%' }} className="bg-slate-200 h-full flex items-center justify-center text-[10px] text-slate-400 font-mono italic">
                  1.5h
                </div>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Effort Packed</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">38.5 / 40.0h</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                <div className="text-[10px] text-emerald-700 font-bold uppercase">Risk Points Remediated</div>
                <div className="text-base font-bold font-mono text-emerald-800 mt-0.5">142 pts</div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-center">
                <div className="text-[10px] text-indigo-700 font-bold uppercase">Payoff Return ROI</div>
                <div className="text-base font-bold font-mono text-indigo-800 mt-0.5">3.69x ROI</div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 8: COMPLIANCE AUDIT REPORT EXPORT                               */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-audit"
          className={`scroll-mt-36 transition-all duration-300 ${
            isFocus('audit')
              ? 'relative z-40 bg-white ring-2 ring-indigo-500 shadow-2xl rounded-2xl p-5 sm:p-6'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('audit') && (
            <div className="inline-flex items-center space-x-1.5 mb-3 bg-emerald-600 text-white px-2.5 py-1 rounded-md shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 8 Focus • Technical Debt Audit & Governance Export</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 border border-emerald-200">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">
                  Technical Debt Audit & Governance Report (ISO-25010)
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium leading-relaxed">
                  Export complete mathematical proofs, telemetry balance sheet, AST cyclomatic metrics, and knapsack schedule as an executive PDF.
                </div>
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-2 transition-colors cursor-pointer shrink-0"
            >
              <FileDown className="w-4 h-4" />
              <span>Download Audit Report PDF</span>
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. DOCKED BOTTOM PRESENTER BAR (NEVER OVERLAPS THE CONTENT)                 */}
      {/* Pinned directly to the bottom of the screen as a sleek command toolbar    */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Left: Stage Title & Concise Explanation (Instantly Understandable) */}
          <div className="flex-1 w-full md:w-auto">
            <div className="flex items-center space-x-2 mb-1 flex-wrap gap-1">
              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono font-bold text-[10px] tracking-wider uppercase">
                {currentConfig.badge}
              </span>
              <span className="text-xs font-bold text-slate-900">
                Stage {currentStep} of {totalSteps}: {currentConfig.stageName}
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold truncate max-w-sm">
                {currentConfig.mathematicalProof}
              </span>
            </div>

            <div className="text-xs sm:text-sm font-semibold text-slate-900 flex items-baseline space-x-1.5">
              <span className="text-indigo-600 font-bold shrink-0">Q:</span>
              <span>{currentConfig.inquiry}</span>
            </div>

            <p className="text-xs text-slate-600 font-normal leading-relaxed mt-0.5 line-clamp-2 md:line-clamp-none">
              {currentConfig.explanation}
            </p>
          </div>

          {/* Right: Master 1-Click Advance Controls */}
          <div className="flex items-center justify-end space-x-2 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <button
              disabled={currentStep === 1}
              onClick={handlePrev}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer flex items-center space-x-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {/* Stepper Dots */}
            <div className="hidden lg:flex items-center space-x-1 px-1">
              {steps.map((s) => (
                <button
                  key={s.step}
                  onClick={() => setCurrentStep(s.step)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    s.step === currentStep 
                      ? 'w-5 bg-indigo-600' 
                      : s.step < currentStep 
                      ? 'w-2 bg-emerald-500' 
                      : 'w-2 bg-slate-200 hover:bg-slate-300'
                  }`}
                  title={`Stage ${s.step}: ${s.stageName}`}
                />
              ))}
            </div>

            {/* Master ONE-CLICK Step Advance Button */}
            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg flex items-center space-x-2 transition-all cursor-pointer active:scale-95"
            >
              <span>{currentConfig.nextLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};
