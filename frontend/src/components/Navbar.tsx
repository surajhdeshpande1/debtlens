import React, { useState } from 'react';
import { 
  Layers, 
  RotateCcw, 
  FileDown, 
  User as UserIcon, 
  CheckCircle2, 
  ChevronDown,
  Building,
  FolderGit2
} from 'lucide-react';
import { api } from '../services/api';
import { UserRole } from '../types';
import { isFirebaseConfigured } from '../services/firebase';
import { isSupabaseConfigured } from '../services/supabase';

interface NavbarProps {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  activeProjectId: number;
  onRefreshData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  setCurrentRole,
  activeProjectId,
  onRefreshData
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

  const roles: { role: UserRole; label: string; desc: string }[] = [
    { role: 'tech_lead', label: 'Tech Lead', desc: 'Sushma Hiremath' },
    { role: 'admin', label: 'Admin', desc: 'Suraj Deshpande' },
    { role: 'developer', label: 'Developer', desc: 'Sushma Patil' },
    { role: 'viewer', label: 'Viewer', desc: 'Sushma Mathapati' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-slate-900">Debt<span className="text-indigo-600">Lens</span></span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                v1.0 • BISA531P
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Incident-Driven Technical Debt Intelligence & Remediation</p>
          </div>
        </div>

        {/* Project Context & Global Actions */}
        <div className="flex items-center space-x-3">
          
          {/* Active Workspace Pill */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-600">FinTech Cloud</span>
            <span className="text-slate-300">/</span>
            <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-semibold text-slate-900">PAY: Payments Platform</span>
          </div>

          {/* Database / Backend Status Indicator */}
          {isFirebaseConfigured ? (
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Google Cloud Firestore</span>
            </div>
          ) : isSupabaseConfigured ? (
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Supabase Cloud (PostgreSQL)</span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>FinTech Cloud Engine</span>
            </div>
          )}

          {/* Seed Reload Button */}
          <button
            onClick={handleReloadSeed}
            disabled={isReloading}
            title="Reload Seeded Enterprise Dataset"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">{isReloading ? 'Seeding...' : 'Reload Seed Data'}</span>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isDownloadingPdf ? 'Generating...' : 'Audit Report PDF'}</span>
          </button>

          {/* Role Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-700 shadow-xs cursor-pointer"
            >
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                {currentRole[0].toUpperCase()}
              </div>
              <span className="capitalize">{currentRole.replace('_', ' ')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Active Role (RBAC)
                </div>
                {roles.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => {
                      setCurrentRole(r.role);
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${
                      currentRole === r.role ? 'bg-indigo-50/70 text-indigo-900 font-medium' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{r.label}</div>
                      <div className="text-[11px] text-slate-400">{r.desc}</div>
                    </div>
                    {currentRole === r.role && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
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

