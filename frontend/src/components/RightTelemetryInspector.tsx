import React, { useState } from 'react';
import { 
  Activity, 
  Code2, 
  AlertTriangle, 
  ExternalLink, 
  Layers, 
  ChevronRight, 
  GitFork, 
  Coins, 
  ShieldAlert, 
  CheckCircle2, 
  Flame,
  FileCode,
  Terminal,
  Cpu
} from 'lucide-react';
import { ExecutiveDashboardSummary, Incident, DebtItem } from '../types';

interface RightTelemetryInspectorProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedItem: Incident | DebtItem | any | null;
  summary: ExecutiveDashboardSummary | null;
  onNavigateTab: (tab: any) => void;
  onClearSelection: () => void;
}

export const RightTelemetryInspector: React.FC<RightTelemetryInspectorProps> = ({
  isOpen,
  onToggle,
  selectedItem,
  summary,
  onNavigateTab,
  onClearSelection
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'context'>(selectedItem ? 'context' : 'system');

  // Automatically switch to contextual tab if a new item is selected
  React.useEffect(() => {
    if (selectedItem) {
      setActiveTab('context');
    }
  }, [selectedItem]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-24 z-30 bg-[#064E3B] hover:bg-[#053D2E] text-white px-2.5 py-3 rounded-l-md shadow-md border-y border-l border-[#042C21] flex flex-col items-center space-y-2 cursor-pointer transition-colors"
        title="Open Live Telemetry & AST Inspector"
      >
        <Activity className="w-4 h-4 text-emerald-300 animate-pulse" />
        <span className="text-[10px] font-mono font-bold tracking-widest [writing-mode:vertical-lr] uppercase">
          Telemetry
        </span>
      </button>
    );
  }

  // Microservice Blast Radius Matrix
  const microservices = [
    { name: 'database', downstream: 5, health: 'CRITICAL', dragHours: 64.2 },
    { name: 'payments', downstream: 4, health: 'DEGRADED', dragHours: 44.5 },
    { name: 'settlement', downstream: 3, health: 'WARNING', dragHours: 34.0 },
    { name: 'orders', downstream: 3, health: 'STABLE', dragHours: 19.5 },
    { name: 'checkout', downstream: 2, health: 'STABLE', dragHours: 14.2 },
    { name: 'auth', downstream: 2, health: 'HEALTHY', dragHours: 11.5 },
    { name: 'notification', downstream: 1, health: 'HEALTHY', dragHours: 9.8 }
  ];

  return (
    <aside className="w-80 xl:w-96 bg-white border-l border-[#E2DDD5] shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 flex flex-col justify-between overflow-y-auto z-20 select-none shadow-[ -2px_0_4px_rgba(0,0,0,0.02)]">
      
      {/* Inspector Header */}
      <div>
        <div className="p-3 bg-[#FAF9F5] border-b border-[#E2DDD5] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#064E3B]">
              Telemetry & AST Inspector
            </span>
          </div>

          <button
            onClick={onToggle}
            className="p-1 rounded-sm text-stone-500 hover:text-stone-900 hover:bg-[#EAE5D9] transition-colors cursor-pointer"
            title="Collapse Right Inspector"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Dual Mode Switcher Tabs */}
        <div className="flex border-b border-[#E2DDD5] bg-[#F4EFE6] text-xs font-mono font-bold">
          <button
            onClick={() => setActiveTab('system')}
            className={`flex-1 py-2 px-3 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border-r border-[#E2DDD5] ${
              activeTab === 'system'
                ? 'bg-white text-[#064E3B] border-b-2 border-b-[#064E3B]'
                : 'text-stone-600 hover:bg-[#EAE5D9]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>LIVE TELEMETRY</span>
          </button>

          <button
            onClick={() => setActiveTab('context')}
            className={`flex-1 py-2 px-3 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer relative ${
              activeTab === 'context'
                ? 'bg-white text-[#064E3B] border-b-2 border-b-[#064E3B]'
                : 'text-stone-600 hover:bg-[#EAE5D9]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>ITEM INSPECTOR</span>
            {selectedItem && (
              <span className="w-2 h-2 rounded-full bg-emerald-600 ml-1" />
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="p-3.5 space-y-4">
          
          {activeTab === 'system' ? (
            /* MODE 1: LIVE SYSTEM TELEMETRY MONITOR */
            <div className="space-y-4">
              
              {/* Formula Evaluator Strip */}
              <div className="p-3 rounded-md bg-[#FAF9F5] border border-[#E2DDD5] space-y-2">
                <div className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
                  <span>Economic Drag Formula I(d)</span>
                  <span className="text-emerald-700 font-bold">λ₁=0.15, λ₂=1.8</span>
                </div>

                <div className="p-2 bg-white rounded-sm border border-[#E2DDD5] font-mono text-[11px] text-[#0F172A] leading-relaxed">
                  I(d) = Σ[sev·effort] + 0.15·churn + 1.8·blast
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                  <div className="p-2 bg-white rounded-sm border border-[#E2DDD5]">
                    <span className="text-[#64748B] block text-[9px] uppercase">Principal P(d)</span>
                    <strong className="text-sm font-bold text-[#0F172A]">
                      {summary?.total_principal_effort || 90.0}h
                    </strong>
                  </div>
                  <div className="p-2 bg-rose-50 rounded-sm border border-rose-200">
                    <span className="text-rose-700 block text-[9px] uppercase font-bold">Drag Interest I(d)</span>
                    <strong className="text-sm font-bold text-rose-900">
                      {summary?.total_accrued_interest || 182.2}h
                    </strong>
                  </div>
                </div>

                <div className="text-[10px] text-rose-700 font-mono font-semibold flex items-center space-x-1 pt-1">
                  <Flame className="w-3 h-3 text-rose-600" />
                  <span>Net Capital Drag: +{( (summary?.total_accrued_interest || 182.2) - (summary?.total_principal_effort || 90.0) ).toFixed(1)}h</span>
                </div>
              </div>

              {/* Break-Even Critical Gauge */}
              <div className="p-3 rounded-md bg-white border border-[#E2DDD5] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                  <span className="text-[#0F172A]">Break-Even Saturation</span>
                  <span className="text-rose-700">86% Past Threshold</span>
                </div>
                
                <div className="w-full bg-[#EAE5D9] h-2.5 rounded-xs overflow-hidden">
                  <div className="bg-rose-600 h-full w-[86%]" />
                </div>

                <p className="text-[10px] text-[#64748B] font-mono leading-tight">
                  6 of 7 registered debt items have accumulated more downtime cost than their one-time refactoring principal.
                </p>
              </div>

              {/* Microservice Blast Radius Table */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
                  <span>Microservice Exposure</span>
                  <span>Blast Radius</span>
                </div>

                <div className="space-y-1 text-xs font-mono">
                  {microservices.map((svc) => (
                    <div 
                      key={svc.name}
                      className="p-2 rounded-sm bg-[#FAF9F5] border border-[#E2DDD5] flex items-center justify-between hover:bg-white transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          svc.health === 'CRITICAL' ? 'bg-rose-500' :
                          svc.health === 'DEGRADED' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                        <span className="font-bold text-[#0F172A]">{svc.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[#64748B] text-[11px]">{svc.dragHours}h drag</span>
                        <span className="px-1.5 py-0.2 bg-[#EAE5D9] text-[#0F172A] rounded-xs font-bold text-[10px]">
                          {svc.downstream} services
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active System Invariants */}
              <div className="p-3 rounded-md bg-slate-900 text-slate-100 font-mono text-xs space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Architecture Invariants</span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-rose-300">
                    <span>HikariCP.pool_saturation &lt; 90%</span>
                    <span className="font-bold text-rose-400">[100% SAT]</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-300">
                    <span>Idempotency_Interceptor_Active</span>
                    <span className="font-bold text-rose-400">[VIOLATED]</span>
                  </div>
                  <div className="flex items-center justify-between text-amber-300">
                    <span>Ledger_Partition_Index_Present</span>
                    <span className="font-bold text-amber-400">[DEGRADED]</span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* MODE 2: CONTEXTUAL ITEM DETAIL INSPECTOR */
            <div>
              {selectedItem ? (
                <div className="space-y-3.5">
                  
                  {/* Selected Item Header */}
                  <div className="p-3 bg-[#FAF9F5] rounded-md border border-[#E2DDD5] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-xs bg-[#064E3B] text-white">
                        {selectedItem.debt_key || selectedItem.incident_number || 'INSPECT-01'}
                      </span>
                      <span className="text-[10px] font-mono font-bold uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded-xs border border-rose-200">
                        {selectedItem.severity || selectedItem.category || 'HIGH RISK'}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#0F172A] leading-snug pt-1">
                      {selectedItem.title}
                    </h4>

                    <div className="flex items-center space-x-2 text-[11px] font-mono text-[#64748B] pt-0.5">
                      <span>Module: <strong>{selectedItem.module_name || selectedItem.affected_module}</strong></span>
                      <span>•</span>
                      <span>Effort: <strong>{selectedItem.effort_principal || selectedItem.resolution_effort_hours}h</strong></span>
                    </div>
                  </div>

                  {/* AST Code Evidence Block */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
                      <span>Codebase Hotspot Evidence</span>
                      <span className="text-[#064E3B]">AST cyclomatic CC: 24.5</span>
                    </div>

                    <div className="p-2.5 bg-[#1E293B] rounded-md text-slate-100 font-mono text-[11px] space-y-2 border border-slate-700">
                      <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-700">
                        <span className="truncate">
                          {selectedItem.file_path || 'database/connection_pool.py:84'}
                        </span>
                        <span className="text-amber-400 font-bold shrink-0">FIXME DETECTED</span>
                      </div>

                      <pre className="text-[10px] text-slate-300 overflow-x-auto leading-relaxed">
{`83 | def acquire_connection(timeout_ms=5000):
84 |   # FIXME: Pool leak during rollback
85 |   conn = pool.get(block=True, timeout=None)
86 |   if conn.is_stale():
87 |     conn.reconnect()`}
                      </pre>
                    </div>
                  </div>

                  {/* 5-Whys Causal Trace */}
                  <div className="p-3 bg-white rounded-md border border-[#E2DDD5] space-y-2 text-xs font-mono">
                    <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center space-x-1">
                      <GitFork className="w-3.5 h-3.5 text-[#064E3B]" />
                      <span>Causal Chain (5-Whys)</span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-[#0F172A]">
                      <div className="p-1.5 bg-[#FAF9F5] rounded-xs border border-[#E2DDD5]">
                        <span className="text-[#64748B] text-[10px] block">Symptom:</span>
                        Latency timeout spike exceeding 30s
                      </div>
                      <div className="p-1.5 bg-[#FAF9F5] rounded-xs border border-[#E2DDD5]">
                        <span className="text-[#64748B] text-[10px] block">Root Cause Node:</span>
                        Connection Pool Exhaustion under Unbounded Waiting
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Deck */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => onNavigateTab('causal')}
                      className="w-full py-2 px-3 bg-[#064E3B] hover:bg-[#053D2E] text-white rounded-sm font-mono text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      <span>Trace in 5-Whys Graph</span>
                    </button>

                    <button
                      onClick={() => onNavigateTab('optimiser')}
                      className="w-full py-2 px-3 bg-white hover:bg-[#FAF9F5] text-[#0F172A] border border-[#E2DDD5] rounded-sm font-mono text-xs font-bold shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <Coins className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Package in 0/1 Knapsack</span>
                    </button>

                    <button
                      onClick={onClearSelection}
                      className="w-full py-1 text-center text-[10px] font-mono text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>

                </div>
              ) : (
                /* No item selected placeholder */
                <div className="py-12 px-4 text-center font-mono space-y-3">
                  <div className="w-10 h-10 rounded-sm bg-[#F4EFE6] border border-[#E2DDD5] flex items-center justify-center text-[#64748B] mx-auto">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#0F172A]">No Item Selected</h5>
                    <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
                      Click any incident in M2 or debt item in M4 to inspect its AST code hotspot, 5-Whys trace, and SATD comment tags.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('system')}
                    className="text-xs font-bold text-[#064E3B] hover:underline"
                  >
                    View Live Telemetry Monitor →
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Inspector Footer */}
      <div className="p-3 bg-[#FAF9F5] border-t border-[#E2DDD5] text-[10px] font-mono text-[#64748B] flex items-center justify-between">
        <span>DebtLens Engine v1.0</span>
        <span className="text-emerald-800 font-bold">Node Telemetry Active</span>
      </div>

    </aside>
  );
};
