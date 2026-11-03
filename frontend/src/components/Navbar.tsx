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
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        
        {/* Brand & Workspace Context */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center text-white border border-black shadow-xs">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base font-extrabold tracking-tight text-black font-sans">
                DEBTLENS
              </span>
              <span className="text-[10px] font-mono font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded-sm border border-zinc-200">
                v1.0
              </span>
            </div>
          </div>

          <div className="hidden xl:flex items-center text-zinc-300 font-light">|</div>

          {/* Academic & Platform Scope Indicator */}
          <div className="hidden xl:flex items-center space-x-2 text-xs text-zinc-700 px-3 py-1.5 rounded-md bg-zinc-50 border border-zinc-200 h-9">
            <Building className="w-3.5 h-3.5 text-black shrink-0" />
            <span className="font-semibold text-zinc-600">BEC Bagalkote</span>
            <span className="text-zinc-300">/</span>
            <span className="font-bold text-black whitespace-nowrap">Payments Engine (PAY)</span>
          </div>
        </div>

        {/* Center: Command Palette Trigger (Single line, strictly bounded, cannot wrap or pop out) */}
        <div className="flex-1 max-w-xs mx-2 hidden lg:block">
          <button
            onClick={onOpenCommandPalette}
            className="w-full h-9 flex items-center justify-between px-3 rounded-md bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs text-zinc-600 hover:text-black transition-all cursor-pointer group"
            title="Press ⌘K or Ctrl+K to search"
          >
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-black transition-colors shrink-0" />
              <span className="text-zinc-500 group-hover:text-black font-medium truncate whitespace-nowrap">
                Search commands, incidents...
              </span>
            </div>
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-sm shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions: All uniform height h-9, spacious padding, regular rectangular shape */}
        <div className="flex items-center space-x-2 shrink-0">
          
          {/* Live Telemetry Indicator */}
          <div className="hidden md:flex items-center space-x-1.5 px-3 h-9 rounded-md text-xs font-mono font-semibold text-black bg-zinc-100 border border-zinc-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse shrink-0" />
            <span>asia-south1 • Live</span>
          </div>

          {/* Quick Refresh Seed Data */}
          <button
            onClick={handleReloadSeed}
            disabled={isReloading}
            title="Reset test dataset to baseline"
            className="h-9 w-9 rounded-md text-zinc-700 hover:text-black hover:bg-zinc-100 border border-zinc-300 bg-white flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-black' : ''}`} />
          </button>

          {/* Audit PDF Export */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="h-9 px-3.5 rounded-md text-xs font-semibold text-black bg-white hover:bg-zinc-100 border border-zinc-300 inline-flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5 text-black shrink-0" />
            <span className="hidden sm:inline">{isDownloadingPdf ? 'Exporting...' : 'Audit PDF'}</span>
          </button>

          {/* Live Demo 1-Click Launch Button in Minimal Solid Black */}
          {onLaunchDemo && (
            <button
              onClick={onLaunchDemo}
              className="h-9 px-4 rounded-md text-xs font-bold text-white bg-black hover:bg-zinc-800 border border-black inline-flex items-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] whitespace-nowrap"
              title="Launch Interactive 1-Click Operational Pipeline Walkthrough"
            >
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse shrink-0" />
              <span>Demo Walkthrough</span>
            </button>
          )}

          <div className="h-5 w-px bg-zinc-200" />

          {/* Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="h-9 px-2.5 rounded-md hover:bg-zinc-100 border border-zinc-200 bg-white flex items-center space-x-2 transition-colors cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-md bg-black text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {currentRoleObj.initials}
              </div>
              <div className="hidden sm:block text-left text-xs leading-none">
                <span className="font-bold text-black block">{currentRoleObj.label}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-black transition-colors shrink-0" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-xl border border-zinc-300 py-1.5 z-50 animate-in fade-in duration-100">
                <div className="px-3 py-1.5 border-b border-zinc-100 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
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
                      <div className="font-bold text-black">{r.label}</div>
                      <div className="text-[10px] text-zinc-500">{r.desc}</div>
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
