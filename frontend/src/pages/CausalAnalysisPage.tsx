import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  Plus, 
  HelpCircle, 
  Award, 
  Layers, 
  ExternalLink,
  Filter,
  Coins
} from 'lucide-react';
import { CausalGraphData, CauseNode } from '../types';
import { api } from '../services/api';
import { CausalGraphView } from '../components/CausalGraphView';
import { useToast } from '../context/ToastContext';

interface CausalAnalysisPageProps {
  projectId: number;
  onConvertCauseToDebt?: (cause: { id: number; description: string; category: string }) => void;
}

export const CausalAnalysisPage: React.FC<CausalAnalysisPageProps> = ({ 
  projectId,
  onConvertCauseToDebt 
}) => {
  const { showToast } = useToast();
  const [graphData, setGraphData] = useState<CausalGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newCauseDesc, setNewCauseDesc] = useState('');
  const [newCauseCategory, setNewCauseCategory] = useState('ARCHITECTURE');
  const [isAdding, setIsAdding] = useState(false);

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const data = await api.getCausalGraph(projectId);
      setGraphData(data);
    } catch (err) {
      console.error(err);
      showToast('error', 'Error', 'Failed to retrieve causal graph telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [projectId]);

  const handleAddCause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCauseDesc.trim()) return;
    try {
      setIsAdding(true);
      await api.createCauseNode(projectId, newCauseDesc.trim(), newCauseCategory);
      showToast('success', 'Node Inserted', 'Cause node converged into reusable directed causal network.');
      setNewCauseDesc('');
      await fetchGraph();
    } catch (err) {
      console.error(err);
      showToast('error', 'Error', 'Failed to create cause node.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Causal Graph & Guided 5-Whys</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold font-mono">
              Module M3
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Directed causal network capturing reusable failure mechanisms, converging duplicate causes, and measuring systemic impact via graph centrality
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs">
            NetworkX Centrality Engine: <strong>Active</strong>
          </span>
        </div>
      </div>

      {/* Interactive Cytoscape Canvas */}
      {graphData ? (
        <CausalGraphView 
          graphData={graphData} 
          onConvertCauseToDebt={onConvertCauseToDebt}
        />
      ) : (
        <div className="h-[500px] bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-xs">
          Loading Causal Network...
        </div>
      )}

      {/* Two Columns: Systemic Cause Ranking + Quick Cause Registration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Systemic Causes Table */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">Systemic Weakness Ranking (Centrality Matrix)</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Sorted by Betweenness × Degree</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Rank & Category</th>
                  <th className="py-2.5 px-3">Reusable Root Cause Description</th>
                  <th className="py-2.5 px-3 text-center">Betweenness</th>
                  <th className="py-2.5 px-3 text-center">Degree</th>
                  <th className="py-2.5 px-3 text-center">Incidents</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {graphData?.systemic_causes.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-sm text-[10px]">
                        #{idx + 1} {c.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {c.description}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                      {c.betweenness_centrality.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                      {c.degree_centrality.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-indigo-600">
                      {c.incident_count}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {onConvertCauseToDebt && (
                        <button
                          onClick={() => onConvertCauseToDebt({
                            id: c.id,
                            description: c.description,
                            category: c.category
                          })}
                          className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md transition-colors cursor-pointer"
                        >
                          + Debt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cause Node Registration Box */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Add Reusable Cause Node</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Register a standard root cause to link across multiple incidents and observe centrality emergence in the graph.
          </p>

          <form onSubmit={handleAddCause} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cause Description
              </label>
              <textarea
                rows={2}
                required
                value={newCauseDesc}
                onChange={(e) => setNewCauseDesc(e.target.value)}
                placeholder="e.g. Unbounded thread pool timeout during high concurrency"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={newCauseCategory}
                onChange={(e) => setNewCauseCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer"
              >
                <option value="ARCHITECTURE">ARCHITECTURE</option>
                <option value="DATABASE">DATABASE</option>
                <option value="CONCURRENCY">CONCURRENCY</option>
                <option value="NETWORK">NETWORK</option>
                <option value="MEMORY">MEMORY</option>
                <option value="CONFIGURATION">CONFIGURATION</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isAdding ? 'Adding Node...' : '+ Insert into Causal Graph'}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};
