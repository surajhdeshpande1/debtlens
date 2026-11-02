import React from 'react';
import { 
  LayoutDashboard, 
  AlertCircle, 
  GitFork, 
  Coins, 
  GitBranch, 
  Sparkles, 
  Calculator, 
  BookOpen
} from 'lucide-react';

export type NavTab = 
  | 'dashboard' 
  | 'incidents' 
  | 'causal' 
  | 'debt' 
  | 'repository' 
  | 'intelligence' 
  | 'optimiser' 
  | 'knowledge';

interface SidebarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  openIncidentsCount?: number;
  breakevenDebtCount?: number;
  regressionsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  openIncidentsCount = 0,
  breakevenDebtCount = 0,
  regressionsCount = 0
}) => {
  const navItems: { 
    id: NavTab; 
    label: string; 
    icon: React.ComponentType<{ className?: string }>; 
    badge?: number; 
    badgeColor?: string; 
    moduleCode: string;
    accentColor: string;
    iconBg: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Executive Overview',
      icon: LayoutDashboard,
      moduleCode: 'M8',
      accentColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50 border-indigo-200/80'
    },
    {
      id: 'incidents',
      label: 'Incident Management',
      icon: AlertCircle,
      badge: openIncidentsCount,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      moduleCode: 'M2',
      accentColor: 'text-rose-600',
      iconBg: 'bg-rose-50 border-rose-200/80'
    },
    {
      id: 'causal',
      label: 'Causal Graph (5 Whys)',
      icon: GitFork,
      moduleCode: 'M3',
      accentColor: 'text-purple-600',
      iconBg: 'bg-purple-50 border-purple-200/80'
    },
    {
      id: 'debt',
      label: 'Technical Debt Ledger',
      icon: Coins,
      badge: breakevenDebtCount,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      moduleCode: 'M4',
      accentColor: 'text-amber-600',
      iconBg: 'bg-amber-50 border-amber-200/80'
    },
    {
      id: 'repository',
      label: 'Repository Evidence',
      icon: GitBranch,
      moduleCode: 'M5',
      accentColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 border-emerald-200/80'
    },
    {
      id: 'intelligence',
      label: 'Incident Intelligence',
      icon: Sparkles,
      badge: regressionsCount > 0 ? regressionsCount : undefined,
      badgeColor: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
      moduleCode: 'M6',
      accentColor: 'text-fuchsia-600',
      iconBg: 'bg-fuchsia-50 border-fuchsia-200/80'
    },
    {
      id: 'optimiser',
      label: 'Payoff Optimiser (0/1)',
      icon: Calculator,
      moduleCode: 'M7',
      accentColor: 'text-teal-600',
      iconBg: 'bg-teal-50 border-teal-200/80'
    },
    {
      id: 'knowledge',
      label: 'Knowledge & Audit',
      icon: BookOpen,
      moduleCode: 'M8',
      accentColor: 'text-sky-600',
      iconBg: 'bg-sky-50 border-sky-200/80'
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 shrink-0 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between select-none">
      <div className="space-y-1">
        <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Platform Capabilities</span>
          <span className="text-[10px] font-mono font-medium text-slate-300">8 MODULES</span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer group ${
                isActive
                  ? 'bg-slate-100 text-slate-900 shadow-2xs border border-slate-200/90 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50/80 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                  isActive 
                    ? `${item.iconBg} ${item.accentColor} shadow-2xs` 
                    : 'bg-slate-50 border-slate-200 text-slate-400 group-hover:text-slate-600 group-hover:border-slate-300'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <span className="text-[10px] text-slate-400 font-mono font-medium">{item.moduleCode}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full border shadow-2xs ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* College & Department Endorsement Footer */}
      <div className="pt-4 border-t border-slate-100">
        <div className="p-3 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-xl border border-slate-200/80 text-slate-600">
          <div className="flex items-center space-x-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            <span className="text-[11px] font-bold text-slate-900">BEC Bagalkote — ISE</span>
          </div>
          <div className="text-[10px] text-slate-500">Mini Project BISA531P (2026-27)</div>
          <div className="text-[10px] text-indigo-700 font-semibold mt-1">Guide: Prof. P. R. Muttannavar</div>
        </div>
      </div>
    </aside>
  );
};
