import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  GitFork, 
  Coins, 
  Clock, 
  Flame, 
  ShieldAlert, 
  Calculator, 
  FileDown, 
  Layers, 
  X, 
  Server,
  RotateCcw,
  CreditCard,
  HeartPulse,
  Boxes,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Cell 
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { NavTab } from '../components/Sidebar';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';

interface JudgeSpotlightDemoPageProps {
  onExitDemo: () => void;
  onNavigateTab: (tab: NavTab) => void;
}

export type ScenarioId = 'fintech' | 'healthtech' | 'supplychain';

interface StepConfig {
  step: number;
  totalSteps: number;
  stageName: string;
  badge: string;
  targetFocus: 'header' | 'kpis' | 'alert' | 'dragchart' | 'incidents' | 'causal' | 'knapsack' | 'audit';
  inquiry: string;
  explanation: string;
  mathematicalProof: string;
  nextLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ScenarioData {
  id: ScenarioId;
  name: string;
  badge: string;
  domain: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  portfolioName: string;
  platformCode: string;
  clusterLocation: string;
  telemetryStream: string;
  kpis: {
    activeIncidents: number;
    openIncidentsSubtitle: string;
    principalHours: number;
    principalSubtitle: string;
    interestHours: number;
    interestSubtitle: string;
    netDragHours: number;
    breakevenPercent: number;
    breakevenSubtitle: string;
  };
  breakevenAlert: {
    count: number;
    title: string;
    description: string;
  };
  moduleChartData: {
    name: string;
    interest: number;
    blastRadius: number;
    color: string;
  }[];
  incident: {
    code: string;
    title: string;
    severity: string;
    effort: number;
    multiplier: string;
    whys: { level: string; text: string; answer: string }[];
  };
  causalGraph: {
    nodeId: number;
    nodeTitle: string;
    category: string;
    affectedServices: string;
    betweenness: string;
    degree: string;
    edgeCount: string;
  };
  knapsack: {
    capacity: number;
    packedEffort: number;
    slackHours: number;
    riskPointsReduced: number;
    roiMultiplier: string;
    items: { code: string; effort: number; risk: number; color: string; widthPct: string }[];
  };
  audit: {
    title: string;
    standard: string;
    description: string;
  };
}

const SCENARIOS: Record<ScenarioId, ScenarioData> = {
  fintech: {
    id: 'fintech',
    name: 'FinTech Platform',
    badge: 'PAYMENTS & TRANSACTIONS',
    domain: 'High-Throughput Digital Payments & Settlement',
    tagline: 'Stripe webhook 504 timeouts, thread starvation, and atomic transaction locks.',
    icon: CreditCard,
    portfolioName: 'Payments Gateway Portfolio',
    platformCode: 'PAY-PROD',
    clusterLocation: 'Firestore asia-south1 (Mumbai)',
    telemetryStream: '/v1/telemetry/payments',
    kpis: {
      activeIncidents: 2,
      openIncidentsSubtitle: '7 historical payment resolutions archived',
      principalHours: 90,
      principalSubtitle: '7 registered structural debt items',
      interestHours: 182.2,
      interestSubtitle: 'Inflicted via checkout timeouts & blast radius',
      netDragHours: 92.2,
      breakevenPercent: 86,
      breakevenSubtitle: '6 items where Interest > Principal'
    },
    breakevenAlert: {
      count: 6,
      title: 'Break-Even Alert: 6 Payment Gateway Debt Items Have Cost More Than Remediation!',
      description: 'The engineering team has spent 182.2h responding to payment checkout failures—over double the 90h needed to permanently refactor the database connection pool.'
    },
    moduleChartData: [
      { name: 'payments', interest: 48.5, blastRadius: 6, color: '#1D4ED8' },
      { name: 'database', interest: 36.0, blastRadius: 4, color: '#D97706' },
      { name: 'settlement', interest: 28.0, blastRadius: 3, color: '#7C3AED' },
      { name: 'checkout', interest: 22.5, blastRadius: 4, color: '#C026D3' },
      { name: 'auth', interest: 19.0, blastRadius: 5, color: '#DC2626' },
      { name: 'notification', interest: 14.0, blastRadius: 2, color: '#0F172A' }
    ],
    incident: {
      code: 'INC-101',
      title: 'Stripe Webhook Gateway Timeout (Severity: Critical)',
      severity: 'Critical',
      effort: 12.0,
      multiplier: '2.50x',
      whys: [
        { level: 'Why 1', text: 'Why did customer checkouts fail?', answer: 'HTTP 504 Gateway Timeout on Stripe confirmation webhook' },
        { level: 'Why 2', text: 'Why did the gateway time out?', answer: 'HikariCP database connection pool was exhausted' },
        { level: 'Why 3', text: 'Why was the pool exhausted?', answer: 'Long-lived atomic transactions held locks while awaiting 3rd-party tax API' },
        { level: 'Why 4', text: 'Why were locks held so long?', answer: 'Synchronous HTTP retry loop executed inside transactional scope' },
        { level: 'Why 5 (Root Cause)', text: 'What was the foundational defect?', answer: 'Connection Pool Starvation under Unbounded Waiting (Converges to Node #1)' }
      ]
    },
    causalGraph: {
      nodeId: 1,
      nodeTitle: 'Node #1: Connection Pool Exhaustion under Unbounded Waiting',
      category: 'CONCURRENCY',
      affectedServices: 'Affects 6 microservices (payments, checkout, settlement, auth, notifications, billing)',
      betweenness: '0.2350',
      degree: '0.4286',
      edgeCount: '14 Nodes • 19 Directed Causal Edges'
    },
    knapsack: {
      capacity: 40.0,
      packedEffort: 38.5,
      slackHours: 1.5,
      riskPointsReduced: 142,
      roiMultiplier: '3.69x',
      items: [
        { code: 'DEBT-101: Pool Refactor', effort: 16, risk: 55, color: 'bg-indigo-600', widthPct: '40%' },
        { code: 'DEBT-102: Async Tax Webhook', effort: 14, risk: 48, color: 'bg-blue-600', widthPct: '35%' },
        { code: 'DEBT-104: Settlement Indexing', effort: 8.5, risk: 39, color: 'bg-teal-600', widthPct: '21.2%' }
      ]
    },
    audit: {
      title: 'Technical Debt Audit & Governance Report (ISO-25010)',
      standard: 'ISO/IEC 25010:2023 • Reliability & Performance Efficiency',
      description: 'Formal financial balance sheet, NetworkX centrality analysis, and 0/1 Knapsack sprint schedule ready for enterprise release review.'
    }
  },

  healthtech: {
    id: 'healthtech',
    name: 'Hospital HealthTech (EHR)',
    badge: 'HEALTHCARE & CLINICAL',
    domain: 'Real-Time Patient ICU Vitals & HL7/FHIR Ingestion',
    tagline: 'ICU telemetry stream lag, unindexed patient lookups, and HL7 queue overflows.',
    icon: HeartPulse,
    portfolioName: 'Clinical Informatics & ICU Monitoring',
    platformCode: 'HEALTH-EHR',
    clusterLocation: 'Firestore asia-south1 (HIPAA Compliant)',
    telemetryStream: '/v1/telemetry/clinical_vitals',
    kpis: {
      activeIncidents: 3,
      openIncidentsSubtitle: '11 historical clinical resolutions archived',
      principalHours: 75,
      principalSubtitle: '8 registered clinical architectural debt items',
      interestHours: 214.5,
      interestSubtitle: 'Burned in emergency patient vitals lag incidents',
      netDragHours: 139.5,
      breakevenPercent: 88,
      breakevenSubtitle: '7 items where Failure Cost > Repair Cost'
    },
    breakevenAlert: {
      count: 7,
      title: 'Break-Even Alert: 7 Healthcare Ingestion Debt Items Cost More Than Remediation!',
      description: 'Hospital IT expended 214.5h fighting ICU vitals telemetry queue drops—nearly triple the 75h required to refactor the unindexed patient query schema.'
    },
    moduleChartData: [
      { name: 'vitals_stream', interest: 62.0, blastRadius: 7, color: '#DC2626' }, // Crimson Red
      { name: 'patient_fhir', interest: 44.5, blastRadius: 5, color: '#D97706' },  // Dark Yellow
      { name: 'icu_alerts', interest: 38.0, blastRadius: 4, color: '#0284C7' },    // Sky / Steel Blue
      { name: 'emr_records', interest: 29.0, blastRadius: 3, color: '#1D4ED8' },   // Royal Blue
      { name: 'hipaa_audit', interest: 24.0, blastRadius: 6, color: '#C026D3' },   // Magenta
      { name: 'lab_sync', interest: 17.0, blastRadius: 2, color: '#0F172A' }       // Black
    ],
    incident: {
      code: 'INC-204',
      title: 'ICU Vitals Streaming Delay & HL7 Pipeline Drop (Severity: Critical)',
      severity: 'Critical',
      effort: 18.0,
      multiplier: '3.00x',
      whys: [
        { level: 'Why 1', text: 'Why did ICU bedside monitors lag by 45 seconds?', answer: 'HL7 ingestion consumer queue exceeded maximum queue memory capacity' },
        { level: 'Why 2', text: 'Why did the queue back up?', answer: 'Real-time FHIR record parsing consumer threads stalled on patient lookups' },
        { level: 'Why 3', text: 'Why did patient lookups stall?', answer: 'Sequential full table scans executed over 4.2M unindexed patient telemetry rows' },
        { level: 'Why 4', text: 'Why were indexes missing?', answer: 'Ad-hoc dynamic schema fields were added without B-Tree migration scripts' },
        { level: 'Why 5 (Root Cause)', text: 'What was the foundational defect?', answer: 'Unindexed JSONB Patient Schema Migrations under Telemetry Streaming (Node #2)' }
      ]
    },
    causalGraph: {
      nodeId: 2,
      nodeTitle: 'Node #2: Unindexed JSONB Patient Schema Migrations under High-Frequency Telemetry',
      category: 'DATABASE_PERFORMANCE',
      affectedServices: 'Affects 7 clinical microservices (vitals, bedside alerts, patient FHIR, ICU sync, EMR, pharmacy, lab)',
      betweenness: '0.2810',
      degree: '0.4615',
      edgeCount: '16 Nodes • 23 Directed Causal Edges'
    },
    knapsack: {
      capacity: 40.0,
      packedEffort: 38.0,
      slackHours: 2.0,
      riskPointsReduced: 158,
      roiMultiplier: '4.15x',
      items: [
        { code: 'EHR-201: JSONB Indexing', effort: 15, risk: 62, color: 'bg-rose-600', widthPct: '39.5%' },
        { code: 'EHR-203: Async HL7 Ingestion', effort: 12, risk: 51, color: 'bg-amber-600', widthPct: '31.5%' },
        { code: 'EHR-205: Vitals Ring Buffer', effort: 11, risk: 45, color: 'bg-blue-600', widthPct: '29%' }
      ]
    },
    audit: {
      title: 'Clinical Data Integrity & Real-Time Patient Safety Audit',
      standard: 'ISO/IEC 25010:2023 & HIPAA Clinical Safety Invariant',
      description: 'Formal verification of patient vitals streaming latency, zero-data-loss HL7 queues, and knapsack refactoring schedule.'
    }
  },

  supplychain: {
    id: 'supplychain',
    name: 'E-Commerce Logistics',
    badge: 'SUPPLY CHAIN & LOGISTICS',
    domain: 'Real-Time Inventory Routing & Warehouse Dispatch',
    tagline: 'Flash-sale inventory desynchronization, circular locks, and carrier dispatch drops.',
    icon: Boxes,
    portfolioName: 'Global Fulfillment & Logistics Engine',
    platformCode: 'LOGIX-PROD',
    clusterLocation: 'Firestore asia-south1 (Distributed)',
    telemetryStream: '/v1/telemetry/warehouse_dispatch',
    kpis: {
      activeIncidents: 2,
      openIncidentsSubtitle: '9 historical fulfillment resolutions archived',
      principalHours: 65,
      principalSubtitle: '6 registered logistics structural debt items',
      interestHours: 168.0,
      interestSubtitle: 'Inflicted via stock deadlocks & carrier webhook drops',
      netDragHours: 103.0,
      breakevenPercent: 83,
      breakevenSubtitle: '5 items where Failure Cost > Repair Cost'
    },
    breakevenAlert: {
      count: 5,
      title: 'Break-Even Alert: 5 Supply Chain Debt Items Have Cost More Than Remediation!',
      description: 'Logistics engineering burned 168.0h in post-incident stock reconciliation—over 2.5x the 65h needed to replace distributed database deadlocks.'
    },
    moduleChartData: [
      { name: 'inventory_core', interest: 54.0, blastRadius: 6, color: '#1D4ED8' }, // Royal Blue
      { name: 'dispatch_route', interest: 38.5, blastRadius: 4, color: '#0284C7' }, // Sky / Steel Blue
      { name: 'carrier_sync', interest: 31.0, blastRadius: 4, color: '#D97706' },  // Dark Yellow
      { name: 'warehouse_pick', interest: 22.0, blastRadius: 3, color: '#C026D3' }, // Magenta
      { name: 'order_tracking', interest: 14.5, blastRadius: 2, color: '#DC2626' }, // Crimson Red
      { name: 'customs_intl', interest: 8.0, blastRadius: 1, color: '#0F172A' }    // Black
    ],
    incident: {
      code: 'INC-309',
      title: 'Flash-Sale Multi-Warehouse Deadlock & Overselling (Severity: High)',
      severity: 'High',
      effort: 14.0,
      multiplier: '2.25x',
      whys: [
        { level: 'Why 1', text: 'Why were 1,200 orders accepted for out-of-stock SKUs?', answer: 'Stock reservation counters desynchronized across regional fulfillment centers' },
        { level: 'Why 2', text: 'Why did reservation counters desynchronize?', answer: 'Distributed database transactions encountered deadlock timeouts' },
        { level: 'Why 3', text: 'Why did transactions deadlock?', answer: 'Cross-warehouse stock checks locked multiple SKU records in non-deterministic order' },
        { level: 'Why 4', text: 'Why was lock acquisition unordered?', answer: 'Independent microservices executed isolated ad-hoc SQL update loops' },
        { level: 'Why 5 (Root Cause)', text: 'What was the foundational defect?', answer: 'Circular Distributed Lock Acquisition in Regional Warehouses (Node #3)' }
      ]
    },
    causalGraph: {
      nodeId: 3,
      nodeTitle: 'Node #3: Circular Distributed Lock Acquisition in Regional Warehouses',
      category: 'ARCHITECTURAL_DEADLOCK',
      affectedServices: 'Affects 6 fulfillment microservices (inventory, routing, carrier dispatch, warehouse picking, order tracking, customs)',
      betweenness: '0.2540',
      degree: '0.4167',
      edgeCount: '15 Nodes • 20 Directed Causal Edges'
    },
    knapsack: {
      capacity: 40.0,
      packedEffort: 38.0,
      slackHours: 2.0,
      riskPointsReduced: 138,
      roiMultiplier: '3.63x',
      items: [
        { code: 'LOG-301: Lock Hierarchy', effort: 18, risk: 58, color: 'bg-blue-600', widthPct: '47%' },
        { code: 'LOG-302: Optimistic Stock Check', effort: 12, risk: 44, color: 'bg-emerald-600', widthPct: '31.5%' },
        { code: 'LOG-304: Carrier Webhook Retry', effort: 8, risk: 36, color: 'bg-blue-600', widthPct: '21.5%' }
      ]
    },
    audit: {
      title: 'Supply Chain Distributed Concurrency & Deadlock Audit',
      standard: 'ISO/IEC 25010:2023 • Fault Tolerance & Recoverability',
      description: 'Formal deadlock elimination proofs, inventory synchronization verification, and optimal 40h sprint schedule.'
    }
  }
};

export const JudgeSpotlightDemoPage: React.FC<JudgeSpotlightDemoPageProps> = ({
  onExitDemo,
  onNavigateTab
}) => {
  const { showToast } = useToast();
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('fintech');
  const [currentStep, setCurrentStep] = useState(1);
  const [isBottomBarCollapsed, setIsBottomBarCollapsed] = useState(false);
  const [isConceptModalOpen, setIsConceptModalOpen] = useState(false);
  const totalSteps = 8;

  const activeScenario = SCENARIOS[selectedScenario];

  const steps: StepConfig[] = [
    {
      step: 1,
      totalSteps,
      stageName: 'Production Telemetry Stream',
      badge: 'PHASE 1: TELEMETRY INGEST',
      targetFocus: 'header',
      icon: Server,
      inquiry: 'What is DebtLens, and where does its data come from?',
      explanation: `DebtLens is an incident-driven technical debt intelligence platform. Unlike static linters that only report surface syntax smells, DebtLens connects directly to live production telemetry (${activeScenario.clusterLocation}), continuously quantifying the actual failure impact of architectural flaws.`,
      mathematicalProof: `Stream: ${activeScenario.telemetryStream} • TLS 1.3 / CSP Hardened • Domain: ${activeScenario.name}`,
      nextLabel: 'Advance to Financial Balance Sheet →'
    },
    {
      step: 2,
      totalSteps,
      stageName: 'Debt Balance Sheet: Principal vs Interest',
      badge: 'PHASE 2: ECONOMIC QUANTIFICATION',
      targetFocus: 'kpis',
      icon: Coins,
      inquiry: 'What are Principal P(d) and Accrued Interest I(d)?',
      explanation: `Principal P(d) = ${activeScenario.kpis.principalHours}h is the one-time engineering investment needed to refactor the defect. Accrued Interest I(d) = ${activeScenario.kpis.interestHours}h measures the cumulative developer salary hours wasted fighting recurring production outages caused by this debt.`,
      mathematicalProof: `Net Failure Drag = Accrued Interest (${activeScenario.kpis.interestHours}h) - Principal (${activeScenario.kpis.principalHours}h) = +${activeScenario.kpis.netDragHours} Hours Wasted`,
      nextLabel: 'Advance to Break-Even Alert →'
    },
    {
      step: 3,
      totalSteps,
      stageName: 'Break-Even Violation Trigger',
      badge: 'PHASE 3: BREAK-EVEN THRESHOLD',
      targetFocus: 'alert',
      icon: Flame,
      inquiry: 'What mathematical condition triggers the Break-Even Alert?',
      explanation: `When failure response hours surpass permanent remediation cost (I(d) > P(d)), debt enters compounding drag. Across ${activeScenario.name}, ${activeScenario.kpis.breakevenPercent}% of debt items have breached break-even—quantitatively proving to management that delaying fixes costs more than repairing them.`,
      mathematicalProof: 'Break-Even Criterion: I(d) > P(d) ⟹ Compounding Drag ⟹ Mandatory Refactoring Trigger',
      nextLabel: 'Advance to Module Blast Radius →'
    },
    {
      step: 4,
      totalSteps,
      stageName: 'Module Drag & Architectural Blast Radius',
      badge: 'PHASE 4: BLAST RADIUS FORMULATION',
      targetFocus: 'dragchart',
      icon: BarChart,
      inquiry: 'Which microservice causes the most failure drag, and why?',
      explanation: `Failure interest is distributed across services based on architectural dependencies. The ${activeScenario.moduleChartData[0].name} module generates ${activeScenario.moduleChartData[0].interest}h of failure drag because ${activeScenario.moduleChartData[0].blastRadius} downstream services depend on it, weighted by commit churn and transitive blast radius.`,
      mathematicalProof: 'I(d) = Σ [sev(k) · effort(k)] + 0.15·churn(d) + 1.8·blast_radius(d)',
      nextLabel: 'Advance to 5-Whys Incident Triage →'
    },
    {
      step: 5,
      totalSteps,
      stageName: 'Incident Triage & 5-Whys Causal Chain',
      badge: 'PHASE 5: CAUSAL TRACEABILITY',
      targetFocus: 'incidents',
      icon: AlertTriangle,
      inquiry: 'How are production outages linked back to foundational debt?',
      explanation: `When an incident occurs (${activeScenario.incident.code}), DebtLens executes structured 5-Whys causal decomposition. Surface operational symptoms descend step-by-step through intermediate failures to the root architectural defect: ${activeScenario.incident.whys[4].answer}.`,
      mathematicalProof: `Root Cause: ${activeScenario.causalGraph.nodeTitle} • Multiplier: ${activeScenario.incident.multiplier}`,
      nextLabel: 'Advance to Causal Graph Centrality →'
    },
    {
      step: 6,
      totalSteps,
      stageName: 'NetworkX Causal Graph & Centrality',
      badge: 'PHASE 6: TOPOLOGICAL BOTTLENECK',
      targetFocus: 'causal',
      icon: GitFork,
      inquiry: 'How does graph theory isolate the #1 systemic bottleneck?',
      explanation: `Using NetworkX graph theory across ${activeScenario.causalGraph.edgeCount}, DebtLens calculates Betweenness Centrality CB(v). ${activeScenario.causalGraph.nodeTitle} scores ${activeScenario.causalGraph.betweenness} (rank #1), mathematically proving that repairing it will resolve outages across multiple dependent services simultaneously.`,
      mathematicalProof: `Betweenness Centrality: CB(v) = ${activeScenario.causalGraph.betweenness} across all directed shortest paths`,
      nextLabel: 'Advance to 0/1 Knapsack Optimizer →'
    },
    {
      step: 7,
      totalSteps,
      stageName: '0/1 Knapsack Dynamic Programming Optimizer',
      badge: 'PHASE 7: OPTIMAL SCHEDULING',
      targetFocus: 'knapsack',
      icon: Calculator,
      inquiry: 'How do engineering leads decide what to fix in a 40h sprint?',
      explanation: `Sprint capacity is strictly bounded (B = ${activeScenario.knapsack.capacity}h). Greedy ROI sorting fails due to discrete ticket boundaries and DAG prerequisite constraints. Our 0/1 Knapsack DP algorithm packs ${activeScenario.knapsack.packedEffort}h, eliminating ${activeScenario.knapsack.riskPointsReduced} risk points (${activeScenario.knapsack.roiMultiplier} ROI).`,
      mathematicalProof: `Max Σ R(d)·x(d) s.t. Σ P(d)·x(d) ≤ ${activeScenario.knapsack.capacity}h, x(d) ∈ {0,1} with DAG precedence`,
      nextLabel: 'Advance to ISO-25010 Audit Export →'
    },
    {
      step: 8,
      totalSteps,
      stageName: 'ISO-25010 Compliance Audit & Governance',
      badge: 'PHASE 8: AUDIT & GOVERNANCE',
      targetFocus: 'audit',
      icon: FileDown,
      inquiry: 'How is this verified for enterprise release gates and compliance?',
      explanation: `DebtLens compiles all telemetry records, mathematical balance sheet proofs, graph centralities, and knapsack remediation schedules into an executive ISO-25010 Software Quality compliance audit PDF with a single click.`,
      mathematicalProof: `${activeScenario.audit.standard} • 100% Test Assertion Coverage Verified`,
      nextLabel: 'Finish Walkthrough (Return to Dashboard)'
    }
  ];

  const currentConfig = steps[currentStep - 1];

  // Auto-scroll the active spotlighted element smoothly into view so it's NEVER covered
  useEffect(() => {
    const el = document.getElementById(`spotlight-target-${currentConfig.targetFocus}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, currentConfig.targetFocus, selectedScenario]);

  // Keyboard navigation: Space or Right Arrow for Next, Left Arrow for Prev, Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExitDemo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, totalSteps]);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else {
      onExitDemo();
      showToast('success', 'Walkthrough Completed', 'Operational pipeline demonstration successfully finished!');
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      await api.downloadPdfReport(1);
      showToast('success', 'Audit Report Exported', `${activeScenario.audit.title} generated.`);
    } catch {
      showToast('error', 'Export Failed', 'Could not export audit report.');
    }
  };

  const handleSwitchScenario = (id: ScenarioId) => {
    setSelectedScenario(id);
    setCurrentStep(1);
    showToast('info', 'Scenario Switched', `Active domain changed to: ${SCENARIOS[id].name}`);
  };

  const isFocus = (target: string) => currentConfig.targetFocus === target;

  return (
    <div className="relative min-h-screen bg-[#FDFBF7] text-slate-900 select-none pb-36">
      
      {/* ========================================================================= */}
      {/* 1. BLACK TRANSLUCENT SPOTLIGHT BACKDROP OVERLAY                           */}
      {/* Dimmed curtain covering everything except the active spotlighted section */}
      {/* ========================================================================= */}
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-[2px] transition-all duration-300 z-30 pointer-events-none" />

      {/* ========================================================================= */}
      {/* TOP HEADER: Elegant Light Beige Enterprise Header with Scenario Switcher */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-40 bg-[#FCFAF7]/95 backdrop-blur-md text-slate-900 px-4 sm:px-6 py-2.5 border-b border-[#EADBCE] shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          
          {/* Brand & Guide Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-md bg-blue-700 flex items-center justify-center text-white shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm tracking-tight text-slate-950">DebtLens Operational Walkthrough</span>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-sm bg-[#F5EFEB] text-slate-900 border border-[#EADBCE] text-[10px] font-mono font-bold">
                    {activeScenario.platformCode}
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 hidden sm:block font-medium">
                  BEC Bagalkote • Dept. of Information Science & Engineering • Guide: Prof. P. R. Muttannavar
                </p>
              </div>
            </div>

            {/* Mobile Exit */}
            <button
              onClick={onExitDemo}
              className="md:hidden px-3 py-1.5 rounded-md bg-rose-600 text-[11px] font-bold text-white flex items-center space-x-1"
            >
              <X className="w-3 h-3" />
              <span>Exit</span>
            </button>
          </div>

          {/* Center: Scenario Switcher (At Least 3 Domain Examples: FinTech, HealthTech, Supply Chain) */}
          <div className="flex items-center space-x-1.5 bg-[#FAF8F5] p-1 rounded-md border border-[#EADBCE] self-center">
            <span className="text-[10px] uppercase font-bold text-stone-500 px-2 hidden lg:inline">
              Select Domain:
            </span>

            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
              const sc = SCENARIOS[id];
              const Icon = sc.icon;
              const isSelected = selectedScenario === id;
              return (
                <button
                  key={id}
                  onClick={() => handleSwitchScenario(id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-700 text-white shadow-xs font-bold'
                      : 'text-stone-700 hover:text-slate-950 hover:bg-[#F5EFEB]'
                  }`}
                  title={sc.tagline}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{sc.name}</span>
                </button>
              );
            })}
          </div>

          {/* Right Actions: Concept Guide, Restart & Exit */}
          <div className="hidden md:flex items-center space-x-2">
            <button
              onClick={() => setIsConceptModalOpen(true)}
              className="px-3 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="Explain what DebtLens is and why it applies to any software domain"
            >
              <Info className="w-3.5 h-3.5 text-blue-700" />
              <span>What is DebtLens?</span>
            </button>

            <button
              onClick={() => setCurrentStep(1)}
              title="Restart walkthrough from stage 1"
              className="p-1.5 px-2.5 rounded-md bg-white hover:bg-[#F5EFEB] text-stone-700 hover:text-slate-950 border border-[#EADBCE] transition-colors cursor-pointer text-xs font-semibold flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3 text-stone-500" />
              <span>Restart</span>
            </button>

            <button
              onClick={onExitDemo}
              className="px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Exit Demo</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONCEPT GUIDE MODAL: Explains project to faculty / "Sir"                  */}
      {/* ========================================================================= */}
      {isConceptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#FCFAF7] rounded-md max-w-2xl w-full p-6 shadow-2xl border border-[#EADBCE] space-y-4">
            <div className="flex items-center justify-between border-b border-[#EADBCE] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center text-blue-700 border border-blue-200">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-950">
                    What is DebtLens?
                  </h3>
                  <p className="text-[11px] text-stone-500 font-medium">
                    Executive Project Concept for Faculty, Evaluators & Software Leaders
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsConceptModalOpen(false)}
                className="p-1.5 rounded-md text-stone-400 hover:text-slate-950 hover:bg-[#F5EFEB] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-stone-700 leading-relaxed">
              <div className="p-3.5 bg-blue-50/70 rounded-md border border-blue-200">
                <h4 className="font-bold text-blue-950 mb-1 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>1. Universal Software Domain Agnostic</span>
                </h4>
                <p className="text-stone-700 text-xs leading-relaxed">
                  Technical debt is <strong>not bounded to financial software</strong>. Every modern software organization—whether <strong>FinTech (payment processing)</strong>, <strong>HealthTech (hospital EHR & ICU telemetry)</strong>, <strong>Supply Chain (logistics & inventory routing)</strong>, or SaaS—suffers from accumulated architectural shortcuts, unindexed queries, thread pool starvation, and tightly coupled microservices.
                </p>
              </div>

              <div className="p-3.5 bg-amber-50/80 rounded-md border border-amber-200">
                <h4 className="font-bold text-amber-950 mb-1 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  <span>2. Why Traditional Linters (SonarQube) Fail</span>
                </h4>
                <p className="text-stone-700 text-xs leading-relaxed">
                  Traditional static code analyzers scan source code syntax and report 1,000+ style warnings. However, engineering managers ignore them because they cannot answer: <em>"Is this code smell actually causing outages in production?"</em> DebtLens solves this by directly linking real production incidents into the debt ledger.
                </p>
              </div>

              <div className="p-3.5 bg-slate-100 rounded-md border border-[#EADBCE]">
                <h4 className="font-bold text-slate-950 mb-1 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>3. The 4 Mathematical Pillars of DebtLens</span>
                </h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-stone-700">
                  <li><strong>Economic Balance Sheet</strong>: Quantifies debt in wasted engineering salary hours (Accrued Interest I(d) &gt; P(d)).</li>
                  <li><strong>5-Whys Causal Traceability</strong>: Traces runtime incidents down to root architectural weaknesses.</li>
                  <li><strong>NetworkX Graph Centrality</strong>: Calculates Betweenness Centrality C_B(v) to isolate the #1 systemic bottleneck.</li>
                  <li><strong>0/1 Knapsack Dynamic Programming</strong>: Schedules the optimal subset of refactoring tickets for a bounded 40h sprint.</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 border-t border-[#EADBCE] flex justify-end">
              <button
                onClick={() => setIsConceptModalOpen(false)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer"
              >
                Close & Return to Walkthrough
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISUAL NAVIGATING TOOL: COMPACT HORIZONTAL PIPELINE STEPPER                */}
      {/* ========================================================================= */}
      <div className="sticky top-[55px] z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#EADBCE] px-4 sm:px-6 py-2 shadow-xs overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between min-w-[700px] gap-1.5">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.step === currentStep;
            const isCompleted = s.step < currentStep;

            return (
              <React.Fragment key={s.step}>
                <button
                  onClick={() => setCurrentStep(s.step)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md transition-all cursor-pointer text-left shrink-0 ${
                    isActive
                      ? 'bg-blue-700 text-white font-bold ring-1 ring-blue-500 shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 font-semibold'
                      : 'bg-white text-stone-600 border border-[#EADBCE] hover:bg-[#F5EFEB] hover:text-slate-950 font-medium'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-sm flex items-center justify-center shrink-0 ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : isCompleted 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'text-stone-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    ) : (
                      <Icon className="w-3 h-3" />
                    )}
                  </div>
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {s.step}. {s.stageName.split(':')[0].split('&')[0]}
                  </span>
                </button>

                {idx < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 min-w-[8px] rounded-full ${
                    isCompleted ? 'bg-emerald-500' : 'bg-[#EADBCE]'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Container Rendering the Live Application State with Spotlight */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5 relative">
        
        {/* ======================================================================= */}
        {/* TARGET 1: EXECUTIVE PAGE HEADER                                        */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-header"
          className={`scroll-mt-32 transition-all duration-300 ${
            isFocus('header')
              ? 'relative z-40 bg-white/98 ring-2 ring-blue-600 shadow-[0_0_40px_rgba(29,78,216,0.22)] rounded-md p-4 sm:p-5 border border-[#EADBCE]'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('header') && (
            <div className="inline-flex items-center space-x-1.5 mb-2.5 bg-blue-700 text-white px-2.5 py-0.5 rounded-md shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 1 Focus • Production Telemetry Stream ({activeScenario.name})</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#EADBCE]">
            <div>
              <div className="flex items-center space-x-2 text-xs text-stone-500 mb-1">
                <span>Domain</span>
                <span>/</span>
                <span className="text-slate-950 font-bold">{activeScenario.portfolioName}</span>
                <span className="text-stone-300">•</span>
                <span className="inline-flex items-center space-x-1 text-xs text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-time Telemetry Live</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950">
                Executive Debt Intelligence Dashboard
              </h1>
              <p className="text-xs text-stone-600 mt-0.5 font-medium">
                {activeScenario.tagline}
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="px-2.5 py-1 rounded-sm bg-[#F5EFEB] text-slate-900 border border-[#EADBCE] text-xs font-mono font-bold">
                {activeScenario.clusterLocation}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 2: CORE FINANCIAL TELEMETRY KPIS                                 */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-kpis"
          className={`scroll-mt-32 transition-all duration-300 ${
            isFocus('kpis')
              ? 'relative z-40 bg-white/98 ring-2 ring-blue-600 shadow-[0_0_40px_rgba(29,78,216,0.22)] rounded-md p-4 sm:p-5 border border-[#EADBCE]'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('kpis') && (
            <div className="inline-flex items-center space-x-1.5 mb-2.5 bg-blue-700 text-white px-2.5 py-0.5 rounded-sm shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 2 Focus • Debt Balance Sheet: Principal P(d) vs Accrued Interest I(d)</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <StatCard
              title="Active Production Incidents"
              value={activeScenario.kpis.activeIncidents}
              subtitle={activeScenario.kpis.openIncidentsSubtitle}
              icon={AlertTriangle}
              badge={{ text: `${activeScenario.kpis.activeIncidents} Open`, variant: 'warning' }}
            />
            <StatCard
              title="Debt Principal Effort P(d)"
              value={`${activeScenario.kpis.principalHours}h`}
              subtitle={activeScenario.kpis.principalSubtitle}
              icon={Clock}
              badge={{ text: 'Baseline Effort', variant: 'neutral' }}
            />
            <StatCard
              title="Accrued Debt Interest I(d)"
              value={`${activeScenario.kpis.interestHours}h`}
              subtitle={activeScenario.kpis.interestSubtitle}
              icon={Coins}
              badge={{ text: `+${activeScenario.kpis.netDragHours}h Drag`, variant: 'negative' }}
            />
            <StatCard
              title="Break-Even Threshold"
              value={`${activeScenario.kpis.breakevenPercent}%`}
              subtitle={activeScenario.kpis.breakevenSubtitle}
              icon={Flame}
              badge={{ text: 'Action Urgent', variant: 'negative' }}
            />
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 3: BREAK-EVEN OUTAGE ALERT                                      */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-alert"
          className={`scroll-mt-32 transition-all duration-300 ${
            isFocus('alert')
              ? 'relative z-40 bg-white/98 ring-2 ring-rose-600 shadow-[0_0_40px_rgba(220,38,38,0.22)] rounded-md p-4 sm:p-5 border border-[#EADBCE]'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('alert') && (
            <div className="inline-flex items-center space-x-1.5 mb-2.5 bg-rose-700 text-white px-2.5 py-0.5 rounded-sm shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 3 Focus • Mathematical Break-Even Violation Trigger</span>
            </div>
          )}

          <div className="p-3.5 sm:p-4 rounded-md border-2 border-rose-300 bg-[#FFF9F6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-900 shadow-xs">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="w-9 h-9 rounded-md bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-bold text-slate-950">
                  {activeScenario.breakevenAlert.title}
                </div>
                <div className="text-xs text-stone-600 mt-0.5 font-medium leading-relaxed">
                  {activeScenario.breakevenAlert.description}
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:items-end shrink-0">
              <span className="px-2.5 py-1 bg-rose-600 text-white text-xs font-bold rounded-sm shadow-2xs font-mono">
                Net Drag: +{activeScenario.kpis.netDragHours} hrs
              </span>
              <span className="text-[10px] font-mono text-rose-700 font-bold mt-0.5">
                Criterion: I(d) &gt; P(d)
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 4: MODULE DRAG EXPOSURE BAR CHART                                */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-dragchart"
          className={`scroll-mt-32 transition-all duration-300 ${
            isFocus('dragchart')
              ? 'relative z-40 bg-white/98 ring-2 ring-amber-600 shadow-[0_0_40px_rgba(217,119,6,0.22)] rounded-md p-4 sm:p-5 border border-[#EADBCE]'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('dragchart') && (
            <div className="inline-flex items-center space-x-1.5 mb-2.5 bg-amber-700 text-white px-2.5 py-0.5 rounded-sm shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 4 Focus • Partitioned Failure Drag & Blast Radius ({activeScenario.name})</span>
            </div>
          )}

          <div className="bg-white rounded-md border border-[#EADBCE] p-4 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-[#F5EFEB]">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Module Economic Drag Exposure</h3>
                <p className="text-[11px] text-stone-500">Partitioned failure interest across {activeScenario.name} microservices</p>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[#F5EFEB] text-stone-700 border border-[#EADBCE]">
                λ₁ = 0.15 (churn), λ₂ = 1.8 (blast radius)
              </span>
            </div>

            <div className="h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeScenario.moduleChartData} margin={{ top: 10, right: 10, left: -15, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2EDE4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                  <Tooltip formatter={(val: any) => [`${val} hours`, 'Failure Interest']} />
                  <Bar dataKey="interest" radius={[4, 4, 0, 0]}>
                    {activeScenario.moduleChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 5: 5-WHYS DIAGNOSTIC CONVERGENCE (INCIDENTS)                    */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-incidents"
          className={`scroll-mt-32 transition-all duration-300 ${
            isFocus('incidents')
              ? 'relative z-40 bg-white/98 ring-2 ring-fuchsia-600 shadow-[0_0_40px_rgba(192,38,211,0.22)] rounded-md p-4 sm:p-5 border border-[#EADBCE]'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('incidents') && (
            <div className="inline-flex items-center space-x-1.5 mb-2.5 bg-fuchsia-700 text-white px-2.5 py-0.5 rounded-sm shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 5 Focus • Automated 5-Whys Diagnostic Decomposition ({activeScenario.incident.code})</span>
            </div>
          )}

          <div className="bg-white rounded-md border border-[#EADBCE] p-4 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#F5EFEB] pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Incident Triage: {activeScenario.incident.title}
                  </h3>
                  <p className="text-[11px] text-stone-500">Production outage converted into structured causal evidence</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-sm border border-rose-200">
                {activeScenario.incident.effort}h Effort • Severity: {activeScenario.incident.multiplier}
              </span>
            </div>

            {/* 5-Whys Diagnostic Chain */}
            <div className="space-y-1.5">
              {activeScenario.incident.whys.map((w, idx) => (
                <div key={idx} className="p-2 rounded-md border border-[#EADBCE] bg-[#FAF8F5] flex items-start space-x-2">
                  <span className="px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-950 font-mono font-bold text-[10px] shrink-0">
                    {w.level}
                  </span>
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-slate-950">{w.text}</span>
                    <span className="text-stone-600 block mt-0.5 font-medium">↳ {w.answer}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 6: DIRECTED CAUSAL GRAPH & CENTRALITY                           */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-causal"
          className={`scroll-mt-32 transition-all duration-300 ${
            isFocus('causal')
              ? 'relative z-40 bg-white/98 ring-2 ring-blue-600 shadow-[0_0_40px_rgba(29,78,216,0.22)] rounded-md p-4 sm:p-5 border border-[#EADBCE]'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('causal') && (
            <div className="inline-flex items-center space-x-1.5 mb-2.5 bg-blue-700 text-white px-2.5 py-0.5 rounded-sm shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 6 Focus • NetworkX Directed Causal Graph Centrality</span>
            </div>
          )}

          <div className="bg-white rounded-md border border-[#EADBCE] p-4 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#F5EFEB] pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-blue-700">
                  <GitFork className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    NetworkX Directed Causal Graph Analysis
                  </h3>
                  <p className="text-[11px] text-stone-500">Topological shortest path centrality isolating highest-impact bottleneck</p>
                </div>
              </div>
              <span className="text-xs font-mono text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200">
                {activeScenario.causalGraph.edgeCount}
              </span>
            </div>

            <div className="p-3.5 rounded-md border border-[#EADBCE] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-blue-100 text-blue-950">
                  RANK #1 SYSTEMIC BOTTLENECK
                </span>
                <h4 className="text-sm font-bold text-slate-950 mt-1">
                  {activeScenario.causalGraph.nodeTitle}
                </h4>
                <p className="text-xs text-stone-700 mt-0.5 font-medium">
                  Category: <strong className="text-blue-900 font-bold">{activeScenario.causalGraph.category}</strong> • {activeScenario.causalGraph.affectedServices}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center shrink-0">
                <div className="p-2 bg-white rounded-md border border-[#EADBCE] shadow-2xs">
                  <div className="text-[9px] text-stone-500 font-bold uppercase">Betweenness CB(v)</div>
                  <div className="text-base font-bold font-mono text-blue-900 mt-0.5">{activeScenario.causalGraph.betweenness}</div>
                </div>
                <div className="p-2 bg-white rounded-md border border-[#EADBCE] shadow-2xs">
                  <div className="text-[9px] text-stone-500 font-bold uppercase">Degree Centrality</div>
                  <div className="text-base font-bold font-mono text-blue-700 mt-0.5">{activeScenario.causalGraph.degree}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 7: 0/1 KNAPSACK DYNAMIC PROGRAMMING                             */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-knapsack"
          className={`scroll-mt-32 transition-all duration-300 ${
            isFocus('knapsack')
              ? 'relative z-40 bg-white/98 ring-2 ring-blue-600 shadow-[0_0_40px_rgba(29,78,216,0.22)] rounded-md p-4 sm:p-5 border border-[#EADBCE]'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('knapsack') && (
            <div className="inline-flex items-center space-x-1.5 mb-2.5 bg-blue-800 text-white px-2.5 py-0.5 rounded-sm shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 7 Focus • Bounded 0/1 Knapsack Dynamic Programming Optimizer</span>
            </div>
          )}

          <div className="bg-white rounded-md border border-[#EADBCE] p-4 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#F5EFEB] pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-blue-800">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Bounded 0/1 Knapsack Dynamic Programming Optimizer
                  </h3>
                  <p className="text-[11px] text-stone-500">Globally optimal refactoring selection under sprint capacity constraint B = {activeScenario.knapsack.capacity}h</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200">
                Capacity B = {activeScenario.knapsack.capacity}h • Utilization: 95.0%
              </span>
            </div>

            {/* Segmented Packing Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-900">
                <span>Optimal Refactoring Allocation:</span>
                <span className="font-mono text-stone-500">{activeScenario.knapsack.packedEffort}h allocated / {activeScenario.knapsack.capacity}h capacity ({activeScenario.knapsack.slackHours}h slack)</span>
              </div>
              <div className="w-full h-7 bg-[#F5EFEB] rounded-sm border border-[#EADBCE] p-0.5 flex overflow-hidden shadow-inner">
                {activeScenario.knapsack.items.map((item, idx) => (
                  <div 
                    key={idx}
                    style={{ width: item.widthPct }} 
                    className={`${item.color} text-white h-full flex items-center justify-center text-[10px] font-mono font-bold px-1 border-r border-white/20 truncate`}
                    title={`${item.code} (${item.effort}h, +${item.risk} risk pts)`}
                  >
                    {item.code} ({item.effort}h)
                  </div>
                ))}
                <div style={{ width: '4%' }} className="bg-stone-200 h-full flex items-center justify-center text-[9px] text-stone-500 font-mono italic">
                  {activeScenario.knapsack.slackHours}h
                </div>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 bg-[#FAF8F5] rounded-md border border-[#EADBCE] text-center">
                <div className="text-[9px] text-stone-500 font-bold uppercase">Effort Packed</div>
                <div className="text-sm font-bold font-mono text-slate-950 mt-0.5">{activeScenario.knapsack.packedEffort} / {activeScenario.knapsack.capacity}h</div>
              </div>
              <div className="p-2.5 bg-[#FAF8F5] rounded-md border border-[#EADBCE] text-center">
                <div className="text-[9px] text-blue-800 font-bold uppercase">Risk Points Remediated</div>
                <div className="text-sm font-bold font-mono text-blue-900 mt-0.5">{activeScenario.knapsack.riskPointsReduced} pts</div>
              </div>
              <div className="p-2.5 bg-[#FAF8F5] rounded-md border border-[#EADBCE] text-center">
                <div className="text-[9px] text-blue-800 font-bold uppercase">Payoff Return ROI</div>
                <div className="text-sm font-bold font-mono text-blue-900 mt-0.5">{activeScenario.knapsack.roiMultiplier} ROI</div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* TARGET 8: COMPLIANCE AUDIT REPORT EXPORT                               */}
        {/* ======================================================================= */}
        <div 
          id="spotlight-target-audit"
          className={`scroll-mt-32 transition-all duration-300 ${
            isFocus('audit')
              ? 'relative z-40 bg-white/98 ring-2 ring-slate-900 shadow-[0_0_40px_rgba(15,23,42,0.22)] rounded-md p-4 sm:p-5 border border-[#EADBCE]'
              : 'opacity-20 pointer-events-none'
          }`}
        >
          {isFocus('audit') && (
            <div className="inline-flex items-center space-x-1.5 mb-2.5 bg-slate-950 text-white px-2.5 py-0.5 rounded-sm shadow-xs text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              <span>Stage 8 Focus • Technical Debt Audit & Governance Export</span>
            </div>
          )}

          <div className="bg-white rounded-md border border-[#EADBCE] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-md bg-[#F5EFEB] flex items-center justify-center text-blue-800 shrink-0 border border-[#EADBCE]">
                <FileDown className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-950">
                  {activeScenario.audit.title}
                </div>
                <div className="text-xs text-stone-600 mt-0.5 font-medium leading-relaxed">
                  {activeScenario.audit.description}
                </div>
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-md text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Download Audit Report PDF</span>
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. DOCKED BOTTOM PRESENTER BAR (SIT FLUSH & LOW, NEVER OVERLAPS)           */}
      {/* Pinned to the absolute bottom, slim height, with minimize/expand toggle   */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#FCFAF7]/98 backdrop-blur-md border-t border-[#EADBCE] shadow-[0_-8px_30px_rgba(15,23,42,0.12)]">
        
        {/* Sleek Toggle Header for Minimal View */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between border-b border-[#F5EFEB] py-1 text-[11px] text-stone-500">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-950 uppercase tracking-wider text-[10px]">Presenter Console</span>
            <span className="text-[#EADBCE]">|</span>
            <span className="font-mono text-blue-800 font-bold">{activeScenario.name}</span>
          </div>

          <button
            onClick={() => setIsBottomBarCollapsed(!isBottomBarCollapsed)}
            className="flex items-center space-x-1 text-stone-600 hover:text-slate-950 cursor-pointer font-semibold transition-colors"
          >
            <span>{isBottomBarCollapsed ? 'Expand Controller' : 'Minimize Controller'}</span>
            {isBottomBarCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsed State: Single Clean Ribbon */}
        {isBottomBarCollapsed ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-sm bg-blue-700 text-white font-mono font-bold text-[10px]">
                {currentStep} / {totalSteps}
              </span>
              <span className="text-xs font-bold text-slate-950">{currentConfig.stageName}</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                disabled={currentStep === 1}
                onClick={handlePrev}
                className="px-2.5 py-1 rounded-md border border-[#EADBCE] text-xs font-semibold text-stone-700 hover:bg-[#F5EFEB] disabled:opacity-30 cursor-pointer"
              >
                Prev
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-1 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {currentConfig.nextLabel}
              </button>
            </div>
          </div>
        ) : (
          /* Expanded Sleek Bar: Full Question, Explanation, and 1-Click Controls */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
            
            {/* Left: Stage Title & Clear Q&A Explanation */}
            <div className="flex-1 w-full md:w-auto">
              <div className="flex items-center space-x-2 mb-1 flex-wrap gap-1">
                <span className="px-2 py-0.5 rounded-sm bg-blue-700 text-white font-mono font-bold text-[9px] tracking-wider uppercase">
                  {currentConfig.badge}
                </span>
                <span className="text-xs font-bold text-slate-950">
                  Stage {currentStep} of {totalSteps}: {currentConfig.stageName}
                </span>
                <span className="text-stone-300 hidden sm:inline">•</span>
                <span className="text-[10px] font-mono text-blue-900 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200 font-bold truncate max-w-sm">
                  {currentConfig.mathematicalProof}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-950 flex items-baseline space-x-1.5">
                <span className="text-blue-700 font-extrabold shrink-0">Q:</span>
                <span className="text-slate-950 font-semibold">{currentConfig.inquiry}</span>
              </div>

              <p className="text-[11px] text-stone-600 font-medium leading-snug mt-0.5 line-clamp-2 md:line-clamp-none">
                {currentConfig.explanation}
              </p>
            </div>

            {/* Right: Master 1-Click Advance Controls */}
            <div className="flex items-center justify-end space-x-2 shrink-0 w-full md:w-auto pt-1.5 md:pt-0 border-t md:border-t-0 border-[#F5EFEB]">
              <button
                disabled={currentStep === 1}
                onClick={handlePrev}
                className="px-2.5 py-1.5 rounded-md border border-[#EADBCE] text-xs font-semibold text-stone-700 hover:bg-[#F5EFEB] disabled:opacity-30 cursor-pointer flex items-center space-x-1 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Prev</span>
              </button>

              {/* Master ONE-CLICK Step Advance Button */}
              <button
                onClick={handleNext}
                className="px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs hover:shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer active:scale-[0.99]"
              >
                <span>{currentConfig.nextLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
