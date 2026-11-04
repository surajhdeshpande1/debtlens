import React, { useState } from 'react';
import { 
  Layers, 
  RotateCcw, 
  FileDown, 
  CheckCircle2, 
  ChevronDown,
  Building,
  Search,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { UserRole } from '../types';

interface NavbarProps {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  activeProjectId: number;
  onRefreshData: () => void;
  onOpenCommandPalette: () => void;
  onLaunchDemo?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  setCurrentRole,
  activeProjectId,
  onRefreshData,
  onOpenCommandPalette,
  onLaunchDemo
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

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] select-none">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        
        {/* Left Section: Brand & Academic / Module Context */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                Debt<span className="text-indigo-600">Lens</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                v1.0
              </span>
            </div>
          </div>

          <div className="hidden lg:block h-4 w-px bg-slate-200" />

          {/* Institutional / Architecture Scope Tag - Clean h-9 Pill */}
          <div className="hidden md:flex items-center space-x-2 h-9 px-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-700 shadow-2xs">
            <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-slate-600 font-semibold">BEC Bagalkote</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-bold">Payments Engine (PAY)</span>
          </div>
        </div>

        {/* Center Section: Search Command Bar - Guaranteed Non-Wrapping Fixed Proportions */}
        <div className="hidden md:flex items-center justify-center flex-1 max-w-md mx-2">
          <button
            onClick={onOpenCommandPalette}
            className="w-full h-9 px-3 rounded-lg bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center justify-between shadow-2xs group"
            title="Press ⌘K or Ctrl+K to search"
          >
            <div className="flex items-center space-x-2 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
              <span className="truncate text-slate-400 group-hover:text-slate-600 font-medium">
                Search commands, incidents, ledger...
              </span>
            </div>
            <kbd className="shrink-0 ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Section: Uniform H-9 Action Deck */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
          
          {/* Real-Time Telemetry Badge */}
          <div className="hidden xl:flex items-center space-x-1.5 h-9 px-3 rounded-lg text-xs font-mono font-medium text-emerald-800 bg-emerald-50/80 border border-emerald-200/90 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>asia-south1 • Live</span>
          </div>

          {/* Quick Refresh Seed Data Button */}
          <button
            onClick={handleReloadSeed}
            disabled={isReloading}
            title="Reset test dataset to baseline"
            className="h-9 w-9 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shadow-2xs shrink-0"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          {/* Audit PDF Export Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">{isDownloadingPdf ? 'Exporting...' : 'Audit PDF'}</span>
          </button>

          {/* Live Demo Walkthrough Launch Button */}
          {onLaunchDemo && (
            <button
              onClick={onLaunchDemo}
              className="h-9 px-3.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer active:scale-[0.98] shrink-0 border border-slate-800"
              title="Launch Interactive 1-Click Operational Pipeline Walkthrough"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Demo Walkthrough</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          {/* Role Switcher (RBAC) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="h-9 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 flex items-center space-x-2 transition-colors cursor-pointer shadow-2xs group"
            >
              <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shadow-2xs shrink-0">
                {currentRoleObj.initials}
              </div>
              <div className="hidden sm:block text-left text-xs leading-none">
                <span className="font-semibold text-slate-800 block">{currentRoleObj.label}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in duration-100">
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
                      currentRole === r.role ? 'bg-indigo-50/70 text-indigo-900 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{r.label}</div>
                      <div className="text-[10px] text-slate-400">{r.desc}</div>
                    </div>
                    {currentRole === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
