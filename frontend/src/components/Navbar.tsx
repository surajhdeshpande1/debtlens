import React, { useState } from 'react';
import { 
  Layers, 
  RotateCcw, 
  FileDown, 
  CheckCircle2, 
  ChevronDown,
  Building,
  FolderGit2,
  Search,
  Sparkles,
  GraduationCap
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
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/98 backdrop-blur-md border-b border-[#E5DFD5] shadow-[0_1px_3px_rgba(12,26,46,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Brand & Workspace Context */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-md bg-[#0C1A2E] flex items-center justify-center text-white shadow-xs border border-[#142B4B]">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base font-extrabold tracking-tight text-[#0C1A2E] font-sans">
                DEBTLENS
              </span>
              <span className="text-[10px] font-mono font-bold text-stone-500 bg-[#EFEAE1] px-1.5 py-0.2 rounded-sm border border-[#DDD5C7]">
                v1.0
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center text-stone-300 font-light">|</div>

          {/* Academic & Platform Scope Indicator */}
          <div className="hidden md:flex items-center space-x-2 text-xs text-stone-700 px-2.5 py-1.5 rounded-md bg-[#F4EFE6] border border-[#E5DFD5]">
            <Building className="w-3.5 h-3.5 text-[#0C1A2E]" />
            <span className="font-semibold text-stone-600">BEC Bagalkote</span>
            <span className="text-stone-300">/</span>
            <span className="font-bold text-[#0C1A2E]">Payments Engine (PAY)</span>
          </div>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-sm mx-4 hidden lg:block">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-md bg-white hover:bg-[#F6F3EB] border border-[#E5DFD5] text-xs text-stone-600 hover:text-[#0C1A2E] transition-all cursor-pointer group shadow-2xs"
            title="Press ⌘K or Ctrl+K to search"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#0C1A2E] transition-colors" />
              <span className="text-stone-500 group-hover:text-stone-800 font-medium">Search commands, incidents, ledger...</span>
            </div>
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-stone-600 bg-[#F4EFE6] border border-[#DDD5C7] rounded-sm shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          
          {/* Subtle Live Telemetry Indicator */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-semibold text-[#1E4E38] bg-[#EDF6F1] border border-[#BCD8C7]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E4E38] animate-pulse" />
            <span>asia-south1 • Live</span>
          </div>

          {/* Quick Refresh Seed Data */}
          <button
            onClick={handleReloadSeed}
            disabled={isReloading}
            title="Reset test dataset to baseline"
            className="p-1.5 rounded-md text-stone-600 hover:text-[#0C1A2E] hover:bg-[#F2ECE2] border border-[#E5DFD5] bg-white transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-[#0C1A2E]' : ''}`} />
          </button>

          {/* Audit PDF Export */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-[#0C1A2E] bg-white hover:bg-[#F6F3EB] border border-[#E5DFD5] shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-[#0C1A2E]" />
            <span className="hidden sm:inline">{isDownloadingPdf ? 'Exporting...' : 'Audit PDF'}</span>
          </button>

          {/* Live Demo 1-Click Launch Button in Deep Navy */}
          {onLaunchDemo && (
            <button
              onClick={onLaunchDemo}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-bold text-white bg-[#0C1A2E] hover:bg-[#142B4B] shadow-xs transition-all cursor-pointer border border-[#142B4B] active:scale-[0.99]"
              title="Launch Interactive 1-Click Operational Pipeline Walkthrough"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E5B54F] animate-pulse" />
              <span>Demo Walkthrough</span>
            </button>
          )}

          <div className="h-4 w-px bg-[#E5DFD5]" />

          {/* Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center space-x-2 p-1 pl-1.5 pr-2 rounded-md hover:bg-[#F2ECE2] border border-transparent hover:border-[#E5DFD5] transition-colors cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-md bg-[#0C1A2E] text-white flex items-center justify-center font-bold text-[10px] shadow-2xs">
                {currentRoleObj.initials}
              </div>
              <div className="hidden sm:block text-left text-xs leading-none">
                <span className="font-bold text-[#0C1A2E] block">{currentRoleObj.label}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-stone-600 transition-colors" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-[#E5DFD5] py-1.5 z-50 animate-in fade-in duration-100">
                <div className="px-3 py-1.5 border-b border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Switch Active Role (RBAC)
                </div>
                {roles.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => {
                      setCurrentRole(r.role);
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-[#FBF8F4] transition-colors cursor-pointer ${
                      currentRole === r.role ? 'bg-[#F0F4FA] text-[#0C1A2E] font-bold' : 'text-stone-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{r.label}</div>
                      <div className="text-[10px] text-stone-400">{r.desc}</div>
                    </div>
                    {currentRole === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-[#0C1A2E]" />}
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
