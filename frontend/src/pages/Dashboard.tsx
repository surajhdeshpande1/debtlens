import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Coins, 
  Flame, 
  Plus, 
  ArrowRight, 
  ShieldAlert, 
  GitFork, 
  CreditCard, 
  HeartPulse, 
  Boxes, 
  Info, 
  X,
  Sparkles,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  CartesianGrid, 
  Cell 
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { ExecutiveDashboardSummary } from '../types';
import { NavTab } from '../components/Sidebar';

interface DashboardProps {
  summary: ExecutiveDashboardSummary | null;
  onNavigateTab: (tab: NavTab) => void;
  onOpenReportModal: () => void;
}

type ScenarioKey = 'fintech' | 'healthtech' | 'supplychain';

interface ScenarioMeta {
  id: ScenarioKey;
  name: string;
  badge: string;
  domain: string;
  systemTitle: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  kpi: {
    openIncidents: number;
    principal: number;
    interest: number;
    dragRatio: number;
    breakevenCount: number;
  };
  modules: { name: string; interest: number; blastRadius: number }[];
  trajectory: { period: string; incidentCost: number; principalBaseline: number }[];
}

const SCENARIO_DATA: Record<ScenarioKey, ScenarioMeta> = {
  fintech: {
    id: 'fintech',
    name: 'FinTech Platform',
    badge: 'PAYMENTS & TRANSACTIONS',
    domain: 'High-Throughput Digital Payments & Settlement Gateway',
    systemTitle: 'Payments Core Architecture (PAY)',
    subtitle: 'Razorpay / Stripe webhook drops, HikariCP connection starvation, and Redis idempotency Redlock.',
    icon: CreditCard,
    kpi: {
      openIncidents: 2,
      principal: 90.0,
      interest: 182.2,
      dragRatio: 86,
      breakevenCount: 6
    },
    modules: [
      { name: 'payments', interest: 48.5, blastRadius: 6 },
      { name: 'database', interest: 36.0, blastRadius: 4 },
      { name: 'settlement', interest: 28.0, blastRadius: 3 },
      { name: 'checkout', interest: 22.5, blastRadius: 4 },
      { name: 'auth', interest: 19.0, blastRadius: 5 },
      { name: 'notification', interest: 14.0, blastRadius: 2 }
    ],
    trajectory: [
      { period: 'W1', incidentCost: 45, principalBaseline: 90 },
      { period: 'W2', incidentCost: 110, principalBaseline: 90 },
      { period: 'W3', incidentCost: 210, principalBaseline: 90 },
      { period: 'W4', incidentCost: 320, principalBaseline: 90 },
      { period: 'Current', incidentCost: 182.2, principalBaseline: 90 }
    ]
  },
  healthtech: {
    id: 'healthtech',
    name: 'Hospital HealthTech (EHR)',
    badge: 'HEALTHCARE & CLINICAL',
    domain: 'Real-Time Patient ICU Vitals & HL7/FHIR Ingestion',
    systemTitle: 'Clinical Informatics & ICU Telemetry (EHR)',
    subtitle: 'Bedside monitor telemetry drops, unindexed patient EHR record scans, and HL7 queue overflows.',
    icon: HeartPulse,
    kpi: {
      openIncidents: 3,
      principal: 75.0,
      interest: 214.5,
      dragRatio: 88,
      breakevenCount: 5
    },
    modules: [
      { name: 'icu-vitals', interest: 62.0, blastRadius: 6 },
      { name: 'ehr-records', interest: 44.5, blastRadius: 5 },
      { name: 'hl7-gateway', interest: 38.0, blastRadius: 4 },
      { name: 'patient-auth', interest: 26.0, blastRadius: 3 },
      { name: 'vitals-alert', interest: 24.5, blastRadius: 4 },
      { name: 'lab-results', interest: 19.5, blastRadius: 2 }
    ],
    trajectory: [
      { period: 'W1', incidentCost: 35, principalBaseline: 75 },
      { period: 'W2', incidentCost: 95, principalBaseline: 75 },
      { period: 'W3', incidentCost: 185, principalBaseline: 75 },
      { period: 'W4', incidentCost: 280, principalBaseline: 75 },
      { period: 'Current', incidentCost: 214.5, principalBaseline: 75 }
    ]
  },
  supplychain: {
    id: 'supplychain',
    name: 'Supply Chain & IoT',
    badge: 'LOGISTICS & FLEET',
    domain: 'Automated Fulfillment, Fleet Telemetry & Inventory Locks',
    systemTitle: 'Logistics Distribution & Telemetry Mesh (SCM)',
    subtitle: 'Kafka consumer lag, flash-sale inventory lock deadlocks, and EDI carrier dispatch timeouts.',
    icon: Boxes,
    kpi: {
      openIncidents: 2,
      principal: 85.0,
      interest: 196.4,
      dragRatio: 85,
      breakevenCount: 6
    },
    modules: [
      { name: 'inventory-lock', interest: 54.0, blastRadius: 5 },
      { name: 'kafka-broker', interest: 42.0, blastRadius: 6 },
      { name: 'edi-dispatch', interest: 36.5, blastRadius: 4 },
      { name: 'fleet-tracker', interest: 28.5, blastRadius: 3 },
      { name: 'warehouse-db', interest: 21.0, blastRadius: 4 },
      { name: 'carrier-api', interest: 14.4, blastRadius: 2 }
    ],
    trajectory: [
      { period: 'W1', incidentCost: 40, principalBaseline: 85 },
      { period: 'W2', incidentCost: 105, principalBaseline: 85 },
      { period: 'W3', incidentCost: 195, principalBaseline: 85 },
      { period: 'W4', incidentCost: 310, principalBaseline: 85 },
      { period: 'Current', incidentCost: 196.4, principalBaseline: 85 }
    ]
  }
};

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  onNavigateTab,
  onOpenReportModal
}) => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>('fintech');
  const [isConceptModalOpen, setIsConceptModalOpen] = useState(false);

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#064E3B]" />
      </div>
    );
  }

  const scenario = SCENARIO_DATA[selectedScenario];

  const moduleChartData = selectedScenario === 'fintech'
    ? summary.high_risk_modules.map((m) => ({
        name: m.module,
        interest: m.interest,
        blastRadius: m.blast_radius,
        debtCount: m.debt_count
      }))
    : scenario.modules;

  const trajectoryData = selectedScenario === 'fintech'
    ? [
        { period: 'W1', incidentCost: 45, principalBaseline: 90 },
        { period: 'W2', incidentCost: 110, principalBaseline: 90 },
        { period: 'W3', incidentCost: 210, principalBaseline: 90 },
        { period: 'W4', incidentCost: 320, principalBaseline: 90 },
        { period: 'Current', incidentCost: summary.total_accrued_interest, principalBaseline: summary.total_principal_effort }
      ]
    : scenario.trajectory;

  const activeIncidentsCount = selectedScenario === 'fintech' ? summary.open_incidents : scenario.kpi.openIncidents;
  const principalEffort = selectedScenario === 'fintech' ? summary.total_principal_effort : scenario.kpi.principal;
  const accruedInterest = selectedScenario === 'fintech' ? summary.total_accrued_interest : scenario.kpi.interest;
  const breakevenRatio = selectedScenario === 'fintech' 
    ? Math.round((summary.past_breakeven_count / Math.max(1, summary.total_debt_items)) * 100)
    : scenario.kpi.dragRatio;
  const breakevenCount = selectedScenario === 'fintech' ? summary.past_breakeven_count : scenario.kpi.breakevenCount;
  const netEconomicDrag = (accruedInterest - principalEffort).toFixed(1);

  // Forest Sage, Warm Ochre & Burgundy Palette
  const modulePalette = [
    '#064E3B', // Deep Forest
    '#D97706', // Warm Ochre
    '#059669', // Sage Green
    '#881337', // Burgundy
    '#0A2E23', // Dark Forest
    '#B45309', // Deep Ochre
    '#10B981'  // Light Sage
  ];
  const getModuleColor = (index: number) => modulePalette[index % modulePalette.length];

  return (
    <div className="space-y-6">
      
      {/* Executive Institutional Header - Optimized for 100% Zoom */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#E5E2DA]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2 text-xs text-stone-500 mb-1 font-mono flex-wrap gap-1">
            <span>Portfolio</span>
            <span>/</span>
            <span className="text-[#0A2E23] font-bold">{scenario.systemTitle}</span>
            <span className="text-stone-300">•</span>
            <span className="inline-flex items-center space-x-1.5 text-[11px] text-[#065F46] font-bold bg-[#ECFDF5] px-2 py-0.5 rounded-sm border border-[#A7F3D0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span>Real-Time Ingestion</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0A2E23]">
            Executive Debt Intelligence Dashboard
          </h1>

          <p className="text-xs sm:text-sm text-stone-600 mt-1 font-medium leading-relaxed max-w-4xl">
            Correlating runtime failure telemetry with structural code weaknesses, quantifying compounding capital drag <span className="font-mono text-[#881337] font-bold">I(d)</span>, and packaging mathematically optimal remediation sets via bounded 0/1 knapsack programming.
          </p>

          {/* Interactive Domain Scenario Selector */}
          <div className="flex items-center space-x-2 flex-wrap gap-2 pt-3">
            <span className="text-xs font-bold text-[#0A2E23] font-mono uppercase tracking-wide">
              Architectural Domain:
            </span>
            {(['fintech', 'healthtech', 'supplychain'] as ScenarioKey[]).map((key) => {
              const sc = SCENARIO_DATA[key];
              const Icon = sc.icon;
              const isSelected = selectedScenario === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedScenario(key)}
                  className={`h-8 px-3 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#064E3B] text-white border-[#064E3B] shadow-xs font-bold'
                      : 'bg-white hover:bg-[#F2EFE8] text-stone-700 border-[#E5E2DA]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-200' : 'text-stone-500'}`} />
                  <span>{sc.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls Deck */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap self-start lg:self-center">
          <button
            onClick={() => setIsConceptModalOpen(true)}
            className="h-9 px-3.5 rounded-md bg-white hover:bg-[#F9F8F5] text-[#0A2E23] text-xs font-semibold border border-[#D8D4C8] shadow-2xs transition-colors cursor-pointer inline-flex items-center space-x-1.5 whitespace-nowrap"
            title="Explain universal applicability of DebtLens to examination panel"
          >
            <Info className="w-3.5 h-3.5 text-[#064E3B]" />
            <span>What is DebtLens? (Concept)</span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="h-9 px-4 rounded-md bg-[#064E3B] hover:bg-[#043D2E] text-white text-xs font-bold border border-[#064E3B] shadow-xs transition-colors cursor-pointer inline-flex items-center space-x-1.5 whitespace-nowrap active:scale-[0.99]"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
            <span>Intake Incident</span>
          </button>

          <button
            onClick={() => onNavigateTab('optimiser')}
            className="h-9 px-4 rounded-md bg-[#0A2E23] hover:bg-[#05231B] text-white text-xs font-semibold border border-[#0A2E23] shadow-xs transition-colors cursor-pointer inline-flex items-center space-x-1.5 whitespace-nowrap"
          >
            <span>Run Optimiser</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
          </button>
        </div>
      </div>

      {/* Structured Financial Ledger Balance Grid - Optimized for 100% Zoom */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCard
          title="Active Production Failures"
          value={activeIncidentsCount}
          subtitle={`Correlated across multi-incident 5-Whys causal network`}
          icon={AlertTriangle}
          accentColor="ochre"
          badge={{ text: `${activeIncidentsCount} Open Failures`, variant: activeIncidentsCount > 0 ? 'warning' : 'positive' }}
        />
        <StatCard
          title="Debt Principal Baseline P(D)"
          value={`${principalEffort}h`}
          subtitle={`One-time investment required to permanently eliminate structural flaws`}
          icon={Clock}
          accentColor="navy"
          badge={{ text: 'Fixed Baseline', variant: 'neutral' }}
        />
        <StatCard
          title="Compounded Drag Interest I(D)"
          value={`${accruedInterest}h`}
          subtitle="Inflicted engineering downtime and blast radius drag"
          icon={Coins}
          accentColor="crimson"
          badge={{ text: `+${netEconomicDrag}h Drag`, variant: 'negative' }}
        />
        <StatCard
          title="Break-Even Threshold Criticality"
          value={`${breakevenRatio}%`}
          subtitle={`${breakevenCount} debt items where Cumulative Interest > Remediation Principal`}
          icon={Flame}
          accentColor="crimson"
          badge={{ text: breakevenCount > 0 ? 'Critical Advisory' : 'Optimal', variant: breakevenCount > 0 ? 'negative' : 'positive' }}
        />
      </div>

      {/* Strategic Capital Drag Warning Banner */}
      {breakevenCount > 0 && (
        <div className="rounded-md border border-[#F8D2DB] bg-[#FDF2F4] p-4.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-sm bg-[#881337] flex items-center justify-center shrink-0 border border-[#700E2B] text-white">
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-[#881337] font-mono uppercase tracking-wide">
                CAPITAL DRAG ALERT: {breakevenCount} DEBT ITEMS EXCEED PERMANENT REMEDIATION COST
              </div>
              <div className="text-xs text-stone-700 mt-0.5 font-medium leading-relaxed">
                Engineering teams have expended <strong className="text-[#881337]">{accruedInterest} hours</strong> repeatedly responding to failures caused by these items—exceeding the one-time <strong>{principalEffort} hours</strong> required to permanently repair their structural weaknesses.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('debt')}
            className="px-4 py-2 bg-[#881337] hover:bg-[#700E2B] text-white text-xs font-bold rounded-md shadow-2xs shrink-0 cursor-pointer transition-colors whitespace-nowrap"
          >
            Review Balance Sheet →
          </button>
        </div>
      )}

      {/* Main Analysis Grid - 100% Zoom Sizing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
        
        {/* Module Drag Exposure Chart */}
        <div className="lg:col-span-7 bg-white rounded-md border border-[#E5E2DA] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EDE5]">
            <div>
              <h3 className="text-xs font-bold text-[#0A2E23] uppercase tracking-wider font-mono">Module Economic Drag Exposure</h3>
              <p className="text-xs text-stone-500 font-medium">Accrued interest cost (hours) partitioned across microservices</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[#F9F8F5] text-stone-700 border border-[#E5E2DA]">
              λ₁=0.15, λ₂=1.8
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EDE5" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#78716C' }} 
                  axisLine={{ stroke: '#D8D4C8' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#78716C' }} 
                  axisLine={{ stroke: '#D8D4C8' }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0A2E23', 
                    color: '#FFFFFF',
                    borderRadius: '6px', 
                    border: '1px solid #05231B',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                  itemStyle={{ color: '#FFFFFF' }}
                  formatter={(val: any) => [`${val} hours`, 'Compounded Interest']}
                />
                <Bar dataKey="interest" radius={[3, 3, 0, 0]}>
                  {moduleChartData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getModuleColor(index)} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Module Color Swatch Legend */}
          <div className="pt-2 border-t border-[#F0EDE5] flex flex-wrap gap-2">
            {moduleChartData.map((entry, index) => {
              const color = getModuleColor(index);
              return (
                <div 
                  key={entry.name}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-[11px] font-semibold bg-[#F9F8F5] border border-[#E5E2DA] text-stone-700"
                >
                  <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: color }} />
                  <span className="capitalize">{entry.name}</span>
                  <span className="font-mono text-[10px] text-stone-500">({entry.interest}h)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Systemic Root Causes (Centrality Ranking) */}
        <div className="lg:col-span-5 bg-white rounded-md border border-[#E5E2DA] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EDE5] mb-3">
              <div className="flex items-center space-x-2">
                <GitFork className="w-4 h-4 text-[#064E3B]" />
                <h3 className="text-xs font-bold text-[#0A2E23] uppercase tracking-wider font-mono">Systemic Root Causes</h3>
              </div>
              <span className="text-[10px] font-mono uppercase font-bold text-stone-400">Betweenness</span>
            </div>
            <p className="text-xs text-stone-500 mb-3 font-medium">
              Ranked by NetworkX graph centrality across multi-incident 5-Whys convergence:
            </p>

            <div className="space-y-2.5">
              {summary.top_systemic_causes.slice(0, 4).map((c, idx) => (
                <div 
                  key={c.id} 
                  className="p-3 rounded-md border border-[#E5E2DA] bg-[#F9F8F5] hover:bg-white hover:border-[#064E3B] transition-all shadow-2xs"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-[#064E3B] text-white font-mono">
                      #{idx + 1} {c.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#B45309] bg-[#FEF9EE] px-1.5 py-0.5 rounded-xs border border-[#FDE68A]">
                      CB: {c.betweenness_centrality.toFixed(4)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-stone-800 line-clamp-2">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('causal')}
            className="mt-4 w-full py-2.5 bg-[#F9F8F5] hover:bg-[#F2EFE8] text-[#0A2E23] border border-[#E5E2DA] rounded-md text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <span>Inspect Causal Network Graph</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#064E3B]" />
          </button>
        </div>

      </div>

      {/* Trajectory: Compounding Drag vs Principal Baseline */}
      <div className="bg-white rounded-md border border-[#E5E2DA] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#F0EDE5]">
          <div>
            <h3 className="text-xs font-bold text-[#0A2E23] uppercase tracking-wider font-mono">Compounding Drag vs. Remediation Principal Trajectory</h3>
            <p className="text-xs text-stone-500 font-medium">
              Visual proof of the Break-Even inflection point: after week 2, unaddressed technical debt enters compounding capital loss.
            </p>
          </div>
          <span className="text-xs font-mono text-[#881337] font-bold bg-[#FDF2F4] px-2.5 py-1 rounded-sm border border-[#F8D2DB] shrink-0">
            Net Economic Drag: +{netEconomicDrag} hrs
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#881337" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#881337" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE5" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#78716C' }} stroke="#D8D4C8" />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} stroke="#D8D4C8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0A2E23', 
                  color: '#FFFFFF', 
                  borderRadius: '6px', 
                  border: '1px solid #05231B',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }} 
                itemStyle={{ color: '#FFFFFF' }}
              />
              <Area 
                type="monotone" 
                dataKey="incidentCost" 
                name="Compounded Failure Drag I(d)" 
                stroke="#881337" 
                fillOpacity={1} 
                fill="url(#interestGrad)" 
                strokeWidth={2.5}
              />
              <Area 
                type="stepAfter" 
                dataKey="principalBaseline" 
                name="Fixed Principal Baseline P(d)" 
                stroke="#064E3B" 
                fill="none" 
                strokeWidth={2} 
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Universal Concept Modal - Explain to Sir why DebtLens applies universally */}
      {isConceptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-md border border-[#E5E2DA] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#E5E2DA] flex items-center justify-between bg-[#F9F8F5]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-md bg-[#064E3B] text-white">
                  <BookOpen className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0A2E23]">Universal Architectural Framework</h3>
                  <p className="text-xs text-stone-500">Why DebtLens is not bounded to only financial systems</p>
                </div>
              </div>
              <button
                onClick={() => setIsConceptModalOpen(false)}
                className="text-stone-400 hover:text-[#0A2E23] p-1 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-stone-700 leading-relaxed max-h-[75vh] overflow-y-auto">
              <div className="p-3.5 bg-[#ECFDF5] rounded-md border border-[#A7F3D0] space-y-1">
                <span className="font-bold text-[#065F46] font-mono text-[11px] uppercase tracking-wide">
                  Core Architectural Premise
                </span>
                <p className="text-stone-800 font-medium">
                  Technical debt in software engineering is <strong>universal</strong>. Whenever code shortcuts or missing structural protections exist, every runtime production failure inflicts repeated downtime and blast radius on the organization.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-[#0A2E23] text-sm mb-1">
                  1. The Universal Economic Drag Formula
                </h4>
                <div className="p-3 bg-[#F9F8F5] rounded-md border border-[#E5E2DA] font-mono text-[11px] text-[#0A2E23] mb-2">
                  I(d) = λ₁ · ∑ (Downtime_Hours × Severity_Weight) + λ₂ · Blast_Radius_Score
                </div>
                <p>
                  This formula is domain-agnostic. Whether calculating lost revenue during payment gateway connection pool exhaustion, or vital telemetry lag in an ICU hospital system, or delivery delays in a supply chain, the compounding loss function remains mathematically identical.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-[#0A2E23] text-sm mb-1">
                  2. Cross-Domain Demonstration Scenarios
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-md border border-[#E5E2DA] bg-[#F9F8F5]">
                    <div className="font-bold text-[#0A2E23]">FinTech Payments</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">PostgreSQL pool starvation, Stripe webhook dropouts, idempotency key deadlocks.</div>
                  </div>
                  <div className="p-2.5 rounded-md border border-[#E5E2DA] bg-[#F9F8F5]">
                    <div className="font-bold text-[#0A2E23]">Hospital HealthTech</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">ICU bedside vital telemetry drops, unindexed EHR lookups, HL7 queue overflows.</div>
                  </div>
                  <div className="p-2.5 rounded-md border border-[#E5E2DA] bg-[#F9F8F5]">
                    <div className="font-bold text-[#0A2E23]">Supply Chain & IoT</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">Kafka partition rebalances, warehouse inventory lock deadlocks, EDI timeouts.</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#0A2E23] text-sm mb-1">
                  3. Mathematical 0/1 Knapsack Remediation Optimization
                </h4>
                <div className="p-3 bg-[#F9F8F5] rounded-md border border-[#E5E2DA] font-mono text-[11px] text-[#0A2E23] mb-2">
                  maximize ∑ R(dᵢ) · xᵢ  subject to  ∑ P(dᵢ) · xᵢ ≤ Sprint_Budget_B,  xᵢ ∈ {'{0, 1}'}
                </div>
                <p>
                  Static linters like SonarQube generate hundreds of unprioritized warnings without business context. DebtLens packages the exact subset of refactoring tasks that maximizes risk reduction and stops ongoing capital drag within finite engineering sprint hours.
                </p>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#E5E2DA] bg-[#F9F8F5] flex items-center justify-between">
              <span className="text-[11px] text-stone-500 font-mono">Department of ISE • BEC Bagalkote</span>
              <button
                onClick={() => setIsConceptModalOpen(false)}
                className="px-4 py-2 bg-[#064E3B] hover:bg-[#043D2E] text-white text-xs font-bold rounded-md shadow-xs transition-colors cursor-pointer"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
