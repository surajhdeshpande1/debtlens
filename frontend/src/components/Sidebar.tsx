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
  GraduationCap
} from 'lucide-react';

export type NavTab = 
  | 'dashboard' 
  | 'incidents' 
  | 'causal' 
  | 'debt' 
  | 'repository' 
  | 'intelligence' 
  | 'optimiser' 
  | 'knowledge'
  | 'demo';

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
    badgeVariant?: 'rose' | 'amber' | 'neutral';
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
      badgeVariant: 'amber',
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
      badgeVariant: 'rose',
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
      badgeVariant: 'neutral',
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

  const getBadgeClass = (variant?: 'rose' | 'amber' | 'neutral') => {
    switch (variant) {
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200/80';
    }
  };

  return (
    <aside className="w-60 bg-white border-r border-slate-200/80 shrink-0 min-h-[calc(100vh-3.5rem)] p-3 flex flex-col justify-between select-none">
      <div className="space-y-1">
        
        {/* Prominent Faculty Demo Mode Button */}
        <button
          onClick={() => setCurrentTab('demo')}
          className={`w-full mb-3 p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
            currentTab === 'demo'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-950 border border-indigo-200/90 shadow-2xs'
          }`}
        >
          <div className="flex items-center space-x-2">
            <GraduationCap className={`w-4 h-4 ${currentTab === 'demo' ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <span>Faculty Demo & Viva Lab</span>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono ${
            currentTab === 'demo' ? 'bg-slate-800 text-indigo-300' : 'bg-indigo-200/70 text-indigo-800'
          }`}>
            DEMO
          </span>
        </button>

        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Platform Modules</span>
          <span className="font-mono text-[9px] text-slate-300">8 CORE</span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer group ${
                isActive
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-700'
                }`} />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <span className="text-[10px] text-slate-400 font-mono">{item.moduleCode}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded border shadow-2xs ${getBadgeClass(item.badgeVariant)}`}>
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* College & Department Endorsement Footer */}
      <div className="pt-3 border-t border-slate-100">
        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 text-slate-600">
          <div className="flex items-center space-x-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            <span className="text-[11px] font-bold text-slate-900">BEC Bagalkote — ISE</span>
          </div>
          <div className="text-[10px] text-slate-500">Mini Project BISA531P</div>
          <div className="text-[10px] text-indigo-700 font-medium mt-1">Guide: Prof. P. R. Muttannavar</div>
        </div>
      </div>
    </aside>
  );
};
