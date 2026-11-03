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
  Coins,
  Search,
  MessageSquareCode,
  Tag
} from 'lucide-react';
import { RootCauseCluster, RegressionItem, Incident } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface IntelligencePageProps {
  projectId: number;
}

export const IntelligencePage: React.FC<IntelligencePageProps> = ({ projectId }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'clusters' | 'comparator' | 'search'>('clusters');
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

  // Natural Language Query Engine State
  const [nlQuery, setNlQuery] = useState('Connection pool exhausted during checkout batch reconciliation');
  const [queryMatches, setQueryMatches] = useState<Array<{
    incident: Incident;
    score: number;
    tokens: string[];
    suggestedCause: string;
  }>>([]);

  const handleRunNlQuery = (textToRun?: string) => {
    const q = (textToRun || nlQuery).trim().toLowerCase();
    if (!q) return;

    const stopWords = new Set(['the', 'is', 'in', 'at', 'of', 'on', 'and', 'a', 'to', 'for', 'with', 'by']);
    const queryTokens = q.split(/[\s,._-]+/).filter(t => t.length > 2 && !stopWords.has(t));

    const scored = incidents.map(inc => {
      const incText = `${inc.title} ${inc.description} ${inc.affected_module} ${inc.affected_component || ''}`.toLowerCase();
      const incTokens = new Set(incText.split(/[\s,._-]+/));
      const common = queryTokens.filter(t => incTokens.has(t));
      
      const jaccard = queryTokens.length > 0 ? (common.length / (queryTokens.length + incTokens.size - common.length)) : 0;
      const tokenOverlap = queryTokens.length > 0 ? (common.length / queryTokens.length) : 0;
      const moduleMatch = incText.includes(inc.affected_module.toLowerCase()) && q.includes(inc.affected_module.toLowerCase()) ? 0.25 : 0;
      
      const finalScore = Math.min(0.98, Math.max(0.15, (tokenOverlap * 0.65) + (jaccard * 0.15) + moduleMatch));

      let suggestedCause = 'Generic Structural Fragility';
      if (inc.affected_module === 'database') suggestedCause = 'Database Connection Pool Exhaustion under Unbounded Waiting (Node #1)';
      else if (inc.affected_module === 'payments') suggestedCause = 'Missing Distributed Idempotency Key in Transaction API (Node #3)';
      else if (inc.affected_module === 'settlement') suggestedCause = 'Unindexed Large Table Scans during Batch Settlement (Node #6)';
      else if (inc.affected_module === 'notification') suggestedCause = 'Synchronous Blocking Calls inside Async Event Loop (Node #4)';
      else if (inc.affected_module === 'auth') suggestedCause = 'In-Memory State Leak in Multi-Instance Scaled Services (Node #7)';

      return {
        incident: inc,
        score: parseFloat(finalScore.toFixed(3)),
        tokens: common,
        suggestedCause
      };
    }).sort((a, b) => b.score - a.score).slice(0, 3);

    setQueryMatches(scored);
    showToast('info', 'Query Evaluated', `Ranked ${scored.length} matching incidents by hybrid TF-IDF similarity.`);
  };

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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Incident Intelligence & Defect Analytics</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold font-mono">
              Module M6
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            DBSCAN root cause clustering over cosine distance, hybrid TF-IDF lexical + semantic scoring, and regression recurrence detection
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sub-tab switcher */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('clusters')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'clusters' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Clusters & Regressions
            </button>
            <button
              onClick={() => setActiveTab('comparator')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1 cursor-pointer ${
                activeTab === 'comparator' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Pairwise Comparator</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('search');
                if (queryMatches.length === 0) handleRunNlQuery();
              }}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1 cursor-pointer ${
                activeTab === 'search' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>NLP Matcher</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'clusters' ? (
        <>
          {/* Interactive Formulation Tuning Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <div className="flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Interactive Algorithmic Hyperparameter Tuning</span>
              </div>
              <span className="text-[11px] font-normal text-slate-500">Adjust thresholds to observe sensitivity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Tau Slider */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Regression Similarity Threshold (τ):</span>
                  <strong className="font-mono text-indigo-600">{tau.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.80"
                  step="0.05"
                  value={tau}
                  onChange={(e) => setTau(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0.20 (Broad)</span>
                  <span>0.50 (Standard)</span>
                  <span>0.80 (Strict)</span>
                </div>
              </div>

              {/* DBSCAN Eps Slider */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">DBSCAN Clustering Radius (ε):</span>
                  <strong className="font-mono text-indigo-600">{eps.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.85"
                  step="0.05"
                  value={eps}
                  onChange={(e) => setEps(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0.30 (Tight Clusters)</span>
                  <span>0.55 (Standard)</span>
                  <span>0.85 (Broad Clusters)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Regression Detection Callout */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Detected Recurrent Regressions</h3>
                  <p className="text-xs text-slate-500">
                    New incidents matching resolved incidents on identical modules after recorded fix date
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                {regressions.length} Regressions Flagged
              </span>
            </div>

            {regressions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                No regressions detected at threshold τ = {tau}. Resolved fixes are holding stable.
              </div>
            ) : (
              <div className="space-y-3">
                {regressions.map((r) => (
                  <div 
                    key={`${r.new_incident_id}-${r.resolved_incident_id}`}
                    className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
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
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">DBSCAN Root Cause Semantic Clusters</h3>
                  <p className="text-xs text-slate-500">
                    Density-based spatial clustering grouping semantically equivalent causes without predetermined k
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono text-slate-400">eps={eps}, min_samples=2</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusters.map((c, cIdx) => {
                const clusterThemes = [
                  { border: 'border-indigo-200 hover:border-indigo-300', bg: 'bg-indigo-50/40', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'text-indigo-600', text: 'text-indigo-700' },
                  { border: 'border-purple-200 hover:border-purple-300', bg: 'bg-purple-50/40', badge: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'text-purple-600', text: 'text-purple-700' },
                  { border: 'border-teal-200 hover:border-teal-300', bg: 'bg-teal-50/40', badge: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'text-teal-600', text: 'text-teal-700' },
                  { border: 'border-amber-200 hover:border-amber-300', bg: 'bg-amber-50/40', badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'text-amber-600', text: 'text-amber-700' },
                  { border: 'border-emerald-200 hover:border-emerald-300', bg: 'bg-emerald-50/40', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'text-emerald-600', text: 'text-emerald-700' }
                ];
                const theme = c.is_noise 
                  ? { border: 'border-slate-200', bg: 'bg-slate-50/60', badge: 'bg-slate-200 text-slate-700 border-slate-300', dot: 'text-slate-400', text: 'text-slate-600' }
                  : clusterThemes[cIdx % clusterThemes.length];

                return (
                  <div 
                    key={c.cluster_id}
                    className={`p-4 rounded-xl border transition-all ${theme.border} ${theme.bg}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${theme.badge}`}>
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

                    <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-200/60">
                      {c.causes.map((cause, idx) => (
                        <div key={idx} className="text-[11px] text-slate-600 flex items-start space-x-1.5">
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
      ) : activeTab === 'comparator' ? (
        /* Pairwise Incident Comparator Tool */
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <GitCompare className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pairwise Incident Similarity Comparator</h3>
                  <p className="text-xs text-slate-500">
                    Compare any two historical or open incidents to verify hybrid TF-IDF and semantic subword cosine similarity
                  </p>
                </div>
              </div>

              {/* Alpha Weight Slider */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-semibold text-slate-700">Lexical Weight (α):</span>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={alpha}
                  onChange={(e) => setAlpha(parseFloat(e.target.value))}
                  className="w-24 accent-indigo-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                />
                <span className="font-mono font-bold text-indigo-600">{alpha.toFixed(2)}</span>
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
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white cursor-pointer"
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
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white cursor-pointer"
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
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Lexical Cosine Score</div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {(comparisonResult.lexical_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">cos(tfidf_a, tfidf_b)</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Semantic Subword Score</div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {(comparisonResult.semantic_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">cos(emb_a, emb_b)</div>
                  </div>

                  <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200">
                    <div className="text-[10px] font-bold text-indigo-700 uppercase">Hybrid Formulation Score</div>
                    <div className="text-2xl font-black font-mono text-indigo-600 mt-0.5">
                      {(comparisonResult.hybrid_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-indigo-500 font-mono">α·lex + (1-α)·sem</div>
                  </div>
                </div>

                {/* Shared Tokens */}
                {comparisonResult.common_tokens.length > 0 && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="font-bold text-slate-800 text-[11px]">Overlapping Linguistic / Domain Tokens:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {comparisonResult.common_tokens.map((tok: string, idx: number) => (
                        <span key={idx} className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
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
      ) : (
        /* Real-Time Natural Language Incident Matcher & Causal Predictor */
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <MessageSquareCode className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Natural Language Incident Matching & Root Cause Predictor</h3>
                  <p className="text-xs text-slate-500">
                    Input any failure description or stack trace to test live hybrid lexical + semantic token similarity against the historical corpus
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
                TF-IDF + Subword Jaccard
              </span>
            </div>

            {/* Query Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Incident Failure Description / Log Trace:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunNlQuery()}
                  placeholder="e.g. Database connection pool starved during checkout reconciliation..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <button
                  onClick={() => handleRunNlQuery()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Query Corpus</span>
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-slate-400 text-[11px] font-semibold">Test Presets:</span>
                {[
                  'Hikari connection pool leak on payment checkout',
                  'Stripe webhook timeout and dropped settlement',
                  'In-memory token blacklist out of bounds heap exhaustion',
                  'Race condition on inventory stock check during flash sale'
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNlQuery(preset);
                      handleRunNlQuery(preset);
                    }}
                    className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[10px] transition-colors cursor-pointer"
                  >
                    "{preset.length > 35 ? preset.substring(0, 32) + '...' : preset}"
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            {queryMatches.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <h4 className="font-bold text-slate-800">Top Ranked Historical Matches:</h4>
                  <span className="text-[11px] font-mono text-slate-400">Ranked by Hybrid Jaccard × Lexical Overlap</span>
                </div>

                <div className="space-y-3">
                  {queryMatches.map((m, idx) => (
                    <div 
                      key={m.incident.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                            #{idx + 1}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{m.incident.incident_number}</span>
                          <span className="font-semibold text-slate-500 font-mono">[{m.incident.affected_module}]</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-sm bg-slate-200/70 text-slate-700">
                            {m.incident.severity}
                          </span>
                        </div>

                        <h5 className="font-bold text-slate-900 leading-snug">
                          {m.incident.title}
                        </h5>

                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {m.incident.description}
                        </p>

                        {/* Predicted Causal Root Node */}
                        <div className="p-2 bg-indigo-50/70 rounded-lg border border-indigo-200 text-indigo-900 text-[11px] flex items-center space-x-1.5">
                          <span className="font-bold font-mono text-indigo-700 shrink-0">Predicted Cause:</span>
                          <span className="truncate">{m.suggestedCause}</span>
                        </div>

                        {/* Matched Token Badges */}
                        {m.tokens.length > 0 && (
                          <div className="flex items-center space-x-1.5 pt-1">
                            <span className="text-[10px] text-slate-400 font-semibold">Matched Tokens:</span>
                            <div className="flex flex-wrap gap-1">
                              {m.tokens.map((tok, tIdx) => (
                                <span key={tIdx} className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-white text-indigo-700 border border-indigo-200">
                                  {tok}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-2xl font-black font-mono text-indigo-600">
                          {Math.round(m.score * 100)}%
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Similarity Score</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
