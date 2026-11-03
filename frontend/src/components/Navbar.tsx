import React, { useState } from 'react';
import { 
  Layers, 
  RotateCcw, 
  FileDown, 
  CheckCircle2, 
  ChevronDown,
  Building,
  Search,
  Sparkles,
  LayoutDashboard,
  AlertCircle,
  GitFork,
  Coins,
  Calculator,
  GitBranch,
  BookOpen
} from 'lucide-react';
import { api } from '../services/api';
import { UserRole } from '../types';
import { NavTab } from './Sidebar';

interface NavbarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  activeProjectId: number;
  onRefreshData: () => void;
  onOpenCommandPalette: () => void;
  onLaunchDemo?: () => void;
  openIncidentsCount?: number;
  breakevenDebtCount?: number;
  regressionsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentRole,
  setCurrentRole,
  activeProjectId,
  onRefreshData,
  onOpenCommandPalette,
  onLaunchDemo,
  openIncidentsCount = 2,
  breakevenDebtCount = 6,
  regressionsCount = 1
}) => {
  const [isReloading, setIsReloading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const handleReloadSeed = async () => {
    if (confirm("Reset and reload the realistic enterprise test corpus?")) {
      try {
        setIsReloading(true);
        await api.reloadSeedData();
        onRefreshData();
      } catch (err) {
        console.error(err);
        alert("Failed to reload seed data");
      } finally {
        setIsReloading(false);
      }
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      await api.downloadPdfReport(activeProjectId);
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF audit report");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const roles: { role: UserRole; label: string; desc: string; initials: string }[] = [
    { role: 'tech_lead', label: 'Tech Lead', desc: 'Sushma Hiremath', initials: 'SH' },
    { role: 'admin', label: 'Admin', desc: 'Suraj Deshpande', initials: 'SD' },
    { role: 'developer', label: 'Developer', desc: 'Sushma Patil', initials: 'SP' },
    { role: 'viewer', label: 'Viewer', desc: 'Sushma Mathapati', initials: 'SM' },
  ];

  const currentRoleObj = roles.find(r => r.role === currentRole) || roles[0];

  const coreNavItems: { 
    id: NavTab; 
    label: string; 
    icon: React.ComponentType<{ className?: string }>; 
    badge?: number; 
    badgeType?: 'danger' | 'warning' | 'info';
    moduleCode: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Executive Overview',
      icon: LayoutDashboard,
      moduleCode: 'M8'
    },
    {
      id: 'incidents',
      label: 'Incident Management',
      icon: AlertCircle,
      badge: openIncidentsCount,
      badgeType: 'warning',
      moduleCode: 'M2'
    },
    {
      id: 'causal',
      label: 'Causal Graph (5 Whys)',
      icon: GitFork,
      moduleCode: 'M3'
    },
    {
      id: 'debt',
      label: 'Technical Debt Ledger',
      icon: Coins,
      badge: breakevenDebtCount,
      badgeType: 'danger',
      moduleCode: 'M4'
    }
  ];

  const remediationNavItems: {
    id: NavTab; 
    label: string; 
    icon: React.ComponentType<{ className?: string }>; 
    badge?: number; 
    badgeType?: 'danger' | 'warning' | 'info';
    moduleCode: string;
  }[] = [
    {
      id: 'optimiser',
      label: 'Payoff Optimiser (0/1)',
      icon: Calculator,
      moduleCode: 'M7'
    },
    {
      id: 'repository',
      label: 'Repository Evidence',
      icon: GitBranch,
      moduleCode: 'M5'
    },
    {
      id: 'intelligence',
      label: 'Incident Intelligence',
      icon: Sparkles,
      badge: regressionsCount > 0 ? regressionsCount : undefined,
      badgeType: 'info',
      moduleCode: 'M6'
    },
    {
      id: 'knowledge',
      label: 'Knowledge & Defense',
      icon: BookOpen,
      moduleCode: 'M8'
    }
  ];

  const getBadgeStyle = (type?: 'danger' | 'warning' | 'info', isActive?: boolean) => {
    if (isActive) {
      return 'bg-white text-slate-900 border-white/80';
    }
    switch (type) {
      case 'danger':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      
      {/* TIER 1: Executive Brand, Search, Telemetry, and Actions */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-3 border-b border-slate-100">
        
        {/* Brand & Workspace Scope */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-900 flex items-center justify-center text-white shadow-xs border border-slate-950">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base font-extrabold tracking-tight text-slate-950 font-sans">
                DEBTLENS
              </span>
              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm border border-blue-200">
                v1.0
              </span>
            </div>
          </div>

          <div className="hidden xl:flex items-center text-slate-300 font-light">|</div>

          {/* Academic Endorsement & Scope Pill */}
          <div className="hidden xl:flex items-center space-x-2 text-xs text-slate-700 px-3 py-1 rounded-md bg-slate-50 border border-slate-200 h-8">
            <Building className="w-3.5 h-3.5 text-blue-700 shrink-0" />
            <span className="font-semibold text-slate-600">BEC Bagalkote</span>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900 whitespace-nowrap">Payments Core (PAY)</span>
          </div>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-sm mx-3 hidden lg:block">
          <button
            onClick={onOpenCommandPalette}
            className="w-full h-8.5 flex items-center justify-between px-3 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-600 hover:text-slate-950 transition-all cursor-pointer group"
            title="Press ⌘K or Ctrl+K to search"
          >
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-700 transition-colors shrink-0" />
              <span className="text-slate-500 group-hover:text-slate-900 font-medium truncate whitespace-nowrap">
                Search commands, incidents, ledger...
              </span>
            </div>
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-600 bg-white border border-slate-200 rounded-sm shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions: Live Status, PDF, 1-Click Demo, RBAC */}
        <div className="flex items-center space-x-2 shrink-0">
          
          {/* Live Telemetry Indicator */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 h-8.5 rounded-md text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>asia-south1 • Live</span>
          </div>

          {/* Quick Refresh Seed Data */}
          <button
            onClick={handleReloadSeed}
            disabled={isReloading}
            title="Reset test dataset to baseline"
            className="h-8.5 w-8.5 rounded-md text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-300 bg-white flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-blue-700' : ''}`} />
          </button>

          {/* Audit PDF Export */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="h-8.5 px-3 rounded-md text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 inline-flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shadow-2xs"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            <span className="hidden sm:inline">{isDownloadingPdf ? 'Generating...' : 'Audit PDF'}</span>
          </button>

          {/* Standout 1-Click Interactive Demo Button */}
          {onLaunchDemo && (
            <button
              onClick={onLaunchDemo}
              className="h-8.5 px-3.5 rounded-md text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 border border-blue-800 inline-flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] whitespace-nowrap"
              title="Launch Interactive 1-Click Operational Pipeline Walkthrough"
            >
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse shrink-0" />
              <span>Interactive Demo</span>
              <span className="ml-1 text-[9px] font-mono px-1 py-0.2 rounded-xs bg-blue-900 text-blue-100 font-bold">1-CLICK</span>
            </button>
          )}

          <div className="h-5 w-px bg-slate-200" />

          {/* Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="h-8.5 px-2 rounded-md hover:bg-slate-100 border border-slate-200 bg-white flex items-center space-x-2 transition-colors cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {currentRoleObj.initials}
              </div>
              <div className="hidden sm:block text-left text-xs leading-none">
                <span className="font-bold text-slate-900 block">{currentRoleObj.label}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-900 transition-colors shrink-0" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Switch Active Role (RBAC)
                </div>
                {roles.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => {
                      setCurrentRole(r.role);
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                      currentRole === r.role ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{r.label}</div>
                      <div className="text-[10px] text-slate-400">{r.desc}</div>
                    </div>
                    {currentRole === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* TIER 2: Top-Bar Executive Cockpit Module Navigation */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center overflow-x-auto no-scrollbar">
        <nav className="flex items-center space-x-1 sm:space-x-1.5 w-full">
          
          {/* Group 1: Core Intelligence */}
          <div className="flex items-center space-x-1 shrink-0">
            {coreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`h-9 px-3 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-300' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  
                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded-xs border ${
                    isActive ? 'bg-white/20 text-white border-white/30' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {item.moduleCode}
                  </span>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-xs border ${getBadgeStyle(item.badgeType, isActive)}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-slate-200 shrink-0 mx-1" />

          {/* Group 2: Remediation & Architecture */}
          <div className="flex items-center space-x-1 shrink-0">
            {remediationNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`h-9 px-3 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-300' : 'text-slate-400'}`} />
                  <span>{item.label}</span>

                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded-xs border ${
                    isActive ? 'bg-white/20 text-white border-white/30' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {item.moduleCode}
                  </span>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-xs border ${getBadgeStyle(item.badgeType, isActive)}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </nav>
      </div>

    </header>
  );
};
