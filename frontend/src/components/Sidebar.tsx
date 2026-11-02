import React from 'react';
import { 
  LayoutDashboard, 
  AlertCircle, 
  GitFork, 
  Coins, 
  GitBranch, 
  Sparkles, 
  Calculator, 
  BookOpen,
  ShieldAlert
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
  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; badgeColor?: string; moduleCode: string }[] = [
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
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
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
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      moduleCode: 'M4'
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
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      moduleCode: 'M6'
    },
    {
      id: 'optimiser',
      label: 'Payoff Optimiser (0/1)',
      icon: Calculator,
      moduleCode: 'M7'
    },
    {
      id: 'knowledge',
      label: 'Knowledge & Audit',
      icon: BookOpen,
      moduleCode: 'M8'
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 shrink-0 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Platform Capabilities
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-200/70 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-slate-400 font-mono">{item.moduleCode}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full border ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
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
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
          <div className="text-[11px] font-bold text-slate-900">BEC Bagalkote — ISE Dept</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Mini Project BISA531P (2026-27)</div>
          <div className="text-[10px] text-indigo-600 font-medium mt-1">Guide: Prof. P. R. Muttannavar</div>
        </div>
      </div>
    </aside>
  );
};

