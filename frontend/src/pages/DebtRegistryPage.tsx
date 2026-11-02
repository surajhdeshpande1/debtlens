import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Plus, 
  Filter, 
  Flame, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  ArrowRight, 
  TrendingUp, 
  Search, 
  Calculator, 
  HelpCircle, 
  X,
  Download,
  RotateCcw,
  Check
} from 'lucide-react';
import { DebtItem, DebtStatus, DebtCategory } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface DebtRegistryPageProps {
  projectId: number;
  onOpenDebtModal: () => void;
}

export const DebtRegistryPage: React.FC<DebtRegistryPageProps> = ({ projectId, onOpenDebtModal }) => {
  const { showToast } = useToast();
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [breakEvenOnly, setBreakEvenOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'risk' | 'interest' | 'principal' | 'age'>('risk');

  const fetchDebts = async () => {
    try {
      setLoading(true);
      const data = await api.getDebtItems(projectId, {
        category: filterCategory,
        status: filterStatus,
        break_even_only: breakEvenOnly
      });
      setDebts(data);
      if (data.length > 0 && !selectedDebt) {
        setSelectedDebt(data[0]);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Error', 'Failed to retrieve debt ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, [projectId, filterCategory, filterStatus, breakEvenOnly]);

  const handleStatusChange = async (debtId: number, newStatus: DebtStatus) => {
    try {
      const updated = await api.updateDebtItem(debtId, { status: newStatus });
      setDebts(debts.map(d => d.id === debtId ? updated : d));
      if (selectedDebt?.id === debtId) {
        setSelectedDebt(updated);
      }
      showToast('success', 'Workflow Updated', `${updated.debt_key} marked as ${newStatus}`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Update Failed', 'Could not update status');
    }
  };

  const hasActiveFilters = filterCategory !== 'ALL' || filterStatus !== 'ALL' || breakEvenOnly || searchTerm.trim() !== '';

  const handleClearFilters = () => {
    setFilterCategory('ALL');
    setFilterStatus('ALL');
    setBreakEvenOnly(false);
    setSearchTerm('');
    setSortBy('risk');
  };

  const handleExportCsv = async () => {
    try {
      await api.downloadDebtCsv(projectId);
      showToast('success', 'Export Complete', 'Technical debt ledger downloaded as CSV.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Export Failed', 'Could not export debt ledger to CSV.');
    }
  };

  // Filter & Sort
  const filteredDebts = debts
    .filter(d => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        d.title.toLowerCase().includes(s) ||
        d.debt_key.toLowerCase().includes(s) ||
        d.module_name.toLowerCase().includes(s) ||
        d.description.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'risk') return b.risk_score - a.risk_score;
      if (sortBy === 'interest') return b.accrued_interest - a.accrued_interest;
      if (sortBy === 'principal') return b.effort_principal - a.effort_principal;
      if (sortBy === 'age') return b.age_days - a.age_days;
      return 0;
    });

  const statusBadge = (s: DebtStatus) => {
    switch (s) {
      case 'IDENTIFIED':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'PRIORITIZED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'IN_PROGRESS':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REMEDIATED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getCategoryBadge = (cat: string) => {
    const c = (cat || '').toUpperCase();
    if (c.includes('ARCHITECTURAL')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (c.includes('CODE_SMELL')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (c.includes('INFRASTRUCTURE')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (c.includes('SECURITY')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (c.includes('TEST')) return 'bg-teal-50 text-teal-700 border-teal-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getModuleBadge = (moduleName: string) => {
    const m = (moduleName || '').toLowerCase().replace(/[\s-]/g, '_');
    if (m.includes('payment')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (m.includes('database')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (m.includes('settlement')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (m.includes('checkout')) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (m.includes('auth')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (m.includes('notification')) return 'bg-teal-50 text-teal-700 border-teal-200';
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  const getRiskBadge = (score: number) => {
    if (score >= 50) return 'text-rose-700 bg-rose-50 border-rose-200';
    if (score >= 25) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-indigo-700 bg-indigo-50 border-indigo-200';
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center space-x-2">
            <span>Technical Debt Registry & Financial Ledger</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F5EFEB] text-purple-900 border border-[#EADBCE] font-bold font-mono">
              Module M4
            </span>
          </h2>
          <p className="text-xs text-stone-500 font-medium">
            Pricing technical debt as a ledger of principal <span className="font-mono text-purple-900 font-bold">P(d)</span> and accruing interest <span className="font-mono text-rose-700 font-bold">I(d)</span> driven by incident cost and churn
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#EADBCE] hover:bg-[#FAF8F5] text-stone-700 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Export debt items as CSV"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenDebtModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 hover:opacity-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Debt Item</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/95 rounded-xl border border-[#EADBCE] p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[180px] flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search debt key or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#EADBCE] bg-[#FAF8F5] w-full focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[#EADBCE] bg-[#FAF8F5] text-stone-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="ARCHITECTURAL">Architectural</option>
            <option value="CODE_SMELL">Code Smell</option>
            <option value="INFRASTRUCTURE">Infrastructure</option>
            <option value="TEST_DEBT">Test Debt</option>
            <option value="SECURITY_DEBT">Security Debt</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[#EADBCE] bg-[#FAF8F5] text-stone-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="IDENTIFIED">Identified</option>
            <option value="PRIORITIZED">Prioritized</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REMEDIATED">Remediated</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[#EADBCE] bg-[#FAF8F5] text-stone-700 cursor-pointer font-semibold"
          >
            <option value="risk">Sort by Risk Score R(d)</option>
            <option value="interest">Sort by Accrued Interest I(d)</option>
            <option value="principal">Sort by Principal P(d)</option>
            <option value="age">Sort by Age (Days)</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs rounded-lg bg-[#F5EFEB] hover:bg-[#EADBCE] text-stone-700 transition-colors cursor-pointer font-bold"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3 text-stone-500" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <button
          onClick={() => setBreakEvenOnly(!breakEvenOnly)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
            breakEvenOnly
              ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-200'
              : 'bg-[#FAF8F5] text-stone-700 border-[#EADBCE] hover:bg-[#F5EFEB]'
          }`}
        >
          <Flame className={`w-3.5 h-3.5 ${breakEvenOnly ? 'text-rose-600' : 'text-stone-400'}`} />
          <span>Break-Even Exceeded Only ({debts.filter(d => d.break_even_status).length})</span>
        </button>
      </div>

      {/* Two Column Layout: Debt Table + Mathematical Breakdown Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Table */}
        <div className="lg:col-span-8 bg-white/95 rounded-xl border border-[#EADBCE] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-stone-600 font-bold uppercase text-[10px] tracking-wider border-b border-[#EADBCE]">
                <tr>
                  <th className="py-3 px-3">Key & Module</th>
                  <th className="py-3 px-3">Title & Category</th>
                  <th className="py-3 px-2 text-center">Principal</th>
                  <th className="py-3 px-2 text-center">Interest</th>
                  <th className="py-3 px-2 text-center">Break-Even</th>
                  <th className="py-3 px-2 text-center">Risk Score</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5EFEB]">
                {filteredDebts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-stone-400 font-medium">
                      No debt items found for current selection.
                    </td>
                  </tr>
                ) : (
                  filteredDebts.map((d) => {
                    const isSelected = selectedDebt?.id === d.id;
                    return (
                      <tr 
                        key={d.id} 
                        onClick={() => setSelectedDebt(d)}
                        className={`hover:bg-[#FAF8F5] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#F5EFEB]/70 border-l-4 border-purple-700' : ''
                        }`}
                      >
                        {/* Key & Module */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-950">{d.debt_key}</div>
                          <span className={`inline-block mt-0.5 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md border ${getModuleBadge(d.module_name)}`}>
                            {d.module_name}
                          </span>
                        </td>

                        {/* Title & Category */}
                        <td className="py-3 px-3 max-w-xs">
                          <div className="font-bold text-slate-900 leading-snug line-clamp-1">{d.title}</div>
                          <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded-sm border ${getCategoryBadge(d.category)}`}>
                            {d.category}
                          </span>
                        </td>

                        {/* Principal P(d) */}
                        <td className="py-3 px-2 text-center whitespace-nowrap font-mono font-bold text-slate-900">
                          <span className="bg-blue-50 text-blue-900 px-2 py-0.5 rounded-md border border-blue-200">
                            {d.effort_principal}h
                          </span>
                        </td>

                        {/* Interest I(d) */}
                        <td className="py-3 px-2 text-center whitespace-nowrap font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded-md border ${
                            d.break_even_status 
                              ? 'bg-rose-50 text-rose-800 border-rose-200' 
                              : 'bg-[#FAF8F5] text-stone-800 border-[#EADBCE]'
                          }`}>
                            {d.accrued_interest}h
                          </span>
                        </td>

                        {/* Break-Even Status */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {d.break_even_status ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 animate-pulse">
                              <Flame className="w-2.5 h-2.5 text-rose-600" />
                              <span>EXCEEDED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span>Optimal</span>
                            </span>
                          )}
                        </td>

                        {/* Risk Score */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded-md border ${getRiskBadge(d.risk_score)}`}>
                            {d.risk_score}
                          </span>
                        </td>

                        {/* Workflow */}
                        <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={d.status}
                            onChange={(e) => handleStatusChange(d.id, e.target.value as DebtStatus)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusBadge(d.status)} bg-white cursor-pointer`}
                          >
                            <option value="IDENTIFIED">IDENTIFIED</option>
                            <option value="PRIORITIZED">PRIORITIZED</option>
                            <option value="IN_PROGRESS">IN PROGRESS</option>
                            <option value="REMEDIATED">REMEDIATED</option>
                          </select>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mathematical Economic Inspection Drawer */}
        <div className="lg:col-span-4 bg-white/95 rounded-xl border border-[#EADBCE] p-5 shadow-xs sticky top-20 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F5EFEB]">
            <div className="flex items-center space-x-1.5">
              <Calculator className="w-4 h-4 text-purple-700" />
              <h3 className="text-xs font-extrabold text-slate-950">Economic Formulation Breakdown</h3>
            </div>
            <span className="text-[10px] font-mono text-purple-900 bg-[#F5EFEB] px-1.5 py-0.5 rounded border border-[#EADBCE] font-bold">Section 7.3</span>
          </div>

          {selectedDebt ? (
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-600 text-xs">{selectedDebt.debt_key}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {selectedDebt.category}
                  </span>
                </div>
                <h4 className="mt-1 font-bold text-slate-900 leading-snug">{selectedDebt.title}</h4>
                <div className="text-[11px] text-slate-500 mt-1">Module: <strong className="text-slate-700">{selectedDebt.module_name}</strong></div>
              </div>

              {/* Interactive Debt Workflow State */}
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700">Remediation Status</span>
                  <span className="text-[10px] text-slate-400">Click to transition</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['IDENTIFIED', 'PRIORITIZED', 'IN_PROGRESS', 'REMEDIATED'] as DebtStatus[]).map((st) => {
                    const isCurrent = selectedDebt.status === st;
                    return (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(selectedDebt.id, st)}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-between transition-all cursor-pointer ${
                          isCurrent
                            ? st === 'REMEDIATED'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : st === 'IN_PROGRESS'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : st === 'PRIORITIZED'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-700 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{st.replace('_', ' ')}</span>
                        {isCurrent && <Check className="w-3 h-3 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mathematical Equation Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Accrued Interest Equation I(d):
                </div>
                <div className="font-mono text-[11px] text-slate-800 bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto">
                  I(d) = Σ [sev(k) · effort(k)] + λ₁·churn + λ₂·blast
                </div>

                <div className="space-y-1.5 pt-1 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>Principal Remediation Effort P(d):</span>
                    <strong className="text-slate-900 font-mono">{selectedDebt.effort_principal} hrs</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Accrued Failure Interest I(d):</span>
                    <strong className={`font-mono ${selectedDebt.break_even_status ? 'text-rose-600' : 'text-slate-900'}`}>
                      {selectedDebt.accrued_interest} hrs
                    </strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span>Net Economic Drag [I(d) - P(d)]:</span>
                    <strong className={`font-mono ${selectedDebt.accrued_interest > selectedDebt.effort_principal ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {(selectedDebt.accrued_interest - selectedDebt.effort_principal).toFixed(1)} hrs
                    </strong>
                  </div>
                </div>
              </div>

              {/* Break Even Status Callout */}
              <div className={`p-3 rounded-xl border ${
                selectedDebt.break_even_status 
                  ? 'bg-rose-50 border-rose-200 text-rose-900' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center space-x-1.5 font-bold text-xs">
                  {selectedDebt.break_even_status ? <Flame className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  <span>{selectedDebt.break_even_status ? 'Break-Even Exceeded' : 'Within Break-Even Budget'}</span>
                </div>
                <p className="mt-1 text-[11px] opacity-90 leading-relaxed">
                  {selectedDebt.break_even_status 
                    ? 'The organization has already wasted more hours coping with defects generated by this debt item than it would cost to permanently repair it.'
                    : 'Accrued cost remains below remediation threshold; can be scheduled in standard backlog maintenance.'}
                </p>
              </div>

              {/* Linked Incident Count & Prereqs */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Linked Incidents: <strong className="text-slate-800">{selectedDebt.linked_incident_count}</strong></span>
                <span>Age: <strong className="text-slate-800">{selectedDebt.age_days} days</strong></span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              Select any debt item from the table to inspect its mathematical pricing breakdown.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
