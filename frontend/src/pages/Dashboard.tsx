import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  AlertTriangle, 
  Coins, 
  Clock, 
  Flame, 
  ArrowRight, 
  GitFork, 
  Plus, 
  Terminal, 
  ShieldAlert,
  Cpu,
  Layers,
  Activity
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { ExecutiveDashboardSummary } from '../types';
import { NavTab } from '../components/Sidebar';

interface DashboardProps {
  summary: ExecutiveDashboardSummary | null;
  onNavigateTab: (tab: NavTab) => void;
  onOpenReportModal: () => void;
}

const MODULE_COLORS: Record<string, string> = {
  database: '#064E3B',    // Deep Forest Emerald
  payments: '#059669',    // Emerald
  settlement: '#D97706',  // Amber
  orders: '#B45309',      // Dark Amber
  checkout: '#475569',    // Slate
  auth: '#1E293B',        // Charcoal Slate
  notification: '#0284C7' // Technical Cyan
};

const getModuleColor = (name: string, index: number) => {
  const clean = name.toLowerCase().replace(/[\s-]/g, '_');
  if (MODULE_COLORS[clean]) return MODULE_COLORS[clean];
  const palette = ['#064E3B', '#059669', '#D97706', '#B45309', '#475569', '#1E293B'];
  return palette[index % palette.length];
};

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  onNavigateTab,
  onOpenReportModal
}) => {
  if (!summary) {
    return (
      <div className="py-24 text-center font-mono">
        <div className="w-8 h-8 border-2 border-[#064E3B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-xs font-bold text-[#064E3B]">Connecting to telemetry stream...</div>
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
    <div className="space-y-5">
      
      {/* Executive Engineering Cockpit Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E2DDD5]">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-[#64748B] mb-1">
            <span>BEC_BAGALKOTE</span>
            <span>::</span>
            <span className="text-[#0F172A] font-bold">PAYMENTS_PLATFORM[PAY]</span>
            <span>•</span>
            <span className="inline-flex items-center space-x-1.5 text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-xs border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>TELEMETRY STREAM ACTIVE</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0F172A] font-mono">
            Executive Debt Intelligence Cockpit
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5 font-mono">
            Correlating runtime production failures with structural code debt via 0/1 Knapsack optimization.
          </p>
        </div>

        {/* Functional Engineering Actions (Zero Sparkles, Crisp High-Contrast) */}
        <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-2 font-mono">
          <button
            onClick={() => onNavigateTab('demo')}
            className="h-8 inline-flex items-center space-x-1.5 px-3 rounded-sm bg-[#064E3B] hover:bg-[#053D2E] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.98] border border-[#042C21]"
            title="Launch Interactive 1-Click Operational Pipeline Walkthrough"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-300" />
            <span>RUN DEMO PIPELINE</span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="h-8 inline-flex items-center space-x-1.5 px-3 rounded-sm bg-white hover:bg-[#F4EFE6] text-[#0F172A] text-xs font-bold border border-[#E2DDD5] shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-stone-600" />
            <span>INGEST INCIDENT</span>
          </button>

          <button
            onClick={() => onNavigateTab('optimiser')}
            className="h-8 inline-flex items-center space-x-1.5 px-3 rounded-sm bg-white hover:bg-[#F4EFE6] text-[#0F172A] text-xs font-bold border border-[#E2DDD5] shadow-2xs transition-colors cursor-pointer"
          >
            <span>0/1 OPTIMISER</span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Active Failures"
          value={summary.open_incidents}
          subtitle={`${summary.resolved_incidents} historical resolutions archived`}
          icon={AlertTriangle}
          badge={summary.open_incidents > 0 ? { text: `${summary.open_incidents} OPEN`, variant: 'warning' } : { text: 'HEALTHY', variant: 'positive' }}
        />

        <StatCard
          title="Principal P(d)"
          value={`${summary.total_principal_effort}h`}
          subtitle={`${summary.total_debt_items} structural components cataloged`}
          icon={Clock}
          badge={{ text: 'BASELINE', variant: 'neutral' }}
        />

        <StatCard
          title="Accrued Drag I(d)"
          value={`${summary.total_accrued_interest}h`}
          subtitle={`Inflicted engineering downtime drag`}
          icon={Coins}
          badge={{ text: `+${summary.net_economic_drag}h DRAG`, variant: 'negative' }}
        />

        <StatCard
          title="Break-Even Critical"
          value={`${breakevenRatio}%`}
          subtitle={`${summary.past_breakeven_count} items where Interest > Principal`}
          icon={Flame}
          badge={{ text: 'CRITICAL', variant: 'negative' }}
        />
      </div>

      {/* Break-Even Critical Technical Callout */}
      {summary.past_breakeven_count > 0 && (
        <div className="p-3.5 rounded-md border border-rose-300 bg-rose-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[#0F172A] shadow-[0_1px_2px_rgba(0,0,0,0.02)] font-mono">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-8 h-8 rounded-sm bg-rose-100 flex items-center justify-center shrink-0 border border-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-700" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-rose-950">
                CAPITAL DRAG ALERT: {summary.past_breakeven_count} DEBT ITEMS EXCEED PERMANENT REMEDIATION COST
              </div>
              <div className="text-[11px] text-rose-800 mt-0.5 leading-relaxed font-sans">
                Engineering teams have expended {summary.total_accrued_interest} hours repeatedly mitigating failures—exceeding the one-time {summary.total_principal_effort} hours required to permanently repair them.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('debt')}
            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-sm shadow-xs shrink-0 cursor-pointer transition-colors"
          >
            Review Balance Sheet →
          </button>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Module Drag Exposure Chart */}
        <div className="lg:col-span-7 bg-white rounded-md border border-[#E2DDD5] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold font-mono uppercase text-[#0F172A]">Module Economic Drag Exposure</h3>
              <p className="text-[11px] text-[#64748B] font-mono">Accrued interest cost (hours) partitioned across microservices</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-xs bg-[#F4EFE6] text-[#064E3B] border border-[#E2DDD5]">
              λ₁=0.15, λ₂=1.8
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#F0ECE1" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }} 
                  axisLine={{ stroke: '#E2DDD5' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }} 
                  axisLine={{ stroke: '#E2DDD5' }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    borderRadius: '3px', 
                    border: '1px solid #E2DDD5',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                  }}
                  formatter={(val: any) => [`${val} hours`, 'Accrued Interest']}
                />
                <Bar dataKey="interest" radius={[2, 2, 0, 0]}>
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
          <div className="pt-2 border-t border-[#F0ECE1] flex flex-wrap gap-1.5 font-mono">
            {moduleChartData.map((entry, index) => {
              const color = getModuleColor(entry.name, index);
              return (
                <div 
                  key={entry.name}
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-xs text-[10px] bg-[#FAF9F5] border border-[#E2DDD5] text-stone-700"
                >
                  <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: color }} />
                  <span className="capitalize">{entry.name}</span>
                  <span className="text-[#64748B]">({entry.interest}h)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Systemic Root Causes (Centrality Ranking) */}
        <div className="lg:col-span-5 bg-white rounded-md border border-[#E2DDD5] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <GitFork className="w-4 h-4 text-[#064E3B]" />
                <h3 className="text-xs font-mono font-bold uppercase text-[#0F172A]">Systemic Root Causes</h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase">Betweenness</span>
            </div>
            <p className="text-[11px] text-[#64748B] font-mono mb-3">
              Ranked via NetworkX graph centrality across multi-incident 5-Whys trees:
            </p>

            <div className="space-y-2">
              {summary.top_systemic_causes.slice(0, 4).map((c, idx) => (
                <div 
                  key={c.id} 
                  className="p-2.5 rounded-sm border border-[#E2DDD5] bg-[#FAF9F5] hover:bg-white hover:border-[#064E3B]/40 transition-all font-mono"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-xs bg-[#F4EFE6] text-[#064E3B] border border-[#E2DDD5]">
                      #{idx + 1} {c.category}
                    </span>
                    <span className="text-xs font-black text-rose-800">
                      {c.betweenness_centrality.toFixed(4)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-[#0F172A] line-clamp-2 font-sans">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('causal')}
            className="mt-4 w-full py-2 bg-[#FAF9F5] hover:bg-[#F4EFE6] text-[#0F172A] border border-[#E2DDD5] rounded-sm text-xs font-mono font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span>EXPLORE FULL CAUSAL GRAPH (M3)</span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
          </button>
        </div>

      </div>

      {/* Trajectory: Break-Even Crossing Curve */}
      <div className="bg-white rounded-md border border-[#E2DDD5] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-mono">
          <div>
            <h3 className="text-xs font-bold uppercase text-[#0F172A]">Cumulative Drag Trajectory vs. Remediation Principal</h3>
            <p className="text-[11px] text-[#64748B]">
              When cumulative interest crosses above the fixed remediation line, technical debt enters compounding drag.
            </p>
          </div>
          <span className="text-xs font-bold text-rose-900 bg-rose-50 px-2.5 py-1 rounded-xs border border-rose-300 shrink-0">
            NET DRAG: +{summary.net_economic_drag} HRS
          </span>
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#F0ECE1" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '3px', 
                  border: '1px solid #E2DDD5',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="incidentCost" 
                name="Accrued Failure Interest I(d)" 
                stroke="#DC2626" 
                fillOpacity={1} 
                fill="url(#interestGrad)" 
                strokeWidth={2}
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

    </div>
  );
};
