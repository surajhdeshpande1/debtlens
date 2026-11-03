import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Flame, 
  Search, 
  Calculator, 
  Download,
  RotateCcw,
  Check
} from 'lucide-react';
import { DebtItem, DebtStatus } from '../types';
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
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [breakEvenOnly, setBreakEvenOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'risk' | 'interest' | 'principal' | 'age'>('risk');

  const fetchDebts = async () => {
    try {
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
    .filter((d) => {
      if (searchTerm.trim() === '') return true;
      const q = searchTerm.toLowerCase();
      return (
        d.debt_key.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.module_name.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'risk':
          return b.risk_score - a.risk_score;
        case 'interest':
          return b.accrued_interest - a.accrued_interest;
        case 'principal':
          return b.effort_principal - a.effort_principal;
        case 'age':
          return b.age_days - a.age_days;
      }
    });

  const statusBadge = (s: DebtStatus) => {
    switch (s) {
      case 'IDENTIFIED':
        return 'bg-zinc-100 text-zinc-700 border-zinc-200 font-mono';
      case 'PRIORITIZED':
        return 'bg-black text-white border-black font-mono';
      case 'IN_PROGRESS':
        return 'bg-zinc-800 text-white border-zinc-700 font-mono';
      case 'REMEDIATED':
        return 'bg-zinc-200 text-zinc-900 border-zinc-300 font-mono';
    }
  };

  const getCategoryBadge = (_cat: string) => {
    return 'bg-zinc-100 text-black border-zinc-200 font-mono';
  };

  const getModuleBadge = (_moduleName: string) => {
    return 'bg-zinc-100 text-black border-zinc-200 font-mono';
  };

  const getRiskBadge = (score: number) => {
    if (score >= 50) return 'text-white bg-black border-black font-mono';
    if (score >= 25) return 'text-white bg-zinc-800 border-zinc-700 font-mono';
    return 'text-black bg-zinc-100 border-zinc-300 font-mono';
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-black tracking-tight flex items-center space-x-2">
            <span>Technical Debt Registry & Financial Ledger</span>
            <span className="text-xs px-2.5 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-200 font-bold font-mono">
              Module M4
            </span>
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Pricing technical debt as a ledger of principal <span className="font-mono text-black font-bold">P(d)</span> and accruing interest <span className="font-mono text-black font-bold">I(d)</span> driven by incident cost and churn
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-white border border-zinc-300 hover:bg-zinc-100 text-black text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Export debt items as CSV"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenDebtModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-md bg-black hover:bg-zinc-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer border border-black"
          >
            <Plus className="w-4 h-4" />
            <span>Register Debt Item</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-md border border-zinc-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex wrap items-center gap-2 flex-1">
          <div className="relative min-w-[180px] flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search debt key, title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md border border-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-black bg-white text-black"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-zinc-200 bg-white text-black font-medium cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="ARCHITECTURAL">Architectural</option>
            <option value="CODE_SMELL">Code Smell</option>
            <option value="INFRASTRUCTURE">Infrastructure</option>
            <option value="SECURITY">Security</option>
            <option value="TEST">Testing</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-zinc-200 bg-white text-black font-medium cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="IDENTIFIED">Identified</option>
            <option value="PRIORITIZED">Prioritized</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REMEDIATED">Remediated</option>
          </select>

          <button
            onClick={() => setBreakEvenOnly(!breakEvenOnly)}
            className={`px-3 py-1.5 text-xs rounded-md border font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
              breakEvenOnly
                ? 'bg-black text-white border-black font-bold shadow-xs'
                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Break-Even (I &gt; P) Only</span>
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 text-xs rounded-md bg-zinc-100 hover:bg-zinc-200 text-black font-medium flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-zinc-500" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-1.5 text-xs text-zinc-500">
          <span className="font-medium">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1 text-xs rounded-md border border-zinc-200 bg-white font-bold text-black cursor-pointer"
          >
            <option value="risk">Risk Score</option>
            <option value="interest">Accrued Interest I(d)</option>
            <option value="principal">Remediation Principal P(d)</option>
            <option value="age">Age (Days)</option>
          </select>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Table View */}
        <div className="lg:col-span-8 bg-white rounded-md border border-zinc-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-600 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="py-2.5 px-3">Item Key & Module</th>
                  <th className="py-2.5 px-3">Description & Scope</th>
                  <th className="py-2.5 px-2 text-center">Principal P(d)</th>
                  <th className="py-2.5 px-2 text-center">Interest I(d)</th>
                  <th className="py-2.5 px-2 text-center">Break-Even</th>
                  <th className="py-2.5 px-2 text-center">Risk Score</th>
                  <th className="py-2.5 px-3 text-center">Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredDebts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400">
                      No technical debt items found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredDebts.map((d) => {
                    const isSelected = selectedDebt?.id === d.id;
                    return (
                      <tr 
                        key={d.id} 
                        onClick={() => setSelectedDebt(d)}
                        className={`hover:bg-zinc-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-zinc-100 border-l-4 border-black' : ''
                        }`}
                      >
                        {/* Key & Module */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-black">{d.debt_key}</div>
                          <span className={`inline-block mt-0.5 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-sm border ${getModuleBadge(d.module_name)}`}>
                            {d.module_name}
                          </span>
                        </td>

                        {/* Title & Category */}
                        <td className="py-3 px-3 max-w-xs">
                          <div className="font-bold text-black leading-snug line-clamp-1">{d.title}</div>
                          <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded-sm border ${getCategoryBadge(d.category)}`}>
                            {d.category}
                          </span>
                        </td>

                        {/* Principal P(d) */}
                        <td className="py-3 px-2 text-center whitespace-nowrap font-mono font-bold text-black">
                          <span className="bg-zinc-100 text-black px-2 py-0.5 rounded-sm border border-zinc-200">
                            {d.effort_principal}h
                          </span>
                        </td>

                        {/* Interest I(d) */}
                        <td className="py-3 px-2 text-center whitespace-nowrap font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded-sm border ${
                            d.break_even_status 
                              ? 'bg-black text-white border-black' 
                              : 'bg-zinc-50 text-black border-zinc-200'
                          }`}>
                            {d.accrued_interest}h
                          </span>
                        </td>

                        {/* Break-Even Status */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {d.break_even_status ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[9px] font-bold bg-black text-white font-mono">
                              <Flame className="w-2.5 h-2.5 text-white" />
                              <span>EXCEEDED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[9px] font-bold bg-zinc-100 text-black border border-zinc-200">
                              <span>Optimal</span>
                            </span>
                          )}
                        </td>

                        {/* Risk Score */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded-sm border ${getRiskBadge(d.risk_score)}`}>
                            {d.risk_score}
                          </span>
                        </td>

                        {/* Workflow */}
                        <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={d.status}
                            onChange={(e) => handleStatusChange(d.id, e.target.value as DebtStatus)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${statusBadge(d.status)} bg-white cursor-pointer`}
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
        <div className="lg:col-span-4 bg-white rounded-md border border-zinc-200 p-5 shadow-xs sticky top-20 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center space-x-1.5">
              <Calculator className="w-4 h-4 text-black" />
              <h3 className="text-xs font-extrabold text-black">Economic Formulation Breakdown</h3>
            </div>
            <span className="text-[10px] font-mono text-black bg-zinc-100 px-1.5 py-0.5 rounded-sm border border-zinc-200 font-bold">Section 7.3</span>
          </div>

          {selectedDebt ? (
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-black text-xs">{selectedDebt.debt_key}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-zinc-100 text-black">
                    {selectedDebt.category}
                  </span>
                </div>
                <h4 className="mt-1 font-bold text-black leading-snug">{selectedDebt.title}</h4>
                <div className="text-[11px] text-zinc-500 mt-1">Module: <strong className="text-black">{selectedDebt.module_name}</strong></div>
              </div>

              {/* Interactive Debt Workflow State */}
              <div className="bg-zinc-50 p-2.5 rounded-md border border-zinc-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-zinc-700">Remediation Status</span>
                  <span className="text-[10px] text-zinc-400">Click to transition</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['IDENTIFIED', 'PRIORITIZED', 'IN_PROGRESS', 'REMEDIATED'] as DebtStatus[]).map((st) => {
                    const isCurrent = selectedDebt.status === st;
                    return (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(selectedDebt.id, st)}
                        className={`px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center justify-between transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-black text-white shadow-xs border border-black'
                            : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
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
              <div className="p-3 bg-zinc-50 rounded-md border border-zinc-200 space-y-2">
                <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                  Accrued Interest Equation I(d):
                </div>
                <div className="font-mono text-[11px] text-black bg-white p-2 rounded-md border border-zinc-200 overflow-x-auto">
                  I(d) = Σ [sev(k) · effort(k)] + λ₁·churn + λ₂·blast
                </div>

                <div className="space-y-1.5 pt-1 text-[11px] text-zinc-600">
                  <div className="flex justify-between">
                    <span>Incident Resolution Effort:</span>
                    <strong className="font-mono text-black">{((selectedDebt as any).incident_frequency_count ?? selectedDebt.linked_incident_count ?? 1) * 12}h</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Git Churn Penalty (λ₁=0.15):</span>
                    <strong className="font-mono text-black">+{(((selectedDebt as any).churn_rate ?? 24) * 0.15).toFixed(1)}h</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Architectural Blast Radius (λ₂=1.8):</span>
                    <strong className="font-mono text-black">+{(((selectedDebt as any).blast_radius ?? 4) * 1.8).toFixed(1)}h</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-zinc-200 font-bold text-black">
                    <span>Total Accrued Interest I(d):</span>
                    <span className="font-mono">{selectedDebt.accrued_interest}h</span>
                  </div>
                </div>
              </div>

              {/* Break-Even Comparison Pill */}
              <div className="p-3 rounded-md border border-zinc-200 bg-zinc-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-black text-xs">Balance Sheet Verdict:</span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm ${
                    selectedDebt.break_even_status ? 'bg-black text-white' : 'bg-zinc-200 text-black'
                  }`}>
                    {selectedDebt.break_even_status ? 'I(d) > P(d) [DEFICIT]' : 'I(d) ≤ P(d) [NOMINAL]'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                  {selectedDebt.break_even_status 
                    ? `This debt item has cost ${selectedDebt.accrued_interest}h in ongoing failure drag, exceeding its permanent ${selectedDebt.effort_principal}h fix cost. Refactoring is economically mandated.`
                    : `Remediation principal (${selectedDebt.effort_principal}h) exceeds current failure interest (${selectedDebt.accrued_interest}h). Monitor churn.`}
                </p>
              </div>

            </div>
          ) : (
            <div className="p-8 text-center text-xs text-zinc-400 font-medium">
              Select an item from the ledger to inspect economic parameters.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
