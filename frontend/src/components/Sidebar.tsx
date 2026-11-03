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
  const coreNavItems: { 
    id: NavTab; 
    label: string; 
    icon: React.ComponentType<{ className?: string }>; 
    badge?: number; 
    badgeVariant?: 'solid' | 'subtle' | 'neutral';
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
      badgeVariant: 'solid',
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
      badgeVariant: 'solid',
      moduleCode: 'M4'
    }
  ];

  const remediationNavItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeVariant?: 'solid' | 'subtle' | 'neutral';
    moduleCode: string;
  }[] = [
    {
      id: 'optimiser',
      label: 'Payoff Optimiser (0/1)',
      icon: Calculator,
      moduleCode: 'M7'
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
      badgeVariant: 'subtle',
      moduleCode: 'M6'
    },
    {
      id: 'knowledge',
      label: 'Knowledge & Audit',
      icon: BookOpen,
      moduleCode: 'M8'
    }
  ];

  const getBadgeClass = (variant?: 'solid' | 'subtle' | 'neutral') => {
    switch (variant) {
      case 'solid':
        return 'bg-black text-white border-black';
      case 'subtle':
        return 'bg-zinc-800 text-white border-zinc-700';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-300';
    }
  };

  const renderNavGroup = (items: typeof coreNavItems) => (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs sm:text-sm transition-all cursor-pointer group ${
              isActive
                ? 'bg-zinc-100 text-black font-bold border border-zinc-300 border-l-4 border-l-black shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-50 hover:text-black font-medium'
            }`}
          >
            <div className="flex items-center space-x-2.5 truncate">
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                isActive ? 'text-black' : 'text-zinc-400 group-hover:text-black'
              }`} />
              <span className="truncate">{item.label}</span>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="text-[10px] text-zinc-400 font-mono font-medium">{item.moduleCode}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-sm border shadow-2xs ${getBadgeClass(item.badgeVariant)}`}>
                  {item.badge}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="w-64 bg-white border-r border-zinc-200 shrink-0 min-h-[calc(100vh-3.5rem)] p-3.5 flex flex-col justify-between select-none">
      <div className="space-y-4">
        
        {/* Prominent Live Demo Mode Button - Minimal Solid Black */}
        <button
          onClick={() => setCurrentTab('demo')}
          className={`w-full px-3.5 py-2.5 rounded-md text-xs sm:text-sm font-bold flex items-center justify-between transition-all cursor-pointer border ${
            currentTab === 'demo'
              ? 'bg-zinc-900 text-white border-black shadow-md ring-1 ring-zinc-700'
              : 'bg-black hover:bg-zinc-800 text-white border-black shadow-xs'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
            <span>Interactive Demo</span>
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm font-mono bg-white/20 text-white tracking-wider">
            1-CLICK
          </span>
        </button>

        {/* Section 1: Core Intelligence */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Core Intelligence</span>
            <span className="font-mono text-[9px] text-zinc-400">LEDGER</span>
          </div>
          {renderNavGroup(coreNavItems)}
        </div>

        {/* Section 2: Remediation & Architecture */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Remediation Engine</span>
            <span className="font-mono text-[9px] text-zinc-400">SOLVER</span>
          </div>
          {renderNavGroup(remediationNavItems)}
        </div>
      </div>

      {/* Institutional Department Endorsement Footer */}
      <div className="pt-3 border-t border-zinc-200">
        <div className="p-3 bg-zinc-50 rounded-md border border-zinc-200 text-zinc-700 text-xs">
          <div className="flex items-center space-x-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black" />
            <span className="text-[11px] font-bold text-black">BEC Bagalkote — Dept of ISE</span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">5th Sem Mini Project • BISA531P</div>
          <div className="text-[10px] text-black font-medium mt-0.5">Guide: Prof. P. R. Muttannavar</div>
        </div>
      </div>
    </aside>
  );
};
