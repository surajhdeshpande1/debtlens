import React from 'react';
import { 
  AlertTriangle, 
  Coins, 
  Clock, 
  GitFork, 
  Flame, 
  ShieldAlert, 
  ArrowRight, 
  Plus,
  Sparkles
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
import { ExecutiveDashboardSummary } from '../types';
import { NavTab } from '../components/Sidebar';

interface DashboardProps {
  summary: ExecutiveDashboardSummary | null;
  onNavigateTab: (tab: NavTab) => void;
  onOpenReportModal: () => void;
}

const MONO_SHADES = ['#000000', '#27272A', '#52525B', '#71717A', '#A1A1AA', '#D4D4D8'];

const getModuleColor = (index: number) => {
  return MONO_SHADES[index % MONO_SHADES.length];
};

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  onNavigateTab,
  onOpenReportModal
}) => {
  if (!summary) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-xs font-semibold text-zinc-700">Connecting to telemetry stream...</div>
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

  return (
    <div className="space-y-6">
      
      {/* Executive Institutional Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2 text-xs text-zinc-500 mb-1 font-mono">
            <span>Portfolio</span>
            <span>/</span>
            <span className="text-black font-bold">Payments Core Architecture (PAY)</span>
            <span className="text-zinc-300">•</span>
            <span className="inline-flex items-center space-x-1.5 text-[11px] text-black font-bold bg-zinc-100 px-2 py-0.5 rounded-sm border border-zinc-200">
              <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
              <span>Real-Time Ingestion</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black">
            Executive Debt Intelligence Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 font-medium leading-relaxed max-w-3xl">
            Correlating runtime production failure telemetry with structural code weaknesses, quantifying compounding capital drag <span className="font-mono text-black font-bold">I(d)</span>, and packaging mathematically optimal remediation sets via bounded 0/1 knapsack programming.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => onNavigateTab('demo')}
            className="h-9 px-4 rounded-md bg-black hover:bg-zinc-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer border border-black inline-flex items-center space-x-2 active:scale-[0.99] whitespace-nowrap"
            title="Launch 1-Click Interactive Demo Pipeline"
          >
            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse shrink-0" />
            <span>Interactive Demo</span>
          </button>
          <button
            onClick={onOpenReportModal}
            className="h-9 px-3.5 rounded-md bg-white hover:bg-zinc-100 text-black text-xs font-semibold border border-zinc-300 shadow-2xs transition-colors cursor-pointer inline-flex items-center space-x-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>Intake Incident</span>
          </button>
          <button
            onClick={() => onNavigateTab('optimiser')}
            className="h-9 px-3.5 rounded-md bg-white hover:bg-zinc-100 text-black text-xs font-semibold border border-zinc-300 shadow-2xs transition-colors cursor-pointer inline-flex items-center space-x-1.5 whitespace-nowrap"
          >
            <span>Run Optimiser</span>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
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
          badge={summary.open_incidents > 0 ? { text: `${summary.open_incidents} Open Failures`, variant: 'warning' } : { text: 'Nominal', variant: 'positive' }}
        />

        <StatCard
          title="Debt Principal Baseline P(d)"
          value={`${summary.total_principal_effort}h`}
          subtitle={`${summary.total_debt_items} structural components catalogued across 6 modules`}
          icon={Clock}
          badge={{ text: 'Fixed Baseline', variant: 'neutral' }}
        />

        <StatCard
          title="Compounded Drag Interest I(d)"
          value={`${summary.total_accrued_interest}h`}
          subtitle="Inflicted engineering downtime and blast radius drag"
          icon={Coins}
          badge={{ text: `+${summary.net_economic_drag}h Drag`, variant: 'negative' }}
        />

        <StatCard
          title="Break-Even Threshold Criticality"
          value={`${breakevenRatio}%`}
          subtitle={`${summary.past_breakeven_count} debt items where Cumulative Interest > Remediation Principal`}
          icon={Flame}
          badge={{ text: 'Critical Advisory', variant: 'negative' }}
        />
      </div>

      {/* Institutional Capital Drag Advisory */}
      {summary.past_breakeven_count > 0 && (
        <div className="p-4 rounded-md border border-zinc-300 border-l-4 border-l-black bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-black shadow-2xs">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-8 h-8 rounded-sm bg-black flex items-center justify-center shrink-0 border border-black">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-black font-mono uppercase tracking-wide">
                CAPITAL DRAG ALERT: {summary.past_breakeven_count} DEBT ITEMS EXCEED PERMANENT REMEDIATION COST
              </div>
              <div className="text-xs text-zinc-700 mt-0.5 font-medium leading-relaxed">
                Engineering teams have expended <strong>{summary.total_accrued_interest} hours</strong> repeatedly responding to failures caused by these items—exceeding the one-time <strong>{summary.total_principal_effort} hours</strong> required to permanently repair their structural weaknesses.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('debt')}
            className="px-3.5 py-1.5 bg-black hover:bg-zinc-800 text-white text-xs font-bold rounded-md shadow-2xs shrink-0 cursor-pointer transition-colors"
          >
            Review Balance Sheet →
          </button>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Module Drag Exposure Chart */}
        <div className="lg:col-span-7 bg-white rounded-md border border-zinc-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h3 className="text-xs font-bold text-black uppercase tracking-wider font-mono">Module Economic Drag Exposure</h3>
              <p className="text-xs text-zinc-500 font-medium">Accrued interest cost (hours) partitioned across microservices</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-zinc-100 text-zinc-700 border border-zinc-200">
              λ₁=0.15, λ₂=1.8
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F4F4F5" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#71717A' }} 
                  axisLine={{ stroke: '#E4E4E7' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#71717A' }} 
                  axisLine={{ stroke: '#E4E4E7' }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#000000', 
                    color: '#FFFFFF',
                    borderRadius: '4px', 
                    border: '1px solid #27272A',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                  itemStyle={{ color: '#FFFFFF' }}
                  formatter={(val: any) => [`${val} hours`, 'Compounded Interest']}
                />
                <Bar dataKey="interest" radius={[2, 2, 0, 0]}>
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
          <div className="pt-2 border-t border-zinc-100 flex flex-wrap gap-2">
            {moduleChartData.map((entry, index) => {
              const color = getModuleColor(index);
              return (
                <div 
                  key={entry.name}
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-zinc-50 border border-zinc-200 text-zinc-700"
                >
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="capitalize">{entry.name}</span>
                  <span className="font-mono text-[10px] text-zinc-500">({entry.interest}h)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Systemic Root Causes (Centrality Ranking) */}
        <div className="lg:col-span-5 bg-white rounded-md border border-zinc-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
              <div className="flex items-center space-x-2">
                <GitFork className="w-4 h-4 text-black" />
                <h3 className="text-xs font-bold text-black uppercase tracking-wider font-mono">Systemic Root Causes</h3>
              </div>
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-400">Betweenness</span>
            </div>
            <p className="text-xs text-zinc-500 mb-3 font-medium">
              Ranked by NetworkX graph centrality across multi-incident 5-Whys convergence:
            </p>

            <div className="space-y-2">
              {summary.top_systemic_causes.slice(0, 4).map((c, idx) => (
                <div 
                  key={c.id} 
                  className="p-2.5 rounded-sm border border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-400 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-black text-white font-mono">
                      #{idx + 1} {c.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-black">
                      {c.betweenness_centrality.toFixed(4)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-zinc-800 line-clamp-2">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('causal')}
            className="mt-4 w-full py-2 bg-zinc-50 hover:bg-zinc-100 text-black border border-zinc-200 rounded-md text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <span>Inspect Causal Network Graph</span>
            <ArrowRight className="w-3.5 h-3.5 text-black" />
          </button>
        </div>

      </div>

      {/* Trajectory: Compounding Drag vs Principal Baseline */}
      <div className="bg-white rounded-md border border-zinc-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-xs font-bold text-black uppercase tracking-wider font-mono">Compounding Drag vs. Remediation Principal Trajectory</h3>
            <p className="text-xs text-zinc-500 font-medium">
              Visual proof of the Break-Even inflection point: after week 2, unaddressed technical debt enters compounding capital loss.
            </p>
          </div>
          <span className="text-xs font-mono text-black font-bold bg-zinc-100 px-2.5 py-1 rounded-sm border border-zinc-300 shrink-0">
            Net Economic Drag: +{summary.net_economic_drag} hrs
          </span>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#000000" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#000000" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#71717A' }} stroke="#E4E4E7" />
              <YAxis tick={{ fontSize: 11, fill: '#71717A' }} stroke="#E4E4E7" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#000000', 
                  color: '#FFFFFF',
                  borderRadius: '4px', 
                  border: '1px solid #27272A',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }} 
                itemStyle={{ color: '#FFFFFF' }}
              />
              <Area 
                type="monotone" 
                dataKey="incidentCost" 
                name="Compounded Failure Drag I(d)" 
                stroke="#000000" 
                fillOpacity={1} 
                fill="url(#interestGrad)" 
                strokeWidth={2}
              />
              <Area 
                type="stepAfter" 
                dataKey="principalBaseline" 
                name="Fixed Principal Baseline P(d)" 
                stroke="#71717A" 
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
