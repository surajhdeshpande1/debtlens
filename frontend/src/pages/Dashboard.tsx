import React from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Coins, 
  Flame, 
  Plus, 
  Sparkles,
  ArrowRight,
  ShieldAlert,
  GitFork
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

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  onNavigateTab,
  onOpenReportModal
}) => {
  if (!summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    );
  }

  const moduleChartData = summary.high_risk_modules.map((m) => ({
    name: m.module,
    interest: m.interest,
    blastRadius: m.blast_radius,
    debtCount: m.debt_count
  }));

  const trajectoryData = [
    { period: 'W1', incidentCost: 45, principalBaseline: 90 },
    { period: 'W2', incidentCost: 110, principalBaseline: 90 },
    { period: 'W3', incidentCost: 210, principalBaseline: 90 },
    { period: 'W4', incidentCost: 320, principalBaseline: 90 },
    { period: 'Current', incidentCost: summary.total_accrued_interest, principalBaseline: summary.total_principal_effort }
  ];

  const breakevenRatio = Math.round((summary.past_breakeven_count / Math.max(1, summary.total_debt_items)) * 100);

  // Executive Bespoke FinTech Module Colors
  const modulePalette = [
    '#0F172A', // Midnight Navy
    '#1D4ED8', // Royal Blue
    '#991B1B', // Crimson Drag
    '#B45309', // Brass Ochre
    '#065F46', // Emerald Sage
    '#4338CA', // Indigo Slate
    '#0284C7'  // Sky Sapphire
  ];
  const getModuleColor = (index: number) => modulePalette[index % modulePalette.length];

  return (
    <div className="space-y-6">
      
      {/* Executive Institutional Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1 font-mono">
            <span>Portfolio</span>
            <span>/</span>
            <span className="text-slate-900 font-bold">Payments Core Architecture (PAY)</span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center space-x-1.5 text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Ingestion</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
            Executive Debt Intelligence Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium leading-relaxed max-w-3xl">
            Correlating runtime production failure telemetry with structural code weaknesses, quantifying compounding capital drag <span className="font-mono text-red-700 font-bold">I(d)</span>, and packaging mathematically optimal remediation sets via bounded 0/1 knapsack programming.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => onNavigateTab('demo')}
            className="h-9 px-4 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer border border-blue-800 inline-flex items-center space-x-2 active:scale-[0.99] whitespace-nowrap"
            title="Launch 1-Click Interactive Demo Pipeline"
          >
            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse shrink-0" />
            <span>Interactive Demo</span>
          </button>
          <button
            onClick={onOpenReportModal}
            className="h-9 px-3.5 rounded-md bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer inline-flex items-center space-x-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Intake Incident</span>
          </button>
          <button
            onClick={() => onNavigateTab('optimiser')}
            className="h-9 px-3.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold border border-slate-900 shadow-2xs transition-colors cursor-pointer inline-flex items-center space-x-1.5 whitespace-nowrap"
          >
            <span>Run Optimiser</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* Structured Financial Ledger Balance Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Production Failures"
          value={summary.open_incidents}
          subtitle={`${summary.resolved_incidents} historical incident resolutions linked in causal graph`}
          icon={AlertTriangle}
          accentColor="ochre"
          badge={summary.open_incidents > 0 ? { text: `${summary.open_incidents} Open Failures`, variant: 'warning' } : { text: 'Nominal', variant: 'positive' }}
        />

        <StatCard
          title="Debt Principal Baseline P(d)"
          value={`${summary.total_principal_effort}h`}
          subtitle={`${summary.total_debt_items} structural components catalogued across 6 modules`}
          icon={Clock}
          accentColor="navy"
          badge={{ text: 'Fixed Baseline', variant: 'neutral' }}
        />

        <StatCard
          title="Compounded Drag Interest I(d)"
          value={`${summary.total_accrued_interest}h`}
          subtitle="Inflicted engineering downtime and blast radius drag"
          icon={Coins}
          accentColor="crimson"
          badge={{ text: `+${summary.net_economic_drag}h Drag`, variant: 'negative' }}
        />

        <StatCard
          title="Break-Even Threshold Criticality"
          value={`${breakevenRatio}%`}
          subtitle={`${summary.past_breakeven_count} debt items where Cumulative Interest > Remediation Principal`}
          icon={Flame}
          accentColor="crimson"
          badge={{ text: 'Critical Advisory', variant: 'negative' }}
        />
      </div>

      {/* Institutional Capital Drag Advisory */}
      {summary.past_breakeven_count > 0 && (
        <div className="p-4 rounded-md border border-red-200 border-l-4 border-l-red-700 bg-red-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-900 shadow-2xs">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-8 h-8 rounded-sm bg-red-700 flex items-center justify-center shrink-0 border border-red-800 text-white">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-red-950 font-mono uppercase tracking-wide">
                CAPITAL DRAG ALERT: {summary.past_breakeven_count} DEBT ITEMS EXCEED PERMANENT REMEDIATION COST
              </div>
              <div className="text-xs text-slate-700 mt-0.5 font-medium leading-relaxed">
                Engineering teams have expended <strong className="text-red-900">{summary.total_accrued_interest} hours</strong> repeatedly responding to failures caused by these items—exceeding the one-time <strong>{summary.total_principal_effort} hours</strong> required to permanently repair their structural weaknesses.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('debt')}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-md shadow-2xs shrink-0 cursor-pointer transition-colors whitespace-nowrap"
          >
            Review Balance Sheet →
          </button>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Module Drag Exposure Chart */}
        <div className="lg:col-span-7 bg-white rounded-md border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">Module Economic Drag Exposure</h3>
              <p className="text-xs text-slate-500 font-medium">Accrued interest cost (hours) partitioned across microservices</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 border border-slate-200">
              λ₁=0.15, λ₂=1.8
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    color: '#FFFFFF',
                    borderRadius: '6px', 
                    border: '1px solid #1E293B',
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
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
            {moduleChartData.map((entry, index) => {
              const color = getModuleColor(index);
              return (
                <div 
                  key={entry.name}
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-700"
                >
                  <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: color }} />
                  <span className="capitalize">{entry.name}</span>
                  <span className="font-mono text-[10px] text-slate-500">({entry.interest}h)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Systemic Root Causes (Centrality Ranking) */}
        <div className="lg:col-span-5 bg-white rounded-md border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center space-x-2">
                <GitFork className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">Systemic Root Causes</h3>
              </div>
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Betweenness</span>
            </div>
            <p className="text-xs text-slate-500 mb-3 font-medium">
              Ranked by NetworkX graph centrality across multi-incident 5-Whys convergence:
            </p>

            <div className="space-y-2">
              {summary.top_systemic_causes.slice(0, 4).map((c, idx) => (
                <div 
                  key={c.id} 
                  className="p-3 rounded-md border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-400 transition-all shadow-2xs"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-slate-900 text-white font-mono">
                      #{idx + 1} {c.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-xs border border-blue-200">
                      CB: {c.betweenness_centrality.toFixed(4)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-slate-800 line-clamp-2">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('causal')}
            className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-md text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <span>Inspect Causal Network Graph</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
          </button>
        </div>

      </div>

      {/* Trajectory: Compounding Drag vs Principal Baseline */}
      <div className="bg-white rounded-md border border-slate-200/90 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">Compounding Drag vs. Remediation Principal Trajectory</h3>
            <p className="text-xs text-slate-500 font-medium">
              Visual proof of the Break-Even inflection point: after week 2, unaddressed technical debt enters compounding capital loss.
            </p>
          </div>
          <span className="text-xs font-mono text-red-700 font-bold bg-red-50 px-2.5 py-1 rounded-sm border border-red-200 shrink-0">
            Net Economic Drag: +{summary.net_economic_drag} hrs
          </span>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} stroke="#CBD5E1" />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} stroke="#CBD5E1" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0F172A', 
                  color: '#FFFFFF', 
                  borderRadius: '6px', 
                  border: '1px solid #1E293B',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }} 
                itemStyle={{ color: '#FFFFFF' }}
              />
              <Area 
                type="monotone" 
                dataKey="incidentCost" 
                name="Compounded Failure Drag I(d)" 
                stroke="#DC2626" 
                fillOpacity={1} 
                fill="url(#interestGrad)" 
                strokeWidth={2.5}
              />
              <Area 
                type="stepAfter" 
                dataKey="principalBaseline" 
                name="Fixed Principal Baseline P(d)" 
                stroke="#475569" 
                fill="none" 
                strokeWidth={2} 
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
