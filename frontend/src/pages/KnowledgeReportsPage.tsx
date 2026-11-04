import React, { useState } from 'react';
import { 
  BookOpen, 
  FileDown, 
  Award, 
  Search, 
  CheckCircle2, 
  Building2, 
  Users, 
  ShieldCheck,
  FileText,
  HelpCircle,
  GraduationCap,
  BookmarkCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../services/api';
import { Incident } from '../types';
import { useToast } from '../context/ToastContext';
import { IncidentReportModal } from '../components/IncidentReportModal';

interface KnowledgeReportsPageProps {
  projectId: number;
}

export const KnowledgeReportsPage: React.FC<KnowledgeReportsPageProps> = ({ projectId }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'articles' | 'viva'>('articles');
  const [isDownloading, setIsDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedViva, setExpandedViva] = useState<number | null>(0);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportIncident, setReportIncident] = useState<Incident | null>(null);

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      await api.downloadPdfReport(projectId);
      showToast('success', 'PDF Export Complete', 'Downloaded DebtLens Technical Audit Report.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Export Failed', 'Could not generate PDF report.');
    } finally {
      setIsDownloading(false);
    }
  };

  const articles = [
    {
      id: 1,
      title: 'Post-Mortem: INC-101 Stripe Webhook Timeout Spike',
      module: 'payments',
      rootCause: 'Connection Pool Exhaustion under Unbounded Waiting',
      lesson: 'Never permit unbounded socket wait times in webhook listeners. Deploy adaptive pool sizing and return 202 Accepted before queuing work asynchronously.',
      author: 'Sushma Hiremath'
    },
    {
      id: 2,
      title: 'Architecture Decision Record: Distributed Idempotency (DEBT-102)',
      module: 'orders',
      rootCause: 'Missing Distributed Idempotency Key in Transaction API',
      lesson: 'Mandate client idempotency keys on all state-mutating payment and checkout endpoints. Cache responses in Redis with 24-hour sliding TTL.',
      author: 'Suraj Deshpande'
    },
    {
      id: 3,
      title: 'Database Capacity Guideline: Monthly Ledger Partitioning',
      module: 'settlement',
      rootCause: 'Unindexed Large Table Scans during Batch Settlement',
      lesson: 'Batch reconciliation must operate over partitioned PostgreSQL tables with compound index on (tenant_id, settlement_date, status) to prevent 4-hour sequential table scans.',
      author: 'Sushma Patil'
    },
    {
      id: 4,
      title: 'Resilience Standard: Circuit Breaker Deployment (DEBT-103)',
      module: 'checkout',
      rootCause: 'Missing Circuit Breaker and Cascading Failure Protection',
      lesson: 'All external third-party calls (Avalara, Tax, Geolocation) must execute behind a Resilience4j circuit breaker with 2s timeout and static fallback.',
      author: 'Sushma Mathapati'
    }
  ];

  const vivaQuestions = [
    {
      q: 'Why did DebtLens model 5-Whys as a reusable directed graph instead of a flat ticket tree?',
      a: 'In real-world software, distinct incidents across different microservices frequently originate from the exact same systemic weakness (e.g. database pool exhaustion). By modeling cause answers as reusable nodes in a directed graph, the network converges over time, allowing NetworkX Betweenness Centrality and Degree Centrality to mathematically uncover the most influential root causes.'
    },
    {
      q: 'Explain why 0/1 Knapsack Dynamic Programming is used over a greedy sorting strategy.',
      a: 'A naive greedy approach sorting by ROI (Risk Reduction / Principal) fails because technical debt items are discrete (you cannot refactor half a connection pool) and items possess prerequisite constraints (e.g. read replicas require the connection pool refactor first). 0/1 Knapsack DP over a topologically sorted graph guarantees a mathematically optimal subset within the sprint budget constraint B.'
    },
    {
      q: 'How is accrued debt interest I(d) calculated, and what do λ₁ and λ₂ signify?',
      a: 'Accrued interest represents the actual historical drag inflicted on the team: I(d) = Σ [sev(k) · effort(k)] + λ₁·churn(d) + λ₂·blast_radius(d). λ₁ (0.15) weights the commit churn pressure of the files, while λ₂ (1.8) weights the structural blast radius: the number of modules transitively dependent on that module determined via DFS traversal of the dependency graph.'
    },
    {
      q: 'What is a "Break-Even" debt item, and why is it crucial for engineering negotiation?',
      a: 'A debt item is past break-even when I(d) > P(d). It proves objectively that the engineering team has already expended more hours patching incidents caused by the defect than it would cost to permanently repair it. This converts technical debt from an intuitive opinion into an evidence-backed financial justification during sprint planning.'
    },
    {
      q: 'How does the Hybrid Incident Similarity engine work on CPU without large GPU models?',
      a: 'The similarity formula sim(i, j) = α · cos(tfidf_i, tfidf_j) + (1 - α) · cos(emb_i, emb_j) balances TF-IDF lexical frequency with character/subword n-gram morphological embeddings. This achieves robust semantic generalization across technical terms without requiring network access or heavy PyTorch GPU dependencies.'
    },
    {
      q: 'What are the 5 foundational literature survey papers grounding DebtLens?',
      a: '1. Potdar & Shihab (IEEE 2014) on Self-Admitted Technical Debt (SATD); 2. Lenarduzzi et al. (JSS 2021) on Technical Debt Prioritization gaps; 3. Ampatzoglou et al. (IST 2020) on Principal and Interest relationships; 4. Tornhill & Borg (TechDebt 2022) validating code churn and complexity as defect proxies; 5. Laney et al. (2025) on threshold-based duplicate defect retrieval.'
    }
  ];

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.lesson.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Knowledge Base & Academic Evaluation Guide</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold font-mono">
              Module M8
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Searchable historical incident post-mortems, formal PDF audit reports, and viva defense evaluation guide
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sub-tab toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('articles')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'articles' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Post-Mortems
            </button>
            <button
              onClick={() => setActiveTab('viva')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1 cursor-pointer ${
                activeTab === 'viva' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Viva Voce Defense Q&A</span>
            </button>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Generating...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* College Project Endorsement Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
              Basaveshwar Engineering College Bagalkote
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Department of Information Science & Engineering
            </h3>
            <p className="text-xs text-slate-500">
              5th Semester Mini Project (BISA531P) • Academic Year 2026-27
            </p>
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900">
            <div className="text-[10px] font-bold uppercase text-indigo-500">Project Guide</div>
            <div className="font-bold text-sm">Prof. P. R. Muttannavar</div>
            <div className="text-[11px] text-indigo-700">Dept. of ISE, BEC Bagalkote</div>
          </div>
        </div>

        {/* Project Associates */}
        <div className="pt-4">
          <div className="text-xs font-bold text-slate-900 mb-3 flex items-center space-x-1.5">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Project Associates</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { name: 'Suraj H Deshpande', usn: '2BA24IS171', role: 'System Architecture & Algorithms' },
              { name: 'Sushma Hiremath', usn: '2BA24IS172', role: 'Causal Graph & Centrality Engine' },
              { name: 'Sushma K Patil', usn: '2BA24IS173', role: 'Repository Evidence & Hotspots' },
              { name: 'Sushma Mathapati', usn: '2BA24IS174', role: 'Payoff 0/1 Knapsack & Reporting' },
            ].map((student) => (
              <div key={student.usn} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-slate-900">{student.name}</div>
                <div className="font-mono text-indigo-600 text-[11px] font-semibold">{student.usn}</div>
                <div className="text-[10px] text-slate-400 mt-1">{student.role}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'articles' ? (
        /* Searchable Knowledge Base */
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Post-Mortems & Architectural Lessons Learned</h3>
              <p className="text-xs text-slate-500">Preserved technical reasoning connecting failure symptoms to verified repairs</p>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search post-mortems..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((art) => (
              <div key={art.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {art.module}
                  </span>
                  <span className="text-[10px] text-slate-400">By {art.author}</span>
                </div>

                <h4 className="font-bold text-slate-900 leading-snug">
                  {art.title}
                </h4>

                <div className="text-[11px] text-slate-500">
                  Root Cause: <strong className="text-slate-700">{art.rootCause}</strong>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 leading-relaxed text-[11px]">
                  {art.lesson}
                </div>

                <button
                  onClick={() => {
                    setReportIncident({
                      id: art.id,
                      project_id: projectId,
                      incident_number: `INC-${100 + art.id}`,
                      title: art.title,
                      description: art.lesson,
                      affected_module: art.module,
                      affected_component: `${art.module}_core_service`,
                      severity: 'HIGH',
                      status: 'RESOLVED',
                      resolution_effort_hours: 6.5,
                      reported_at: '2026-10-24T14:30:00Z',
                      resolved_at: '2026-10-24T21:00:00Z'
                    });
                    setIsReportModalOpen(true);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-900 font-bold text-[11px] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer mt-2"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Display 8-Section Incident Post-Mortem</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Viva Voce Defense Guide */
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Viva-Voce Evaluation & Algorithm Defense Q&A</h3>
              <p className="text-xs text-slate-500">Key theoretical, mathematical, and algorithmic questions for mini project defense</p>
            </div>
          </div>

          <div className="space-y-3">
            {vivaQuestions.map((item, idx) => {
              const isExpanded = expandedViva === idx;
              return (
                <div 
                  key={idx}
                  className="rounded-xl border border-slate-200 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setExpandedViva(isExpanded ? null : idx)}
                    className="w-full p-4 text-left bg-slate-50/70 hover:bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-900 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <span className="font-mono text-indigo-600">Q{idx + 1}:</span>
                      <span>{item.q}</span>
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-white text-xs text-slate-700 leading-relaxed border-t border-slate-100 animate-in fade-in duration-150">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comprehensive 8-Section Incident Report Modal (Exact Correct Order) */}
      <IncidentReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        incident={reportIncident}
      />

    </div>
  );
};
