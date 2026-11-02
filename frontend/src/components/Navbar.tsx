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
    <header className="sticky top-0 z-40 bg-[#FCFAF7]/95 backdrop-blur-md border-b border-[#EADBCE] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Brand & Workspace Context */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-950 flex items-center justify-center text-white shadow-xs border border-slate-800">
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-base font-bold tracking-tight text-slate-950">
                Debt<span className="text-blue-700">Lens</span>
              </span>
              <span className="w-1.5 h-1.5 rounded-sm bg-blue-600 inline-block mb-1" />
              <span className="text-[10px] font-mono font-semibold text-stone-500 ml-1">
                v1.0
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center text-xs text-stone-300">/</div>

          {/* Clean Workspace Selector */}
          <div className="hidden md:flex items-center space-x-2 text-xs text-stone-700 hover:text-slate-950 transition-colors cursor-pointer px-2.5 py-1.5 rounded-md bg-[#F5EFEB]/90 hover:bg-[#EFE7DE] border border-[#EADBCE]">
            <Building className="w-3.5 h-3.5 text-stone-500" />
            <span className="font-medium text-stone-600">Enterprise</span>
            <span className="text-stone-300">/</span>
            <span className="font-bold text-slate-900">Payments (PAY)</span>
            <ChevronDown className="w-3 h-3 text-stone-400" />
          </div>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-sm mx-4 hidden lg:block">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-md bg-[#F7F4EE] hover:bg-[#EFE8DE] border border-[#EADBCE] text-xs text-stone-600 hover:text-slate-900 transition-all cursor-pointer group shadow-2xs"
            title="Press ⌘K or Ctrl+K to search"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-stone-400 group-hover:text-blue-600 transition-colors" />
              <span className="text-stone-500 group-hover:text-slate-800">Search commands, incidents...</span>
            </div>
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-stone-500 bg-white border border-[#EADBCE] rounded-sm shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2.5">
          
          {/* Subtle Live Status Indicator */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-[11px] font-medium text-stone-700 bg-[#F5EFEB] border border-[#EADBCE]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>asia-south1</span>
          </div>

          {/* Quick Refresh Seed */}
          <button
            onClick={handleReloadSeed}
            disabled={isReloading}
            title="Reset test dataset to baseline"
            className="p-1.5 rounded-md text-stone-500 hover:text-slate-950 hover:bg-[#F2ECE2] border border-[#EADBCE] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${isReloading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Audit PDF Export */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-slate-800 bg-white hover:bg-[#F7F3EE] border border-[#EADBCE] shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-700" />
            <span className="hidden sm:inline">{isDownloadingPdf ? 'Exporting...' : 'Export PDF'}</span>
          </button>

          {/* Live Demo 1-Click Launch Button */}
          {onLaunchDemo && (
            <button
              onClick={onLaunchDemo}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs sm:text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-xs transition-all cursor-pointer ring-1 ring-blue-600 active:scale-95"
              title="Launch Interactive 1-Click Operational Pipeline Walkthrough"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Live Demo (1-Click)</span>
            </button>
          )}

          <div className="h-4 w-px bg-[#EADBCE]" />

          {/* Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center space-x-2 p-1 pl-1.5 pr-2 rounded-md hover:bg-[#F2ECE2] border border-transparent hover:border-[#EADBCE] transition-colors cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-md bg-blue-700 text-white flex items-center justify-center font-bold text-[10px] shadow-2xs">
                {currentRoleObj.initials}
              </div>
              <div className="hidden sm:block text-left text-xs leading-none">
                <span className="font-bold text-slate-850 block">{currentRoleObj.label}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-slate-600 transition-colors" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-[#EADBCE] py-1.5 z-50 animate-in fade-in duration-100">
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
                      currentRole === r.role ? 'bg-blue-50 text-blue-950 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{r.label}</div>
                      <div className="text-[10px] text-stone-400">{r.desc}</div>
                    </div>
                    {currentRole === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />}
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
