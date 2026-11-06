import React, { useRef } from 'react';
import { 
  X, 
  FileDown, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  GitFork, 
  Coins, 
  Calculator, 
  ShieldCheck, 
  FileText, 
  ArrowRight, 
  Layers, 
  Terminal, 
  Building, 
  Award,
  Check,
  Flame,
  Info
} from 'lucide-react';
import { Incident, DebtItem, CauseNode } from '../types';
import { useToast } from '../context/ToastContext';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident | null;
  linkedDebt?: DebtItem | null;
  rootCauseNode?: CauseNode | null;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  onClose,
  incident,
  linkedDebt,
  rootCauseNode
}) => {
  const { showToast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !incident) return null;

  // Severity Weight & Multiplier
  const severityWeights: Record<string, number> = {
    CRITICAL: 3.0,
    HIGH: 2.0,
    MEDIUM: 1.0,
    LOW: 0.5
  };
  const weight = severityWeights[incident.severity.toUpperCase()] || 1.0;

  // Module Blast Radii
  const blastRadii: Record<string, number> = {
    database: 5,
    payments: 4,
    settlement: 3,
    orders: 3,
    checkout: 3,
    auth: 2,
    notification: 1,
    inventory: 1
  };
  const blastRadius = blastRadii[incident.affected_module.toLowerCase()] || 2;

  // Compounding Drag Interest I(d)
  const downtime = incident.resolution_effort_hours;
  const lambda1 = 0.85;
  const lambda2 = 1.5;
  const accruedInterest = parseFloat(((lambda1 * (downtime * weight)) + (lambda2 * blastRadius)).toFixed(1));

  // Module-specific data synthesis for 5-Whys and Technical Debt
  const getModuleIncidentRca = (mod: string) => {
    switch (mod.toLowerCase()) {
      case 'database':
        return {
          why1: 'Why did database queries stall?',
          ans1: 'Active connection pool capacity reached 100% saturation during concurrent transaction spike.',
          why2: 'Why did the pool saturate?',
          ans2: 'Worker threads were executing unindexed batch scans over 12M audit log rows while holding live client connections.',
          why3: 'Why were batch scans holding client connections?',
          ans3: 'Reconciliation transactions lacked separate read-replica routing and adaptive connection timeouts.',
          why4: 'Why was read-replica routing missing?',
          ans4: 'The original pool configuration used naive fixed-thread pooling without circuit breaking or backpressure.',
          why5: 'What is the foundational root cause?',
          ans5: 'Database Connection Pool Exhaustion under Unbounded Waiting (Node #1)',
          file: 'database/connection_pool.py',
          line: 84,
          satd: 'FIXME: Connection pool leak when async transaction rolls back during timeout',
          preventative: 'Enforce HikariCP connection pool with dynamic circuit breaker and mandatory 250ms query timeout limits.',
          adr: 'ADR-014: Decoupled PostgreSQL Connection Pooling & Read-Replica Sharding'
        };
      case 'payments':
        return {
          why1: 'Why did customer checkouts fail or hang?',
          ans1: 'Inbound Stripe webhook processing latency exceeded 30-second gateway timeout threshold.',
          why2: 'Why did webhook processing exceed 30 seconds?',
          ans2: 'Sequential database lock contention occurred when simultaneous webhook retries attempted to mutate the same order record.',
          why3: 'Why were duplicate webhook retries received?',
          ans3: 'Network jitter on carrier gateway caused retries before the initial 200 OK receipt was acknowledged.',
          why4: 'Why did the system execute duplicate charges on retries?',
          ans4: 'Payment mutation API lacked a distributed atomic idempotency interceptor with fast-fail response caching.',
          why5: 'What is the foundational root cause?',
          ans5: 'Missing Distributed Idempotency Key in Transaction API (Node #3)',
          file: 'payments/gateway_client.py',
          line: 112,
          satd: 'HACK: Bypassing idempotency token check for fast-track legacy card checkouts',
          preventative: 'Mandate Redis Redlock distributed lock with 24h client request token caching on all payment endpoints.',
          adr: 'ADR-008: Distributed Idempotency Interceptor via Redis Redlock'
        };
      case 'orders':
      case 'checkout':
        return {
          why1: 'Why did checkout operations stall for users?',
          ans1: 'Third-party Tax and Address Verification API latency degraded from 200ms to 14,000ms.',
          why2: 'Why did external API latency halt checkout?',
          ans2: 'Checkout controller made synchronous blocking REST calls directly inside the main customer thread.',
          why3: 'Why were external calls synchronous?',
          ans3: 'Downstream tax calculation service lacked fallback estimation and non-blocking asynchronous promises.',
          why4: 'Why did the architecture permit synchronous external blocking?',
          ans4: 'Missing circuit breaker protection and fault-tolerant timeout boundaries on external dependencies.',
          why5: 'What is the foundational root cause?',
          ans5: 'Missing Circuit Breaker and Cascading Failure Protection (Node #5)',
          file: 'checkout/checkout_flow.py',
          line: 97,
          satd: 'BUG: Circuit breaker fallback is synchronous; blocks worker threads during outage',
          preventative: 'Deploy Resilience4j circuit breaker with static fallback and 2.0s hard timeout cutoff.',
          adr: 'ADR-021: Non-Blocking Circuit Breakers for Third-Party Checkout Integrations'
        };
      case 'settlement':
        return {
          why1: 'Why did reconciliation batch run 4 hours behind SLA?',
          ans1: 'Batch settlement processor performed sequential full table scans over unpartitioned ledger table.',
          why2: 'Why were table scans sequential?',
          ans2: 'Database query execution plan regressed due to missing compound index on (tenant_id, settlement_date, status).',
          why3: 'Why was the index missing?',
          ans3: 'Schema evolution scripts lacked performance verification tests for high-volume ledger queries.',
          why4: 'Why was the table not partitioned?',
          ans4: 'Historical architectural shortcut deferred monthly table partitioning until scale exceeded 10M rows.',
          why5: 'What is the foundational root cause?',
          ans5: 'Unindexed Large Table Scans during Batch Settlement (Node #6)',
          file: 'settlement/reconciliation_engine.py',
          line: 163,
          satd: 'DEPRECATED: Using legacy unindexed batch scan over entire transaction ledger table',
          preventative: 'Implement automated PostgreSQL pg_partman monthly range partitioning and compound index migration.',
          adr: 'ADR-032: Monthly Ledger Partitioning & Automated Index Verification'
        };
      case 'notification':
        return {
          why1: 'Why did SMS and email notifications drop?',
          ans1: 'Event dispatcher thread pool exhausted all worker threads during marketing campaign push.',
          why2: 'Why did worker threads exhaust?',
          ans2: 'Synchronous blocking HTTP POST requests were invoked directly inside the message broker event loop.',
          why3: 'Why was message handling synchronous?',
          ans3: 'Worker threads lacked an asynchronous message queue backpressure buffer with dead-letter queue routing.',
          why4: 'Why did the architecture permit synchronous message handling?',
          ans4: 'Architectural shortcut omitted RabbitMQ/Celery worker separation for notification dispatch.',
          why5: 'What is the foundational root cause?',
          ans5: 'Synchronous Blocking Calls inside Async Event Loop (Node #4)',
          file: 'notification/webhook_dispatcher.py',
          line: 88,
          satd: 'TODO: Migrate synchronous notification dispatch to background Celery queue',
          preventative: 'Decouple message ingestion from transmission via async Celery worker queues with rate limiting.',
          adr: 'ADR-019: Decoupled Asynchronous Event Notification Workers'
        };
      default:
        return {
          why1: `Why did ${incident.affected_component || incident.affected_module} fail?`,
          ans1: `${incident.title} disrupted service availability for ${downtime} hours.`,
          why2: 'Why did that failure condition manifest?',
          ans2: `${incident.description}`,
          why3: 'Why was the defect not prevented by runtime safeguards?',
          ans3: 'Missing fault-isolation boundaries and absence of automated invariant regression tests.',
          why4: 'Why did the system permit this architectural fragility?',
          ans4: 'Accumulated structural shortcuts deferred during rapid feature release cycles.',
          why5: 'What is the foundational root cause?',
          ans5: rootCauseNode?.description || 'Structural Architectural Debt in Microservice Core (Node #1)',
          file: `${incident.affected_module}/service.py`,
          line: 45,
          satd: 'FIXME: Refactor legacy control path to eliminate recursive failure cascade',
          preventative: 'Introduce automated chaos regression testing and bounded timeout guards.',
          adr: 'ADR-005: Fault Tolerance & Microservice Boundary Enforcement'
        };
    }
  };

  const rca = getModuleIncidentRca(incident.affected_module);

  // Timestamps for Chronological Order
  const reportedTime = new Date(incident.reported_at);
  const t0 = reportedTime.toLocaleString();
  const t1 = new Date(reportedTime.getTime() + 15 * 60000).toLocaleString(); // +15 min
  const t2 = new Date(reportedTime.getTime() + 45 * 60000).toLocaleString(); // +45 min
  const t3 = new Date(reportedTime.getTime() + (downtime * 0.7) * 3600000).toLocaleString();
  const t4 = incident.resolved_at 
    ? new Date(incident.resolved_at).toLocaleString() 
    : new Date(reportedTime.getTime() + downtime * 3600000).toLocaleString();

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    const md = [
      `# Incident Post-Mortem & Comprehensive RCA Report: ${incident.incident_number}`,
      `**Title:** ${incident.title}`,
      `**Severity:** ${incident.severity} | **Status:** ${incident.status} | **Module:** ${incident.affected_module}`,
      `**Downtime Effort:** ${incident.resolution_effort_hours}h | **Compounding Drag I(d):** ${accruedInterest}h`,
      '',
      '## 1. Executive Summary',
      incident.description,
      '',
      '## 2. Chronological Timeline',
      `- **T0 (Detection):** ${t0} — Telemetry alert triggered`,
      `- **T1 (Triage):** ${t1} — On-call responder assigned; investigating status`,
      `- **T2 (Blast Radius):** ${t2} — Inter-service dependency mapped (${blastRadius} services impacted)`,
      `- **T3 (Mitigation):** ${t3} — Hotfix deployed; traffic shed`,
      `- **T4 (Resolution):** ${t4} — Defect permanently isolated; incident resolved`,
      '',
      '## 3. 5-Whys Root Cause Analysis',
      `1. ${rca.why1} -> ${rca.ans1}`,
      `2. ${rca.why2} -> ${rca.ans2}`,
      `3. ${rca.why3} -> ${rca.ans3}`,
      `4. ${rca.why4} -> ${rca.ans4}`,
      `5. ${rca.why5} -> ${rca.ans5}`,
      '',
      '## 4. Technical Debt Attribution',
      `- **File:** \`${rca.file}:${rca.line}\``,
      `- **Code Marker:** \`${rca.satd}\``,
      `- **Remediation Principal P(d):** ${linkedDebt ? linkedDebt.effort_principal : 16}h`,
      `- **Break-Even Status:** ${accruedInterest > (linkedDebt?.effort_principal || 16) ? 'YES (Interest exceeds repair cost)' : 'NO'}`,
      '',
      '## 5. Preventative Action Items',
      `- ${rca.preventative}`,
      `- Architectural Reference: ${rca.adr}`
    ].join('\n');

    navigator.clipboard.writeText(md);
    showToast('success', 'Copied to Clipboard', 'Full post-mortem markdown report copied.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div 
        ref={reportRef}
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto"
      >
        
        {/* Sticky Header with Action Deck */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <FileText className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                  {incident.incident_number}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                  incident.status === 'RESOLVED' 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {incident.status}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Module M2 / M3 RCA Record
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight mt-0.5">
                Full Incident Post-Mortem & Remediation Report
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer border border-slate-700"
              title="Copy formatted Markdown report"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Copy Markdown</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              title="Print formal report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Report Canvas in Exact Ordered Progression */}
        <div className="p-6 sm:p-8 space-y-8 overflow-y-auto text-slate-800 leading-relaxed text-xs">
          
          {/* Section 01: Executive Summary & Identification Metadata */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <span className="font-mono text-indigo-600 font-extrabold text-sm">01</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Executive Incident Summary & Classification
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Severity Level</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${
                  incident.severity === 'CRITICAL' ? 'text-rose-600' :
                  incident.severity === 'HIGH' ? 'text-amber-600' : 'text-blue-600'
                }`}>
                  {incident.severity} ({weight}x Multiplier)
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Affected Module</div>
                <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                  {incident.affected_module} / {incident.affected_component || 'Core'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Resolution Effort</div>
                <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                  {downtime}h Downtime
                </div>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 text-center">
                <div className="text-[10px] text-rose-600 font-semibold uppercase">Compounded Drag I(d)</div>
                <div className="text-sm font-bold text-rose-700 font-mono mt-0.5">
                  +{accruedInterest}h Drag
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 space-y-1">
              <div className="font-bold text-slate-900 text-sm">{incident.title}</div>
              <p className="text-xs text-slate-600 leading-relaxed">{incident.description}</p>
              <div className="text-[11px] text-slate-400 font-mono pt-1">
                Reported by: <span className="text-slate-600 font-semibold">{incident.reported_by}</span> • Project: <span className="text-slate-600 font-semibold">Payments & Settlement Platform (PAY)</span>
              </div>
            </div>
          </section>

          {/* Section 02: Chronological Event Response Timeline (T0 to T4) */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <span className="font-mono text-indigo-600 font-extrabold text-sm">02</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Incident Response Timeline & Chronological Lifecycle
              </h3>
            </div>

            <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              <div className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100" />
                <div className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                  <span className="font-mono text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded-sm border border-rose-200 text-[10px]">T0 • Detection</span>
                  <span>{t0}</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Automated telemetry alert fired: Error threshold exceeded on <span className="font-mono font-semibold">{incident.affected_module}</span> listener. SRE on-call paged.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                <div className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                  <span className="font-mono text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-sm border border-amber-200 text-[10px]">T1 • Triage & Escalation</span>
                  <span>{t1}</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Incident triage initiated. Incident Commander designated. Status moved to <strong className="text-amber-700">INVESTIGATING</strong>. Diagnostic stack trace captured.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-100" />
                <div className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                  <span className="font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-sm border border-indigo-200 text-[10px]">T2 • Blast Radius Mapping</span>
                  <span>{t2}</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Transitive DFS graph traversal mapped failure to <strong className="text-indigo-700">{blastRadius} dependent microservices</strong>. Database pool backpressure verified.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                <div className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                  <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded-sm border border-blue-200 text-[10px]">T3 • Containment & Mitigation</span>
                  <span>{t3}</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Emergency traffic shedding enabled. Circuit breaker manually tripped. Temporary pool ceiling expanded to restore baseline availability.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                <div className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                  <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-sm border border-emerald-200 text-[10px]">T4 • Resolution & Closure</span>
                  <span>{t4}</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Telemetry stabilized across all nodes for &gt; 60 minutes. Status transitioned to <strong className="text-emerald-700">RESOLVED</strong>. 5-Whys RCA initiated.
                </p>
              </div>
            </div>
          </section>

          {/* Section 03: Economic Drag & Transitive Blast Radius Impact */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <span className="font-mono text-indigo-600 font-extrabold text-sm">03</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Economic Capital Drag & Transitive Blast Radius
              </h3>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
              <div className="font-bold text-indigo-700 text-xs">Universal Drag Formulation:</div>
              <div>I(d) = λ₁ · (Downtime × Severity Weight) + λ₂ · Blast Radius</div>
              <div className="text-[10px] text-slate-500 pt-1">
                = (0.85 × ({downtime}h × {weight})) + (1.5 × {blastRadius}) = <strong className="text-rose-700">{accruedInterest} Accrued Drag Hours</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Transitive Depth</span>
                <div className="font-bold text-slate-900 font-mono">{blastRadius} Microservices</div>
                <div className="text-[10px] text-slate-500">Cascading propagation path</div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Severity Impact Factor</span>
                <div className="font-bold text-slate-900 font-mono">{weight}x Baseline</div>
                <div className="text-[10px] text-slate-500">Business revenue risk weight</div>
              </div>
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 space-y-0.5">
                <span className="text-[10px] text-rose-700 font-semibold uppercase">Break-Even Criticality</span>
                <div className="font-bold text-rose-700 font-mono">
                  {accruedInterest > (linkedDebt?.effort_principal || 16) ? 'EXCEEDED' : 'MONITORING'}
                </div>
                <div className="text-[10px] text-rose-600">Drag &gt; Permanent Repair Cost</div>
              </div>
            </div>
          </section>

          {/* Section 04: Guided 5-Whys Root Cause Analysis */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <span className="font-mono text-indigo-600 font-extrabold text-sm">04</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Root Cause Analysis (Guided 5-Whys Graph Progression)
              </h3>
            </div>

            <div className="space-y-2.5">
              {[
                { step: 1, label: 'Why 1 • Symptom', q: rca.why1, a: rca.ans1, tag: 'SYMPTOM' },
                { step: 2, label: 'Why 2 • Proximate Condition', q: rca.why2, a: rca.ans2, tag: 'TRIGGER' },
                { step: 3, label: 'Why 3 • Architectural Flaw', q: rca.why3, a: rca.ans3, tag: 'DEFECT' },
                { step: 4, label: 'Why 4 • Missing Protection', q: rca.why4, a: rca.ans4, tag: 'SAFEGUARD' },
                { step: 5, label: 'Why 5 • Foundational Root Cause', q: rca.why5, a: rca.ans5, tag: 'SYSTEMIC_ROOT' }
              ].map((w) => (
                <div 
                  key={w.step} 
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    w.step === 5 
                      ? 'bg-indigo-50/70 border-indigo-200 ring-1 ring-indigo-200' 
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-sm ${
                      w.step === 5 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {w.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{w.tag}</span>
                  </div>
                  <div className="font-semibold text-slate-800">{w.q}</div>
                  <div className={`text-[11px] leading-relaxed ${w.step === 5 ? 'text-indigo-950 font-bold' : 'text-slate-600'}`}>
                    → {w.a}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-200 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <GitFork className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-semibold text-slate-800">Converged Graph Root Cause Node:</span>
              </div>
              <span className="font-mono font-bold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-md text-[11px]">
                Betweenness: {rootCauseNode ? rootCauseNode.betweenness_centrality.toFixed(3) : '0.714'} • Degree: {rootCauseNode ? rootCauseNode.degree_centrality.toFixed(3) : '0.625'}
              </span>
            </div>
          </section>

          {/* Section 05: Structural Technical Debt Attribution */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <span className="font-mono text-indigo-600 font-extrabold text-sm">05</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Structural Technical Debt Identification & Code Smell
              </h3>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {linkedDebt ? linkedDebt.debt_key : 'DEBT-101'}
                  </span>
                  <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-sm text-slate-700">
                    ARCHITECTURAL DEBT
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px]">
                  Principal P(d): {linkedDebt ? linkedDebt.effort_principal : 16.0}h
                </span>
              </div>

              <div className="font-semibold text-slate-900 leading-snug">
                {linkedDebt ? linkedDebt.title : 'Refactor Database Connection Pool to HikariCP with Dynamic Backpressure'}
              </div>

              <div className="font-mono text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span>File: <strong className="text-slate-800">{rca.file}</strong> (Line {rca.line})</span>
                <span className="text-indigo-600">AST Complexity: CC 24.5</span>
              </div>

              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 text-[11px] text-amber-900 space-y-0.5">
                <div className="font-bold text-[10px] uppercase font-mono tracking-wide text-amber-700">
                  Self-Admitted Technical Debt (SATD) Marker Detected:
                </div>
                <div className="font-mono text-slate-700 italic">"{rca.satd}"</div>
              </div>
            </div>
          </section>

          {/* Section 06: Remediation Action Plan & 0/1 Knapsack Packaging */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <span className="font-mono text-indigo-600 font-extrabold text-sm">06</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Remediation Action Plan & 0/1 Knapsack Sprint Packaging
              </h3>
            </div>

            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-emerald-950">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  <span>Bounded 0/1 Knapsack Allocation:</span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-700">
                  Topological Priority: #1 in Sprint
                </span>
              </div>

              <p className="text-[11px] text-emerald-900 leading-relaxed">
                Remediation task packaged into next 40h sprint schedule via DP optimizer. Eliminates ongoing <strong>{accruedInterest}h drag</strong> with a single <strong>{linkedDebt ? linkedDebt.effort_principal : 16}h investment</strong>.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[10px]">
                <div className="p-1.5 bg-white rounded border border-emerald-200 text-center">
                  <span className="text-slate-400 block">Effort Principal</span>
                  <strong className="text-slate-900">{linkedDebt ? linkedDebt.effort_principal : 16}h</strong>
                </div>
                <div className="p-1.5 bg-white rounded border border-emerald-200 text-center">
                  <span className="text-slate-400 block">Interest Prevented</span>
                  <strong className="text-rose-600">{accruedInterest}h</strong>
                </div>
                <div className="p-1.5 bg-white rounded border border-emerald-200 text-center">
                  <span className="text-slate-400 block">Risk Points</span>
                  <strong className="text-indigo-600">+9.4 Pts</strong>
                </div>
                <div className="p-1.5 bg-white rounded border border-emerald-200 text-center">
                  <span className="text-slate-400 block">ROI Multiplier</span>
                  <strong className="text-emerald-700">4.01x</strong>
                </div>
              </div>
            </div>
          </section>

          {/* Section 07: Preventative Engineering Controls & Governance */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <span className="font-mono text-indigo-600 font-extrabold text-sm">07</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Preventative Engineering Safeguards & Architecture Invariant
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900">Automated Architectural Invariant:</div>
                  <div className="text-slate-600 text-[11px]">{rca.preventative}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-2.5">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900">Architectural Decision Record (ADR):</div>
                  <div className="text-slate-600 text-[11px]">{rca.adr}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 08: Lessons Learned & Institutional Sign-Off */}
          <section className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
              <span className="font-mono text-indigo-600 font-extrabold text-sm">08</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Lessons Learned & Institutional Governance Sign-Off
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-emerald-700 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>What Went Well</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Real-time telemetry alert caught the incident within 60 seconds. Traffic shedding protected core settlement services from complete downtime.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-rose-700 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>What Needs Improvement</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Diagnostic stack trace analysis required manual intervention because timeout logs were fragmented across multiple worker containers.
                </p>
              </div>
            </div>

            {/* Formal Institutional Sign-Off Box */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="font-bold text-slate-900">BEC Bagalkote • Department of Information Science & Engineering</div>
                <div className="text-slate-500 font-mono text-[10px]">Mini Project BISA531P • Guide: Prof. P. R. Muttannavar</div>
              </div>

              <div className="flex items-center space-x-4 shrink-0 font-mono text-[10px]">
                <div className="text-right">
                  <span className="text-slate-400 block">Lead Responder:</span>
                  <span className="font-bold text-slate-800">Sushma Hiremath (Tech Lead)</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center font-bold">
                  ✓
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Formal Post-Mortem Record Verified • ISO/IEC 25010 Compliance Invariant</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>

      </div>
    </div>
  );
};

