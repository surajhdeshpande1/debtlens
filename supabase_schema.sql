-- ==============================================================================
-- DebtLens: Supabase PostgreSQL Database Schema & Seed Data
-- Basaveshwar Engineering College Bagalkote - Dept. of ISE (BISA531P)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    repo_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Cause Nodes (5-Whys Directed Causal Nodes)
CREATE TABLE IF NOT EXISTS cause_nodes (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'GENERAL',
    degree_centrality FLOAT DEFAULT 0.0,
    betweenness_centrality FLOAT DEFAULT 0.0,
    incident_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Causal Edges (Directed Relationships: u caused_by v)
CREATE TABLE IF NOT EXISTS causal_edges (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    source_cause_id BIGINT REFERENCES cause_nodes(id) ON DELETE CASCADE,
    target_cause_id BIGINT REFERENCES cause_nodes(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) DEFAULT 'caused_by',
    frequency INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Incidents Table
CREATE TABLE IF NOT EXISTS incidents (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    incident_number VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'MEDIUM',
    status VARCHAR(20) DEFAULT 'OPEN',
    affected_module VARCHAR(100) NOT NULL,
    affected_component VARCHAR(100),
    reported_by VARCHAR(100) DEFAULT 'SRE Bot',
    resolution_notes TEXT,
    resolution_effort_hours FLOAT DEFAULT 4.0,
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 7. Incident Causal Links (Connecting Incident to 5-Whys Steps)
CREATE TABLE IF NOT EXISTS incident_causal_links (
    id BIGSERIAL PRIMARY KEY,
    incident_id BIGINT REFERENCES incidents(id) ON DELETE CASCADE,
    cause_node_id BIGINT REFERENCES cause_nodes(id) ON DELETE CASCADE,
    step_number INT NOT NULL
);

-- 8. Technical Debt Items Table
CREATE TABLE IF NOT EXISTS debt_items (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    debt_key VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'CODE_SMELL',
    module_name VARCHAR(100) NOT NULL,
    file_path VARCHAR(255),
    effort_principal FLOAT DEFAULT 8.0,
    accrued_interest FLOAT DEFAULT 0.0,
    break_even_status BOOLEAN DEFAULT FALSE,
    risk_score FLOAT DEFAULT 0.0,
    status VARCHAR(30) DEFAULT 'IDENTIFIED',
    assignee VARCHAR(100),
    root_cause_id BIGINT REFERENCES cause_nodes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Debt Incident Links
CREATE TABLE IF NOT EXISTS debt_incident_links (
    id BIGSERIAL PRIMARY KEY,
    debt_id BIGINT REFERENCES debt_items(id) ON DELETE CASCADE,
    incident_id BIGINT REFERENCES incidents(id) ON DELETE CASCADE
);

-- 10. Debt Prerequisites (Topological DAG constraints)
CREATE TABLE IF NOT EXISTS debt_prerequisites (
    id BIGSERIAL PRIMARY KEY,
    debt_id BIGINT REFERENCES debt_items(id) ON DELETE CASCADE,
    prerequisite_debt_id BIGINT REFERENCES debt_items(id) ON DELETE CASCADE
);

-- 11. File Hotspots (Repository Evidence)
CREATE TABLE IF NOT EXISTS file_hotspots (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    churn_count INT DEFAULT 0,
    cyclomatic_complexity FLOAT DEFAULT 1.0,
    risk_score FLOAT DEFAULT 0.0,
    blast_radius INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Self-Admitted Technical Debt (SATD)
CREATE TABLE IF NOT EXISTS self_admitted_debt (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    line_number INT NOT NULL,
    marker_type VARCHAR(20) NOT NULL,
    comment_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Module Dependencies (Architecture Graph)
CREATE TABLE IF NOT EXISTS module_dependencies (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    source_module VARCHAR(100) NOT NULL,
    target_module VARCHAR(100) NOT NULL
);

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY & OPEN PUBLIC ACCESS FOR WEB CLIENT
-- ==============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cause_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_causal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_incident_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_admitted_debt ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read/Write for organizations" ON organizations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for cause_nodes" ON cause_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for causal_edges" ON causal_edges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for incidents" ON incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for incident_causal_links" ON incident_causal_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for debt_items" ON debt_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for debt_incident_links" ON debt_incident_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for debt_prerequisites" ON debt_prerequisites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for file_hotspots" ON file_hotspots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for self_admitted_debt" ON self_admitted_debt FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write for module_dependencies" ON module_dependencies FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- SEED DATA: FinTech Enterprise Corpus
-- ==============================================================================
INSERT INTO organizations (id, name, slug) VALUES 
(1, 'FinTech Cloud Engineering', 'fintech-cloud')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, organization_id, name, key, description, repo_url) VALUES
(1, 1, 'Payments & Settlement Platform', 'PAY', 'Core multi-tenant payment gateway, settlement processing, and webhook routing architecture.', 'https://github.com/fintech-cloud/payments-core.git')
ON CONFLICT (id) DO NOTHING;

-- Cause Nodes
INSERT INTO cause_nodes (id, project_id, description, normalized_text, category, degree_centrality, betweenness_centrality, incident_count) VALUES
(1, 1, 'Database Connection Pool Exhaustion under Unbounded Waiting', 'database connection pool exhaustion under unbounded waiting', 'DATABASE', 0.625, 0.714, 3),
(2, 1, 'Unbounded HTTP and Socket Timeout on External Services', 'unbounded http and socket timeout on external services', 'NETWORK', 0.375, 0.428, 2),
(3, 1, 'Missing Distributed Idempotency Key in Transaction API', 'missing distributed idempotency key in transaction api', 'CONCURRENCY', 0.250, 0.285, 2),
(4, 1, 'Synchronous Blocking Calls inside Async Event Loop', 'synchronous blocking calls inside async event loop', 'PERFORMANCE', 0.250, 0.142, 2),
(5, 1, 'Missing Circuit Breaker and Cascading Failure Protection', 'missing circuit breaker and cascading failure protection', 'ARCHITECTURE', 0.250, 0.285, 1),
(6, 1, 'Unindexed Large Table Scans during Batch Settlement', 'unindexed large table scans during batch settlement', 'DATABASE', 0.250, 0.142, 2),
(7, 1, 'In-Memory State Leak in Multi-Instance Scaled Services', 'in-memory state leak in multi-instance scaled services', 'MEMORY', 0.125, 0.000, 1),
(8, 1, 'Missing Distributed Lock for Stock State Check', 'missing distributed lock for stock state check', 'CONCURRENCY', 0.125, 0.000, 1)
ON CONFLICT (id) DO NOTHING;

-- Causal Edges
INSERT INTO causal_edges (id, project_id, source_cause_id, target_cause_id, relation_type, frequency) VALUES
(1, 1, 4, 1, 'caused_by', 3),
(2, 1, 2, 1, 'caused_by', 3),
(3, 1, 5, 2, 'caused_by', 2),
(4, 1, 6, 1, 'caused_by', 3),
(5, 1, 3, 8, 'caused_by', 2)
ON CONFLICT (id) DO NOTHING;

-- Incidents
INSERT INTO incidents (id, project_id, incident_number, title, description, severity, status, affected_module, affected_component, reported_by, resolution_effort_hours, reported_at, resolved_at) VALUES
(1, 1, 'INC-101', 'Stripe Webhook Gateway Timeout during Cyber Monday Spike', 'Inbound Stripe webhook callbacks timed out resulting in dropped settlement receipts and unconfirmed customer orders.', 'CRITICAL', 'RESOLVED', 'payments', 'Webhook Listener', 'SRE Bot', 14.0, NOW() - INTERVAL '45 days', NOW() - INTERVAL '44 days'),
(2, 1, 'INC-102', 'Database Connection Pool Starvation during Batch Settlement', 'Nightly reconciliation job consumed all available pool connections, starving live payment processing requests for 48 minutes.', 'CRITICAL', 'RESOLVED', 'database', 'Connection Manager', 'SRE Bot', 18.0, NOW() - INTERVAL '38 days', NOW() - INTERVAL '37 days'),
(3, 1, 'INC-103', 'Duplicate Charges on Mobile App Network Disconnect', 'Users on flaky 4G connections received duplicate charges when double-clicking submit upon transient socket drop.', 'HIGH', 'RESOLVED', 'orders', 'Checkout Controller', 'SRE Bot', 10.0, NOW() - INTERVAL '30 days', NOW() - INTERVAL '29 days'),
(4, 1, 'INC-104', 'Third-Party Tax API Latency Cascading to Checkout Block', 'Avalara Tax API degraded to 12s response times, causing entire checkout pipeline to stall without graceful fallback.', 'HIGH', 'RESOLVED', 'checkout', 'Tax Calculation Client', 'SRE Bot', 8.0, NOW() - INTERVAL '22 days', NOW() - INTERVAL '21 days'),
(5, 1, 'INC-105', 'Payment Gateway Timeout Surge under High Concurrency', 'Active incident: Payment webhook requests timing out under sustained 500 RPS traffic surge. Similar pattern to INC-101.', 'CRITICAL', 'OPEN', 'payments', 'Webhook Listener', 'SRE Bot', 12.0, NOW() - INTERVAL '2 days', NULL),
(6, 1, 'INC-106', 'Notification Webhook Worker Thread Starvation', 'Customer email and SMS webhook worker threads exhausted due to synchronous blocking external REST calls.', 'MEDIUM', 'RESOLVED', 'notification', 'Event Dispatcher', 'SRE Bot', 6.0, NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),
(7, 1, 'INC-107', 'Auth Service Memory Out-of-Bounds on Revocation Peak', 'During mass token revocation event, in-memory blacklist consumed 98% of JVM container memory resulting in OOM kills.', 'HIGH', 'RESOLVED', 'auth', 'JWT Middleware', 'SRE Bot', 7.0, NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days'),
(8, 1, 'INC-108', 'Flash Sale Oversell Incident due to Race Condition', 'Two customers successfully purchased the final inventory unit simultaneously due to uncoordinated stock checks.', 'HIGH', 'RESOLVED', 'inventory', 'Stock Reservation', 'SRE Bot', 9.0, NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days'),
(9, 1, 'INC-109', 'Settlement Reconciliation Latency Degraded to 4 Hours', 'Database query plan regression causing sequential table scan across 12M audit rows during reconciliation run.', 'MEDIUM', 'INVESTIGATING', 'settlement', 'Batch Engine', 'SRE Bot', 6.0, NOW() - INTERVAL '1 day', NULL)
ON CONFLICT (id) DO NOTHING;

-- Debt Items
INSERT INTO debt_items (id, project_id, debt_key, title, description, category, module_name, file_path, effort_principal, accrued_interest, break_even_status, risk_score, status, assignee, root_cause_id, created_at) VALUES
(1, 1, 'DEBT-101', 'Refactor Database Connection Pool to HikariCP with Dynamic Backpressure', 'Replace current naive thread pool with asynchronous connection pool featuring adaptive capacity, fast-fail timeout, and circuit breaker.', 'ARCHITECTURAL', 'database', 'database/connection_pool.py', 16.0, 64.2, TRUE, 9.4, 'PRIORITIZED', 'Sushma Patil', 1, NOW() - INTERVAL '40 days'),
(2, 1, 'DEBT-102', 'Implement Distributed Idempotency Interceptor via Redis Redlock', 'Enforce mandatory Client-Request-Id header with Redis-backed distributed lock and 24-hour response caching on all mutable payment APIs.', 'ARCHITECTURAL', 'payments', 'payments/gateway_client.py', 12.0, 32.5, TRUE, 8.8, 'PRIORITIZED', 'Sushma Patil', 3, NOW() - INTERVAL '30 days'),
(3, 1, 'DEBT-103', 'Add Resilience4j Circuit Breakers to Third-Party Tax & Gateway Clients', 'Wrap all external HTTP client calls with configurable circuit breakers, exponential backoff with jitter, and static fallback stubs.', 'INFRASTRUCTURE', 'checkout', 'checkout/checkout_flow.py', 8.0, 14.2, TRUE, 7.2, 'IDENTIFIED', 'Sushma Patil', 5, NOW() - INTERVAL '25 days'),
(4, 1, 'DEBT-104', 'Add Composite Partitioning and Indexes to Transaction Audit Log', 'Add compound index on (tenant_id, settlement_date, status) and partition postgres table by month to eliminate 4-hour sequential scans.', 'CODE_SMELL', 'settlement', 'settlement/reconciliation_engine.py', 6.0, 28.0, TRUE, 8.1, 'PRIORITIZED', 'Sushma Patil', 6, NOW() - INTERVAL '35 days'),
(5, 1, 'DEBT-105', 'Refactor Notification Dispatcher to Asynchronous SQS/Kafka Pipeline', 'Eliminate synchronous HTTP calls from notification worker threads by introducing persistent broker queues with retry dead-letter topics.', 'ARCHITECTURAL', 'notification', 'notification/webhook_dispatcher.py', 18.0, 9.8, FALSE, 5.6, 'IDENTIFIED', 'Sushma Patil', 4, NOW() - INTERVAL '20 days'),
(6, 1, 'DEBT-106', 'Migrate In-Memory JWT Revocation List to Scaled Redis Bloom Filter', 'Replace memory-hogging dictionary with distributed Redis Bloom Filter and 2-hour sliding window TTL to prevent container OOM.', 'SECURITY_DEBT', 'auth', 'auth/jwt_token_validator.py', 10.0, 11.5, TRUE, 6.9, 'IDENTIFIED', 'Sushma Patil', 7, NOW() - INTERVAL '15 days'),
(7, 1, 'DEBT-107', 'Deploy Horizontal Read Replicas and Query Routing (Requires DEBT-101)', 'Route reporting and settlement queries to dedicated PostgreSQL read replica; depends on connection pool support from DEBT-101.', 'INFRASTRUCTURE', 'database', 'database/connection_pool.py', 20.0, 22.0, TRUE, 7.8, 'IDENTIFIED', 'Sushma Patil', 1, NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- Debt Prerequisites
INSERT INTO debt_prerequisites (id, debt_id, prerequisite_debt_id) VALUES
(1, 7, 1)
ON CONFLICT (id) DO NOTHING;

-- File Hotspots
INSERT INTO file_hotspots (id, project_id, file_path, module_name, churn_count, cyclomatic_complexity, risk_score, blast_radius) VALUES
(1, 1, 'database/connection_pool.py', 'database', 68, 24.5, 95.2, 5),
(2, 1, 'payments/gateway_client.py', 'payments', 54, 18.0, 82.4, 4),
(3, 1, 'settlement/reconciliation_engine.py', 'settlement', 47, 21.0, 78.6, 3),
(4, 1, 'orders/order_processor.py', 'orders', 39, 15.5, 63.8, 3),
(5, 1, 'auth/jwt_token_validator.py', 'auth', 26, 12.0, 48.0, 2),
(6, 1, 'checkout/checkout_flow.py', 'checkout', 32, 14.0, 52.5, 2),
(7, 1, 'notification/webhook_dispatcher.py', 'notification', 28, 10.5, 39.0, 1),
(8, 1, 'inventory/stock_manager.py', 'inventory', 22, 11.0, 36.5, 1)
ON CONFLICT (id) DO NOTHING;

-- Self-Admitted Debt
INSERT INTO self_admitted_debt (id, project_id, file_path, module_name, line_number, marker_type, comment_text, status) VALUES
(1, 1, 'database/connection_pool.py', 'database', 84, 'FIXME', 'Connection pool leak when async transaction rolls back during timeout', 'OPEN'),
(2, 1, 'database/connection_pool.py', 'database', 142, 'TODO', 'Replace unbounded waiting with bounded semaphore and exponential backoff', 'OPEN'),
(3, 1, 'payments/gateway_client.py', 'payments', 112, 'HACK', 'Bypassing idempotency token check for fast-track legacy card checkouts', 'OPEN'),
(4, 1, 'payments/gateway_client.py', 'payments', 205, 'OPTIMIZE', 'Circuit breaker fallback is synchronous; blocks worker threads during outage', 'OPEN'),
(5, 1, 'orders/order_processor.py', 'orders', 97, 'BUG', 'Race condition if duplicate webhook arrives within 20ms', 'OPEN'),
(6, 1, 'settlement/reconciliation_engine.py', 'settlement', 163, 'DEPRECATED', 'Using legacy unindexed batch scan over entire transaction ledger table', 'OPEN'),
(7, 1, 'auth/jwt_token_validator.py', 'auth', 52, 'HACK', 'In-memory token blacklist leaks heap memory under high load', 'OPEN')
ON CONFLICT (id) DO NOTHING;

-- Module Dependencies
INSERT INTO module_dependencies (id, project_id, source_module, target_module) VALUES
(1, 1, 'orders', 'payments'),
(2, 1, 'orders', 'inventory'),
(3, 1, 'orders', 'auth'),
(4, 1, 'payments', 'database'),
(5, 1, 'settlement', 'database'),
(6, 1, 'settlement', 'payments'),
(7, 1, 'checkout', 'orders'),
(8, 1, 'checkout', 'payments'),
(9, 1, 'checkout', 'auth'),
(10, 1, 'notification', 'orders'),
(11, 1, 'reporting', 'database'),
(12, 1, 'reporting', 'settlement')
ON CONFLICT (id) DO NOTHING;

