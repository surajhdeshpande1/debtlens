import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  GitFork, 
  Coins, 
  Calculator, 
  GitBranch, 
  Sparkles, 
  BookOpen 
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { NavTab } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { IncidentsPage } from './pages/IncidentsPage';
import { CausalAnalysisPage } from './pages/CausalAnalysisPage';
import { DebtRegistryPage } from './pages/DebtRegistryPage';
import { RepoEvidencePage } from './pages/RepoEvidencePage';
import { IntelligencePage } from './pages/IntelligencePage';
import { RemediationOptimiserPage } from './pages/RemediationOptimiserPage';
import { KnowledgeReportsPage } from './pages/KnowledgeReportsPage';
import { JudgeSpotlightDemoPage } from './pages/JudgeSpotlightDemoPage';
import { IncidentModal } from './components/IncidentModal';
import { DebtModal } from './components/DebtModal';
import { CommandPalette } from './components/CommandPalette';
import { ExecutiveDashboardSummary, UserRole, DebtCategory } from './types';
import { api } from './services/api';
import { ToastProvider, useToast } from './context/ToastContext';

const MainAppContent: React.FC = () => {
  const { showToast } = useToast();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('tech_lead');
  const [activeProjectId] = useState<number>(1);
  const [summary, setSummary] = useState<ExecutiveDashboardSummary | null>(null);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [debtModalInitialData, setDebtModalInitialData] = useState<{
    title?: string;
    description?: string;
    category?: DebtCategory;
    module_name?: string;
    effort_principal?: number;
    root_cause_id?: number;
    linked_incident_id?: number;
  } | null>(null);

  const fetchSummary = async () => {
    try {
      const data = await api.getDashboardSummary(activeProjectId);
      setSummary(data);
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [activeProjectId]);

  // Ensure website always starts clean on home dashboard
  useEffect(() => {
    if (window.location.hash === '#demo') {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  }, []);

  const handleLaunchDemo = () => {
    setCurrentTab('demo');
    showToast('info', 'Live Demo Mode Active', '1-Click step through the live enterprise pipeline.');
  };

  const handleExitDemo = () => {
    setCurrentTab('dashboard');
    if (window.location.hash === '#demo') {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  };

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleCreateIncident = async (payload: any) => {
    await api.createIncident(payload);
    await fetchSummary();
  };

  const handleCreateDebt = async (payload: any) => {
    await api.createDebtItem(payload);
    await fetchSummary();
  };

  const handleOpenIncidentToDebt = (data: {
    title: string;
    description: string;
    module_name: string;
    effort_principal: number;
    linked_incident_id: number;
  }) => {
    setDebtModalInitialData({
      title: data.title,
      description: data.description,
      module_name: data.module_name,
      effort_principal: data.effort_principal,
      linked_incident_id: data.linked_incident_id,
      category: 'ARCHITECTURAL'
    });
    setIsDebtModalOpen(true);
  };

  const handleOpenCauseToDebt = (cause: { id: number; description: string; category: string }) => {
    setDebtModalInitialData({
      title: `Eliminate systemic root cause: ${cause.description}`,
      description: `Architectural refactoring to eliminate recurring failure mechanism in category ${cause.category}.`,
      root_cause_id: cause.id,
      category: 'ARCHITECTURAL',
      effort_principal: 16.0
    });
    setIsDebtModalOpen(true);
  };

  if (currentTab === 'demo') {
    return (
      <JudgeSpotlightDemoPage
        onExitDemo={handleExitDemo}
        onNavigateTab={(tab) => {
          setCurrentTab(tab);
          if (window.location.hash === '#demo') {
            history.pushState("", document.title, window.location.pathname + window.location.search);
          }
        }}
      />
    );
  }

  const isIncidentsGroup = currentTab === 'incidents' || currentTab === 'causal';
  const isDebtGroup = currentTab === 'debt' || currentTab === 'optimiser';
  const isIntelligenceGroup = currentTab === 'intelligence' || currentTab === 'repository' || currentTab === 'knowledge';

  return (
    <div className="min-h-screen bg-[#F9F8F5] text-[#0A2E23] flex flex-col font-sans selection:bg-[#064E3B] selection:text-white">

      {/* Top Executive Cockpit Navigation (Single Sleek Bar) */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentRole={currentRole}
        setCurrentRole={(role) => {
          setCurrentRole(role);
          showToast('info', 'RBAC Role Switched', `Active permissions set to: ${role.toUpperCase()}`);
        }}
        activeProjectId={activeProjectId}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onLaunchDemo={handleLaunchDemo}
        onRefreshData={() => {
          fetchSummary();
          showToast('success', 'Data Synchronized', 'Telemetry and economic models refreshed.');
        }}
        openIncidentsCount={summary?.open_incidents}
        breakevenDebtCount={summary?.past_breakeven_count}
        regressionsCount={summary?.regressions_detected}
      />

      {/* Main Expansive Full-Width Canvas - Optimized for 100% Zoom */}
      <main className="flex-1 max-w-[1640px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 min-w-0">
        
        {/* VIEW 1: Executive Balance Sheet */}
        {currentTab === 'dashboard' && (
          <Dashboard
            summary={summary}
            onNavigateTab={setCurrentTab}
            onOpenReportModal={() => setIsIncidentModalOpen(true)}
          />
        )}

        {/* VIEW 2: Incidents & 5-Whys Causal Workspace */}
        {isIncidentsGroup && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E2DA]">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#0A2E23]">
                  Incidents & Causal Graph Workspace
                </h1>
                <p className="text-xs text-stone-600 mt-1 font-medium leading-relaxed">
                  Correlate live production failures with systemic 5-Whys convergence and NetworkX root cause centrality.
                </p>
              </div>

              {/* Luxury Segmented Pill Switcher */}
              <div className="flex items-center space-x-1.5 p-1 bg-white rounded-md border border-[#E5E2DA] shadow-2xs self-start sm:self-auto shrink-0">
                <button
                  onClick={() => setCurrentTab('incidents')}
                  className={`h-9 px-4 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'incidents'
                      ? 'bg-[#064E3B] text-white shadow-xs font-bold'
                      : 'text-stone-600 hover:text-[#0A2E23] hover:bg-[#F9F8F5]'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Production Incidents</span>
                  {summary?.open_incidents ? (
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-xs border ${
                      currentTab === 'incidents' ? 'bg-white/20 text-white border-white/30' : 'bg-[#FDF2F4] text-[#881337] border-[#F8D2DB]'
                    }`}>
                      {summary.open_incidents} Open
                    </span>
                  ) : null}
                </button>
                <button
                  onClick={() => setCurrentTab('causal')}
                  className={`h-9 px-4 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'causal'
                      ? 'bg-[#064E3B] text-white shadow-xs font-bold'
                      : 'text-stone-600 hover:text-[#0A2E23] hover:bg-[#F9F8F5]'
                  }`}
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>5-Whys Causal Graph</span>
                </button>
              </div>
            </div>

            {currentTab === 'incidents' && (
              <IncidentsPage
                projectId={activeProjectId}
                onOpenReportModal={() => setIsIncidentModalOpen(true)}
                onConvertIncidentToDebt={handleOpenIncidentToDebt}
              />
            )}

            {currentTab === 'causal' && (
              <CausalAnalysisPage
                projectId={activeProjectId}
                onConvertCauseToDebt={handleOpenCauseToDebt}
              />
            )}
          </div>
        )}

        {/* VIEW 3: Technical Debt Ledger & 0/1 Knapsack Solver Workspace */}
        {isDebtGroup && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E2DA]">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#0A2E23]">
                  Technical Debt & Payoff Solver Workspace
                </h1>
                <p className="text-xs text-stone-600 mt-1 font-medium leading-relaxed">
                  Quantify compounding capital drag I(d) and compute mathematically optimal remediation packages via bounded 0/1 knapsack dynamic programming.
                </p>
              </div>

              {/* Luxury Segmented Pill Switcher */}
              <div className="flex items-center space-x-1.5 p-1 bg-white rounded-md border border-[#E5E2DA] shadow-2xs self-start sm:self-auto shrink-0">
                <button
                  onClick={() => setCurrentTab('debt')}
                  className={`h-9 px-4 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'debt'
                      ? 'bg-[#064E3B] text-white shadow-xs font-bold'
                      : 'text-stone-600 hover:text-[#0A2E23] hover:bg-[#F9F8F5]'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Technical Debt Ledger</span>
                  {summary?.past_breakeven_count ? (
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-xs border ${
                      currentTab === 'debt' ? 'bg-white/20 text-white border-white/30' : 'bg-[#FDF2F4] text-[#881337] border-[#F8D2DB]'
                    }`}>
                      {summary.past_breakeven_count} Drag
                    </span>
                  ) : null}
                </button>
                <button
                  onClick={() => setCurrentTab('optimiser')}
                  className={`h-9 px-4 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'optimiser'
                      ? 'bg-[#064E3B] text-white shadow-xs font-bold'
                      : 'text-stone-600 hover:text-[#0A2E23] hover:bg-[#F9F8F5]'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>0/1 Knapsack Payoff Optimiser</span>
                </button>
              </div>
            </div>

            {currentTab === 'debt' && (
              <DebtRegistryPage
                projectId={activeProjectId}
                onOpenDebtModal={() => {
                  setDebtModalInitialData(null);
                  setIsDebtModalOpen(true);
                }}
              />
            )}

            {currentTab === 'optimiser' && (
              <RemediationOptimiserPage
                projectId={activeProjectId}
              />
            )}
          </div>
        )}

        {/* VIEW 4: Code Evidence & Academic Defense Workspace */}
        {isIntelligenceGroup && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E2DA]">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#0A2E23]">
                  Code Evidence & Viva Defense Workspace
                </h1>
                <p className="text-xs text-stone-600 mt-1 font-medium leading-relaxed">
                  AST syntactic complexity hotspots, self-admitted debt markers, hybrid NLP regression detection, and academic Viva Voce defense.
                </p>
              </div>

              {/* Luxury Segmented Pill Switcher */}
              <div className="flex items-center space-x-1.5 p-1 bg-white rounded-md border border-[#E5E2DA] shadow-2xs self-start sm:self-auto overflow-x-auto shrink-0 no-scrollbar">
                <button
                  onClick={() => setCurrentTab('repository')}
                  className={`h-9 px-4 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'repository'
                      ? 'bg-[#064E3B] text-white shadow-xs font-bold'
                      : 'text-stone-600 hover:text-[#0A2E23] hover:bg-[#F9F8F5]'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>AST Hotspots & SATD</span>
                </button>
                <button
                  onClick={() => setCurrentTab('intelligence')}
                  className={`h-9 px-4 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'intelligence'
                      ? 'bg-[#064E3B] text-white shadow-xs font-bold'
                      : 'text-stone-600 hover:text-[#0A2E23] hover:bg-[#F9F8F5]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Incident Intelligence NLP</span>
                </button>
                <button
                  onClick={() => setCurrentTab('knowledge')}
                  className={`h-9 px-4 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'knowledge'
                      ? 'bg-[#064E3B] text-white shadow-xs font-bold'
                      : 'text-stone-600 hover:text-[#0A2E23] hover:bg-[#F9F8F5]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Viva Voce Defense</span>
                </button>
              </div>
            </div>

            {currentTab === 'repository' && (
              <RepoEvidencePage
                projectId={activeProjectId}
              />
            )}

            {currentTab === 'intelligence' && (
              <IntelligencePage
                projectId={activeProjectId}
              />
            )}

            {currentTab === 'knowledge' && (
              <KnowledgeReportsPage
                projectId={activeProjectId}
              />
            )}
          </div>
        )}

      </main>

      {/* Incident Intake Modal */}
      <IncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        onSubmit={handleCreateIncident}
        projectId={activeProjectId}
      />

      {/* Debt Registration Modal */}
      <DebtModal
        isOpen={isDebtModalOpen}
        onClose={() => {
          setIsDebtModalOpen(false);
          setDebtModalInitialData(null);
        }}
        onSubmit={handleCreateDebt}
        projectId={activeProjectId}
        initialData={debtModalInitialData}
      />

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={setCurrentTab}
        onOpenIncidentModal={() => setIsIncidentModalOpen(true)}
        onOpenDebtModal={() => {
          setDebtModalInitialData(null);
          setIsDebtModalOpen(true);
        }}
        onDownloadPdf={() => api.downloadPdfReport(activeProjectId)}
        onReloadSeed={async () => {
          await api.reloadSeedData();
          await fetchSummary();
        }}
        projectId={activeProjectId}
      />

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <MainAppContent />
    </ToastProvider>
  );
};

export default App;
