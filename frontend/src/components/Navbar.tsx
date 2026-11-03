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
      return 'bg-white text-[#0A2E23] border-white/80 font-bold';
    }
    switch (type) {
      case 'danger':
        return 'bg-[#FDF2F4] text-[#881337] border-[#F8D2DB] font-bold';
      case 'warning':
        return 'bg-[#FEF9EE] text-[#B45309] border-[#FDE68A] font-bold';
      case 'info':
        return 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] font-bold';
      default:
        return 'bg-[#F4F2EB] text-stone-700 border-[#E2DFD6]';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E2DA] shadow-[0_1px_4px_rgba(0,0,0,0.03)] select-none">
      
      {/* TIER 1: Executive Brand, Search, Telemetry, and Actions */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-2.5 sm:gap-4 border-b border-[#F0EDE5]">
        
        {/* Left: Brand & Academic Scope Context */}
        <div className="flex items-center space-x-3 shrink-0">
          <div 
            className="flex items-center space-x-2.5 cursor-pointer" 
            onClick={() => setCurrentTab('dashboard')}
            title="Return to Executive Overview"
          >
            <div className="w-8 h-8 rounded-md bg-[#064E3B] flex items-center justify-center text-white shadow-xs border border-[#053D2E] shrink-0">
              <Layers className="w-4 h-4 text-emerald-200" />
            </div>
            <div className="flex items-baseline space-x-1.5 shrink-0">
              <span className="text-base font-extrabold tracking-tight text-[#0A2E23] font-sans">
                DEBTLENS
              </span>
              <span className="text-[10px] font-mono font-bold text-[#065F46] bg-[#ECFDF5] px-1.5 py-0.5 rounded-sm border border-[#A7F3D0]">
                v1.0
              </span>
            </div>
          </div>

          <div className="hidden xl:block text-stone-300 font-light">|</div>

          {/* Academic Endorsement & Scope Pill */}
          <div className="hidden xl:flex items-center space-x-2 text-xs text-stone-700 px-3 py-1 rounded-md bg-[#F9F8F5] border border-[#E5E2DA] h-8.5 shrink-0 whitespace-nowrap">
            <Building className="w-3.5 h-3.5 text-[#064E3B] shrink-0" />
            <span className="font-semibold text-stone-600">BEC Bagalkote</span>
            <span className="text-stone-300">/</span>
            <span className="font-bold text-[#0A2E23]">Payments Core (PAY)</span>
          </div>
        </div>

        {/* Center: Command Palette Trigger with Fixed Safe Width */}
        <div className="hidden md:flex items-center shrink-0">
          <button
            onClick={onOpenCommandPalette}
            className="w-48 lg:w-56 xl:w-64 h-8.5 flex items-center justify-between px-3 rounded-md bg-[#F9F8F5] hover:bg-[#F2EFE8] border border-[#E5E2DA] text-xs text-stone-600 hover:text-[#0A2E23] transition-all cursor-pointer group shadow-2xs overflow-hidden"
            title="Press ⌘K or Ctrl+K to search"
          >
            <div className="flex items-center space-x-2 min-w-0 pr-1.5 overflow-hidden">
              <Search className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#064E3B] transition-colors shrink-0" />
              <span className="text-stone-500 group-hover:text-[#0A2E23] font-medium truncate whitespace-nowrap">
                Search commands, ledger...
              </span>
            </div>
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-stone-600 bg-white border border-[#E5E2DA] rounded-sm shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions: Live Status, PDF, 1-Click Demo, RBAC */}
        <div className="flex items-center space-x-2 shrink-0">
          
          {/* Mobile search button (< md) */}
          <button
            onClick={onOpenCommandPalette}
            className="md:hidden h-8.5 w-8.5 rounded-md text-stone-700 hover:text-[#0A2E23] hover:bg-[#F4F2EB] border border-[#D8D4C8] bg-white flex items-center justify-center shrink-0 cursor-pointer"
            title="Search (⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-stone-500" />
          </button>

          {/* Live Telemetry Indicator */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 h-8.5 rounded-md text-xs font-mono font-bold text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse shrink-0" />
            <span className="whitespace-nowrap">asia-south1 • Live</span>
          </div>

          {/* Quick Refresh Seed Data */}
          <button
            onClick={handleReloadSeed}
            disabled={isReloading}
            title="Reset test dataset to baseline"
            className="h-8.5 w-8.5 rounded-md text-stone-700 hover:text-[#0A2E23] hover:bg-[#F4F2EB] border border-[#D8D4C8] bg-white flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shrink-0 shadow-2xs"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-[#064E3B]' : ''}`} />
          </button>

          {/* Audit PDF Export */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="h-8.5 px-3 rounded-md text-xs font-semibold text-[#0A2E23] bg-white hover:bg-[#F9F8F5] border border-[#D8D4C8] inline-flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shadow-2xs shrink-0"
          >
            <FileDown className="w-3.5 h-3.5 text-[#064E3B] shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">{isDownloadingPdf ? 'Generating...' : 'Audit PDF'}</span>
          </button>

          {/* Standout 1-Click Interactive Demo Button */}
          {onLaunchDemo && (
            <button
              onClick={onLaunchDemo}
              className="h-8.5 px-3.5 rounded-md text-xs font-bold text-white bg-[#065F46] hover:bg-[#044E38] border border-[#044E38] inline-flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] whitespace-nowrap shrink-0"
              title="Launch Interactive 1-Click Operational Pipeline Walkthrough"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-200 animate-pulse shrink-0" />
              <span className="whitespace-nowrap">Interactive Demo</span>
              <span className="ml-1 text-[9px] font-mono px-1 py-0.2 rounded-xs bg-[#0A2E23] text-emerald-200 font-bold shrink-0">1-CLICK</span>
            </button>
          )}

          <div className="h-5 w-px bg-[#E5E2DA] shrink-0 mx-0.5" />

          {/* Role Switcher */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="h-8.5 px-2.5 rounded-md hover:bg-[#F4F2EB] border border-[#E5E2DA] bg-white flex items-center space-x-2 transition-colors cursor-pointer group shrink-0 shadow-2xs"
            >
              <div className="w-6 h-6 rounded-md bg-[#064E3B] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {currentRoleObj.initials}
              </div>
              <div className="hidden sm:block text-left text-xs leading-none whitespace-nowrap">
                <span className="font-bold text-[#0A2E23] block">{currentRoleObj.label}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-[#0A2E23] transition-colors shrink-0" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-xl border border-[#D8D4C8] py-1.5 z-50 animate-in fade-in duration-100">
                <div className="px-3 py-1.5 border-b border-[#F0EDE5] text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Switch Active Role (RBAC)
                </div>
                {roles.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => {
                      setCurrentRole(r.role);
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-[#F9F8F5] transition-colors cursor-pointer ${
                      currentRole === r.role ? 'bg-[#ECFDF5] text-[#065F46] font-bold' : 'text-stone-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{r.label}</div>
                      <div className="text-[10px] text-stone-400">{r.desc}</div>
                    </div>
                    {currentRole === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-[#065F46]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* TIER 2: Top-Bar Executive Cockpit Module Navigation */}
      <div className="bg-[#FAF9F6] border-b border-[#E5E2DA]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center overflow-x-auto no-scrollbar">
          <nav className="flex items-center space-x-1 sm:space-x-1.5 w-full min-w-max py-1">
            
            {/* Group 1: Core Intelligence */}
            <div className="flex items-center space-x-1 shrink-0">
              {coreNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    className={`h-8.5 px-3 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                      isActive
                        ? 'bg-[#064E3B] text-white border-[#064E3B] shadow-xs font-bold'
                        : 'bg-white hover:bg-[#F2EFE8] text-[#0A2E23] border-[#E5E2DA] shadow-2xs hover:border-[#D8D4C8]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-200' : 'text-stone-500'}`} />
                    <span className="whitespace-nowrap">{item.label}</span>
                    
                    <span className={`text-[9px] font-mono px-1 py-0.2 rounded-xs border shrink-0 ${
                      isActive ? 'bg-white/20 text-white border-white/30' : 'bg-[#F4F2EB] text-stone-600 border-[#E2DFD6]'
                    }`}>
                      {item.moduleCode}
                    </span>

                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-xs border shrink-0 ${getBadgeStyle(item.badgeType, isActive)}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="h-5 w-px bg-[#D8D4C8] shrink-0 mx-1.5" />

            {/* Group 2: Remediation & Architecture */}
            <div className="flex items-center space-x-1 shrink-0">
              {remediationNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    className={`h-8.5 px-3 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                      isActive
                        ? 'bg-[#064E3B] text-white border-[#064E3B] shadow-xs font-bold'
                        : 'bg-white hover:bg-[#F2EFE8] text-[#0A2E23] border-[#E5E2DA] shadow-2xs hover:border-[#D8D4C8]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-200' : 'text-stone-500'}`} />
                    <span className="whitespace-nowrap">{item.label}</span>

                    <span className={`text-[9px] font-mono px-1 py-0.2 rounded-xs border shrink-0 ${
                      isActive ? 'bg-white/20 text-white border-white/30' : 'bg-[#F4F2EB] text-stone-600 border-[#E2DFD6]'
                    }`}>
                      {item.moduleCode}
                    </span>

                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-xs border shrink-0 ${getBadgeStyle(item.badgeType, isActive)}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

          </nav>
        </div>
      </div>

    </header>
  );
};
