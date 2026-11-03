import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Flame, 
  Search, 
  Layers, 
  FileCode, 
  RefreshCw, 
  AlertTriangle,
  Tag,
  ArrowRight,
  Code2,
  Play,
  Sparkles,
  CheckCircle2,
  Info
} from 'lucide-react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { HotspotItem, SelfAdmittedDebtItem } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface RepoEvidencePageProps {
  projectId: number;
}

const PRESET_SNIPPETS = [
  {
    name: 'Payment Retry (High CC + SATD)',
    badge: 'CC: 14',
    code: `def process_payment_retry(order, gateway_client, user_session):
    # TODO: Migrate synchronous retry to background Celery queue
    # FIXME: Race condition when double clicking checkout
    if not order or not user_session:
        return {"status": "FAILED", "code": 400}
    
    attempts = 0
    while attempts < 3:
        try:
            if order.amount > 50000 and not user_session.is_2fa_verified:
                # HACK: Bypass threshold for VIP enterprise accounts
                if user_session.role == "VIP":
                    pass
                else:
                    return {"status": "REQUIRES_2FA"}
            
            res = gateway_client.charge(order.id, order.amount)
            if res.is_success and res.auth_code is not None:
                order.mark_as_paid()
                return {"status": "SUCCESS"}
            elif res.is_declined or res.insufficient_funds:
                return {"status": "DECLINED"}
        except Exception:
            attempts += 1
            if attempts == 3:
                # BUG: Socket left unclosed on terminal retry
                raise RuntimeError("Gateway timeout")
    return {"status": "ERROR"}
`
  },
  {
    name: 'Clean Helper Service',
    badge: 'CC: 2',
    code: `def format_currency(amount: float, currency_code: str = "USD") -> str:
    """Format numeric amount into standardized ISO currency string."""
    if amount is None or amount < 0:
        return "$0.00"
    return f"{currency_code} {amount:,.2f}"
`
  },
  {
    name: 'Nested Monolith Engine',
    badge: 'CC: 22',
    code: `def reconcile_settlement_batch(batch_records, ledger_store, auditor):
    # TODO: Refactor this 4-level nested monster into modular strategies
    # FIXME: High memory usage when batch size > 10,000 records
    # HACK: Hardcoded tax exemption for region 4
    for record in batch_records:
        if record.is_valid and not record.is_archived:
            for item in record.sub_items:
                if item.settlement_status == "PENDING":
                    if item.tax_exempt or item.region_id == 4:
                        rate = 0.0
                    else:
                        rate = 0.18 if item.amount > 1000 else 0.12
                    
                    try:
                        ledger_store.post_entry(item.id, item.amount * (1 + rate))
                    except Exception:
                        auditor.flag_discrepancy(item.id)
                elif item.settlement_status == "REJECTED":
                    auditor.log_rejection(item.id)
    return True
`
  }
];

export const RepoEvidencePage: React.FC<RepoEvidencePageProps> = ({ projectId }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'matrix' | 'playground'>('matrix');
  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [satdItems, setSatdItems] = useState<SelfAdmittedDebtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [filterMarker, setFilterMarker] = useState('ALL');

  // AST Playground State
  const [snippetCode, setSnippetCode] = useState(`def process_payment_batch(transactions, max_retries=3):
    # TODO: replace synchronous retry with exponential backoff and jitter
    successful = []
    failed = []
    for tx in transactions:
        # FIXME: connection pool leak if exception occurs here
        if tx.get("amount", 0) > 0 and tx.get("currency") == "USD":
            if tx.get("is_authorized") and not tx.get("is_settled"):
                try:
                    res = execute_settlement(tx)
                    if res.status == 200:
                        successful.append(tx)
                    elif res.status == 429 or res.status >= 500:
                        # HACK: fast failover to legacy backup gateway
                        failed.append(tx)
                except Exception as err:
                    failed.append(tx)
            elif tx.get("fraud_score", 0) > 85:
                # BUG: duplicate alert raised if webhook retries
                flag_fraud(tx)
        else:
            failed.append(tx)
    return {"settled": len(successful), "failed": len(failed)}
`);
  const [isAnalyzingSnippet, setIsAnalyzingSnippet] = useState(false);
  const [snippetResult, setSnippetResult] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hot, satd] = await Promise.all([
        api.getHotspots(projectId),
        api.getSATD(projectId, filterMarker)
      ]);
      setHotspots(hot);
      setSatdItems(satd);
    } catch (err) {
      console.error(err);
      showToast('error', 'Error', 'Failed to retrieve repository evidence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId, filterMarker]);

  const handleScanWorkspace = async () => {
    try {
      setIsScanning(true);
      await api.scanWorkspace(projectId);
      await fetchData();
      showToast('success', 'Workspace Scanned', 'AST complexity, churn metrics, and SATD updated successfully.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Scan Failed', 'Could not scan workspace codebase.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAnalyzeSnippet = async (codeToAnalyze?: string) => {
    const code = typeof codeToAnalyze === 'string' ? codeToAnalyze : snippetCode;
    try {
      setIsAnalyzingSnippet(true);
      const res = await api.analyzeSnippet(code, 'python');
      setSnippetResult(res);
      showToast('success', 'AST Analysis Complete', `McCabe Cyclomatic Complexity: ${res.cyclomatic_complexity}`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Analysis Error', 'Failed to parse code snippet AST.');
    } finally {
      setIsAnalyzingSnippet(false);
    }
  };

  const handleSelectPreset = (code: string) => {
    setSnippetCode(code);
    handleAnalyzeSnippet(code);
  };

  const scatterData = hotspots.map(h => ({
    name: h.file_path,
    churn: h.churn_count,
    complexity: h.cyclomatic_complexity,
    risk: h.risk_score,
    module: h.module_name,
    blastRadius: h.blast_radius
  }));

  const markerColor = (marker: string) => {
    switch (marker.toUpperCase()) {
      case 'FIXME':
      case 'BUG':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HACK':
      case 'WORKAROUND':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'TODO':
      case 'OPTIMIZE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Repository Evidence & Static Code Hotspots</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold font-mono">
              Module M5
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Deriving code churn, McCabe cyclomatic complexity, transitive blast radius via DFS, and self-admitted debt markers (SATD)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sub-tab toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'matrix' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Repository Matrix
            </button>
            <button
              onClick={() => {
                setActiveTab('playground');
                if (!snippetResult) handleAnalyzeSnippet();
              }}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1 cursor-pointer ${
                activeTab === 'playground' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>AST Code Playground</span>
            </button>
          </div>

          <button
            onClick={handleScanWorkspace}
            disabled={isScanning}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Scan Repo'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'matrix' ? (
        <>
          {/* Churn vs Complexity Matrix Scatter Plot */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Code Churn vs. Cyclomatic Complexity Hotspots</h3>
                <p className="text-xs text-slate-500">High Churn + High Complexity files indicate severe architectural risk hotspots</p>
              </div>
              <span className="text-xs font-mono text-slate-400">McCabe AST Visitor</span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis 
                    type="number" 
                    dataKey="churn" 
                    name="Code Churn (Edits)" 
                    unit=" edits"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="complexity" 
                    name="Cyclomatic Complexity" 
                    unit=" CC"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <ZAxis type="number" dataKey="risk" range={[60, 400]} name="Risk Score" />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-lg text-xs space-y-1">
                            <div className="font-bold text-slate-900 font-mono">{data.name}</div>
                            <div className="text-slate-500">Module: <span className="font-semibold text-slate-700">{data.module}</span></div>
                            <div className="text-slate-500">Cyclomatic Complexity: <span className="font-semibold text-slate-700">{data.complexity}</span></div>
                            <div className="text-slate-500">Churn Count: <span className="font-semibold text-slate-700">{data.churn}</span></div>
                            <div className="text-indigo-600 font-bold">Composite Risk: {data.risk}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter name="Files" data={scatterData} fill="#4F46E5" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two Columns: Hotspot Files Table + Self-Admitted Debt (SATD) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Hotspots Table */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-900">Risk-Ranked Hotspot Files</h3>
                <span className="text-[11px] text-slate-400 font-mono">Ranked by (CC×1.8 + Churn×0.25)</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {hotspots.map((h) => (
                  <div key={h.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center space-x-2">
                        <FileCode className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-mono font-bold text-slate-900 truncate">{h.file_path}</span>
                      </div>
                      <div className="mt-1 flex items-center space-x-3 text-[11px] text-slate-500 font-mono">
                        <span>Module: {h.module_name}</span>
                        <span>•</span>
                        <span>Blast Radius: {h.blast_radius}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-indigo-600">{h.risk_score}</div>
                      <div className="text-[10px] text-slate-400">CC: {h.cyclomatic_complexity} | Churn: {h.churn_count}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Self-Admitted Technical Debt (SATD) Table */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900">Self-Admitted Debt (SATD)</h3>
                </div>
                
                <select
                  value={filterMarker}
                  onChange={(e) => setFilterMarker(e.target.value)}
                  className="text-[11px] px-2 py-0.5 rounded-md border border-slate-200 bg-white cursor-pointer"
                >
                  <option value="ALL">All Markers</option>
                  <option value="TODO">TODO</option>
                  <option value="FIXME">FIXME</option>
                  <option value="HACK">HACK</option>
                  <option value="BUG">BUG</option>
                  <option value="DEPRECATED">DEPRECATED</option>
                </select>
              </div>

              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {satdItems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No SATD comment markers found matching filter.
                  </div>
                ) : (
                  satdItems.map((s) => (
                    <div key={s.id} className="p-3 hover:bg-slate-50 transition-colors text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded-sm border ${markerColor(s.marker_type)}`}>
                          {s.marker_type}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          Line {s.line_number} • {s.module_name}
                        </span>
                      </div>

                      <p className="text-slate-700 font-medium text-[11px] leading-snug">
                        "{s.comment_text}"
                      </p>

                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {s.file_path}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      ) : (
        /* AST Code Playground */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Code Editor Column */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900">Python Source Code Input</h3>
              </div>

              <button
                onClick={() => handleAnalyzeSnippet()}
                disabled={isAnalyzingSnippet}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isAnalyzingSnippet ? 'Analyzing AST...' : 'Analyze AST & SATD'}</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Presets:</span>
              {PRESET_SNIPPETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPreset(preset.code)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>{preset.name}</span>
                  <span className="font-mono text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded-sm border border-indigo-200">
                    {preset.badge}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-3">
              <textarea
                rows={16}
                value={snippetCode}
                onChange={(e) => setSnippetCode(e.target.value)}
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 bg-slate-900 text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>
          </div>

          {/* AST Results Column */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900">AST Control-Flow Telemetry</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">McCabe AST NodeVisitor</span>
            </div>

            {snippetResult ? (
              <div className="space-y-4 text-xs">
                {/* Software Complexity & Maintainability Metrics Row */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Cyclomatic (CC)</div>
                    <div className="text-2xl font-extrabold font-mono text-indigo-600 mt-0.5">
                      {snippetResult.cyclomatic_complexity}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">McCabe V(G)</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Cognitive</div>
                    <div className="text-2xl font-extrabold font-mono text-amber-600 mt-0.5">
                      {snippetResult.cognitive_complexity ?? snippetResult.cyclomatic_complexity}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">Nesting Penalty</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Maintainability (MI)</div>
                    <div className={`text-2xl font-extrabold font-mono mt-0.5 ${
                      (snippetResult.maintainability_index ?? 75) >= 65 ? 'text-emerald-600' :
                      (snippetResult.maintainability_index ?? 75) >= 40 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {snippetResult.maintainability_index ? `${snippetResult.maintainability_index}%` : '74.2%'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">SEI / ISO Index</div>
                  </div>
                </div>

                {/* Halstead Metrics Grid (if present) */}
                {snippetResult.halstead && (
                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-bold text-slate-800 text-[11px] flex items-center justify-between">
                      <span>Halstead Software Science Metrics:</span>
                      <span className="font-mono text-[10px] text-slate-400">Vocabulary: {snippetResult.halstead.vocabulary}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                      <div className="p-1.5 bg-white rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9px]">Volume</span>
                        <strong className="text-slate-800">{snippetResult.halstead.volume}</strong>
                      </div>
                      <div className="p-1.5 bg-white rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9px]">Difficulty</span>
                        <strong className="text-slate-800">{snippetResult.halstead.difficulty}</strong>
                      </div>
                      <div className="p-1.5 bg-white rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9px]">Effort</span>
                        <strong className="text-slate-800">{snippetResult.halstead.effort}</strong>
                      </div>
                      <div className="p-1.5 bg-white rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9px]">Est. Bugs</span>
                        <strong className="text-rose-600">{snippetResult.halstead.estimated_bugs}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Branch Breakdown Table */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-800 text-[11px]">Branch & Operator Breakdown:</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Conditional Branches (if/elif):</span>
                      <strong className="block text-slate-900 font-mono mt-0.5">{snippetResult.branch_breakdown.if_branches}</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Loop Statements (for/while):</span>
                      <strong className="block text-slate-900 font-mono mt-0.5">{snippetResult.branch_breakdown.loops}</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Exception Blocks (try/except):</span>
                      <strong className="block text-slate-900 font-mono mt-0.5">{snippetResult.branch_breakdown.exception_handlers}</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-500">Boolean Operators (and/or):</span>
                      <strong className="block text-slate-900 font-mono mt-0.5">{snippetResult.branch_breakdown.boolean_conditions}</strong>
                    </div>
                  </div>
                </div>

                {/* Detected SATD Markers in snippet */}
                <div>
                  <div className="font-bold text-slate-800 text-[11px] mb-1.5 flex items-center justify-between">
                    <span>Self-Admitted Debt Markers Detected:</span>
                    <span className="font-mono text-indigo-600 font-bold">{snippetResult.satd_markers.length} found</span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {snippetResult.satd_markers.map((m: any, idx: number) => (
                      <div key={idx} className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-mono font-bold text-[9px] px-1.5 py-0.2 rounded-sm border ${markerColor(m.marker_type)}`}>
                            {m.marker_type}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">Line {m.line_number}</span>
                        </div>
                        <div className="text-slate-700 italic">"{m.comment_text}"</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation */}
                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <Info className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Engineering Recommendation:</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    {snippetResult.recommendation}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Click "Analyze AST & SATD" to inspect this snippet.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
