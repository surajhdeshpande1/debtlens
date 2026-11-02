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
    badgeVariant?: 'rose' | 'amber' | 'neutral' | 'magenta';
    moduleCode: string;
    iconColor: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Executive Overview',
      icon: LayoutDashboard,
      moduleCode: 'M8',
      iconColor: 'text-blue-700'
    },
    {
      id: 'incidents',
      label: 'Incident Management',
      icon: AlertCircle,
      badge: openIncidentsCount,
      badgeVariant: 'amber',
      moduleCode: 'M2',
      iconColor: 'text-amber-600'
    },
    {
      id: 'causal',
      label: 'Causal Graph (5 Whys)',
      icon: GitFork,
      moduleCode: 'M3',
      iconColor: 'text-purple-600'
    },
    {
      id: 'debt',
      label: 'Technical Debt Ledger',
      icon: Coins,
      badge: breakevenDebtCount,
      badgeVariant: 'rose',
      moduleCode: 'M4',
      iconColor: 'text-rose-600'
    },
    {
      id: 'repository',
      label: 'Repository Evidence',
      icon: GitBranch,
      moduleCode: 'M5',
      iconColor: 'text-slate-850'
    },
    {
      id: 'intelligence',
      label: 'Incident Intelligence',
      icon: Sparkles,
      badge: regressionsCount > 0 ? regressionsCount : undefined,
      badgeVariant: 'magenta',
      moduleCode: 'M6',
      iconColor: 'text-fuchsia-600'
    },
    {
      id: 'optimiser',
      label: 'Payoff Optimiser (0/1)',
      icon: Calculator,
      moduleCode: 'M7',
      iconColor: 'text-blue-600'
    },
    {
      id: 'knowledge',
      label: 'Knowledge & Audit',
      icon: BookOpen,
      moduleCode: 'M8',
      iconColor: 'text-purple-700'
    }
  ];

  const getBadgeClass = (variant?: 'rose' | 'amber' | 'neutral' | 'magenta') => {
    switch (variant) {
      case 'rose':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'amber':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'magenta':
        return 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <aside className="w-64 bg-[#FCFAF7] border-r border-[#EADBCE] shrink-0 min-h-[calc(100vh-3.5rem)] p-3.5 flex flex-col justify-between select-none">
      <div className="space-y-1">
        
        {/* Prominent Live Demo Mode Button */}
        <button
          onClick={() => setCurrentTab('demo')}
          className={`w-full mb-3.5 p-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-between transition-all cursor-pointer ${
            currentTab === 'demo'
              ? 'bg-slate-950 text-white shadow-md'
              : 'bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 hover:from-blue-800 hover:to-purple-800 text-white shadow-xs hover:shadow-md'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Live Demo Walkthrough</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md font-mono bg-white/20 text-white">
            1-CLICK
          </span>
        </button>

        <div className="px-3 py-1.5 text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between">
          <span>Platform Modules</span>
          <span className="font-mono text-[10px] text-stone-400">8 CORE</span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer group ${
                isActive
                  ? 'bg-white text-slate-950 font-bold border border-[#EADBCE] shadow-xs'
                  : 'text-stone-700 hover:bg-[#F5EFEB] hover:text-slate-950 font-medium'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? item.iconColor : 'text-stone-400 group-hover:' + item.iconColor
                }`} />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <span className="text-xs text-stone-400 font-mono font-medium">{item.moduleCode}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-md border shadow-2xs ${getBadgeClass(item.badgeVariant)}`}>
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* College & Department Endorsement Footer */}
      <div className="pt-3 border-t border-[#EADBCE]">
        <div className="p-3 bg-[#F5EFEB]/90 rounded-xl border border-[#EADBCE] text-stone-700">
          <div className="flex items-center space-x-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-700" />
            <span className="text-[11px] font-bold text-slate-950">BEC Bagalkote — ISE</span>
          </div>
          <div className="text-[10px] text-stone-500">Mini Project BISA531P</div>
          <div className="text-[10px] text-purple-900 font-semibold mt-0.5">Guide: Prof. P. R. Muttannavar</div>
        </div>
      </div>
    </aside>
  );
};
