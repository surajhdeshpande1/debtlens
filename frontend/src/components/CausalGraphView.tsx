import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { ZoomIn, ZoomOut, Maximize2, GitFork, Search, PlusCircle, Layers, Sliders } from 'lucide-react';
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

    const elements: cytoscape.ElementDefinition[] = [
      ...graphData.nodes.map((n) => {
        let catColor = '#EEF2FF';
        let borderColor = '#4F46E5';
        const cat = (n.data.category || '').toUpperCase();
        if (cat === 'DATABASE') { catColor = '#EFF6FF'; borderColor = '#2563EB'; }
        else if (cat === 'NETWORK') { catColor = '#F0F9FF'; borderColor = '#0284C7'; }
        else if (cat === 'ARCHITECTURE') { catColor = '#FAF5FF'; borderColor = '#9333EA'; }
        else if (cat === 'CONCURRENCY') { catColor = '#FFFBEB'; borderColor = '#D97706'; }
        else if (cat === 'PERFORMANCE') { catColor = '#ECFDF5'; borderColor = '#059669'; }
        else if (cat === 'MEMORY') { catColor = '#FFF1F2'; borderColor = '#E11D48'; }

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
            catColor,
            borderColor
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
            'color': '#0F172A',
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
            'border-color': '#0F172A',
            'border-width': 4,
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#94A3B8',
            'target-arrow-color': '#64748B',
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
    <div className="relative w-full h-[560px] bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Top Toolbar */}
      <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center space-x-2 text-xs text-slate-700">
          <GitFork className="w-4 h-4 text-indigo-600" />
          <span className="font-bold text-slate-900">Reusable Directed Causal Graph</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-medium">{graphData.nodes.length} Nodes</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-medium">{graphData.edges.length} Directed Links</span>
        </div>

        {/* Layout Switcher & Search */}
        <div className="flex items-center space-x-2">
          {/* Quick Search inside graph */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Find cause node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-36 sm:w-44"
            />
          </div>

          {/* Layout Selector */}
          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5 text-xs text-slate-600">
            <button
              onClick={() => setLayoutMode('cose')}
              className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                layoutMode === 'cose' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-100'
              }`}
            >
              Force
            </button>
            <button
              onClick={() => setLayoutMode('breadthfirst')}
              className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                layoutMode === 'breadthfirst' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-100'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setLayoutMode('concentric')}
              className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                layoutMode === 'concentric' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-100'
              }`}
            >
              Radial
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-0.5 border-l border-slate-200 pl-1.5">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded-md text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded-md text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="p-1 rounded-md text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Graph Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full bg-slate-50/20 cursor-grab active:cursor-grabbing" />

      {/* Category Legend Pill */}
      <div className="absolute top-14 left-4 z-10 flex flex-wrap gap-1.5 bg-white/90 backdrop-blur-xs p-1.5 rounded-lg border border-slate-200 shadow-xs text-[10px] text-slate-600">
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          <span>Database</span>
        </span>
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
          <span>Network</span>
        </span>
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          <span>Architecture</span>
        </span>
        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          <span>Concurrency</span>
        </span>
      </div>

      {/* Selected Node Inspector Drawer */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-[420px] bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-indigo-200 shadow-xl z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                {selectedNode.category}
              </span>
              <h4 className="mt-1.5 text-xs font-bold text-slate-900 leading-snug">
                {selectedNode.fullLabel}
              </h4>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 bg-slate-50 rounded-xl">
              <div className="text-[10px] text-slate-500 font-medium">Betweenness</div>
              <div className="text-xs font-mono font-bold text-indigo-600">{selectedNode.betweenness}</div>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <div className="text-[10px] text-slate-500 font-medium">Degree Centrality</div>
              <div className="text-xs font-mono font-bold text-indigo-600">{selectedNode.degree}</div>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <div className="text-[10px] text-slate-500 font-medium">Linked Incidents</div>
              <div className="text-xs font-bold text-slate-800">{selectedNode.incidentCount}</div>
            </div>
          </div>

          {onConvertCauseToDebt && (
            <button
              onClick={() => onConvertCauseToDebt({
                id: selectedNode.nodeId,
                description: selectedNode.fullLabel,
                category: selectedNode.category
              })}
              className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
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
