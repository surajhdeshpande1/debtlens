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
  Check,
  Activity,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { Incident, IncidentSeverity, IncidentStatus, SimilarIncidentMatch, DebtCategory } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { IncidentReportModal } from '../components/IncidentReportModal';

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
  const [isFullReportOpen, setIsFullReportOpen] = useState(false);
  const [reportIncident, setReportIncident] = useState<Incident | null>(null);

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
      if (newStatus === 'RESOLVED') {
        showToast('success', 'Incident Solved & Resolved', `${updated.incident_number} post-mortem report generated in correct order.`);
      } else {
        showToast('success', 'Status Updated', `${updated.incident_number} is now marked ${newStatus}`);
      }
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

  const handleSimulateTelemetrySpike = async () => {
    try {
      const syntheticIncidents = [
        {
          title: 'Redis Cluster Split-Brain Partition Timeout during Card Verification',
          description: 'Distributed Redlock heartbeat latency exceeded 2500ms under concurrent traffic, triggering payment authorization retries.',
          severity: 'HIGH',
          affected_module: 'payments',
          affected_component: 'Distributed Lock Interceptor',
          resolution_effort_hours: 8.5
        },
        {
          title: 'Database Read Replica Replication Lag Exceeded SLA Threshold',
          description: 'Long-running settlement report transaction saturated IOPS on replica pool, delaying order status queries by 42 minutes.',
          severity: 'HIGH',
          affected_module: 'database',
          affected_component: 'Hikari Replica Pool',
          resolution_effort_hours: 11.0
        },
        {
          title: 'Async Notification Webhook Worker Out-Of-Memory Crash',
          description: 'Unbounded in-memory queue consumer heap exhausted during marketing flash campaign dispatch.',
          severity: 'MEDIUM',
          affected_module: 'notification',
          affected_component: 'Event Streamer',
          resolution_effort_hours: 5.5
        }
      ];

      const chosen = syntheticIncidents[Math.floor(Math.random() * syntheticIncidents.length)];
      await api.createIncident({
        ...chosen,
        project_id: projectId
      });
      showToast('warning', 'Live Telemetry Ingested', `Ingested: ${chosen.title}. Economic drag I(d) updated.`);
      await fetchIncidents();
    } catch (e) {
      console.error(e);
      showToast('error', 'Simulation Failed', 'Could not ingest synthetic telemetry event.');
    }
  };

  const severityBadge = (sev: IncidentSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'LOW':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const statusBadge = (stat: IncidentStatus) => {
    switch (stat) {
      case 'OPEN':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'INVESTIGATING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
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

  const getSimilarityBadge = (score: number) => {
    if (score >= 0.7) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 0.4) return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Incident Intake & Lifecycle</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold font-mono">
              Module M2
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Structured incident logging with severity mapping, resolution metrics, and automated root cause convergence
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleSimulateTelemetrySpike}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Simulate Real-Time Telemetry Incident Ingestion"
          >
            <Activity className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span>Simulate Telemetry</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Export incidents dataset as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Incident</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by title, number, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer"
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
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer"
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
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              title="Reset all active filters"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Two Column Layout: Table + Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Incident List Table */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-bold text-slate-900">{incidents.length} Registered Incidents</span>
            <span className="text-[11px] text-slate-500">Click row to inspect causal telemetry</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {incidents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No incidents found matching current filters.
              </div>
            ) : (
              incidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => handleSelectIncident(inc)}
                    className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col space-y-2 ${
                      isSelected ? 'bg-indigo-50/60 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{inc.incident_number}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-sm border ${severityBadge(inc.severity)}`}>
                          {inc.severity}
                        </span>
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${getModuleBadge(inc.affected_module)}`}>
                          {inc.affected_module}
                        </span>
                      </div>

                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge(inc.status)}`}>
                        {inc.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-1">
                      {inc.title}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Effort: {inc.resolution_effort_hours}h • {new Date(inc.reported_at).toLocaleDateString()}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportIncident(inc);
                          setIsFullReportOpen(true);
                        }}
                        className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center space-x-1 cursor-pointer"
                        title="Display full incident report in correct order"
                      >
                        <FileText className="w-3 h-3 text-indigo-500" />
                        <span>Full Report</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Incident Detail Inspector */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs sticky top-20 space-y-5">
          {selectedIncident ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    {selectedIncident.incident_number}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs text-slate-500 font-medium">Status:</span>
                    <select
                      value={selectedIncident.status}
                      onChange={(e) => handleUpdateStatus(selectedIncident.id, e.target.value as IncidentStatus)}
                      className="text-xs font-bold px-2 py-1 rounded-md border border-slate-200 bg-white cursor-pointer"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="INVESTIGATING">INVESTIGATING</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>
                  </div>
                </div>

                {/* Interactive Lifecycle Workflow Stepper */}
                <div className="my-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-semibold text-slate-700">Lifecycle State</span>
                    <span className="text-[10px] text-slate-400">Click to transition</span>
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
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                            isCurrent
                              ? st === 'RESOLVED' 
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : st === 'INVESTIGATING'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-rose-600 text-white shadow-xs'
                              : isPast
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>{idx + 1}. {st.charAt(0) + st.slice(1).toLowerCase()}</span>
                          {isCurrent && <Check className="w-3 h-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Solved Post-Mortem Action Callout */}
                {selectedIncident.status === 'RESOLVED' && (
                  <div className="my-2.5 p-3 rounded-xl border border-emerald-300 bg-emerald-50/90 flex items-center justify-between text-xs animate-in fade-in">
                    <div className="space-y-0.5">
                      <div className="font-bold text-emerald-950 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Incident Fully Solved & Resolved</span>
                      </div>
                      <div className="text-[10px] text-emerald-700">8-Section chronological post-mortem ready</div>
                    </div>
                    <button
                      onClick={() => {
                        setReportIncident(selectedIncident);
                        setIsFullReportOpen(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Full Report</span>
                    </button>
                  </div>
                )}

                <h3 className="text-sm font-bold text-slate-900 leading-snug">{selectedIncident.title}</h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {selectedIncident.description}
                </p>
              </div>

              {/* Metadata Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-medium uppercase">Affected Module</div>
                  <div className="font-semibold text-slate-800">{selectedIncident.affected_module}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-medium uppercase">Resolution Effort</div>
                  <div className="font-semibold text-slate-800">{selectedIncident.resolution_effort_hours} Hours</div>
                </div>
              </div>

              {/* View Full Incident Report Primary Button */}
              <button
                onClick={() => {
                  setReportIncident(selectedIncident);
                  setIsFullReportOpen(true);
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-2 cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Display Full Incident Report (Correct Order)</span>
              </button>

              {/* Convert to Debt Item Action Button */}
              {onConvertIncidentToDebt && (
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-emerald-900">Quantify Underlying Debt</div>
                    <div className="text-[10px] text-emerald-700">Convert incident finding into a scheduled debt item</div>
                  </div>
                  <button
                    onClick={() => onConvertIncidentToDebt({
                      title: `Remediate structural weakness revealed by ${selectedIncident.incident_number}: ${selectedIncident.title}`,
                      description: `Root cause identified in ${selectedIncident.affected_module}. ${selectedIncident.description}`,
                      module_name: selectedIncident.affected_module,
                      effort_principal: Math.max(8.0, selectedIncident.resolution_effort_hours * 1.5),
                      linked_incident_id: selectedIncident.id
                    })}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Convert to Debt</span>
                  </button>
                </div>
              )}

              {/* Similar Incidents (M6 Hybrid Similarity Engine) */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">Hybrid Similar Incidents</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">TF-IDF + Semantics</span>
                </div>

                {similarIncidents.length === 0 ? (
                  <div className="p-3 text-center text-[11px] text-slate-400 bg-slate-50 rounded-lg">
                    No related incidents exceeding similarity threshold.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {similarIncidents.map((s) => (
                      <div 
                        key={s.incident_id}
                        className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100 transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{s.incident_number}</span>
                            <span className="text-slate-400 text-[10px]">• {s.affected_module}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 truncate">{s.title}</div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-md border ${getSimilarityBadge(s.similarity_score)}`}>
                            {Math.round(s.similarity_score * 100)}%
                          </span>
                          <div className="text-[9px] text-slate-400 mt-0.5">sim(i,j)</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              Select an incident from the left to view details and similar defect telemetry.
            </div>
          )}
        </div>

      </div>

      {/* Comprehensive 8-Section Incident Report Modal (Exact Correct Order) */}
      <IncidentReportModal
        isOpen={isFullReportOpen}
        onClose={() => setIsFullReportOpen(false)}
        incident={reportIncident}
      />

    </div>
  );
};
