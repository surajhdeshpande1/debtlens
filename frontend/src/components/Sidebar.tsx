import React from 'react';
import { 
  LayoutDashboard, 
  AlertCircle, 
  GitFork, 
  Coins, 
  GitBranch, 
  Calculator, 
  BookOpen,
  Terminal,
  Cpu
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
      moduleCode: 'M1'
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
      icon: Cpu,
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
        return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
      case 'amber':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
      default:
        return 'bg-[#EAE5D9] text-stone-800 border-[#D5CFC5] font-bold';
    }
  };

  return (
    <aside className="w-60 bg-white border-r border-[#E2DDD5] shrink-0 min-h-[calc(100vh-3rem)] p-3 flex flex-col justify-between select-none">
      <div className="space-y-1">
        
        {/* Prominent Demo Pipeline Button (Solid Forest Emerald, Zero Sparkles) */}
        <button
          onClick={() => setCurrentTab('demo')}
          className={`w-full mb-3 p-2.5 rounded-sm text-xs font-mono font-bold flex items-center justify-between transition-all cursor-pointer ${
            currentTab === 'demo'
              ? 'bg-[#064E3B] text-white border border-[#042C21] shadow-xs'
              : 'bg-[#F4EFE6] hover:bg-[#EAE5D9] text-[#064E3B] border border-[#E2DDD5]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-emerald-700" />
            <span className="tracking-wide">DEMO PIPELINE</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.2 rounded-xs font-mono font-black bg-[#064E3B] text-white">
            1-CLICK
          </span>
        </button>

        <div className="px-2 py-1 text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest flex items-center justify-between">
          <span>Platform Modules</span>
          <span className="text-stone-400">8 CORE</span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-sm text-xs transition-colors cursor-pointer group ${
                isActive
                  ? 'bg-[#F4EFE6] text-[#064E3B] font-bold border-l-2 border-l-[#064E3B] border-y border-r border-transparent'
                  : 'text-stone-700 hover:bg-[#FAF9F5] hover:text-[#0F172A] font-medium'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-[#064E3B]' : 'text-stone-400 group-hover:text-stone-700'
                }`} />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0 font-mono">
                <span className={`text-[10px] font-bold ${isActive ? 'text-[#064E3B]' : 'text-stone-400'}`}>
                  {item.moduleCode}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-xs border ${getBadgeClass(item.badgeVariant)}`}>
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* College & Department Endorsement Footer */}
      <div className="pt-3 border-t border-[#E2DDD5]">
        <div className="p-2.5 bg-[#FAF9F5] rounded-sm border border-[#E2DDD5] text-stone-600 font-mono text-[10px]">
          <div className="flex items-center space-x-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#064E3B]" />
            <span className="font-bold text-[#0F172A]">BEC Bagalkote — ISE</span>
          </div>
          <div className="text-stone-500">Mini Project BISA531P</div>
          <div className="text-[#064E3B] font-bold mt-1">Guide: Prof. P. R. Muttannavar</div>
        </div>
      </div>
    </aside>
  );
};
