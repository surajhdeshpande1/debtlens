import {
  Incident,
  CauseNode,
  CausalGraphData,
  DebtItem,
  RemediationPlan,
  WhatIfScenario,
  SimilarIncidentMatch,
  RootCauseCluster,
  RegressionItem,
  HotspotItem,
  SelfAdmittedDebtItem,
  ExecutiveDashboardSummary,
  Project,
  Organization
} from '../types';

// Storage keys - bumped to v3 for realistic Enterprise FinTech dataset
const STORAGE_KEY = 'debtlens_enterprise_fintech_v3';

interface StoreData {
  incidents: Incident[];
  debts: DebtItem[];
  causeNodes: CauseNode[];
  edges: Array<{ id: string; source: string; target: string; relation: string; weight: number }>;
  hotspots: HotspotItem[];
  satd: SelfAdmittedDebtItem[];
  dependencies: Array<{ source: string; target: string }>;
}

const INITIAL_HOTSPOTS: HotspotItem[] = [
  { id: 1, file_path: 'database/connection_pool.py', module_name: 'database', churn_count: 68, cyclomatic_complexity: 24.5, risk_score: 95.2, blast_radius: 5 },
  { id: 2, file_path: 'payments/gateway_client.py', module_name: 'payments', churn_count: 54, cyclomatic_complexity: 18.0, risk_score: 82.4, blast_radius: 4 },
  { id: 3, file_path: 'settlement/reconciliation_engine.py', module_name: 'settlement', churn_count: 47, cyclomatic_complexity: 21.0, risk_score: 78.6, blast_radius: 3 },
  { id: 4, file_path: 'orders/order_processor.py', module_name: 'orders', churn_count: 39, cyclomatic_complexity: 15.5, risk_score: 63.8, blast_radius: 3 },
  { id: 5, file_path: 'auth/jwt_token_validator.py', module_name: 'auth', churn_count: 26, cyclomatic_complexity: 12.0, risk_score: 48.0, blast_radius: 2 },
  { id: 6, file_path: 'checkout/checkout_flow.py', module_name: 'checkout', churn_count: 32, cyclomatic_complexity: 14.0, risk_score: 52.5, blast_radius: 2 },
  { id: 7, file_path: 'notification/webhook_dispatcher.py', module_name: 'notification', churn_count: 28, cyclomatic_complexity: 10.5, risk_score: 39.0, blast_radius: 1 },
  { id: 8, file_path: 'inventory/stock_manager.py', module_name: 'inventory', churn_count: 22, cyclomatic_complexity: 11.0, risk_score: 36.5, blast_radius: 1 }
];

const INITIAL_SATD: SelfAdmittedDebtItem[] = [
  { id: 1, file_path: 'database/connection_pool.py', line_number: 84, marker_type: 'FIXME', comment_text: 'Connection pool leak when async transaction rolls back during timeout', module_name: 'database', status: 'OPEN' },
  { id: 2, file_path: 'database/connection_pool.py', line_number: 142, marker_type: 'TODO', comment_text: 'Replace unbounded waiting with bounded semaphore and exponential backoff', module_name: 'database', status: 'OPEN' },
  { id: 3, file_path: 'payments/gateway_client.py', line_number: 112, marker_type: 'HACK', comment_text: 'Bypassing idempotency token check for fast-track legacy card checkouts', module_name: 'payments', status: 'OPEN' },
  { id: 4, file_path: 'payments/gateway_client.py', line_number: 205, marker_type: 'OPTIMIZE', comment_text: 'Circuit breaker fallback is synchronous; blocks worker threads during outage', module_name: 'payments', status: 'OPEN' },
  { id: 5, file_path: 'orders/order_processor.py', line_number: 97, marker_type: 'BUG', comment_text: 'Race condition if duplicate webhook arrives within 20ms', module_name: 'orders', status: 'OPEN' },
  { id: 6, file_path: 'settlement/reconciliation_engine.py', line_number: 163, marker_type: 'DEPRECATED', comment_text: 'Using legacy unindexed batch scan over entire transaction ledger table', module_name: 'settlement', status: 'OPEN' },
  { id: 7, file_path: 'auth/jwt_token_validator.py', line_number: 52, marker_type: 'HACK', comment_text: 'In-memory token blacklist leaks heap memory under high load', module_name: 'auth', status: 'OPEN' }
];

const INITIAL_CAUSES: CauseNode[] = [
  { id: 1, project_id: 1, description: 'Database Connection Pool Exhaustion under Unbounded Waiting', normalized_text: 'database connection pool exhaustion under unbounded waiting', category: 'DATABASE', degree_centrality: 0.625, betweenness_centrality: 0.714, created_at: new Date().toISOString(), incident_count: 3 },
  { id: 2, project_id: 1, description: 'Unbounded HTTP and Socket Timeout on External Services', normalized_text: 'unbounded http and socket timeout on external services', category: 'NETWORK', degree_centrality: 0.375, betweenness_centrality: 0.428, created_at: new Date().toISOString(), incident_count: 2 },
  { id: 3, project_id: 1, description: 'Missing Distributed Idempotency Key in Transaction API', normalized_text: 'missing distributed idempotency key in transaction api', category: 'CONCURRENCY', degree_centrality: 0.250, betweenness_centrality: 0.285, created_at: new Date().toISOString(), incident_count: 2 },
  { id: 4, project_id: 1, description: 'Synchronous Blocking Calls inside Async Event Loop', normalized_text: 'synchronous blocking calls inside async event loop', category: 'PERFORMANCE', degree_centrality: 0.250, betweenness_centrality: 0.142, created_at: new Date().toISOString(), incident_count: 2 },
  { id: 5, project_id: 1, description: 'Missing Circuit Breaker and Cascading Failure Protection', normalized_text: 'missing circuit breaker and cascading failure protection', category: 'ARCHITECTURE', degree_centrality: 0.250, betweenness_centrality: 0.285, created_at: new Date().toISOString(), incident_count: 1 },
  { id: 6, project_id: 1, description: 'Unindexed Large Table Scans during Batch Settlement', normalized_text: 'unindexed large table scans during batch settlement', category: 'DATABASE', degree_centrality: 0.250, betweenness_centrality: 0.142, created_at: new Date().toISOString(), incident_count: 2 },
  { id: 7, project_id: 1, description: 'In-Memory State Leak in Multi-Instance Scaled Services', normalized_text: 'in-memory state leak in multi-instance scaled services', category: 'MEMORY', degree_centrality: 0.125, betweenness_centrality: 0.000, created_at: new Date().toISOString(), incident_count: 1 },
  { id: 8, project_id: 1, description: 'Missing Distributed Lock for Stock State Check', normalized_text: 'missing distributed lock for stock state check', category: 'CONCURRENCY', degree_centrality: 0.125, betweenness_centrality: 0.000, created_at: new Date().toISOString(), incident_count: 1 }
];

const INITIAL_EDGES = [
  { id: 'e1', source: '4', target: '1', relation: 'caused_by', weight: 3 },
  { id: 'e2', source: '2', target: '1', relation: 'caused_by', weight: 3 },
  { id: 'e3', source: '5', target: '2', relation: 'caused_by', weight: 2 },
  { id: 'e4', source: '6', target: '1', relation: 'caused_by', weight: 3 },
  { id: 'e5', source: '3', target: '8', relation: 'caused_by', weight: 2 }
];

const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 1,
    project_id: 1,
    incident_number: 'INC-101',
    title: 'Stripe Webhook Gateway Timeout during Cyber Monday Spike',
    description: 'Inbound Stripe webhook callbacks timed out resulting in dropped settlement receipts and unconfirmed customer orders.',
    severity: 'CRITICAL',
    status: 'RESOLVED',
    affected_module: 'payments',
    affected_component: 'Webhook Listener',
    reported_by: 'SRE Observability Bot',
    resolution_effort_hours: 14.0,
    reported_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    resolved_at: new Date(Date.now() - 44 * 86400000).toISOString()
  },
  {
    id: 2,
    project_id: 1,
    incident_number: 'INC-102',
    title: 'Database Connection Pool Starvation during Batch Settlement',
    description: 'Nightly reconciliation job consumed all available pool connections, starving live payment processing requests for 48 minutes.',
    severity: 'CRITICAL',
    status: 'RESOLVED',
    affected_module: 'database',
    affected_component: 'Connection Manager',
    reported_by: 'SRE Observability Bot',
    resolution_effort_hours: 18.0,
    reported_at: new Date(Date.now() - 38 * 86400000).toISOString(),
    resolved_at: new Date(Date.now() - 37 * 86400000).toISOString()
  },
  {
    id: 3,
    project_id: 1,
    incident_number: 'INC-103',
    title: 'Duplicate Charges on Mobile App Network Disconnect',
    description: 'Users on flaky 4G connections received duplicate charges when double-clicking submit upon transient socket drop.',
    severity: 'HIGH',
    status: 'RESOLVED',
    affected_module: 'orders',
    affected_component: 'Checkout Controller',
    reported_by: 'SRE Observability Bot',
    resolution_effort_hours: 10.0,
    reported_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    resolved_at: new Date(Date.now() - 29 * 86400000).toISOString()
  },
  {
    id: 4,
    project_id: 1,
    incident_number: 'INC-104',
    title: 'Third-Party Tax API Latency Cascading to Checkout Block',
    description: 'Avalara Tax API degraded to 12s response times, causing entire checkout pipeline to stall without graceful fallback.',
    severity: 'HIGH',
    status: 'RESOLVED',
    affected_module: 'checkout',
    affected_component: 'Tax Calculation Client',
    reported_by: 'SRE Observability Bot',
    resolution_effort_hours: 8.0,
    reported_at: new Date(Date.now() - 22 * 86400000).toISOString(),
    resolved_at: new Date(Date.now() - 21 * 86400000).toISOString()
  },
  {
    id: 5,
    project_id: 1,
    incident_number: 'INC-105',
    title: 'Payment Gateway Timeout Surge under High Concurrency',
    description: 'Active incident: Payment webhook requests timing out under sustained 500 RPS traffic surge. Similar pattern to INC-101.',
    severity: 'CRITICAL',
    status: 'OPEN',
    affected_module: 'payments',
    affected_component: 'Webhook Listener',
    reported_by: 'SRE Observability Bot',
    resolution_effort_hours: 12.0,
    reported_at: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: 6,
    project_id: 1,
    incident_number: 'INC-106',
    title: 'Notification Webhook Worker Thread Starvation',
    description: 'Customer email and SMS webhook worker threads exhausted due to synchronous blocking external REST calls.',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    affected_module: 'notification',
    affected_component: 'Event Dispatcher',
    reported_by: 'SRE Observability Bot',
    resolution_effort_hours: 6.0,
    reported_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    resolved_at: new Date(Date.now() - 14 * 86400000).toISOString()
  },
  {
    id: 7,
    project_id: 1,
    incident_number: 'INC-107',
    title: 'Auth Service Memory Out-of-Bounds on Revocation Peak',
    description: 'During mass token revocation event, in-memory blacklist consumed 98% of JVM container memory resulting in OOM kills.',
    severity: 'HIGH',
    status: 'RESOLVED',
    affected_module: 'auth',
    affected_component: 'JWT Middleware',
    reported_by: 'SRE Observability Bot',
    resolution_effort_hours: 7.0,
    reported_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    resolved_at: new Date(Date.now() - 11 * 86400000).toISOString()
  },
  {
    id: 8,
    project_id: 1,
    incident_number: 'INC-108',
    title: 'Flash Sale Oversell Incident due to Race Condition',
    description: 'Two customers successfully purchased the final inventory unit simultaneously due to uncoordinated stock checks.',
    severity: 'HIGH',
    status: 'RESOLVED',
    affected_module: 'inventory',
    affected_component: 'Stock Reservation',
    reported_by: 'SRE Observability Bot',
    resolution_effort_hours: 9.0,
    reported_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    resolved_at: new Date(Date.now() - 7 * 86400000).toISOString()
  },
  {
    id: 9,
    project_id: 1,
    incident_number: 'INC-109',
    title: 'Settlement Reconciliation Latency Degraded to 4 Hours',
    description: 'Database query plan regression causing sequential table scan across 12M audit rows during reconciliation run.',
    severity: 'MEDIUM',
    status: 'INVESTIGATING',
    affected_module: 'settlement',
    affected_component: 'Batch Engine',
    reported_by: 'SRE Observability Bot',
    resolution_effort_hours: 6.0,
    reported_at: new Date(Date.now() - 1 * 86400000).toISOString()
  }
];

const INITIAL_DEBTS: DebtItem[] = [
  {
    id: 1,
    project_id: 1,
    debt_key: 'DEBT-101',
    title: 'Refactor Database Connection Pool to HikariCP with Dynamic Backpressure',
    description: 'Replace current naive thread pool with asynchronous connection pool featuring adaptive capacity, fast-fail timeout, and circuit breaker.',
    category: 'ARCHITECTURAL',
    module_name: 'database',
    file_path: 'database/connection_pool.py',
    effort_principal: 16.0,
    accrued_interest: 64.2,
    break_even_status: true,
    risk_score: 9.4,
    status: 'PRIORITIZED',
    assignee: 'Sushma Patil',
    root_cause_id: 1,
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    prerequisite_ids: [],
    linked_incident_count: 3,
    age_days: 40
  },
  {
    id: 2,
    project_id: 1,
    debt_key: 'DEBT-102',
    title: 'Implement Distributed Idempotency Interceptor via Redis Redlock',
    description: 'Enforce mandatory Client-Request-Id header with Redis-backed distributed lock and 24-hour response caching on all mutable payment APIs.',
    category: 'ARCHITECTURAL',
    module_name: 'payments',
    file_path: 'payments/gateway_client.py',
    effort_principal: 12.0,
    accrued_interest: 32.5,
    break_even_status: true,
    risk_score: 8.8,
    status: 'PRIORITIZED',
    assignee: 'Sushma Patil',
    root_cause_id: 3,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    prerequisite_ids: [],
    linked_incident_count: 2,
    age_days: 30
  },
  {
    id: 3,
    project_id: 1,
    debt_key: 'DEBT-103',
    title: 'Add Resilience4j Circuit Breakers to Third-Party Tax & Gateway Clients',
    description: 'Wrap all external HTTP client calls with configurable circuit breakers, exponential backoff with jitter, and static fallback stubs.',
    category: 'INFRASTRUCTURE',
    module_name: 'checkout',
    file_path: 'checkout/checkout_flow.py',
    effort_principal: 8.0,
    accrued_interest: 14.2,
    break_even_status: true,
    risk_score: 7.2,
    status: 'IDENTIFIED',
    assignee: 'Sushma Patil',
    root_cause_id: 5,
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    prerequisite_ids: [],
    linked_incident_count: 1,
    age_days: 25
  },
  {
    id: 4,
    project_id: 1,
    debt_key: 'DEBT-104',
    title: 'Add Composite Partitioning and Indexes to Transaction Audit Log',
    description: 'Add compound index on (tenant_id, settlement_date, status) and partition postgres table by month to eliminate 4-hour sequential scans.',
    category: 'CODE_SMELL',
    module_name: 'settlement',
    file_path: 'settlement/reconciliation_engine.py',
    effort_principal: 6.0,
    accrued_interest: 28.0,
    break_even_status: true,
    risk_score: 8.1,
    status: 'PRIORITIZED',
    assignee: 'Sushma Patil',
    root_cause_id: 6,
    created_at: new Date(Date.now() - 35 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    prerequisite_ids: [],
    linked_incident_count: 2,
    age_days: 35
  },
  {
    id: 5,
    project_id: 1,
    debt_key: 'DEBT-105',
    title: 'Refactor Notification Dispatcher to Asynchronous SQS/Kafka Pipeline',
    description: 'Eliminate synchronous HTTP calls from notification worker threads by introducing persistent broker queues with retry dead-letter topics.',
    category: 'ARCHITECTURAL',
    module_name: 'notification',
    file_path: 'notification/webhook_dispatcher.py',
    effort_principal: 18.0,
    accrued_interest: 9.8,
    break_even_status: false,
    risk_score: 5.6,
    status: 'IDENTIFIED',
    assignee: 'Sushma Patil',
    root_cause_id: 4,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    prerequisite_ids: [],
    linked_incident_count: 1,
    age_days: 20
  },
  {
    id: 6,
    project_id: 1,
    debt_key: 'DEBT-106',
    title: 'Migrate In-Memory JWT Revocation List to Scaled Redis Bloom Filter',
    description: 'Replace memory-hogging dictionary with distributed Redis Bloom Filter and 2-hour sliding window TTL to prevent container OOM.',
    category: 'SECURITY_DEBT',
    module_name: 'auth',
    file_path: 'auth/jwt_token_validator.py',
    effort_principal: 10.0,
    accrued_interest: 11.5,
    break_even_status: true,
    risk_score: 6.9,
    status: 'IDENTIFIED',
    assignee: 'Sushma Patil',
    root_cause_id: 7,
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    prerequisite_ids: [],
    linked_incident_count: 1,
    age_days: 15
  },
  {
    id: 7,
    project_id: 1,
    debt_key: 'DEBT-107',
    title: 'Deploy Horizontal Read Replicas and Query Routing (Requires DEBT-101)',
    description: 'Route reporting and settlement queries to dedicated PostgreSQL read replica; depends on connection pool support from DEBT-101.',
    category: 'INFRASTRUCTURE',
    module_name: 'database',
    file_path: 'database/connection_pool.py',
    effort_principal: 20.0,
    accrued_interest: 22.0,
    break_even_status: true,
    risk_score: 7.8,
    status: 'IDENTIFIED',
    assignee: 'Sushma Patil',
    root_cause_id: 1,
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    prerequisite_ids: [1],
    linked_incident_count: 1,
    age_days: 10
  }
];

function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse localStorage:', e);
  }
  return {
    incidents: INITIAL_INCIDENTS,
    debts: INITIAL_DEBTS,
    causeNodes: INITIAL_CAUSES,
    edges: INITIAL_EDGES,
    hotspots: INITIAL_HOTSPOTS,
    satd: INITIAL_SATD,
    dependencies: [
      { source: 'orders', target: 'payments' },
      { source: 'orders', target: 'inventory' },
      { source: 'orders', target: 'auth' },
      { source: 'payments', target: 'database' },
      { source: 'settlement', target: 'database' },
      { source: 'settlement', target: 'payments' },
      { source: 'checkout', target: 'orders' },
      { source: 'checkout', target: 'payments' },
      { source: 'checkout', target: 'auth' },
      { source: 'notification', target: 'orders' },
      { source: 'reporting', target: 'database' },
      { source: 'reporting', target: 'settlement' }
    ]
  };
}

function saveStore(data: StoreData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

let store = loadStore();

export const mockEngine = {
  resetStore: () => {
    store = {
      incidents: INITIAL_INCIDENTS,
      debts: INITIAL_DEBTS,
      causeNodes: INITIAL_CAUSES,
      edges: INITIAL_EDGES,
      hotspots: INITIAL_HOTSPOTS,
      satd: INITIAL_SATD,
      dependencies: store.dependencies
    };
    saveStore(store);
    return true;
  },

  getOrganizations: async (): Promise<Organization[]> => {
    return [{ id: 1, name: 'FinTech Cloud Engineering', slug: 'fintech-cloud' }];
  },

  getProjects: async (): Promise<Project[]> => {
    return [{
      id: 1,
      organization_id: 1,
      name: 'Payments & Settlement Platform',
      key: 'PAY',
      description: 'Core multi-tenant payment gateway, settlement processing, and webhook routing architecture.',
      repo_url: 'https://github.com/fintech-cloud/payments-core.git'
    }];
  },

  getIncidents: async (projectId: number, params?: { status?: string; severity?: string; module?: string; search?: string }): Promise<Incident[]> => {
    let list = [...store.incidents];
    if (params?.status && params.status !== 'ALL') {
      list = list.filter(i => i.status.toUpperCase() === params.status!.toUpperCase());
    }
    if (params?.severity && params.severity !== 'ALL') {
      list = list.filter(i => i.severity.toUpperCase() === params.severity!.toUpperCase());
    }
    if (params?.module && params.module !== 'ALL') {
      list = list.filter(i => i.affected_module.toLowerCase() === params.module!.toLowerCase());
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.incident_number.toLowerCase().includes(q));
    }
    return list;
  },

  getIncidentDetail: async (incidentId: number) => {
    const inc = store.incidents.find(i => i.id === incidentId);
    if (!inc) throw new Error('Incident not found');
    return {
      ...inc,
      linked_causes: [
        { step: 1, cause_id: 1, description: 'Database Connection Pool Exhaustion under Unbounded Waiting', category: 'DATABASE', betweenness_centrality: 0.714, degree_centrality: 0.625 }
      ],
      linked_debt_ids: [1, 2],
      is_regression: inc.incident_number === 'INC-105',
      regressed_from_id: inc.incident_number === 'INC-105' ? 1 : null
    };
  },

  createIncident: async (data: any): Promise<Incident> => {
    const newId = store.incidents.length + 1;
    const inc: Incident = {
      id: newId,
      project_id: data.project_id || 1,
      incident_number: `INC-${100 + newId}`,
      title: data.title,
      description: data.description,
      severity: data.severity || 'MEDIUM',
      status: 'OPEN',
      affected_module: data.affected_module || 'payments',
      affected_component: data.affected_component || 'Core Engine',
      reported_by: data.reported_by || 'SRE Engineer',
      resolution_effort_hours: data.resolution_effort_hours || 6.0,
      reported_at: new Date().toISOString()
    };
    store.incidents = [inc, ...store.incidents];
    saveStore(store);
    return inc;
  },

  updateIncident: async (incidentId: number, data: Partial<Incident>): Promise<Incident> => {
    const idx = store.incidents.findIndex(i => i.id === incidentId);
    if (idx === -1) throw new Error('Incident not found');
    const updated = {
      ...store.incidents[idx],
      ...data,
      resolved_at: data.status === 'RESOLVED' ? (store.incidents[idx].resolved_at || new Date().toISOString()) : store.incidents[idx].resolved_at
    };
    store.incidents[idx] = updated;
    saveStore(store);
    return updated;
  },

  getCausalGraph: async (projectId: number): Promise<CausalGraphData> => {
    const nodes = store.causeNodes.map(c => ({
      data: {
        id: c.id.toString(),
        node_id: c.id,
        label: c.description,
        category: c.category,
        degree_centrality: c.degree_centrality,
        betweenness_centrality: c.betweenness_centrality,
        incident_count: c.incident_count || 1
      }
    }));
    const edges = store.edges.map(e => ({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        relation: e.relation,
        weight: e.weight
      }
    }));
    const systemic = [...store.causeNodes].sort((a, b) => b.betweenness_centrality - a.betweenness_centrality);
    return { nodes, edges, systemic_causes: systemic };
  },

  getCauseNodes: async (projectId: number): Promise<CauseNode[]> => {
    return store.causeNodes;
  },

  getDebtItems: async (projectId: number, params?: { status?: string; category?: string; break_even_only?: boolean }): Promise<DebtItem[]> => {
    let list = [...store.debts];
    if (params?.status && params.status !== 'ALL') {
      list = list.filter(d => d.status.toUpperCase() === params.status!.toUpperCase());
    }
    if (params?.category && params.category !== 'ALL') {
      list = list.filter(d => d.category.toUpperCase() === params.category!.toUpperCase());
    }
    if (params?.break_even_only) {
      list = list.filter(d => d.break_even_status);
    }
    return list;
  },

  getDebtDetail: async (debtId: number): Promise<DebtItem | null> => {
    return store.debts.find(d => d.id === debtId) || null;
  },

  createDebtItem: async (data: any): Promise<DebtItem> => {
    const newId = store.debts.length + 1;
    const debt: DebtItem = {
      id: newId,
      project_id: data.project_id || 1,
      debt_key: `DEBT-${100 + newId}`,
      title: data.title,
      description: data.description,
      category: data.category || 'CODE_SMELL',
      module_name: data.module_name || 'general',
      file_path: data.file_path || `${data.module_name}/service.py`,
      effort_principal: data.effort_principal || 8.0,
      accrued_interest: 0.0,
      break_even_status: false,
      risk_score: 5.5,
      status: 'IDENTIFIED',
      assignee: data.assignee || 'Unassigned',
      root_cause_id: data.root_cause_id || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      prerequisite_ids: data.prerequisite_ids || [],
      linked_incident_count: data.linked_incident_ids?.length || 0,
      age_days: 0
    };
    store.debts = [debt, ...store.debts];
    saveStore(store);
    return debt;
  },

  updateDebtItem: async (debtId: number, data: any): Promise<DebtItem> => {
    const idx = store.debts.findIndex(d => d.id === debtId);
    if (idx === -1) throw new Error('Debt item not found');
    const updated = {
      ...store.debts[idx],
      ...data,
      updated_at: new Date().toISOString()
    };
    store.debts[idx] = updated;
    saveStore(store);
    return updated;
  },

  getHotspots: async (projectId: number): Promise<HotspotItem[]> => {
    return store.hotspots;
  },

  getDependencies: async (projectId: number) => {
    const nodes = Array.from(new Set(store.dependencies.flatMap(d => [d.source, d.target]))).map(m => ({
      id: m,
      label: m.toUpperCase(),
      blast_radius: m === 'database' ? 5 : m === 'payments' ? 4 : 2
    }));
    return {
      nodes,
      edges: store.dependencies,
      blast_radius_map: { database: 5, payments: 4, settlement: 3, orders: 3, auth: 2, checkout: 2, notification: 1, inventory: 1 }
    };
  },

  getSATD: async (projectId: number, marker?: string): Promise<SelfAdmittedDebtItem[]> => {
    if (marker && marker !== 'ALL') {
      return store.satd.filter(s => s.marker_type.toUpperCase() === marker.toUpperCase());
    }
    return store.satd;
  },

  analyzeSnippet: async (code: string, language: string = 'python') => {
    const lines = code.split('\n');
    let cc = 1;
    let ifBranches = 0;
    let loops = 0;
    let exceptions = 0;
    let boolOps = 0;

    const ifRegex = /\b(if|elif)\b/g;
    const loopRegex = /\b(for|while)\b/g;
    const excRegex = /\b(except|catch|finally)\b/g;
    const boolRegex = /\b(and|or|&&|\|\|)\b/g;

    lines.forEach(l => {
      const ifs = (l.match(ifRegex) || []).length;
      const lps = (l.match(loopRegex) || []).length;
      const exc = (l.match(excRegex) || []).length;
      const bls = (l.match(boolRegex) || []).length;
      ifBranches += ifs;
      loops += lps;
      exceptions += exc;
      boolOps += bls;
      cc += ifs + lps + exc + bls;
    });

    const satdMarkers: any[] = [];
    lines.forEach((line, idx) => {
      const match = line.match(/#(.*?)(TODO|FIXME|HACK|BUG|OPTIMIZE|DEPRECATED):?\s*(.*)/i);
      if (match) {
        satdMarkers.push({
          line_number: idx + 1,
          marker_type: match[2].toUpperCase(),
          comment_text: match[3].trim()
        });
      }
    });

    const risk = cc > 20 ? 'VERY HIGH' : cc > 10 ? 'HIGH' : cc > 5 ? 'MODERATE' : 'LOW';
    const recommendation = cc > 20
      ? 'Critical architectural smell. Untestable control paths. Prioritize for immediate technical debt refactoring.'
      : cc > 10
      ? 'Complex control flow. Consider extracting nested loops and conditional branches into dedicated helper functions.'
      : cc > 5
      ? 'Acceptable complexity for business routines. Ensure full branch test coverage.'
      : 'Simple, easily testable logic. Low risk of latent defects.';

    return {
      cyclomatic_complexity: cc,
      risk_level: risk,
      recommendation,
      branch_breakdown: {
        if_branches: ifBranches,
        loops,
        exception_handlers: exceptions,
        boolean_conditions: boolOps,
        total_lines: lines.length
      },
      satd_markers: satdMarkers
    };
  },

  getSimilarIncidents: async (incidentId: number): Promise<SimilarIncidentMatch[]> => {
    const target = store.incidents.find(i => i.id === incidentId);
    if (!target) return [];
    return store.incidents
      .filter(i => i.id !== incidentId)
      .map(i => {
        const sameMod = i.affected_module.toLowerCase() === target.affected_module.toLowerCase();
        const score = sameMod ? 0.78 : 0.34;
        return {
          incident_id: i.id,
          incident_number: i.incident_number,
          title: i.title,
          status: i.status,
          severity: i.severity,
          affected_module: i.affected_module,
          similarity_score: score,
          lexical_score: sameMod ? 0.71 : 0.28,
          semantic_score: sameMod ? 0.85 : 0.40
        };
      })
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 4);
  },

  comparePairwise: async (incAId: number, incBId: number, alpha: number = 0.55) => {
    const a = store.incidents.find(i => i.id === incAId) || store.incidents[0];
    const b = store.incidents.find(i => i.id === incBId) || store.incidents[1];
    const sameMod = a.affected_module.toLowerCase() === b.affected_module.toLowerCase();
    const lex = sameMod ? 0.68 : 0.22;
    const sem = sameMod ? 0.81 : 0.35;
    const hyb = alpha * lex + (1 - alpha) * sem;
    return {
      incident_a: a,
      incident_b: b,
      lexical_score: parseFloat(lex.toFixed(3)),
      semantic_score: parseFloat(sem.toFixed(3)),
      hybrid_score: parseFloat(hyb.toFixed(3)),
      alpha_weight: alpha,
      same_module: sameMod,
      common_tokens: sameMod ? ['timeout', 'gateway', 'connection', 'pool', 'callback'] : ['service', 'request', 'error']
    };
  },

  getRootCauseClusters: async (projectId: number): Promise<RootCauseCluster[]> => {
    return [
      {
        cluster_id: 0,
        cause_count: 3,
        theme_title: 'Database Connection & Resource Exhaustion',
        causes: [
          'Database Connection Pool Exhaustion under Unbounded Waiting',
          'Synchronous Blocking Calls inside Async Event Loop',
          'Unindexed Large Table Scans during Batch Settlement'
        ],
        is_noise: false
      },
      {
        cluster_id: 1,
        cause_count: 2,
        theme_title: 'Distributed Concurrency & Idempotency Leaks',
        causes: [
          'Missing Distributed Idempotency Key in Transaction API',
          'Missing Distributed Lock for Stock State Check'
        ],
        is_noise: false
      },
      {
        cluster_id: 2,
        cause_count: 2,
        theme_title: 'Cascading Fault Propagation & Latency Spikes',
        causes: [
          'Unbounded HTTP and Socket Timeout on External Services',
          'Missing Circuit Breaker and Cascading Failure Protection'
        ],
        is_noise: false
      }
    ];
  },

  getRegressions: async (projectId: number): Promise<RegressionItem[]> => {
    return [
      {
        new_incident_id: 5,
        new_incident_number: 'INC-105',
        new_incident_title: 'Payment Gateway Timeout Surge under High Concurrency',
        resolved_incident_id: 1,
        resolved_incident_number: 'INC-101',
        resolved_incident_title: 'Stripe Webhook Gateway Timeout during Cyber Monday Spike',
        affected_module: 'payments',
        similarity: 0.84,
        days_to_recurrence: 43,
        reported_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        resolved_at: new Date(Date.now() - 44 * 86400000).toISOString()
      }
    ];
  },

  getOptimalPlan: async (projectId: number, sprintBudgetHours: number, allowedCategories?: string[], forceIncludeDebtIds?: number[]): Promise<RemediationPlan> => {
    let pool = [...store.debts];
    if (allowedCategories && allowedCategories.length > 0) {
      pool = pool.filter(d => allowedCategories.includes(d.category));
    }

    const forced = new Set(forceIncludeDebtIds || []);
    // Prerequisite closure: if DEBT-107 (id 7) is forced, ensure DEBT-101 (id 1) is forced
    if (forced.has(7)) forced.add(1);

    const forcedItems = pool.filter(d => forced.has(d.id));
    const forcedEffort = forcedItems.reduce((acc, it) => acc + it.effort_principal, 0);

    const remainingBudget = Math.max(0, sprintBudgetHours - forcedEffort);
    const candidates = pool.filter(d => !forced.has(d.id));

    // 0/1 Knapsack DP
    const scale = 2; // 0.5 hour step precision
    const W = Math.round(remainingBudget * scale);
    const n = candidates.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));

    for (let i = 1; i <= n; i++) {
      const item = candidates[i - 1];
      const wt = Math.max(1, Math.round(item.effort_principal * scale));
      const val = Math.round(item.risk_score * 10);
      for (let w = 0; w <= W; w++) {
        if (wt <= w) {
          dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - wt] + val);
        } else {
          dp[i][w] = dp[i - 1][w];
        }
      }
    }

    let w = W;
    const chosenIds = new Set<number>();
    for (let i = n; i > 0; i--) {
      if (dp[i][w] !== dp[i - 1][w]) {
        const item = candidates[i - 1];
        chosenIds.add(item.id);
        w -= Math.max(1, Math.round(item.effort_principal * scale));
      }
    }

    // Combine forced and chosen
    const allSelectedIds = new Set([...forced, ...chosenIds]);
    const selectedItems = pool.filter(d => allSelectedIds.has(d.id));
    const deferredItems = pool.filter(d => !allSelectedIds.has(d.id));

    const totalEffort = selectedItems.reduce((acc, it) => acc + it.effort_principal, 0);
    const totalRisk = selectedItems.reduce((acc, it) => acc + it.risk_score, 0);
    const interestSaved = selectedItems.reduce((acc, it) => acc + it.accrued_interest, 0);
    const util = sprintBudgetHours > 0 ? (totalEffort / sprintBudgetHours) * 100 : 0;

    return {
      sprint_budget: sprintBudgetHours,
      total_effort_allocated: parseFloat(totalEffort.toFixed(1)),
      budget_utilization_pct: parseFloat(Math.min(100, util).toFixed(1)),
      total_risk_reduced: parseFloat(totalRisk.toFixed(2)),
      accumulated_interest_saved: parseFloat(interestSaved.toFixed(2)),
      selected_items: selectedItems.map(d => ({
        id: d.id,
        debt_key: d.debt_key,
        title: d.title,
        category: d.category,
        module_name: d.module_name,
        effort_principal: d.effort_principal,
        accrued_interest: d.accrued_interest,
        risk_score: d.risk_score,
        break_even_status: d.break_even_status,
        prerequisite_keys: d.prerequisite_ids.map(pid => store.debts.find(item => item.id === pid)?.debt_key || '')
      })),
      deferred_items: deferredItems.map(d => ({
        id: d.id,
        debt_key: d.debt_key,
        title: d.title,
        category: d.category,
        module_name: d.module_name,
        effort_principal: d.effort_principal,
        accrued_interest: d.accrued_interest,
        risk_score: d.risk_score,
        break_even_status: d.break_even_status,
        prerequisite_keys: d.prerequisite_ids.map(pid => store.debts.find(item => item.id === pid)?.debt_key || '')
      })),
      remediation_order: selectedItems.map(d => d.debt_key)
    };
  },

  simulateWhatIf: async (projectId: number, budgets?: number[]): Promise<{ scenarios: WhatIfScenario[] }> => {
    const points = budgets || [10, 20, 30, 40, 50, 60, 80, 100, 120];
    const scenarios: WhatIfScenario[] = [];
    for (const b of points) {
      const plan = await mockEngine.getOptimalPlan(projectId, b);
      const roi = parseFloat((plan.accumulated_interest_saved / Math.max(1, plan.total_effort_allocated)).toFixed(2));
      scenarios.push({
        budget: b,
        effort_used: plan.total_effort_allocated,
        items_count: plan.selected_items.length,
        risk_reduction: plan.total_risk_reduced,
        interest_saved: plan.accumulated_interest_saved,
        roi_ratio: roi
      });
    }
    return { scenarios };
  },

  getDashboardSummary: async (projectId: number): Promise<ExecutiveDashboardSummary> => {
    const totalPrincipal = store.debts.reduce((acc, d) => acc + d.effort_principal, 0);
    const totalInterest = store.debts.reduce((acc, d) => acc + d.accrued_interest, 0);
    const breakEvenCount = store.debts.filter(d => d.break_even_status).length;
    return {
      total_incidents: store.incidents.length,
      open_incidents: store.incidents.filter(i => i.status === 'OPEN').length,
      resolved_incidents: store.incidents.filter(i => i.status === 'RESOLVED').length,
      total_debt_items: store.debts.length,
      past_breakeven_count: breakEvenCount,
      total_principal_effort: parseFloat(totalPrincipal.toFixed(1)),
      total_accrued_interest: parseFloat(totalInterest.toFixed(1)),
      net_economic_drag: parseFloat((totalInterest - totalPrincipal).toFixed(1)),
      high_risk_modules: [
        { module: 'database', interest: 86.2, blast_radius: 5, debt_count: 2 },
        { module: 'payments', interest: 32.5, blast_radius: 4, debt_count: 1 },
        { module: 'settlement', interest: 28.0, blast_radius: 3, debt_count: 1 },
        { module: 'checkout', interest: 14.2, blast_radius: 2, debt_count: 1 },
        { module: 'auth', interest: 11.5, blast_radius: 2, debt_count: 1 },
        { module: 'notification', interest: 9.8, blast_radius: 1, debt_count: 1 }
      ],
      top_systemic_causes: store.causeNodes.slice(0, 5).map(c => ({
        id: c.id,
        description: c.description,
        category: c.category,
        betweenness_centrality: c.betweenness_centrality,
        degree_centrality: c.degree_centrality
      })),
      regressions_detected: 1,
      satd_count: store.satd.length
    };
  }
};
