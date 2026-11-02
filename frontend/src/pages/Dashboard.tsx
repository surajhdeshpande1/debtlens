import React from 'react';
import { 
  AlertTriangle, 
  Coins, 
  Clock, 
  GitFork, 
  Flame, 
  ShieldAlert, 
  ArrowRight, 
  Code2, 
  Database,
  Server,
  Layers,
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

// Enterprise Module Color Map
const MODULE_PALETTE: Record<string, { color: string; bg: string; text: string; border: string }> = {
  payments: { color: '#8B5CF6', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  database: { color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  settlement: { color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  checkout: { color: '#0EA5E9', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  auth: { color: '#F43F5E', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  notification: { color: '#14B8A6', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  core_ledger: { color: '#6366F1', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' }
};

const getModuleStyle = (name: string, index: number) => {
  const clean = name.toLowerCase().replace(/[\s-]/g, '_');
  if (MODULE_PALETTE[clean]) return MODULE_PALETTE[clean];
  const fallbacks = [
    { color: '#8B5CF6', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    { color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    { color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    { color: '#0EA5E9', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    { color: '#F43F5E', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    { color: '#14B8A6', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' }
  ];
  return fallbacks[index % fallbacks.length];
};

const getCategoryBadgeClass = (category: string) => {
  const cat = (category || '').toUpperCase();
  if (cat.includes('DATABASE')) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (cat.includes('NETWORK')) return 'text-sky-700 bg-sky-50 border-sky-200';
  if (cat.includes('ARCHITECTURE')) return 'text-purple-700 bg-purple-50 border-purple-200';
  if (cat.includes('CONCURRENCY')) return 'text-amber-700 bg-amber-50 border-amber-200';
  if (cat.includes('PERFORMANCE')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (cat.includes('MEMORY')) return 'text-rose-700 bg-rose-50 border-rose-200';
  return 'text-indigo-700 bg-indigo-50 border-indigo-200';
};

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  onNavigateTab,
  onOpenReportModal
}) => {
  if (!summary) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <div className="text-sm font-semibold text-slate-700">Loading DebtLens intelligence telemetry...</div>
        <div className="text-xs text-slate-400 mt-1">Connecting to Firestore asia-south1 cluster</div>
      </div>
    );
  }

  const moduleChartData = summary.high_risk_modules.map((m) => ({
    name: m.module,
    interest: m.interest,
    blastRadius: m.blast_radius,
    debtCount: m.debt_count
  }));

  // Historical cumulative drag trajectory simulation
  const trajectoryData = [
    { period: 'Week 1', incidentCost: 45, principalBaseline: 90 },
    { period: 'Week 2', incidentCost: 110, principalBaseline: 90 },
    { period: 'Week 3', incidentCost: 210, principalBaseline: 90 },
    { period: 'Week 4', incidentCost: 320, principalBaseline: 90 },
    { period: 'Current', incidentCost: summary.total_accrued_interest, principalBaseline: summary.total_principal_effort }
  ];

  const breakevenRatio = Math.round((summary.past_breakeven_count / Math.max(1, summary.total_debt_items)) * 100);

  return (
    <div className="space-y-6">
      
      {/* Welcome & Context Banner with Multi-Color Pastel Accent */}
      <div className="bg-gradient-to-r from-white via-indigo-50/50 to-purple-50/30 rounded-2xl p-6 border border-slate-200/90 shadow-xs relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white text-[11px] font-semibold text-indigo-700 border border-indigo-200/80 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Telemetry Pipeline Active</span>
            </div>
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-50 text-[10px] font-semibold text-purple-700 border border-purple-200">
              <Database className="w-3 h-3 text-purple-600" />
              <span>Firestore asia-south1</span>
            </div>
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
              <Server className="w-3 h-3 text-emerald-600" />
              <span>FastAPI Backend</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Executive Debt Intelligence Dashboard
          </h2>
          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
            Preserving the causal chain from incident intake to directed 5-Whys root cause, quantifying technical debt interest 
            <span className="font-mono bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded-sm mx-1 font-bold">I(d)</span>, 
            and scheduling optimal remediation sets via bounded 0/1 knapsack optimization.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateTab('optimiser')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <span>Run Payoff Optimiser</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenReportModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              <span>+ Intake New Incident</span>
            </button>
            <button
              onClick={() => onNavigateTab('repository')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>AST Playground</span>
            </button>
          </div>
        </div>

        {/* Ambient background glows */}
        <div className="absolute right-0 top-0 translate-x-16 -translate-y-12 w-64 h-64 bg-indigo-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 bottom-0 translate-y-12 w-48 h-48 bg-purple-100/40 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Multi-Colored KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Incidents"
          value={summary.open_incidents}
          subtitle={`${summary.resolved_incidents} historical resolutions archived`}
          icon={AlertTriangle}
          theme="amber"
          badge={summary.open_incidents > 0 ? { text: `${summary.open_incidents} Open`, variant: 'warning' } : { text: 'Healthy', variant: 'positive' }}
        />

        <StatCard
          title="Debt Principal P(d)"
          value={`${summary.total_principal_effort}h`}
          subtitle={`${summary.total_debt_items} registered structural debt items`}
          icon={Clock}
          theme="indigo"
          badge={{ text: 'Baseline Effort', variant: 'neutral' }}
        />

        <StatCard
          title="Accrued Interest I(d)"
          value={`${summary.total_accrued_interest}h`}
          subtitle={`Inflicted via incidents & blast radius`}
          icon={Coins}
          theme="rose"
          badge={{ text: `+${summary.net_economic_drag}h Drag`, variant: 'negative' }}
        />

        <StatCard
          title="Break-Even Threshold"
          value={`${breakevenRatio}%`}
          subtitle={`${summary.past_breakeven_count} items where Interest > Principal`}
          icon={Flame}
          theme="red"
          badge={{ text: 'Action Urgent', variant: 'negative' }}
        />
      </div>

      {/* Break-Even Critical Alert Callout */}
      {summary.past_breakeven_count > 0 && (
        <div className="p-4 rounded-xl bg-rose-50/90 border border-rose-200 flex items-start space-x-3 text-rose-900 shadow-2xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-rose-900">
              Break-Even Alert: {summary.past_breakeven_count} Technical Debt Items Have Cost More Than Remediation!
            </h4>
            <p className="mt-0.5 text-xs text-rose-700">
              The team has expended more engineering hours responding to failures caused by these items than it would cost to permanently repair their structural weaknesses.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('debt')}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer shadow-2xs transition-colors"
          >
            Review Ledger
          </button>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Module Drag Exposure Chart with Palette-Coded Bars */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Module Economic Drag Exposure</h3>
              <p className="text-xs text-slate-500">Accrued interest cost (hours) across architectural boundaries</p>
            </div>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
              λ₁=0.15, λ₂=1.8
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    borderRadius: '10px', 
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                  }}
                  formatter={(val: any) => [`${val} hours`, 'Accrued Interest']}
                />
                <Bar dataKey="interest" radius={[6, 6, 0, 0]}>
                  {moduleChartData.map((entry, index) => {
                    const style = getModuleStyle(entry.name, index);
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={style.color} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Module Color Swatch Legend */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
            {moduleChartData.map((entry, index) => {
              const style = getModuleStyle(entry.name, index);
              return (
                <div 
                  key={entry.name}
                  className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${style.bg} ${style.text} ${style.border}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
                  <span className="capitalize">{entry.name}</span>
                  <span className="font-mono text-[10px] opacity-80">({entry.interest}h)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Systemic Root Causes (Centrality Ranking) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-1.5">
                <GitFork className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Systemic Root Causes</h3>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Betweenness</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Identified by NetworkX causal graph betweenness and degree centrality:
            </p>

            <div className="space-y-2.5">
              {summary.top_systemic_causes.slice(0, 4).map((c, idx) => {
                const badgeClass = getCategoryBadgeClass(c.category);
                return (
                  <div 
                    key={c.id} 
                    className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm border ${badgeClass}`}>
                        #{idx + 1} {c.category}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {c.betweenness_centrality.toFixed(4)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-800 line-clamp-2">
                      {c.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('causal')}
            className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
          >
            <span>Explore Full Causal Graph</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

      </div>

      {/* Trajectory: Break-Even Crossing Curve */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Historical Interest Accrual vs. Principal Break-Even Line</h3>
            <p className="text-xs text-slate-500">
              When the red cumulative interest curve crosses above the fixed principal line, debt is officially past break-even
            </p>
          </div>
          <span className="text-xs font-mono text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
            Current Drag: +{summary.net_economic_drag} hrs
          </span>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="principalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '10px', 
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="incidentCost" 
                name="Accrued Failure Interest I(d)" 
                stroke="#F43F5E" 
                fillOpacity={1} 
                fill="url(#interestGrad)" 
                strokeWidth={2.5}
              />
              <Area 
                type="stepAfter" 
                dataKey="principalBaseline" 
                name="Fixed Principal Remediation Cost P(d)" 
                stroke="#6366F1" 
                fill="url(#principalGrad)" 
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
