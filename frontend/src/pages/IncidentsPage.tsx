import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Search, 
  Filter, 
  Plus, 
  CheckCircle, 
  Clock, 
  ArrowRight,
  ExternalLink,
  GitFork,
  Sparkles,
  ShieldAlert,
  Coins,
  Download,
  RotateCcw,
  Check
} from 'lucide-react';
import { Incident, IncidentSeverity, IncidentStatus, SimilarIncidentMatch, DebtCategory } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface IncidentsPageProps {
  projectId: number;
  onOpenReportModal: () => void;
  onConvertIncidentToDebt?: (data: {
    title: string;
    description: string;
    module_name: string;
    effort_principal: number;
    linked_incident_id: number;
  }) => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({ 
  projectId, 
  onOpenReportModal,
  onConvertIncidentToDebt 
}) => {
  const { showToast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [similarIncidents, setSimilarIncidents] = useState<SimilarIncidentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterModule, setFilterModule] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const data = await api.getIncidents(projectId, {
        severity: filterSeverity,
        status: filterStatus,
        module: filterModule,
        search: searchTerm
      });
      setIncidents(data);
      if (data.length > 0 && !selectedIncident) {
        handleSelectIncident(data[0]);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Error', 'Failed to retrieve incidents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [projectId, filterSeverity, filterStatus, filterModule, searchTerm]);

  const handleSelectIncident = async (inc: Incident) => {
    setSelectedIncident(inc);
    try {
      const similar = await api.getSimilarIncidents(inc.id, 0.15, 4);
      setSimilarIncidents(similar);
    } catch (err) {
      console.error(err);
      setSimilarIncidents([]);
    }
  };

  const handleUpdateStatus = async (incId: number, newStatus: IncidentStatus) => {
    try {
      const updated = await api.updateIncident(incId, { status: newStatus });
      setIncidents(incidents.map(i => i.id === incId ? updated : i));
      if (selectedIncident?.id === incId) {
        setSelectedIncident(updated);
      }
      showToast('success', 'Status Updated', `${updated.incident_number} is now marked ${newStatus}`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Update Failed', 'Could not update status');
    }
  };

  const hasActiveFilters = filterSeverity !== 'ALL' || filterStatus !== 'ALL' || filterModule !== 'ALL' || searchTerm.trim() !== '';

  const handleClearFilters = () => {
    setFilterSeverity('ALL');
    setFilterStatus('ALL');
    setFilterModule('ALL');
    setSearchTerm('');
  };

  const handleExportCsv = async () => {
    try {
      await api.downloadIncidentsCsv(projectId);
      showToast('success', 'Export Complete', 'Incidents register downloaded as CSV.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Export Failed', 'Could not export incidents to CSV.');
    }
  };

  const severityBadge = (sev: IncidentSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-[#FDF2F2] text-[#8E2825] border-[#E8B4B2]';
      case 'HIGH':
        return 'bg-[#FEF9EE] text-[#8A6112] border-[#EBD8A3]';
      case 'MEDIUM':
        return 'bg-[#F0F4FA] text-[#0C1A2E] border-[#CBD8E8]';
      case 'LOW':
        return 'bg-stone-100 text-stone-700 border-[#E5DFD5]';
    }
  };

  const statusBadge = (stat: IncidentStatus) => {
    switch (stat) {
      case 'OPEN':
        return 'bg-[#FDF2F2] text-[#8E2825] border-[#E8B4B2]';
      case 'INVESTIGATING':
        return 'bg-[#FEF9EE] text-[#8A6112] border-[#EBD8A3]';
      case 'RESOLVED':
        return 'bg-[#EDF6F1] text-[#1E4E38] border-[#BCD8C7]';
    }
  };

  const getModuleBadge = (moduleName: string) => {
    const m = (moduleName || '').toLowerCase().replace(/[\s-]/g, '_');
    if (m.includes('payment')) return 'bg-[#F0F4FA] text-[#0C1A2E] border-[#CBD8E8]';
    if (m.includes('database')) return 'bg-[#FEF9EE] text-[#8A6112] border-[#EBD8A3]';
    if (m.includes('settlement')) return 'bg-[#EDF6F1] text-[#1E4E38] border-[#BCD8C7]';
    if (m.includes('checkout')) return 'bg-[#F0F4FA] text-[#2C3E50] border-[#CBD8E8]';
    if (m.includes('auth')) return 'bg-[#FDF2F2] text-[#8E2825] border-[#E8B4B2]';
    if (m.includes('notification')) return 'bg-stone-100 text-stone-700 border-[#E5DFD5]';
    return 'bg-[#F0F4FA] text-[#0C1A2E] border-[#CBD8E8]';
  };

  const getSimilarityBadge = (score: number) => {
    if (score >= 0.7) return 'text-[#1E4E38] bg-[#EDF6F1] border-[#BCD8C7]';
    if (score >= 0.4) return 'text-[#0C1A2E] bg-[#F0F4FA] border-[#CBD8E8]';
    return 'text-[#8A6112] bg-[#FEF9EE] border-[#EBD8A3]';
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center space-x-2">
            <span>Incident Intake & Lifecycle</span>
            <span className="text-xs px-2.5 py-0.5 rounded-sm bg-[#F0F4FA] text-[#0C1A2E] border border-[#CBD8E8] font-bold font-mono">
              Module M2
            </span>
          </h2>
          <p className="text-xs text-stone-500 font-medium">
            Structured incident logging with severity mapping, resolution metrics, and automated root cause convergence
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-white border border-[#E5DFD5] hover:bg-[#FAF8F5] text-stone-700 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Export incidents dataset as CSV"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-md bg-[#0C1A2E] hover:bg-[#142B4B] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Incident</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/95 rounded-md border border-[#EADBCE] p-3 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by title, number, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-[#EADBCE] focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-[#FAF8F5] text-slate-900"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-[#EADBCE] bg-[#FAF8F5] text-stone-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-[#EADBCE] bg-[#FAF8F5] text-stone-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-[#EADBCE] bg-[#FAF8F5] text-stone-700 font-medium cursor-pointer"
          >
            <option value="ALL">All Modules</option>
            <option value="payments">payments</option>
            <option value="database">database</option>
            <option value="orders">orders</option>
            <option value="settlement">settlement</option>
            <option value="auth">auth</option>
            <option value="checkout">checkout</option>
            <option value="notification">notification</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs rounded-md bg-[#F5EFEB] hover:bg-[#EADBCE] text-stone-700 transition-colors cursor-pointer font-semibold"
              title="Reset all active filters"
            >
              <RotateCcw className="w-3 h-3 text-stone-500" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Two Column Layout: Table + Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Incident List Table */}
        <div className="lg:col-span-7 bg-white/95 rounded-md border border-[#EADBCE] shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F5EFEB] flex items-center justify-between bg-[#FAF8F5]">
            <span className="text-xs font-bold text-slate-950">{incidents.length} Registered Incidents</span>
            <span className="text-[11px] text-stone-500 font-medium">Click row to inspect causal telemetry</span>
          </div>

          <div className="divide-y divide-[#F5EFEB] max-h-[640px] overflow-y-auto">
            {incidents.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400 font-medium">
                No incidents found matching current filters.
              </div>
            ) : (
              incidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => handleSelectIncident(inc)}
                    className={`p-3.5 hover:bg-[#FAF8F5] transition-colors cursor-pointer flex flex-col space-y-2 ${
                      isSelected ? 'bg-[#F0F4FA] border-l-4 border-[#0C1A2E]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-950">{inc.incident_number}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-sm border ${severityBadge(inc.severity)}`}>
                          {inc.severity}
                        </span>
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm border ${getModuleBadge(inc.affected_module)}`}>
                          {inc.affected_module}
                        </span>
                      </div>

                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm border ${statusBadge(inc.status)}`}>
                        {inc.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">
                      {inc.title}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
                      <span>Effort: <strong className="text-slate-900">{inc.resolution_effort_hours}h</strong></span>
                      <span>{new Date(inc.reported_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Incident Detail Inspector */}
        <div className="lg:col-span-5 bg-white/95 rounded-md border border-[#E5DFD5] p-5 shadow-xs sticky top-20 space-y-5">
          {selectedIncident ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-[#0C1A2E] bg-[#F0F4FA] border border-[#CBD8E8] px-2.5 py-0.5 rounded-sm">
                    {selectedIncident.incident_number}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs text-stone-500 font-medium">Status:</span>
                    <select
                      value={selectedIncident.status}
                      onChange={(e) => handleUpdateStatus(selectedIncident.id, e.target.value as IncidentStatus)}
                      className="text-xs font-bold px-2 py-1 rounded-md border border-[#E5DFD5] bg-[#FAF8F5] text-slate-900 cursor-pointer"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="INVESTIGATING">INVESTIGATING</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>
                  </div>
                </div>

                {/* Interactive Lifecycle Workflow Stepper */}
                <div className="my-3 bg-[#FAF8F5] p-2.5 rounded-md border border-[#E5DFD5]">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-bold text-slate-950">Lifecycle State</span>
                    <span className="text-[10px] text-stone-500">Click to transition</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['OPEN', 'INVESTIGATING', 'RESOLVED'] as IncidentStatus[]).map((st, idx) => {
                      const isCurrent = selectedIncident.status === st;
                      const isPast = (st === 'OPEN' && (selectedIncident.status === 'INVESTIGATING' || selectedIncident.status === 'RESOLVED')) ||
                                     (st === 'INVESTIGATING' && selectedIncident.status === 'RESOLVED');
                      return (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(selectedIncident.id, st)}
                          className={`px-2 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                            isCurrent
                              ? st === 'RESOLVED' 
                                ? 'bg-[#1E4E38] text-white shadow-xs'
                                : st === 'INVESTIGATING'
                                ? 'bg-[#8A6112] text-white shadow-xs'
                                : 'bg-[#8E2825] text-white shadow-xs'
                              : isPast
                              ? 'bg-[#E5DFD5] text-stone-800 hover:bg-[#DCD6CC]'
                              : 'bg-white text-stone-600 border border-[#E5DFD5] hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <span>{idx + 1}. {st.charAt(0) + st.slice(1).toLowerCase()}</span>
                          {isCurrent && <Check className="w-3 h-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <h3 className="text-sm font-extrabold text-slate-950 leading-snug">{selectedIncident.title}</h3>
                <p className="mt-2 text-xs text-stone-700 leading-relaxed bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD5] font-medium">
                  {selectedIncident.description}
                </p>
              </div>

              {/* Metadata Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-md bg-[#FAF8F5] border border-[#E5DFD5]">
                  <div className="text-[10px] text-stone-500 font-bold uppercase">Affected Module</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedIncident.affected_module}</div>
                </div>
                <div className="p-2.5 rounded-md bg-[#FAF8F5] border border-[#E5DFD5]">
                  <div className="text-[10px] text-stone-500 font-bold uppercase">Resolution Effort</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedIncident.resolution_effort_hours} Hours</div>
                </div>
              </div>

              {/* Convert to Debt Item Action Button */}
              {onConvertIncidentToDebt && (
                <div className="p-3 bg-[#EDF6F1] rounded-md border border-[#BCD8C7] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#1E4E38]">Quantify Underlying Debt</div>
                    <div className="text-[10px] text-stone-600 font-medium">Convert incident finding into a scheduled debt item</div>
                  </div>
                  <button
                    onClick={() => onConvertIncidentToDebt({
                      title: `Remediate structural weakness revealed by ${selectedIncident.incident_number}: ${selectedIncident.title}`,
                      description: `Root cause identified in ${selectedIncident.affected_module}. ${selectedIncident.description}`,
                      module_name: selectedIncident.affected_module,
                      effort_principal: Math.max(8.0, selectedIncident.resolution_effort_hours * 1.5),
                      linked_incident_id: selectedIncident.id
                    })}
                    className="px-3 py-1.5 bg-[#0C1A2E] hover:bg-[#142B4B] text-white rounded-md text-xs font-bold shadow-xs flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Convert to Debt</span>
                  </button>
                </div>
              )}

              {/* Similar Incidents (M6 Hybrid Similarity Engine) */}
              <div className="pt-3 border-t border-[#F4EFE6]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#0C1A2E]" />
                    <span className="text-xs font-bold text-slate-950">Hybrid Similar Incidents</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#0C1A2E] bg-[#F0F4FA] px-1.5 py-0.5 rounded-sm border border-[#CBD8E8] font-bold">TF-IDF + Semantics</span>
                </div>

                {similarIncidents.length === 0 ? (
                  <div className="p-3 text-center text-[11px] text-stone-500 bg-[#FAF8F5] rounded-md border border-[#E5DFD5] font-medium">
                    No related incidents exceeding similarity threshold.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {similarIncidents.map((s) => (
                      <div 
                        key={s.incident_id}
                        className="p-2 rounded-md border border-[#EADBCE] bg-[#FAF8F5] hover:bg-white transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-slate-900 text-[11px]">{s.incident_number}</span>
                            <span className="text-stone-500 text-[10px]">• {s.affected_module}</span>
                          </div>
                          <div className="text-[11px] text-stone-700 truncate font-medium">{s.title}</div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-md border ${getSimilarityBadge(s.similarity_score)}`}>
                            {Math.round(s.similarity_score * 100)}%
                          </span>
                          <div className="text-[9px] text-stone-500 mt-0.5 font-medium">sim(i,j)</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-stone-400 font-medium">
              Select an incident from the left to view details and similar defect telemetry.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
