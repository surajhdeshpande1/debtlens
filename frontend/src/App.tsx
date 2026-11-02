import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
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

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">

      {/* Top Navigation */}
      <Navbar
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
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">

        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          openIncidentsCount={summary?.open_incidents}
          breakevenDebtCount={summary?.past_breakeven_count}
          regressionsCount={summary?.regressions_detected}
        />

        {/* Main Content Pane */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <Dashboard
              summary={summary}
              onNavigateTab={setCurrentTab}
              onOpenReportModal={() => setIsIncidentModalOpen(true)}
            />
          )}

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

          {currentTab === 'debt' && (
            <DebtRegistryPage
              projectId={activeProjectId}
              onOpenDebtModal={() => {
                setDebtModalInitialData(null);
                setIsDebtModalOpen(true);
              }}
            />
          )}

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

          {currentTab === 'optimiser' && (
            <RemediationOptimiserPage
              projectId={activeProjectId}
            />
          )}

          {currentTab === 'knowledge' && (
            <KnowledgeReportsPage
              projectId={activeProjectId}
            />
          )}
        </main>

      </div>

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
