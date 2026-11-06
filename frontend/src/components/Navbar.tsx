import React, { useState } from 'react';
import { 
  Layers, 
  RotateCcw, 
  FileDown, 
  CheckCircle2, 
  ChevronDown,
  Building,
  Search,
  Terminal,
  Activity,
  SlidersHorizontal,
  PanelRight
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
  onToggleInspector?: () => void;
  isInspectorOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  setCurrentRole,
  activeProjectId,
  onRefreshData,
  onOpenCommandPalette,
  onLaunchDemo,
  onToggleInspector,
  isInspectorOpen = true
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
    <header className="sticky top-0 z-40 bg-[#FAF9F5]/98 backdrop-blur-md border-b border-[#E2DDD5] shadow-[0_1px_2px_rgba(0,0,0,0.03)] select-none">
      <div className="w-full px-3 sm:px-5 lg:px-6 h-12 flex items-center justify-between gap-3">
        
        {/* Left: Engineering Terminal Brand & Scope */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-sm bg-[#064E3B] flex items-center justify-center text-white shadow-2xs border border-[#042C21]">
              <Layers className="w-3.5 h-3.5 text-emerald-200" />
            </div>
            <div className="flex items-baseline space-x-1.5 font-mono">
              <span className="text-sm font-black tracking-tight text-[#0F172A]">
                DEBTLENS
              </span>
              <span className="text-[10px] font-bold text-stone-500 bg-[#EAE5D9] px-1.5 py-0.2 rounded-xs border border-[#D5CFC5]">
                v1.0
              </span>
            </div>
          </div>

          <div className="hidden lg:block h-3.5 w-px bg-[#E2DDD5]" />

          {/* Academic / Scope Tag */}
          <div className="hidden md:flex items-center space-x-2 h-8 px-2.5 rounded-sm bg-white border border-[#E2DDD5] text-xs font-mono font-medium text-stone-700 shadow-2xs">
            <Building className="w-3 h-3 text-[#064E3B] shrink-0" />
            <span className="text-stone-600 font-bold">BEC Bagalkote</span>
            <span className="text-stone-300">/</span>
            <span className="text-[#0F172A] font-extrabold">PAYMENTS_CORE[PAY]</span>
          </div>
        </div>

        {/* Center: Command Palette Trigger (Locked Dimensions, Non-Wrapping) */}
        <div className="hidden md:flex items-center justify-center flex-1 max-w-sm mx-2">
          <button
            onClick={onOpenCommandPalette}
            className="w-full h-8 px-3 rounded-sm bg-white hover:bg-[#F4EFE6] border border-[#E2DDD5] text-xs text-stone-500 hover:text-stone-900 transition-colors cursor-pointer flex items-center justify-between shadow-2xs group font-mono"
            title="Press ⌘K or Ctrl+K to search"
          >
            <div className="flex items-center space-x-2 min-w-0">
              <Search className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700 transition-colors shrink-0" />
              <span className="truncate text-stone-500 group-hover:text-stone-800 text-[11px] font-medium">
                Search commands, incidents, ledger...
              </span>
            </div>
            <kbd className="shrink-0 ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-stone-500 bg-[#F4EFE6] border border-[#D5CFC5] rounded-xs shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Section: Crisp Functional Engineering Controls */}
        <div className="flex items-center space-x-2 shrink-0 font-mono">
          
          {/* Telemetry Indicator */}
          <div className="hidden xl:flex items-center space-x-1.5 h-8 px-2.5 rounded-sm text-[11px] font-bold text-emerald-900 bg-emerald-50/90 border border-emerald-300 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>asia-south1 • LIVE</span>
          </div>

          {/* Quick Refresh Seed Data */}
          <button
            onClick={handleReloadSeed}
            disabled={isReloading}
            title="Reset test dataset to baseline"
            className="h-8 w-8 rounded-sm bg-white hover:bg-[#F4EFE6] border border-[#E2DDD5] text-stone-700 hover:text-[#0F172A] flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shadow-2xs shrink-0"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-[#064E3B]' : ''}`} />
          </button>

          {/* Audit PDF Export */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="h-8 px-2.5 rounded-sm text-xs font-bold text-stone-800 hover:text-black bg-white hover:bg-[#F4EFE6] border border-[#E2DDD5] shadow-2xs flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            <FileDown className="w-3.5 h-3.5 text-stone-600" />
            <span className="hidden sm:inline">{isDownloadingPdf ? 'Exporting...' : 'Audit PDF'}</span>
          </button>

          {/* Live Demo Pipeline Launch Button (Zero Sparkles, Pure Engineering) */}
          {onLaunchDemo && (
            <button
              onClick={onLaunchDemo}
              className="h-8 px-3 rounded-sm text-xs font-bold text-white bg-[#064E3B] hover:bg-[#053D2E] shadow-2xs flex items-center space-x-1.5 transition-all cursor-pointer active:scale-[0.98] shrink-0 border border-[#042C21]"
              title="Launch Interactive 1-Click Operational Pipeline Walkthrough"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-300" />
              <span>Demo Pipeline</span>
            </button>
          )}

          {/* Right Inspector Toggle */}
          {onToggleInspector && (
            <button
              onClick={onToggleInspector}
              className={`h-8 px-2.5 rounded-sm text-xs font-bold border transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0 ${
                isInspectorOpen 
                  ? 'bg-[#EAE5D9] text-[#064E3B] border-[#D5CFC5]' 
                  : 'bg-white text-stone-700 hover:bg-[#F4EFE6] border-[#E2DDD5]'
              }`}
              title="Toggle Live Telemetry & AST Inspector Panel"
            >
              <PanelRight className="w-3.5 h-3.5 text-[#064E3B]" />
              <span className="hidden lg:inline text-[11px]">Inspector</span>
            </button>
          )}

          <div className="h-3.5 w-px bg-[#E2DDD5] shrink-0" />

          {/* Role Switcher (RBAC) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="h-8 px-2 rounded-sm bg-white hover:bg-[#F4EFE6] border border-[#E2DDD5] text-stone-800 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs group"
            >
              <div className="w-4.5 h-4.5 rounded-xs bg-[#064E3B] text-white flex items-center justify-center font-bold text-[9px] shadow-2xs shrink-0">
                {currentRoleObj.initials}
              </div>
              <div className="hidden sm:block text-left text-xs leading-none">
                <span className="font-bold text-[#0F172A] block text-[11px]">{currentRoleObj.label}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-stone-700 transition-colors shrink-0" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-sm shadow-xl border border-[#D5CFC5] py-1 z-50 animate-in fade-in duration-100 font-sans">
                <div className="px-3 py-1.5 border-b border-[#F0ECE1] text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider">
                  Switch Active Role (RBAC)
                </div>
                {roles.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => {
                      setCurrentRole(r.role);
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-[#F4EFE6] transition-colors cursor-pointer ${
                      currentRole === r.role ? 'bg-emerald-50 text-[#064E3B] font-bold' : 'text-stone-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-stone-900">{r.label}</div>
                      <div className="text-[10px] text-stone-500 font-mono">{r.desc}</div>
                    </div>
                    {currentRole === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-[#064E3B]" />}
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
