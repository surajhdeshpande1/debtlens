import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Download,
  RotateCcw,
  Check,
  Coins,
  Sparkles
} from 'lucide-react';
import { Incident, IncidentSeverity, IncidentStatus, SimilarIncidentMatch } from '../types';
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
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterModule, setFilterModule] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchIncidents = async () => {
    try {
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
    }
  };

  const handleUpdateStatus = async (incidentId: number, newStatus: IncidentStatus) => {
    try {
      const updated = await api.updateIncident(incidentId, { status: newStatus });
      setIncidents(incidents.map(i => i.id === incidentId ? updated : i));
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident(updated);
      }
      showToast('success', 'Incident Updated', `${updated.incident_number} transitioned to ${newStatus}`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Update Failed', 'Could not transition status.');
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
      showToast('success', 'Export Complete', 'Downloaded incidents dataset as CSV.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Export Failed', 'Could not export incidents to CSV.');
    }
  };

  const severityBadge = (sev: IncidentSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-black text-white border-black font-mono';
      case 'HIGH':
        return 'bg-zinc-800 text-white border-zinc-700 font-mono';
      case 'MEDIUM':
        return 'bg-zinc-200 text-zinc-900 border-zinc-300 font-mono';
      case 'LOW':
        return 'bg-zinc-100 text-zinc-700 border-zinc-200 font-mono';
    }
  };

  const statusBadge = (stat: IncidentStatus) => {
    switch (stat) {
      case 'OPEN':
        return 'bg-black text-white border-black font-mono';
      case 'INVESTIGATING':
        return 'bg-zinc-800 text-white border-zinc-700 font-mono';
      case 'RESOLVED':
        return 'bg-zinc-100 text-zinc-800 border-zinc-300 font-mono';
    }
  };

  const getModuleBadge = (_moduleName: string) => {
    return 'bg-zinc-100 text-black border-zinc-200 font-mono';
  };

  const getSimilarityBadge = (_score: number) => {
    return 'text-black bg-zinc-100 border-zinc-300 font-mono';
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-black tracking-tight flex items-center space-x-2">
            <span>Incident Intake & Lifecycle</span>
            <span className="text-xs px-2.5 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-200 font-bold font-mono">
              Module M2
            </span>
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Structured incident logging with severity mapping, resolution metrics, and automated root cause convergence
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-md bg-white border border-zinc-300 hover:bg-zinc-100 text-black text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Export incidents dataset as CSV"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-md bg-black hover:bg-zinc-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer border border-black"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Incident</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-md border border-zinc-200 p-3 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by title, number, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-black bg-white text-black"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-zinc-200 bg-white text-black font-medium cursor-pointer"
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
            className="px-2.5 py-1.5 text-xs rounded-md border border-zinc-200 bg-white text-black font-medium cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-zinc-200 bg-white text-black font-medium cursor-pointer"
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
              className="px-2.5 py-1.5 text-xs rounded-md bg-zinc-100 hover:bg-zinc-200 text-black font-medium flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-zinc-500" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Incident Workflow Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Incident List */}
        <div className="lg:col-span-7 bg-white rounded-md border border-zinc-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between text-xs font-bold text-zinc-500">
            <span>{incidents.length} Incident Telemetry Records</span>
            <span>Sorted by Recency</span>
          </div>

          <div className="divide-y divide-zinc-100 max-h-[640px] overflow-y-auto">
            {incidents.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 font-medium">
                No incidents found matching current filters.
              </div>
            ) : (
              incidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => handleSelectIncident(inc)}
                    className={`p-3.5 hover:bg-zinc-50 transition-colors cursor-pointer flex flex-col space-y-2 ${
                      isSelected ? 'bg-zinc-100 border-l-4 border-black' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-black">{inc.incident_number}</span>
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

                    <h4 className="text-xs font-bold text-black leading-snug line-clamp-1">
                      {inc.title}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                      <span>Effort: <strong className="text-black">{inc.resolution_effort_hours}h</strong></span>
                      <span>{new Date(inc.reported_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Incident Detail Inspector */}
        <div className="lg:col-span-5 bg-white rounded-md border border-zinc-200 p-5 shadow-xs sticky top-20 space-y-5">
          {selectedIncident ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-white bg-black border border-black px-2.5 py-0.5 rounded-sm">
                    {selectedIncident.incident_number}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs text-zinc-500 font-medium">Status:</span>
                    <select
                      value={selectedIncident.status}
                      onChange={(e) => handleUpdateStatus(selectedIncident.id, e.target.value as IncidentStatus)}
                      className="text-xs font-bold px-2 py-1 rounded-md border border-zinc-200 bg-white text-black cursor-pointer"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="INVESTIGATING">INVESTIGATING</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>
                  </div>
                </div>

                {/* Interactive Lifecycle Workflow Stepper */}
                <div className="my-3 bg-zinc-50 p-2.5 rounded-md border border-zinc-200">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-bold text-black">Lifecycle State</span>
                    <span className="text-[10px] text-zinc-500">Click to transition</span>
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
                              ? 'bg-black text-white shadow-xs border border-black'
                              : isPast
                              ? 'bg-zinc-200 text-black hover:bg-zinc-300'
                              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          <span>{idx + 1}. {st.charAt(0) + st.slice(1).toLowerCase()}</span>
                          {isCurrent && <Check className="w-3 h-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <h3 className="text-sm font-extrabold text-black leading-snug">{selectedIncident.title}</h3>
                <p className="mt-2 text-xs text-zinc-700 leading-relaxed bg-zinc-50 p-3 rounded-md border border-zinc-200 font-medium">
                  {selectedIncident.description}
                </p>
              </div>

              {/* Metadata Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-md bg-zinc-50 border border-zinc-200">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Affected Module</div>
                  <div className="font-bold text-black mt-0.5">{selectedIncident.affected_module}</div>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-50 border border-zinc-200">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Resolution Effort</div>
                  <div className="font-bold text-black mt-0.5">{selectedIncident.resolution_effort_hours} Hours</div>
                </div>
              </div>

              {/* Convert to Debt Item Action Button */}
              {onConvertIncidentToDebt && (
                <div className="p-3 bg-zinc-50 rounded-md border border-zinc-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-black">Quantify Underlying Debt</div>
                    <div className="text-[10px] text-zinc-500 font-medium">Convert incident finding into a scheduled debt item</div>
                  </div>
                  <button
                    onClick={() => onConvertIncidentToDebt({
                      title: `Remediate structural weakness revealed by ${selectedIncident.incident_number}: ${selectedIncident.title}`,
                      description: `Root cause identified in ${selectedIncident.affected_module}. ${selectedIncident.description}`,
                      module_name: selectedIncident.affected_module,
                      effort_principal: Math.max(8.0, selectedIncident.resolution_effort_hours * 1.5),
                      linked_incident_id: selectedIncident.id
                    })}
                    className="px-3 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-md text-xs font-bold shadow-xs flex items-center space-x-1 cursor-pointer transition-colors border border-black"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Convert to Debt</span>
                  </button>
                </div>
              )}

              {/* Similar Incidents */}
              <div className="pt-3 border-t border-zinc-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-black" />
                    <span className="text-xs font-bold text-black">Hybrid Similar Incidents</span>
                  </div>
                  <span className="text-[10px] font-mono text-black bg-zinc-100 px-1.5 py-0.5 rounded-sm border border-zinc-200 font-bold">TF-IDF + Semantics</span>
                </div>

                {similarIncidents.length === 0 ? (
                  <div className="p-3 text-center text-[11px] text-zinc-500 bg-zinc-50 rounded-md border border-zinc-200 font-medium">
                    No related incidents exceeding similarity threshold.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {similarIncidents.map((s) => (
                      <div 
                        key={s.incident_id}
                        className="p-2 rounded-md border border-zinc-200 bg-zinc-50 hover:bg-white transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-black text-[11px]">{s.incident_number}</span>
                            <span className="text-zinc-500 text-[10px]">• {s.affected_module}</span>
                          </div>
                          <div className="text-[11px] text-zinc-700 truncate font-medium">{s.title}</div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-md border ${getSimilarityBadge(s.similarity_score)}`}>
                            {Math.round(s.similarity_score * 100)}%
                          </span>
                          <div className="text-[9px] text-zinc-500 mt-0.5 font-medium">sim(i,j)</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-zinc-400 font-medium">
              Select an incident from the left to view details and similar defect telemetry.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
