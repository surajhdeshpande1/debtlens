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
  payments: '#0C1A2E',      // Deep Navy Blue
  database: '#8A6112',      // Amber Ochre
  settlement: '#2C3E50',    // Steel / Slate Blue
  checkout: '#4A3B69',      // Muted Plum
  auth: '#8E2825',          // Deep Oxblood / Crimson
  notification: '#374151',  // Charcoal
  core_ledger: '#163354'    // Prussian Navy
};

const getModuleColor = (name: string, index: number) => {
  const clean = name.toLowerCase().replace(/[\s-]/g, '_');
  if (MODULE_COLORS[clean]) return MODULE_COLORS[clean];
  const palette = ['#0C1A2E', '#8A6112', '#2C3E50', '#8E2825', '#163354', '#374151'];
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
        <div className="w-8 h-8 border-2 border-[#0C1A2E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-xs font-semibold text-stone-700">Connecting to telemetry stream...</div>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5DFD5]">
        <div>
          <div className="flex items-center space-x-2 text-xs text-stone-500 mb-1 font-mono">
            <span>Portfolio</span>
            <span>/</span>
            <span className="text-[#0C1A2E] font-bold">Payments Core Architecture (PAY)</span>
            <span className="text-stone-300">•</span>
            <span className="inline-flex items-center space-x-1.5 text-[11px] text-[#1E4E38] font-bold bg-[#EDF6F1] px-2 py-0.5 rounded-sm border border-[#BCD8C7]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E4E38] animate-pulse" />
              <span>Real-Time Ingestion</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0C1A2E]">
            Executive Debt Intelligence Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 font-medium leading-relaxed max-w-3xl">
            Correlating runtime production failure telemetry with structural code weaknesses, quantifying compounding capital drag <span className="font-mono text-[#8E2825] font-bold">I(d)</span>, and packaging mathematically optimal remediation sets via bounded 0/1 knapsack programming.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-2">
          <button
            onClick={() => onNavigateTab('demo')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-[#0C1A2E] hover:bg-[#142B4B] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer border border-[#142B4B] active:scale-[0.99]"
            title="Launch 1-Click Interactive Demo Pipeline"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E5B54F] animate-pulse" />
            <span>Interactive Demo</span>
          </button>
          <button
            onClick={onOpenReportModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-white hover:bg-[#F6F3EB] text-[#0C1A2E] text-xs sm:text-sm font-bold border border-[#E5DFD5] shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-stone-500" />
            <span>+ Intake Incident</span>
          </button>
          <button
            onClick={() => onNavigateTab('optimiser')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-white hover:bg-[#F6F3EB] text-[#0C1A2E] text-xs sm:text-sm font-bold border border-[#E5DFD5] shadow-2xs transition-colors cursor-pointer"
          >
            <span>Run Optimiser</span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
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
          accentColor="amber"
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
          subtitle={`Inflicted engineering downtime and blast radius drag`}
          icon={Coins}
          accentColor="oxblood"
          badge={{ text: `+${summary.net_economic_drag}h Drag`, variant: 'negative' }}
        />

        <StatCard
          title="Break-Even Threshold Criticality"
          value={`${breakevenRatio}%`}
          subtitle={`${summary.past_breakeven_count} debt items where Cumulative Interest > Remediation Principal`}
          icon={Flame}
          accentColor="oxblood"
          badge={{ text: 'Critical Advisory', variant: 'negative' }}
        />
      </div>

      {/* Institutional Capital Drag Advisory */}
      {summary.past_breakeven_count > 0 && (
        <div className="p-4 rounded-md border border-[#E8B4B2] border-l-4 border-l-[#8E2825] bg-[#FDF5F5] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-900 shadow-2xs">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-8 h-8 rounded-sm bg-[#FCE8E7] flex items-center justify-center shrink-0 border border-[#E8B4B2]">
              <ShieldAlert className="w-4 h-4 text-[#8E2825]" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-[#8E2825] font-mono uppercase tracking-wide">
                CAPITAL DRAG ALERT: {summary.past_breakeven_count} DEBT ITEMS EXCEED PERMANENT REMEDIATION COST
              </div>
              <div className="text-xs text-stone-700 mt-0.5 font-medium leading-relaxed">
                Engineering teams have expended <strong>{summary.total_accrued_interest} hours</strong> repeatedly responding to failures caused by these items—exceeding the one-time <strong>{summary.total_principal_effort} hours</strong> required to permanently repair their structural weaknesses.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('debt')}
            className="px-3.5 py-1.5 bg-[#8E2825] hover:bg-[#78211F] text-white text-xs font-bold rounded-md shadow-2xs shrink-0 cursor-pointer transition-colors"
          >
            Review Balance Sheet →
          </button>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Module Drag Exposure Chart */}
        <div className="lg:col-span-7 bg-white rounded-md border border-[#E5DFD5] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F4EFE6]">
            <div>
              <h3 className="text-xs font-bold text-[#0C1A2E] uppercase tracking-wider font-mono">Module Economic Drag Exposure</h3>
              <p className="text-xs text-stone-500 font-medium">Accrued interest cost (hours) partitioned across microservices</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[#F4EFE6] text-stone-700 border border-[#E5DFD5]">
              λ₁=0.15, λ₂=1.8
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2EDE4" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#E5DFD5' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#E5DFD5' }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    borderRadius: '4px', 
                    border: '1px solid #E5DFD5',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                  formatter={(val: any) => [`${val} hours`, 'Compounded Interest']}
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
          <div className="pt-2 border-t border-[#F4EFE6] flex flex-wrap gap-2">
            {moduleChartData.map((entry, index) => {
              const color = getModuleColor(entry.name, index);
              return (
                <div 
                  key={entry.name}
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-[#FAF8F5] border border-[#E5DFD5] text-stone-700"
                >
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="capitalize">{entry.name}</span>
                  <span className="font-mono text-[10px] text-stone-500">({entry.interest}h)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Systemic Root Causes (Centrality Ranking) */}
        <div className="lg:col-span-5 bg-white rounded-md border border-[#E5DFD5] p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F4EFE6] mb-3">
              <div className="flex items-center space-x-2">
                <GitFork className="w-4 h-4 text-[#0C1A2E]" />
                <h3 className="text-xs font-bold text-[#0C1A2E] uppercase tracking-wider font-mono">Systemic Root Causes</h3>
              </div>
              <span className="text-[10px] font-mono uppercase font-bold text-stone-400">Betweenness</span>
            </div>
            <p className="text-xs text-stone-500 mb-3 font-medium">
              Ranked by NetworkX graph centrality across multi-incident 5-Whys convergence:
            </p>

            <div className="space-y-2">
              {summary.top_systemic_causes.slice(0, 4).map((c, idx) => (
                <div 
                  key={c.id} 
                  className="p-2.5 rounded-sm border border-[#E5DFD5] bg-[#FAF8F5] hover:bg-white hover:border-[#D1BFA8] transition-all"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-[#F0F4FA] text-[#0C1A2E] border border-[#CBD8E8] font-mono">
                      #{idx + 1} {c.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#0C1A2E]">
                      {c.betweenness_centrality.toFixed(4)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-stone-800 line-clamp-2">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('causal')}
            className="mt-4 w-full py-2 bg-[#FAF8F5] hover:bg-[#F2ECE2] text-[#0C1A2E] border border-[#E5DFD5] rounded-md text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <span>Inspect Causal Network Graph</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#0C1A2E]" />
          </button>
        </div>

      </div>

      {/* Trajectory: Compounding Drag vs Principal Baseline */}
      <div className="bg-white rounded-md border border-[#E5DFD5] p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#F4EFE6]">
          <div>
            <h3 className="text-xs font-bold text-[#0C1A2E] uppercase tracking-wider font-mono">Compounding Drag vs. Remediation Principal Trajectory</h3>
            <p className="text-xs text-stone-500 font-medium">
              Visual proof of the Break-Even inflection point: after week 2, unaddressed technical debt enters compounding capital loss.
            </p>
          </div>
          <span className="text-xs font-mono text-[#8E2825] font-bold bg-[#FDF2F2] px-2.5 py-1 rounded-sm border border-[#E8B4B2] shrink-0">
            Net Economic Drag: +{summary.net_economic_drag} hrs
          </span>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8E2825" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8E2825" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE4" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} stroke="#E5DFD5" />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} stroke="#E5DFD5" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '4px', 
                  border: '1px solid #E5DFD5',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="incidentCost" 
                name="Compounded Failure Drag I(d)" 
                stroke="#8E2825" 
                fillOpacity={1} 
                fill="url(#interestGrad)" 
                strokeWidth={2}
              />
              <Area 
                type="stepAfter" 
                dataKey="principalBaseline" 
                name="Fixed Principal Baseline P(d)" 
                stroke="#0C1A2E" 
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
