import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { ZoomIn, ZoomOut, Maximize2, GitFork, Search, PlusCircle } from 'lucide-react';
import { CausalGraphData } from '../types';

interface CausalGraphViewProps {
  graphData: CausalGraphData;
  onSelectNode?: (nodeId: number) => void;
  onConvertCauseToDebt?: (cause: { id: number; description: string; category: string }) => void;
}

export const CausalGraphView: React.FC<CausalGraphViewProps> = ({ 
  graphData, 
  onSelectNode,
  onConvertCauseToDebt 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [layoutMode, setLayoutMode] = useState<'cose' | 'breadthfirst' | 'circle' | 'concentric'>('cose');
  const [searchQuery, setSearchQuery] = useState('');

  const initGraph = (layoutName: string) => {
    if (!containerRef.current) return;

    const getCategoryColors = (category: string, betweenness: number) => {
      if (betweenness > 0.08) {
        return { bg: '#FEF3C7', border: '#B45309', text: '#78350F' }; // High centrality (Brass Ochre)
      }
      switch (category?.toUpperCase()) {
        case 'ARCHITECTURE':
        case 'ARCHITECTURAL':
          return { bg: '#EFF6FF', border: '#1D4ED8', text: '#1E3A8A' }; // Royal Blue
        case 'DATABASE':
        case 'CONCURRENCY':
          return { bg: '#F1F5F9', border: '#0F172A', text: '#0F172A' }; // Midnight Navy
        case 'PERFORMANCE':
        case 'CODE_LOGIC':
          return { bg: '#FEF2F2', border: '#991B1B', text: '#7F1D1D' }; // Crimson
        case 'NETWORK':
        case 'INFRASTRUCTURE':
          return { bg: '#ECFDF5', border: '#065F46', text: '#064E3B' }; // Emerald
        default:
          return { bg: '#FFFFFF', border: '#64748B', text: '#1E293B' };
      }
    };

    const elements: cytoscape.ElementDefinition[] = [
      ...graphData.nodes.map((n) => {
        const colors = getCategoryColors(n.data.category, n.data.betweenness_centrality);

        return {
          data: {
            id: n.data.id,
            nodeId: n.data.node_id,
            label: n.data.label.length > 28 ? n.data.label.substring(0, 26) + '...' : n.data.label,
            fullLabel: n.data.label,
            category: n.data.category,
            degree: n.data.degree_centrality,
            betweenness: n.data.betweenness_centrality,
            incidentCount: n.data.incident_count,
            catColor: colors.bg,
            borderColor: colors.border,
            textColor: colors.text
          }
        };
      }),
      ...graphData.edges.map((e) => ({
        data: {
          id: e.data.id,
          source: e.data.source,
          target: e.data.target,
          relation: e.data.relation,
          weight: e.data.weight,
        }
      }))
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': 'data(catColor)',
            'border-color': 'data(borderColor)',
            'border-width': 2,
            'color': 'data(textColor)',
            'font-size': '10px',
            'font-weight': 'bold',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '110px',
            'width': 'mapData(betweenness, 0, 0.4, 75, 120)',
            'height': 'mapData(betweenness, 0, 0.4, 75, 120)',
            'shape': 'round-rectangle',
            'padding': '8px'
          }
        },
        {
          selector: 'node[betweenness > 0.05]',
          style: {
            'border-width': 3.5,
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#000000',
            'border-width': 4,
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#71717A',
            'target-arrow-color': '#000000',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.15,
            'opacity': 0.85
          }
        }
      ],
      layout: {
        name: layoutName,
        padding: 50,
        componentSpacing: 110,
        nodeRepulsion: () => 450000,
        directed: true
      } as any
    });

    cy.on('tap', 'node', (evt) => {
      const nodeData = evt.target.data();
      setSelectedNode(nodeData);
      if (onSelectNode) {
        onSelectNode(nodeData.nodeId);
      }
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;
  };

  useEffect(() => {
    initGraph(layoutMode);
    return () => {
      cyRef.current?.destroy();
    };
  }, [graphData, layoutMode]);

  // Handle node search highlight
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (!searchQuery.trim()) {
      cy.elements().removeClass('highlighted dimmed');
      return;
    }
    const q = searchQuery.toLowerCase();
    const matched = cy.nodes().filter((n) => {
      const label = (n.data('fullLabel') || '').toLowerCase();
      const cat = (n.data('category') || '').toLowerCase();
      return label.includes(q) || cat.includes(q);
    });

    cy.elements().addClass('dimmed');
    matched.removeClass('dimmed').addClass('highlighted');
  }, [searchQuery]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 40);

  return (
    <div className="relative w-full h-[560px] bg-white rounded-md border border-zinc-200 shadow-xs overflow-hidden flex flex-col">
      {/* Top Toolbar */}
      <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center space-x-2 text-xs text-zinc-700">
          <GitFork className="w-4 h-4 text-black" />
          <span className="font-bold text-black">Reusable Directed Causal Graph</span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-500 font-medium">{graphData.nodes.length} Nodes</span>
          <span className="text-zinc-300">•</span>
          <span className="text-zinc-500 font-medium">{graphData.edges.length} Directed Links</span>
        </div>

        {/* Layout Switcher & Search */}
        <div className="flex items-center space-x-2">
          {/* Quick Search inside graph */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Find cause node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2.5 py-1 text-xs rounded-md border border-zinc-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-black w-36 sm:w-44 text-black"
            />
          </div>

          {/* Layout Selector */}
          <div className="flex items-center space-x-1 bg-white border border-zinc-200 rounded-md p-0.5 text-xs text-zinc-600">
            <button
              onClick={() => setLayoutMode('cose')}
              className={`px-2 py-0.5 rounded-sm font-semibold text-[11px] transition-colors cursor-pointer ${
                layoutMode === 'cose' ? 'bg-black text-white font-bold' : 'hover:bg-zinc-100'
              }`}
            >
              Force
            </button>
            <button
              onClick={() => setLayoutMode('breadthfirst')}
              className={`px-2 py-0.5 rounded-sm font-semibold text-[11px] transition-colors cursor-pointer ${
                layoutMode === 'breadthfirst' ? 'bg-black text-white font-bold' : 'hover:bg-zinc-100'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setLayoutMode('concentric')}
              className={`px-2 py-0.5 rounded-sm font-semibold text-[11px] transition-colors cursor-pointer ${
                layoutMode === 'concentric' ? 'bg-black text-white font-bold' : 'hover:bg-zinc-100'
              }`}
            >
              Radial
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-0.5 border-l border-zinc-200 pl-1.5">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded-sm text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded-sm text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="p-1 rounded-sm text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Graph Canvas with Engineering Grid */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full bg-zinc-50/50 cursor-grab active:cursor-grabbing" 
        style={{ 
          backgroundImage: 'radial-gradient(#D4D4D8 1.2px, transparent 1.2px)', 
          backgroundSize: '24px 24px' 
        }}
      />

      {/* Category Legend Pill */}
      <div className="absolute top-14 left-4 z-10 flex flex-wrap gap-1.5 bg-white/95 backdrop-blur-xs p-1.5 rounded-md border border-zinc-200 shadow-xs text-[10px] text-zinc-600">
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-black" />
          <span>Database</span>
        </span>
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          <span>Network</span>
        </span>
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          <span>Architecture</span>
        </span>
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
          <span>Concurrency</span>
        </span>
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          <span>Performance</span>
        </span>
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-sm bg-zinc-100 text-black border border-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-black" />
          <span>Memory</span>
        </span>
      </div>

      {/* Selected Node Inspector Drawer */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-[420px] bg-white/98 backdrop-blur-md rounded-md p-4 border border-zinc-300 shadow-xl z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-black text-white font-mono">
                {selectedNode.category}
              </span>
              <h4 className="mt-1.5 text-xs font-bold text-black leading-snug">
                {selectedNode.fullLabel}
              </h4>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-zinc-400 hover:text-black text-xs font-bold p-1 rounded-md hover:bg-zinc-100 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 text-center">
            <div className="p-2 bg-zinc-50 rounded-sm border border-zinc-200">
              <div className="text-[10px] text-zinc-500 font-medium">Betweenness</div>
              <div className="text-xs font-mono font-bold text-black">{selectedNode.betweenness}</div>
            </div>
            <div className="p-2 bg-zinc-50 rounded-sm border border-zinc-200">
              <div className="text-[10px] text-zinc-500 font-medium">Degree Centrality</div>
              <div className="text-xs font-mono font-bold text-zinc-700">{selectedNode.degree}</div>
            </div>
            <div className="p-2 bg-zinc-50 rounded-sm border border-zinc-200">
              <div className="text-[10px] text-zinc-500 font-medium">Linked Incidents</div>
              <div className="text-xs font-bold text-black">{selectedNode.incidentCount}</div>
            </div>
          </div>

          {onConvertCauseToDebt && (
            <button
              onClick={() => onConvertCauseToDebt({
                id: selectedNode.nodeId,
                description: selectedNode.fullLabel,
                category: selectedNode.category
              })}
              className="mt-3 w-full py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-md text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer border border-blue-800"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Remediation Debt Item for this Root Cause</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
