import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  RotateCcw, 
  Layers, 
  ShieldAlert, 
  CheckCircle2, 
  Sliders,
  HelpCircle,
  Clock,
  ArrowRight,
  Filter,
  GitCompare,
  Coins
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
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center space-x-2">
            <span>Incident Intelligence & Defect Analytics</span>
            <span className="text-xs px-2.5 py-0.5 rounded-sm bg-[#F0F4FA] text-[#0C1A2E] border border-[#CBD8E8] font-bold font-mono">
              Module M6
            </span>
          </h2>
          <p className="text-xs text-stone-500 font-medium">
            DBSCAN root cause clustering over cosine distance, hybrid TF-IDF lexical + semantic scoring, and regression recurrence detection
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sub-tab switcher */}
          <div className="flex items-center bg-[#FAF8F5] border border-[#E5DFD5] rounded-md p-0.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('clusters')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer font-bold ${
                activeTab === 'clusters' ? 'bg-[#0C1A2E] text-white shadow-xs' : 'text-stone-700 hover:text-slate-950'
              }`}
            >
              Clusters & Regressions
            </button>
            <button
              onClick={() => setActiveTab('comparator')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1 cursor-pointer font-bold ${
                activeTab === 'comparator' ? 'bg-[#0C1A2E] text-white shadow-xs' : 'text-stone-700 hover:text-slate-950'
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
          <div className="bg-white/95 rounded-md border border-[#E5DFD5] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-950">
              <div className="flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-[#0C1A2E]" />
                <span>Interactive Algorithmic Hyperparameter Tuning</span>
              </div>
              <span className="text-[11px] font-medium text-stone-500">Adjust thresholds to observe sensitivity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Tau Slider */}
              <div className="p-3 bg-[#FAF8F5] rounded-md border border-[#E5DFD5] space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-900">Regression Similarity Threshold (τ):</span>
                  <strong className="font-mono text-[#0C1A2E] font-extrabold">{tau.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.80"
                  step="0.05"
                  value={tau}
                  onChange={(e) => setTau(parseFloat(e.target.value))}
                  className="w-full accent-[#0C1A2E] h-1.5 bg-[#F4EFE6] rounded-md cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono font-medium">
                  <span>0.20 (Broad)</span>
                  <span>0.50 (Standard)</span>
                  <span>0.80 (Strict)</span>
                </div>
              </div>

              {/* DBSCAN Eps Slider */}
              <div className="p-3 bg-[#FAF8F5] rounded-md border border-[#E5DFD5] space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-900">DBSCAN Clustering Radius (ε):</span>
                  <strong className="font-mono text-[#0C1A2E] font-extrabold">{eps.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.85"
                  step="0.05"
                  value={eps}
                  onChange={(e) => setEps(parseFloat(e.target.value))}
                  className="w-full accent-[#0C1A2E] h-1.5 bg-[#F4EFE6] rounded-md cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono font-medium">
                  <span>0.30 (Tight Clusters)</span>
                  <span>0.55 (Standard)</span>
                  <span>0.85 (Broad Clusters)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Regression Detection Callout */}
          <div className="bg-white/95 rounded-md border border-[#EADBCE] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-950">Detected Recurrent Regressions</h3>
                  <p className="text-xs text-stone-500 font-medium">
                    New incidents matching resolved incidents on identical modules after recorded fix date
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-mono">
                {regressions.length} Regressions Flagged
              </span>
            </div>

            {regressions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-md border border-slate-100">
                No regressions detected at threshold τ = {tau}. Resolved fixes are holding stable.
              </div>
            ) : (
              <div className="space-y-3">
                {regressions.map((r) => (
                  <div 
                    key={`${r.new_incident_id}-${r.resolved_incident_id}`}
                    className="p-4 rounded-md border border-rose-200 bg-rose-50/40 hover:bg-rose-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-sm">
                          ACTIVE REGRESSION
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900">{r.new_incident_number}</span>
                        <span className="text-xs text-slate-400">regressed from</span>
                        <span className="font-mono text-xs font-bold text-slate-600">{r.resolved_incident_number}</span>
                      </div>

                      <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                        {r.new_incident_title}
                      </h4>

                      <div className="flex items-center space-x-4 text-[11px] text-slate-500">
                        <span>Module: <strong className="text-slate-700">{r.affected_module}</strong></span>
                        <span>•</span>
                        <span>Recurred after: <strong className="text-slate-700">{r.days_to_recurrence} days</strong></span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-rose-600 text-sm">
                        {Math.round(r.similarity * 100)}% Match
                      </div>
                      <div className="text-[10px] text-slate-400">sim(i, j) ≥ τ ({tau})</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DBSCAN Root Cause Clusters */}
          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-[#0C1A2E]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">DBSCAN Root Cause Semantic Clusters</h3>
                  <p className="text-xs text-stone-500">
                    Density-based spatial clustering grouping semantically equivalent causes without predetermined k
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono text-stone-400">eps={eps}, min_samples=2</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusters.map((c, cIdx) => {
                const clusterThemes = [
                  { border: 'border-[#CBD8E8] hover:border-[#93B4D7]', bg: 'bg-[#F0F4FA]/50', badge: 'bg-[#E4ECF6] text-[#0C1A2E] border-[#CBD8E8]', dot: 'text-[#0C1A2E]', text: 'text-[#0C1A2E]' },
                  { border: 'border-[#EBD8A3] hover:border-[#D4B974]', bg: 'bg-[#FEF9EE]/50', badge: 'bg-[#FDF3DB] text-[#8A6112] border-[#EBD8A3]', dot: 'text-[#8A6112]', text: 'text-[#8A6112]' },
                  { border: 'border-[#BCD8C7] hover:border-[#86BFA0]', bg: 'bg-[#EDF6F1]/50', badge: 'bg-[#DDEEE4] text-[#1E4E38] border-[#BCD8C7]', dot: 'text-[#1E4E38]', text: 'text-[#1E4E38]' },
                  { border: 'border-[#E8B4B2] hover:border-[#D98280]', bg: 'bg-[#FDF2F2]/50', badge: 'bg-[#F8D2D1] text-[#8E2825] border-[#E8B4B2]', dot: 'text-[#8E2825]', text: 'text-[#8E2825]' }
                ];
                const theme = c.is_noise 
                  ? { border: 'border-[#E5DFD5]', bg: 'bg-stone-50/60', badge: 'bg-stone-200 text-stone-700 border-stone-300', dot: 'text-stone-400', text: 'text-stone-600' }
                  : clusterThemes[cIdx % clusterThemes.length];

                return (
                  <div 
                    key={c.cluster_id}
                    className={`p-4 rounded-md border transition-all ${theme.border} ${theme.bg}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider border ${theme.badge}`}>
                          {c.is_noise ? 'Outliers / Noise' : `Cluster #${c.cluster_id + 1}`}
                        </span>
                        <h4 className="mt-1.5 text-xs font-bold text-slate-900 leading-snug">
                          {c.theme_title}
                        </h4>
                      </div>

                      <span className={`text-xs font-bold font-mono ${theme.text}`}>
                        {c.cause_count} causes
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5 pt-2 border-t border-[#E5DFD5]/60">
                      {c.causes.map((cause, idx) => (
                        <div key={idx} className="text-[11px] text-stone-600 flex items-start space-x-1.5">
                          <span className={`${theme.dot} font-bold shrink-0`}>•</span>
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
          <div className="bg-white rounded-md border border-[#E5DFD5] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F4EFE6]">
              <div className="flex items-center space-x-2">
                <GitCompare className="w-5 h-5 text-[#0C1A2E]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pairwise Incident Similarity Comparator</h3>
                  <p className="text-xs text-stone-500">
                    Compare any two historical or open incidents to verify hybrid TF-IDF and semantic subword cosine similarity
                  </p>
                </div>
              </div>

              {/* Alpha Weight Slider */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-semibold text-stone-700">Lexical Weight (α):</span>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={alpha}
                  onChange={(e) => setAlpha(parseFloat(e.target.value))}
                  className="w-24 accent-[#0C1A2E] h-1.5 bg-[#F4EFE6] rounded-md cursor-pointer"
                />
                <span className="font-mono font-bold text-[#0C1A2E]">{alpha.toFixed(2)}</span>
              </div>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Incident A:
                </label>
                <select
                  value={selectedIncA || ''}
                  onChange={(e) => setSelectedIncA(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#E5DFD5] bg-white cursor-pointer"
                >
                  {incidents.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.incident_number}: {i.title.length > 45 ? i.title.substring(0, 42) + '...' : i.title} ({i.affected_module})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Incident B:
                </label>
                <select
                  value={selectedIncB || ''}
                  onChange={(e) => setSelectedIncB(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#E5DFD5] bg-white cursor-pointer"
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
                  <div className="p-3 bg-[#FAF8F5] rounded-md border border-[#E5DFD5]">
                    <div className="text-[10px] font-bold text-stone-500 uppercase">Lexical Cosine Score</div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {(comparisonResult.lexical_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">cos(tfidf_a, tfidf_b)</div>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] rounded-md border border-[#E5DFD5]">
                    <div className="text-[10px] font-bold text-stone-500 uppercase">Semantic Subword Score</div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {(comparisonResult.semantic_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">cos(emb_a, emb_b)</div>
                  </div>

                  <div className="p-3 bg-[#F0F4FA] rounded-md border border-[#CBD8E8]">
                    <div className="text-[10px] font-bold text-[#0C1A2E] uppercase">Hybrid Formulation Score</div>
                    <div className="text-2xl font-black font-mono text-[#0C1A2E] mt-0.5">
                      {(comparisonResult.hybrid_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-[#0C1A2E]/70 font-mono">α·lex + (1-α)·sem</div>
                  </div>
                </div>

                {/* Shared Tokens */}
                {comparisonResult.common_tokens.length > 0 && (
                  <div className="p-3 bg-white rounded-md border border-[#E5DFD5] space-y-1.5 text-xs">
                    <div className="font-bold text-slate-800 text-[11px]">Overlapping Linguistic / Domain Tokens:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {comparisonResult.common_tokens.map((tok: string, idx: number) => (
                        <span key={idx} className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-[#F0F4FA] text-[#0C1A2E] border border-[#CBD8E8]">
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
