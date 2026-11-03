import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  ShieldAlert, 
  Sliders,
  GitCompare
} from 'lucide-react';
import { RootCauseCluster, RegressionItem, Incident } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface IntelligencePageProps {
  projectId: number;
}

export const IntelligencePage: React.FC<IntelligencePageProps> = ({ projectId }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'clusters' | 'comparator'>('clusters');
  const [clusters, setClusters] = useState<RootCauseCluster[]>([]);
  const [regressions, setRegressions] = useState<RegressionItem[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tau, setTau] = useState(0.45);
  const [alpha, setAlpha] = useState(0.55);
  const [eps, setEps] = useState(0.55);
  const [loading, setLoading] = useState(true);

  // Comparator State
  const [selectedIncA, setSelectedIncA] = useState<number | null>(null);
  const [selectedIncB, setSelectedIncB] = useState<number | null>(null);
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);

  const fetchIntelligence = async () => {
    try {
      setLoading(true);
      const [clust, reg, incList] = await Promise.all([
        api.getRootCauseClusters(projectId, eps),
        api.getRegressions(projectId, tau),
        api.getIncidents(projectId)
      ]);
      setClusters(clust);
      setRegressions(reg);
      setIncidents(incList);
      if (incList.length >= 2 && selectedIncA === null) {
        setSelectedIncA(incList[0].id);
        setSelectedIncB(incList[4] ? incList[4].id : incList[1].id);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Error', 'Failed to update intelligence analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [projectId, tau, eps]);

  // Run pairwise comparison when A, B, or alpha change
  useEffect(() => {
    if (selectedIncA && selectedIncB) {
      api.comparePairwise(selectedIncA, selectedIncB, alpha)
        .then(setComparisonResult)
        .catch(console.error);
    }
  }, [selectedIncA, selectedIncB, alpha]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto overflow-x-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-black tracking-tight flex items-center space-x-2">
            <span>Incident Intelligence & Defect Analytics</span>
            <span className="text-xs px-2.5 py-0.5 rounded-sm bg-black text-white font-bold font-mono">
              Module M6
            </span>
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            DBSCAN root cause clustering over cosine distance, hybrid TF-IDF lexical + semantic scoring, and regression recurrence detection
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sub-tab switcher */}
          <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-md p-0.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('clusters')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer font-bold ${
                activeTab === 'clusters' ? 'bg-black text-white shadow-xs' : 'text-zinc-600 hover:text-black'
              }`}
            >
              Clusters & Regressions
            </button>
            <button
              onClick={() => setActiveTab('comparator')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1 cursor-pointer font-bold ${
                activeTab === 'comparator' ? 'bg-black text-white shadow-xs' : 'text-zinc-600 hover:text-black'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Pairwise Comparator</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'clusters' ? (
        <>
          {/* Interactive Formulation Tuning Bar */}
          <div className="bg-white rounded-md border border-zinc-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-black">
              <div className="flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-black" />
                <span>Interactive Algorithmic Hyperparameter Tuning</span>
              </div>
              <span className="text-[11px] font-medium text-zinc-500">Adjust thresholds to observe sensitivity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Tau Slider */}
              <div className="p-3 bg-zinc-50 rounded-md border border-zinc-200 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-black">Regression Similarity Threshold (τ):</span>
                  <strong className="font-mono text-black font-extrabold">{tau.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.80"
                  step="0.05"
                  value={tau}
                  onChange={(e) => setTau(parseFloat(e.target.value))}
                  className="w-full accent-black h-1.5 bg-zinc-200 rounded-md cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono font-medium">
                  <span>0.20 (Broad)</span>
                  <span>0.50 (Standard)</span>
                  <span>0.80 (Strict)</span>
                </div>
              </div>

              {/* DBSCAN Eps Slider */}
              <div className="p-3 bg-zinc-50 rounded-md border border-zinc-200 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-black">DBSCAN Clustering Radius (ε):</span>
                  <strong className="font-mono text-black font-extrabold">{eps.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.85"
                  step="0.05"
                  value={eps}
                  onChange={(e) => setEps(parseFloat(e.target.value))}
                  className="w-full accent-black h-1.5 bg-zinc-200 rounded-md cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono font-medium">
                  <span>0.30 (Tight Clusters)</span>
                  <span>0.55 (Standard)</span>
                  <span>0.85 (Broad Clusters)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Regression Detection Callout */}
          <div className="bg-white rounded-md border border-zinc-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-black" />
                <div>
                  <h3 className="text-sm font-bold text-black">Detected Recurrent Regressions</h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    New incidents matching resolved incidents on identical modules after recorded fix date
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold px-2.5 py-1 rounded-sm bg-red-50 text-red-700 border border-red-200 font-mono">
                {regressions.length} Regressions Flagged
              </span>
            </div>

            {regressions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-md border border-slate-200">
                No regressions detected at threshold τ = {tau}. Resolved fixes are holding stable.
              </div>
            ) : (
              <div className="space-y-3">
                {regressions.map((r) => (
                  <div 
                    key={`${r.new_incident_id}-${r.resolved_incident_id}`}
                    className="p-4 rounded-md border border-red-200 bg-red-50/40 hover:bg-red-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-white bg-red-700 px-1.5 py-0.5 rounded-sm">
                          ACTIVE REGRESSION
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900">{r.new_incident_number}</span>
                        <span className="text-xs text-slate-400">regressed from</span>
                        <span className="font-mono text-xs font-bold text-slate-600">{r.resolved_incident_number}</span>
                      </div>

                      <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                        {r.new_incident_title}
                      </h4>

                      <div className="flex items-center space-x-4 text-[11px] text-slate-600">
                        <span>Module: <strong className="text-slate-900">{r.affected_module}</strong></span>
                        <span>•</span>
                        <span>Recurred after: <strong className="text-slate-900">{r.days_to_recurrence} days</strong></span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-red-700 text-sm">
                        {Math.round(r.similarity * 100)}% Match
                      </div>
                      <div className="text-[10px] text-slate-500">sim(i, j) ≥ τ ({tau})</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DBSCAN Root Cause Clusters */}
          <div className="bg-white rounded-md border border-zinc-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-black" />
                <div>
                  <h3 className="text-sm font-bold text-black">DBSCAN Root Cause Semantic Clusters</h3>
                  <p className="text-xs text-zinc-500">
                    Density-based spatial clustering grouping semantically equivalent causes without predetermined k
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono text-zinc-500 font-medium">eps={eps}, min_samples=2</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusters.map((c) => {
                return (
                  <div 
                    key={c.cluster_id}
                    className={`p-4 rounded-md border transition-all ${c.is_noise ? 'border-dashed border-zinc-300 bg-zinc-50/50' : 'border-zinc-200 bg-zinc-50 hover:bg-white hover:border-black'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider font-mono ${c.is_noise ? 'bg-zinc-200 text-zinc-700' : 'bg-black text-white'}`}>
                          {c.is_noise ? 'Outliers / Noise' : `Cluster #${c.cluster_id + 1}`}
                        </span>
                        <h4 className="mt-1.5 text-xs font-bold text-black leading-snug">
                          {c.theme_title}
                        </h4>
                      </div>

                      <span className="text-xs font-bold font-mono text-black">
                        {c.cause_count} causes
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5 pt-2 border-t border-zinc-200">
                      {c.causes.map((cause, idx) => (
                        <div key={idx} className="text-[11px] text-zinc-600 flex items-start space-x-1.5">
                          <span className="text-black font-bold shrink-0">•</span>
                          <span>{cause}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* Pairwise Incident Comparator Tool */
        <div className="space-y-6">
          <div className="bg-white rounded-md border border-zinc-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center space-x-2">
                <GitCompare className="w-5 h-5 text-black" />
                <div>
                  <h3 className="text-sm font-bold text-black">Pairwise Incident Similarity Comparator</h3>
                  <p className="text-xs text-zinc-500">
                    Compare any two historical or open incidents to verify hybrid TF-IDF and semantic subword cosine similarity
                  </p>
                </div>
              </div>

              {/* Alpha Weight Slider */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-semibold text-zinc-700">Lexical Weight (α):</span>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={alpha}
                  onChange={(e) => setAlpha(parseFloat(e.target.value))}
                  className="w-24 accent-black h-1.5 bg-zinc-200 rounded-md cursor-pointer"
                />
                <span className="font-mono font-bold text-black">{alpha.toFixed(2)}</span>
              </div>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Select Incident A:
                </label>
                <select
                  value={selectedIncA || ''}
                  onChange={(e) => setSelectedIncA(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-md border border-zinc-300 bg-white text-black cursor-pointer"
                >
                  {incidents.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.incident_number}: {i.title.length > 45 ? i.title.substring(0, 42) + '...' : i.title} ({i.affected_module})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Select Incident B:
                </label>
                <select
                  value={selectedIncB || ''}
                  onChange={(e) => setSelectedIncB(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-md border border-zinc-300 bg-white text-black cursor-pointer"
                >
                  {incidents.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.incident_number}: {i.title.length > 45 ? i.title.substring(0, 42) + '...' : i.title} ({i.affected_module})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Metrics Display */}
            {comparisonResult && (
              <div className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-zinc-50 rounded-md border border-zinc-200">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase">Lexical Cosine Score</div>
                    <div className="text-xl font-bold font-mono text-black mt-1">
                      {(comparisonResult.lexical_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">cos(tfidf_a, tfidf_b)</div>
                  </div>

                  <div className="p-3 bg-zinc-50 rounded-md border border-zinc-200">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase">Semantic Subword Score</div>
                    <div className="text-xl font-bold font-mono text-black mt-1">
                      {(comparisonResult.semantic_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">cos(emb_a, emb_b)</div>
                  </div>

                  <div className="p-3 bg-[#064E3B] text-white rounded-md border border-[#043D2E] shadow-xs">
                    <div className="text-[10px] font-bold text-emerald-100 uppercase">Hybrid Formulation Score</div>
                    <div className="text-2xl font-bold font-mono text-white mt-0.5">
                      {(comparisonResult.hybrid_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-emerald-200 font-mono">α·lex + (1-α)·sem</div>
                  </div>
                </div>

                {/* Shared Tokens */}
                {comparisonResult.common_tokens.length > 0 && (
                  <div className="p-3 bg-white rounded-md border border-zinc-200 space-y-1.5 text-xs">
                    <div className="font-bold text-black text-[11px]">Overlapping Linguistic / Domain Tokens:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {comparisonResult.common_tokens.map((tok: string, idx: number) => (
                        <span key={idx} className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-300">
                          {tok}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
