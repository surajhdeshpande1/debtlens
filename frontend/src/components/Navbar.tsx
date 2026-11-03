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
    <header className="sticky top-0 z-40 bg-white/98 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Brand & Workspace Context */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center text-white shadow-xs border border-black">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base font-extrabold tracking-tight text-black font-sans">
                DEBTLENS
              </span>
              <span className="text-[10px] font-mono font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.2 rounded-sm border border-zinc-200">
                v1.0
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center text-zinc-300 font-light">|</div>

          {/* Academic & Platform Scope Indicator */}
          <div className="hidden md:flex items-center space-x-2 text-xs text-zinc-700 px-2.5 py-1.5 rounded-md bg-zinc-50 border border-zinc-200">
            <Building className="w-3.5 h-3.5 text-black" />
            <span className="font-semibold text-zinc-600">BEC Bagalkote</span>
            <span className="text-zinc-300">/</span>
            <span className="font-bold text-black">Payments Engine (PAY)</span>
          </div>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-sm mx-4 hidden lg:block">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-md bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs text-zinc-600 hover:text-black transition-all cursor-pointer group"
            title="Press ⌘K or Ctrl+K to search"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-black transition-colors" />
              <span className="text-zinc-500 group-hover:text-black font-medium">Search commands, incidents, ledger...</span>
            </div>
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-sm">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          
          {/* Live Telemetry Indicator */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-semibold text-black bg-zinc-100 border border-zinc-200">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
            <span>asia-south1 • Live</span>
          </div>

          {/* Quick Refresh Seed Data */}
          <button
            onClick={handleReloadSeed}
            disabled={isReloading}
            title="Reset test dataset to baseline"
            className="p-1.5 rounded-md text-zinc-600 hover:text-black hover:bg-zinc-100 border border-zinc-200 bg-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-black' : ''}`} />
          </button>

          {/* Audit PDF Export */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-black bg-white hover:bg-zinc-100 border border-zinc-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-black" />
            <span className="hidden sm:inline">{isDownloadingPdf ? 'Exporting...' : 'Audit PDF'}</span>
          </button>

          {/* Live Demo 1-Click Launch Button in Minimal Solid Black */}
          {onLaunchDemo && (
            <button
              onClick={onLaunchDemo}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-bold text-white bg-black hover:bg-zinc-800 transition-all cursor-pointer border border-black active:scale-[0.99]"
              title="Launch Interactive 1-Click Operational Pipeline Walkthrough"
            >
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              <span>Demo Walkthrough</span>
            </button>
          )}

          <div className="h-4 w-px bg-zinc-200" />

          {/* Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center space-x-2 p-1 pl-1.5 pr-2 rounded-md hover:bg-zinc-100 border border-transparent hover:border-zinc-200 transition-colors cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-md bg-black text-white flex items-center justify-center font-bold text-[10px]">
                {currentRoleObj.initials}
              </div>
              <div className="hidden sm:block text-left text-xs leading-none">
                <span className="font-bold text-black block">{currentRoleObj.label}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-black transition-colors" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-zinc-200 py-1.5 z-50 animate-in fade-in duration-100">
                <div className="px-3 py-1.5 border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Switch Active Role (RBAC)
                </div>
                {roles.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => {
                      setCurrentRole(r.role);
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-zinc-50 transition-colors cursor-pointer ${
                      currentRole === r.role ? 'bg-zinc-100 text-black font-bold' : 'text-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{r.label}</div>
                      <div className="text-[10px] text-zinc-400">{r.desc}</div>
                    </div>
                    {currentRole === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
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
