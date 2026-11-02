import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  CheckCircle2, 
  Sliders, 
  ArrowRight, 
  GitBranch,
  Sparkles,
  Lock,
  Unlock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { RemediationPlan, WhatIfScenario } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface RemediationOptimiserPageProps {
  projectId: number;
}

export const RemediationOptimiserPage: React.FC<RemediationOptimiserPageProps> = ({ projectId }) => {
  const { showToast } = useToast();
  const [budget, setBudget] = useState(40.0);
  const [forcedDebtIds, setForcedDebtIds] = useState<number[]>([]);
  const [plan, setPlan] = useState<RemediationPlan | null>(null);
  const [whatIfScenarios, setWhatIfScenarios] = useState<WhatIfScenario[]>([]);
  const [loading, setLoading] = useState(true);

  const calculatePlan = async (currentBudget: number, forcedIds: number[] = forcedDebtIds) => {
    try {
      setLoading(true);
      const [resPlan, resWhatIf] = await Promise.all([
        api.getOptimalPlan(projectId, currentBudget, undefined, forcedIds.length > 0 ? forcedIds : undefined),
        api.simulateWhatIf(projectId, [10, 20, 30, 40, 50, 60, 80, 100, 120])
      ]);
      setPlan(resPlan);
      setWhatIfScenarios(resWhatIf.scenarios);
    } catch (err) {
      console.error(err);
      showToast('error', 'Optimization Error', 'Could not compute optimal knapsack plan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculatePlan(budget, forcedDebtIds);
  }, [projectId, forcedDebtIds]);

  const handleBudgetChange = (newVal: number) => {
    setBudget(newVal);
    calculatePlan(newVal, forcedDebtIds);
  };

  const toggleForceInclude = (debtId: number) => {
    let nextForced: number[];
    if (forcedDebtIds.includes(debtId)) {
      nextForced = forcedDebtIds.filter(id => id !== debtId);
      showToast('info', 'Constraint Removed', 'Item returned to flexible knapsack optimization.');
    } else {
      nextForced = [...forcedDebtIds, debtId];
      showToast('success', 'Constraint Enforced', 'Item forced into sprint; DP will optimize around it.');
    }
    setForcedDebtIds(nextForced);
  };

  const roiRatio = plan && plan.total_effort_allocated > 0 
    ? (plan.accumulated_interest_saved / plan.total_effort_allocated).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center space-x-2">
            <span>Payoff Optimiser & Sprint Remediation Planner</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F5EFEB] text-purple-900 border border-[#EADBCE] font-bold font-mono">
              Module M7
            </span>
          </h2>
          <p className="text-xs text-stone-500 font-medium">
            Constrained 0/1 knapsack dynamic programming maximizing risk reduction <span className="font-mono text-purple-900 font-bold">R(d)</span> within sprint effort budget <span className="font-mono text-blue-900 font-bold">B</span> with topological prerequisite sequencing
          </p>
        </div>

        <div className="text-xs text-stone-700 bg-white border border-[#EADBCE] px-3 py-1.5 rounded-lg shadow-xs font-medium">
          Formulation: <span className="font-mono font-bold text-slate-900">Max Σ R(d)·x(d) s.t. Σ P(d)·x(d) ≤ B</span>
        </div>
      </div>

      {/* Interactive Budget Control Card */}
      <div className="bg-white/95 rounded-xl border border-[#EADBCE] p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-purple-700" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-950">Sprint Remediation Effort Budget Constraint (B)</h3>
              <p className="text-xs text-stone-500 font-medium">Select team capacity to pack the highest payoff technical debt items</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-extrabold font-mono text-purple-900">{budget} hrs</span>
            <span className="text-xs text-stone-400 font-medium">capacity</span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-bold text-slate-900">Sprint Presets:</span>
          {[
            { label: 'Hotfix (20h)', val: 20 },
            { label: 'Standard Sprint (40h)', val: 40 },
            { label: 'Hardening (60h)', val: 60 },
            { label: 'Major Release (80h)', val: 80 },
            { label: 'Full Maintenance (120h)', val: 120 },
          ].map((preset) => (
            <button
              key={preset.val}
              onClick={() => handleBudgetChange(preset.val)}
              className={`px-3 py-1 text-xs rounded-lg border font-semibold transition-all cursor-pointer ${
                budget === preset.val
                  ? 'bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 text-white border-transparent font-bold shadow-xs'
                  : 'bg-[#FAF8F5] text-stone-700 border-[#EADBCE] hover:bg-[#F5EFEB]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Range Slider */}
        <div className="space-y-2 pt-2">
          <input
            type="range"
            min="10"
            max="120"
            step="5"
            value={budget}
            onChange={(e) => handleBudgetChange(parseFloat(e.target.value))}
            className="w-full accent-purple-700 h-2 bg-[#F5EFEB] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-stone-500 font-medium">
            <span>10 hrs</span>
            <span>40 hrs (1 Dev-Sprint)</span>
            <span>80 hrs (2 Dev-Sprints)</span>
            <span>120 hrs (Full Iteration)</span>
          </div>
        </div>

        {/* Segmented 2D Knapsack Capacity Bar */}
        {plan && (
          <div className="pt-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-950">Sprint Capacity Packing Allocation:</span>
              <span className="font-mono text-stone-500 font-medium">
                {plan.total_effort_allocated}h allocated of {budget}h ({plan.budget_utilization_pct}%)
              </span>
            </div>

            <div className="w-full h-7 bg-[#F5EFEB] rounded-lg border border-[#EADBCE] p-0.5 flex overflow-hidden shadow-inner">
              {plan.selected_items.map((it, idx) => {
                const widthPct = (it.effort_principal / budget) * 100;
                const colors = ['bg-blue-600', 'bg-purple-600', 'bg-fuchsia-600', 'bg-amber-600', 'bg-rose-600'];
                return (
                  <div
                    key={it.id}
                    style={{ width: `${Math.max(4, widthPct)}%` }}
                    className={`${colors[idx % colors.length]} text-white h-full flex items-center justify-center text-[10px] font-mono font-bold truncate px-1 border-r border-white/20`}
                    title={`${it.debt_key}: ${it.title} (${it.effort_principal}h, +${it.risk_score} risk red)`}
                  >
                    {it.debt_key} ({it.effort_principal}h)
                  </div>
                );
              })}
              {plan.total_effort_allocated < budget && (
                <div 
                  style={{ width: `${((budget - plan.total_effort_allocated) / budget) * 100}%` }}
                  className="bg-stone-200/60 h-full flex items-center justify-center text-[10px] text-stone-500 font-mono italic"
                >
                  {(budget - plan.total_effort_allocated).toFixed(1)}h Unallocated
                </div>
              )}
            </div>
          </div>
        )}

        {/* Optimization Metrics Row with Semantic Theme Palette */}
        {plan && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-[#F5EFEB] text-center">
            <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EADBCE] shadow-2xs">
              <div className="text-[10px] font-bold text-stone-500 uppercase">Effort Allocated</div>
              <div className="text-sm font-bold text-slate-950 font-mono mt-0.5">
                {plan.total_effort_allocated} / {plan.sprint_budget}h
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5 font-medium">{plan.budget_utilization_pct}% capacity</div>
            </div>

            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 shadow-2xs">
              <div className="text-[10px] font-bold text-blue-800 uppercase">Items Selected</div>
              <div className="text-sm font-bold text-blue-900 font-mono mt-0.5">
                {plan.selected_items.length} of {plan.selected_items.length + plan.deferred_items.length}
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5 font-medium">{plan.deferred_items.length} deferred</div>
            </div>

            <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 shadow-2xs">
              <div className="text-[10px] font-bold text-purple-800 uppercase">Risk Reduction Score</div>
              <div className="text-sm font-bold text-purple-900 font-mono mt-0.5">
                {plan.total_risk_reduced} pts
              </div>
              <div className="text-[10px] text-purple-700 mt-0.5 font-medium">Maximized via 0/1 DP</div>
            </div>

            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 shadow-2xs">
              <div className="text-[10px] font-bold text-rose-800 uppercase">Interest Cost Saved</div>
              <div className="text-sm font-bold text-rose-900 font-mono mt-0.5">
                {plan.accumulated_interest_saved} hrs
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5 font-medium">Prevented drag</div>
            </div>

            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 shadow-2xs">
              <div className="text-[10px] font-bold text-amber-800 uppercase">Payoff Return (ROI)</div>
              <div className="text-sm font-bold text-amber-900 font-mono mt-0.5">
                {roiRatio}x
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5 font-medium">Interest / Effort</div>
            </div>
          </div>
        )}
      </div>

      {/* Topological Sequence Pill Bar */}
      {plan && plan.remediation_order.length > 0 && (
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-slate-800 shrink-0">
            <GitBranch className="w-4 h-4 text-indigo-600" />
            <span>Topological Execution Sequence:</span>
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto py-1">
            {plan.remediation_order.map((key, idx) => (
              <React.Fragment key={key}>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-xs shrink-0">
                  {idx + 1}. {key}
                </span>
                {idx < plan.remediation_order.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout: Recommended Schedule + What-If Sensitivity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Recommended Schedule (Knapsack Selection) */}
        <div className="lg:col-span-7 bg-white/95 rounded-xl border border-[#EADBCE] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F5EFEB] flex items-center justify-between bg-[#FAF8F5]">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-extrabold text-slate-950">Recommended Remediation Schedule</h3>
            </div>
            <span className="text-[11px] font-mono text-stone-500 font-medium">Lock items to force inclusion</span>
          </div>

          <div className="p-4 space-y-3">
            {plan?.selected_items.map((item, index) => {
              const isForced = forcedDebtIds.includes(item.id);
              return (
                <div 
                  key={item.id}
                  className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                        {index + 1}
                      </span>
                      <span className="font-mono font-bold text-slate-950">{item.debt_key}</span>
                      <span className="text-[10px] font-bold text-stone-600 font-mono">[{item.module_name}]</span>
                      {item.break_even_status && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-rose-100 text-rose-800">
                          BREAK-EVEN
                        </span>
                      )}
                      {isForced && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-purple-100 text-purple-900 flex items-center space-x-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          <span>FORCED</span>
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h4>

                    {item.prerequisite_keys.length > 0 && (
                      <div className="text-[10px] text-amber-800 flex items-center space-x-1 font-mono font-bold">
                        <span>Prerequisites: {item.prerequisite_keys.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-950">{item.effort_principal}h Effort</div>
                      <div className="text-[11px] font-mono font-bold text-emerald-700">+{item.risk_score} Risk Red.</div>
                      <div className="text-[10px] text-rose-700 font-semibold">{item.accrued_interest}h Int. Saved</div>
                    </div>

                    <button
                      onClick={() => toggleForceInclude(item.id)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isForced ? 'bg-purple-100 text-purple-900 border-purple-300' : 'bg-white text-stone-400 hover:text-stone-700 border-[#EADBCE]'
                      }`}
                      title={isForced ? 'Unlock constraint' : 'Lock this item into schedule'}
                    >
                      {isForced ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Deferred Items */}
            {Boolean(plan?.deferred_items && plan.deferred_items.length > 0) && (
              <div className="pt-4 border-t border-[#F5EFEB]">
                <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">
                  Deferred Items (Exceeds {budget}h Sprint Capacity)
                </h4>
                <div className="space-y-2">
                  {plan?.deferred_items.map((item) => (
                    <div 
                      key={item.id}
                      className="p-2.5 rounded-lg border border-[#EADBCE] bg-[#FAF8F5] flex items-center justify-between text-xs text-stone-700 font-medium"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="font-mono font-bold text-slate-900">{item.debt_key}</span>
                        <span className="truncate">{item.title}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="font-mono text-stone-500 text-[11px] font-semibold">
                          {item.effort_principal}h needed
                        </span>
                        <button
                          onClick={() => toggleForceInclude(item.id)}
                          className="px-2 py-0.5 text-[10px] font-bold text-purple-900 bg-[#F5EFEB] hover:bg-[#EADBCE] rounded border border-[#EADBCE] cursor-pointer"
                        >
                          Force In
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: What-If Sensitivity + Mathematical DP Rigor Card */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* What-If Simulation Curve */}
          <div className="bg-white/95 rounded-xl border border-[#EADBCE] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">What-If Sensitivity Curve</h3>
                <p className="text-xs text-slate-500">Risk Reduction & Interest Saved vs. Sprint Budget Capacity</p>
              </div>
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={whatIfScenarios} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="budget" 
                    tick={{ fontSize: 11, fill: '#64748B' }} 
                    unit="h"
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748B' }} 
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#FFFFFF', 
                      borderRadius: '8px', 
                      border: '1px solid #E2E8F0',
                      fontSize: '12px' 
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="risk_reduction" 
                    name="Risk Reduction Score" 
                    stroke="#4F46E5" 
                    strokeWidth={2.5} 
                    dot={{ r: 4 }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="interest_saved" 
                    name="Interest Saved (hrs)" 
                    stroke="#E11D48" 
                    strokeWidth={2} 
                    strokeDasharray="4 4" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mathematical Knapsack Dynamic Programming Rigor Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center space-x-1.5 font-bold text-slate-900">
              <Calculator className="w-4 h-4 text-indigo-600" />
              <span>Dynamic Programming 0/1 Knapsack Formulation</span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 leading-relaxed">
              DP[i][w] = max(DP[i-1][w], DP[i-1][w - P(dᵢ)] + R(dᵢ))
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong>Why 0/1 DP over Greedy:</strong> A simple greedy approach sorting by <span className="font-mono">R(d)/P(d)</span> frequently gets trapped in sub-optimal local maxima when effort units are discrete and items possess prerequisite dependencies. DebtLens enforces topological ordering before DP packing to guarantee mathematical global optimality.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
