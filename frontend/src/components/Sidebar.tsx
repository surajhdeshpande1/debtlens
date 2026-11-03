import React from 'react';
import { 
  LayoutDashboard, 
  AlertCircle, 
  GitFork, 
  Coins, 
  Calculator, 
  GitBranch, 
  Sparkles, 
  BookOpen
} from 'lucide-react';

export type NavTab = 
  | 'dashboard' 
  | 'incidents' 
  | 'causal' 
  | 'debt' 
  | 'optimiser' 
  | 'repository' 
  | 'intelligence' 
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
  openIncidentsCount = 2,
  breakevenDebtCount = 6,
  regressionsCount = 1
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
    <div className="space-y-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs sm:text-sm transition-all cursor-pointer group ${
              isActive
                ? 'bg-zinc-100 text-black font-bold border border-zinc-300 border-l-4 border-l-black shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-50 hover:text-black font-medium border border-transparent'
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                isActive ? 'text-black' : 'text-zinc-400 group-hover:text-black'
              }`} />
              <span className="truncate">{item.label}</span>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="text-[10px] text-zinc-500 font-mono font-semibold px-1.5 py-0.5 rounded-sm bg-zinc-100 border border-zinc-200">
                {item.moduleCode}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-sm border shadow-2xs ${getBadgeClass(item.badgeVariant)}`}>
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
    <aside className="w-72 bg-white border-r border-zinc-200 shrink-0 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between select-none">
      <div className="space-y-5">
        
        {/* Prominent Live Demo Mode Button - Minimal Solid Black with Spacious Sizing */}
        <button
          onClick={() => setCurrentTab('demo')}
          className={`w-full h-11 px-4 rounded-md text-xs sm:text-sm font-bold flex items-center justify-between transition-all cursor-pointer border ${
            currentTab === 'demo'
              ? 'bg-zinc-900 text-white border-black shadow-md ring-1 ring-zinc-700'
              : 'bg-black hover:bg-zinc-800 text-white border-black shadow-xs'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-4 h-4 text-white animate-pulse shrink-0" />
            <span className="font-bold">Interactive Demo</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm font-mono bg-zinc-800 text-white border border-zinc-700 tracking-wider">
            1-CLICK
          </span>
        </button>

        {/* Section 1: Core Intelligence */}
        <div>
          <div className="px-3.5 pb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between font-mono">
            <span>Core Intelligence</span>
            <span className="text-[9px] text-zinc-400">LEDGER</span>
          </div>
          {renderNavGroup(coreNavItems)}
        </div>

        {/* Section 2: Remediation & Architecture */}
        <div>
          <div className="px-3.5 pb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between font-mono">
            <span>Remediation Engine</span>
            <span className="text-[9px] text-zinc-400">SOLVER</span>
          </div>
          {renderNavGroup(remediationNavItems)}
        </div>
      </div>

      {/* Institutional Department Endorsement Footer */}
      <div className="pt-4 border-t border-zinc-200">
        <div className="p-3.5 bg-zinc-50 rounded-md border border-zinc-200 text-zinc-700 text-xs space-y-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
            <span className="text-[11px] font-bold text-black">BEC Bagalkote — Dept of ISE</span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">5th Sem Mini Project • BISA531P</div>
          <div className="text-[10px] text-black font-semibold pt-0.5">Guide: Prof. P. R. Muttannavar</div>
        </div>
      </div>
    </aside>
  );
};
