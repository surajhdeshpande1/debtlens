import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  LayoutDashboard, 
  AlertCircle, 
  GitFork, 
  Coins, 
  GitBranch, 
  Sparkles, 
  Calculator, 
  BookOpen, 
  FileDown, 
  Plus, 
  RotateCcw,
  ArrowRight,
  Command
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { api } from '../services/api';
import { Incident, DebtItem, CauseNode } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenIncidentModal: () => void;
  onOpenDebtModal: () => void;
  onDownloadPdf: () => void;
  onReloadSeed: () => void;
  projectId: number;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions' | 'Incidents' | 'Technical Debt' | 'Causal Weaknesses';
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  badge?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenIncidentModal,
  onOpenDebtModal,
  onDownloadPdf,
  onReloadSeed,
  projectId
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [causes, setCauses] = useState<CauseNode[]>([]);

  // Fetch telemetry for live fuzzy searching
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      Promise.all([
        api.getIncidents(projectId).catch(() => []),
        api.getDebtItems(projectId).catch(() => []),
        api.getCauseNodes(projectId).catch(() => [])
      ]).then(([incList, debtList, causeList]) => {
        setIncidents(incList);
        setDebts(debtList);
        setCauses(causeList);
      });
    }
  }, [isOpen, projectId]);

  // Static commands
  const staticItems: CommandItem[] = useMemo(() => [
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      title: 'Executive Overview',
      subtitle: 'High-level telemetry, cumulative financial drag & KPIs',
      icon: LayoutDashboard,
      badge: 'M8',
      action: () => { onNavigateTab('dashboard'); onClose(); }
    },
    {
      id: 'nav-incidents',
      category: 'Navigation',
      title: 'Incident Management',
      subtitle: 'Active outages, MTTR tracking, and 5-Whys convergence',
      icon: AlertCircle,
      badge: 'M2',
      action: () => { onNavigateTab('incidents'); onClose(); }
    },
    {
      id: 'nav-causal',
      category: 'Navigation',
      title: 'Causal Graph (5 Whys)',
      subtitle: 'Directed network graph with NetworkX betweenness centrality',
      icon: GitFork,
      badge: 'M3',
      action: () => { onNavigateTab('causal'); onClose(); }
    },
    {
      id: 'nav-debt',
      category: 'Navigation',
      title: 'Technical Debt Ledger',
      subtitle: 'Break-even debt pricing: Principal P(d) vs Interest I(d)',
      icon: Coins,
      badge: 'M4',
      action: () => { onNavigateTab('debt'); onClose(); }
    },
    {
      id: 'nav-repo',
      category: 'Navigation',
      title: 'Repository Evidence & AST',
      subtitle: 'McCabe cyclomatic complexity, code churn & SATD markers',
      icon: GitBranch,
      badge: 'M5',
      action: () => { onNavigateTab('repository'); onClose(); }
    },
    {
      id: 'nav-intel',
      category: 'Navigation',
      title: 'Incident Intelligence',
      subtitle: 'Hybrid cosine similarity, TF-IDF, DBSCAN clustering & regressions',
      icon: Sparkles,
      badge: 'M6',
      action: () => { onNavigateTab('intelligence'); onClose(); }
    },
    {
      id: 'nav-optimiser',
      category: 'Navigation',
      title: 'Payoff Optimiser (0/1 Knapsack)',
      subtitle: 'Constrained dynamic programming over debt dependencies',
      icon: Calculator,
      badge: 'M7',
      action: () => { onNavigateTab('optimiser'); onClose(); }
    },
    {
      id: 'nav-knowledge',
      category: 'Navigation',
      title: 'Knowledge Base & Academic Audit',
      subtitle: 'Post-mortems, literature survey citations & viva defense guide',
      icon: BookOpen,
      badge: 'M8',
      action: () => { onNavigateTab('knowledge'); onClose(); }
    },
    {
      id: 'act-incident',
      category: 'Actions',
      title: 'Intake New Incident',
      subtitle: 'Register production failure with guided 5-Whys chain',
      icon: Plus,
      action: () => { onClose(); onOpenIncidentModal(); }
    },
    {
      id: 'act-debt',
      category: 'Actions',
      title: 'Register Technical Debt Item',
      subtitle: 'Quantify principal effort and link to root causes',
      icon: Plus,
      action: () => { onClose(); onOpenDebtModal(); }
    },
    {
      id: 'act-pdf',
      category: 'Actions',
      title: 'Export PDF Audit Report',
      subtitle: 'Download formal multi-page ReportLab documentation',
      icon: FileDown,
      action: () => { onClose(); onDownloadPdf(); }
    },
    {
      id: 'act-reload',
      category: 'Actions',
      title: 'Reload Enterprise Seed Dataset',
      subtitle: 'Reset platform to baseline FinTech corpus',
      icon: RotateCcw,
      action: () => { onClose(); onReloadSeed(); }
    }
  ], [onNavigateTab, onOpenIncidentModal, onOpenDebtModal, onDownloadPdf, onReloadSeed, onClose]);

  // Dynamic telemetry items based on live database
  const dynamicItems: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [];

    incidents.forEach(inc => {
      list.push({
        id: `inc-${inc.id}`,
        category: 'Incidents',
        title: `${inc.incident_number}: ${inc.title}`,
        subtitle: `${inc.severity} • ${inc.status} • Module: ${inc.affected_module}`,
        icon: AlertCircle,
        badge: inc.severity,
        action: () => {
          onNavigateTab('incidents');
          onClose();
        }
      });
    });

    debts.forEach(d => {
      list.push({
        id: `debt-${d.id}`,
        category: 'Technical Debt',
        title: `${d.debt_key}: ${d.title}`,
        subtitle: `${d.category} • Principal: ${d.effort_principal}h • Interest: ${d.accrued_interest}h`,
        icon: Coins,
        badge: d.break_even_status ? 'PAST BREAK-EVEN' : d.status,
        action: () => {
          onNavigateTab('debt');
          onClose();
        }
      });
    });

    causes.forEach(c => {
      list.push({
        id: `cause-${c.id}`,
        category: 'Causal Weaknesses',
        title: c.description,
        subtitle: `Category: ${c.category} • Betweenness: ${c.betweenness_centrality.toFixed(3)}`,
        icon: GitFork,
        badge: c.category,
        action: () => {
          onNavigateTab('causal');
          onClose();
        }
      });
    });

    return list;
  }, [incidents, debts, causes, onNavigateTab, onClose]);

  const allItems = useMemo(() => [...staticItems, ...dynamicItems], [staticItems, dynamicItems]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return staticItems;
    return allItems.filter(item => 
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [query, staticItems, allItems]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in">
      
      {/* Modal Dialog Card */}
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 bg-slate-50/50">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search modules, incidents, debt ledger, root causes, or actions..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-500 bg-white border border-slate-200 rounded-md shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-50">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No results found for &ldquo;<span className="font-semibold text-slate-800">{query}</span>&rdquo;. Try searching for an incident ID like <code className="px-1.5 py-0.5 rounded-sm bg-slate-100 font-mono text-indigo-600">INC-101</code> or debt keyword like <code className="px-1.5 py-0.5 rounded-sm bg-slate-100 font-mono text-indigo-600">connection pool</code>.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-indigo-50 text-indigo-900' 
                      : 'hover:bg-slate-50/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className={`p-2 rounded-lg border ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-sm border uppercase ${
                            item.badge.includes('BREAK-EVEN')
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isSelected
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pl-3 shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.category}
                    </span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[10px]">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[10px]">↵</kbd>
              <span>Select</span>
            </span>
          </div>

          <span className="text-slate-400 text-[10px]">
            DebtLens Intelligence Quick Nav
          </span>
        </div>

      </div>
    </div>
  );
};

