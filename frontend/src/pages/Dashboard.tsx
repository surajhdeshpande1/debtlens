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
  TrendingUp,
  Activity,
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

const MODULE_COLORS: Record<string, string> = {
  payments: '#6366F1',
  database: '#F59E0B',
  settlement: '#10B981',
  checkout: '#0EA5E9',
  auth: '#F43F5E',
  notification: '#14B8A6',
  core_ledger: '#8B5CF6'
};

const getModuleColor = (name: string, index: number) => {
  const clean = name.toLowerCase().replace(/[\s-]/g, '_');
  if (MODULE_COLORS[clean]) return MODULE_COLORS[clean];
  const palette = ['#6366F1', '#F59E0B', '#10B981', '#0EA5E9', '#F43F5E', '#14B8A6'];
  return palette[index % palette.length];
};

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  onNavigateTab,
  onOpenReportModal
}) => {
  if (!summary) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-xs font-semibold text-slate-700">Connecting to telemetry stream...</div>
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
      
      {/* Executive Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-slate-500 mb-1.5">
            <span>Portfolio</span>
            <span>/</span>
            <span className="text-slate-800 font-bold">Payments Platform (PAY)</span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-time Telemetry Live</span>
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Executive Debt Intelligence Dashboard
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium">
            Preserving root cause causality from production incident intake to knapsack-optimized sprint scheduling.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto flex-wrap gap-2">
          <button
            onClick={() => onNavigateTab('demo')}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold shadow-sm hover:shadow-md transition-all cursor-pointer ring-2 ring-indigo-500/20 active:scale-95"
            title="Launch 1-Click Interactive Demo Pipeline"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Live Demo (1-Click)</span>
          </button>
          <button
            onClick={onOpenReportModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            <span>Intake Incident</span>
          </button>
          <button
            onClick={() => onNavigateTab('optimiser')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <span>Run Optimiser</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Production Incidents"
          value={summary.open_incidents}
          subtitle={`${summary.resolved_incidents} historical resolutions archived`}
          icon={AlertTriangle}
          badge={summary.open_incidents > 0 ? { text: `${summary.open_incidents} Open`, variant: 'warning' } : { text: 'Healthy', variant: 'positive' }}
        />

        <StatCard
          title="Debt Principal Effort P(d)"
          value={`${summary.total_principal_effort}h`}
          subtitle={`${summary.total_debt_items} registered structural debt items`}
          icon={Clock}
          badge={{ text: 'Baseline Effort', variant: 'neutral' }}
        />

        <StatCard
          title="Accrued Debt Interest I(d)"
          value={`${summary.total_accrued_interest}h`}
          subtitle={`Failure response cost across modules`}
          icon={Coins}
          badge={{ text: `+${summary.net_economic_drag}h Drag`, variant: 'negative' }}
        />

        <StatCard
          title="Break-Even Threshold"
          value={`${breakevenRatio}%`}
          subtitle={`${summary.past_breakeven_count} items where Interest > Principal`}
          icon={Flame}
          badge={{ text: 'Action Urgent', variant: 'negative' }}
        />
      </div>

      {/* Break-Even Critical Callout */}
      {summary.past_breakeven_count > 0 && (
        <div className="p-5 rounded-2xl border-2 border-rose-300 bg-rose-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-900 shadow-sm">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200">
              <ShieldAlert className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-extrabold text-slate-900">
                Break-Even Alert: {summary.past_breakeven_count} debt items have exceeded their remediation cost!
              </div>
              <div className="text-sm text-slate-700 mt-1 font-medium leading-relaxed">
                The team has expended more hours responding to failures caused by these items than it would take to permanently refactor them.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('debt')}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-xs shrink-0 cursor-pointer transition-colors"
          >
            Review Ledger →
          </button>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Module Drag Exposure Chart */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Module Economic Drag Exposure</h3>
              <p className="text-xs text-slate-500">Accrued interest cost (hours) partitioned across microservices</p>
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
                    borderRadius: '8px', 
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                  }}
                  formatter={(val: any) => [`${val} hours`, 'Accrued Interest']}
                />
                <Bar dataKey="interest" radius={[4, 4, 0, 0]}>
                  {moduleChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getModuleColor(entry.name, index)} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Module Color Swatch Legend */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
            {moduleChartData.map((entry, index) => {
              const color = getModuleColor(entry.name, index);
              return (
                <div 
                  key={entry.name}
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-700"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="capitalize">{entry.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">({entry.interest}h)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Systemic Root Causes (Centrality Ranking) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <GitFork className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Systemic Root Causes</h3>
              </div>
              <span className="text-xs uppercase font-bold text-slate-400">Betweenness</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mb-4">
              Identified via NetworkX betweenness centrality across 5-Whys causal graphs:
            </p>

            <div className="space-y-2.5">
              {summary.top_systemic_causes.slice(0, 4).map((c, idx) => (
                <div 
                  key={c.id} 
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      #{idx + 1} {c.category}
                    </span>
                    <span className="text-sm font-mono font-black text-purple-700">
                      {c.betweenness_centrality.toFixed(4)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('causal')}
            className="mt-5 w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span>Explore Full Causal Graph</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

      </div>

      {/* Trajectory: Break-Even Crossing Curve */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Cumulative Drag Trajectory vs. Remediation Principal</h3>
            <p className="text-xs sm:text-sm text-slate-500">
              When cumulative interest crosses above the fixed remediation line, technical debt enters compounding drag.
            </p>
          </div>
          <span className="text-xs sm:text-sm font-mono text-rose-700 font-bold bg-rose-50 px-3 py-1 rounded-lg border border-rose-200 shrink-0">
            Net Drag: +{summary.net_economic_drag} hrs
          </span>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '8px', 
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
                strokeWidth={2}
              />
              <Area 
                type="stepAfter" 
                dataKey="principalBaseline" 
                name="Fixed Principal Baseline P(d)" 
                stroke="#6366F1" 
                fill="none" 
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
