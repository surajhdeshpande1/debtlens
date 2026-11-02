import React from 'react';
import { 
  AlertTriangle, 
  Coins, 
  TrendingUp, 
  Clock, 
  GitFork, 
  Flame, 
  CheckCircle2, 
  ArrowUpRight,
  ShieldAlert,
  ArrowRight,
  Zap,
  Code2,
  FileDown,
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

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  onNavigateTab,
  onOpenReportModal
}) => {
  if (!summary) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        Loading DebtLens intelligence telemetry...
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
      
      {/* Welcome & Context Banner */}
      <div className="bg-gradient-to-r from-white via-indigo-50/40 to-slate-50 rounded-2xl p-6 border border-slate-200/90 shadow-xs relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-700 border border-indigo-200 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Telemetry Pipeline Live • FinTech Enterprise Corpus Active</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Executive Debt Intelligence Dashboard</h2>
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
              <Code2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>AST Playground</span>
            </button>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-indigo-100/60 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Production Incidents"
          value={summary.open_incidents}
          subtitle={`${summary.resolved_incidents} historical resolutions archived`}
          icon={AlertTriangle}
          accentColor="text-amber-600 bg-amber-50 border-amber-200"
          badge={summary.open_incidents > 0 ? { text: `${summary.open_incidents} Open`, variant: 'warning' } : { text: 'Healthy', variant: 'positive' }}
        />

        <StatCard
          title="Debt Principal Effort P(d)"
          value={`${summary.total_principal_effort}h`}
          subtitle={`${summary.total_debt_items} registered structural debt items`}
          icon={Clock}
          accentColor="text-indigo-600 bg-indigo-50 border-indigo-200"
        />

        <StatCard
          title="Accrued Debt Interest I(d)"
          value={`${summary.total_accrued_interest}h`}
          subtitle={`Inflicted via incidents & blast radius`}
          icon={Coins}
          accentColor="text-rose-600 bg-rose-50 border-rose-200"
          badge={{ text: `+${summary.net_economic_drag}h Drag`, variant: 'negative' }}
        />

        <StatCard
          title="Break-Even Threshold"
          value={`${breakevenRatio}%`}
          subtitle={`${summary.past_breakeven_count} items where Interest > Principal`}
          icon={Flame}
          accentColor="text-red-600 bg-red-50 border-red-200"
          badge={{ text: 'Action Urgent', variant: 'negative' }}
        />
      </div>

      {/* Break-Even Critical Callout */}
      {summary.past_breakeven_count > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-900">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-rose-900">
              Break-Even Alert: {summary.past_breakeven_count} Technical Debt Items Have Cost More than Remediation!
            </h4>
            <p className="mt-0.5 text-xs text-rose-700">
              The team has already expended more engineering hours responding to failures caused by these items than it would cost to permanently repair their structural weaknesses.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('debt')}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
          >
            Review Ledger
          </button>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Module Drag Exposure Chart */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Module Economic Drag Exposure</h3>
              <p className="text-xs text-slate-500">Accrued interest cost (hours) across architectural boundaries</p>
            </div>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              λ₁=0.15, λ₂=1.8
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
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
                    backgroundColor: '#FFFFFF', 
                    borderRadius: '8px', 
                    border: '1px solid #E2E8F0',
                    fontSize: '12px'
                  }}
                  formatter={(val: any) => [`${val} hours`, 'Accrued Interest']}
                />
                <Bar dataKey="interest" radius={[4, 4, 0, 0]} fill="#4F46E5">
                  {moduleChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.interest > 30 ? '#E11D48' : '#4F46E5'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Systemic Root Causes (Centrality Ranking) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-1.5">
                <GitFork className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Systemic Root Causes</h3>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Betweenness</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Identified by NetworkX causal graph betweenness and degree centrality:
            </p>

            <div className="space-y-2.5">
              {summary.top_systemic_causes.slice(0, 4).map((c, idx) => (
                <div 
                  key={c.id} 
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-sm">
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
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('causal')}
            className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
          >
            <span>Explore Full Causal Graph</span>
            <ArrowRight className="w-3.5 h-3.5" />
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
                  <stop offset="5%" stopColor="#E11D48" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#E11D48" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '8px', 
                  border: '1px solid #E2E8F0',
                  fontSize: '12px' 
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="incidentCost" 
                name="Accrued Failure Interest I(d)" 
                stroke="#E11D48" 
                fillOpacity={1} 
                fill="url(#interestGrad)" 
                strokeWidth={2.5}
              />
              <Area 
                type="stepAfter" 
                dataKey="principalBaseline" 
                name="Fixed Principal Remediation Cost P(d)" 
                stroke="#4F46E5" 
                fill="none" 
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
