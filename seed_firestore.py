import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

def to_fs(val):
    if val is None:
        return {'nullValue': None}
    if isinstance(val, bool):
        return {'booleanValue': val}
    if isinstance(val, int):
        return {'integerValue': str(val)}
    if isinstance(val, float):
        return {'doubleValue': val}
    if isinstance(val, str):
        return {'stringValue': val}
    if isinstance(val, list):
        return {'arrayValue': {'values': [to_fs(v) for v in val]}}
    if isinstance(val, dict):
        return {'mapValue': {'fields': {k: to_fs(v) for k, v in val.items()}}}
    return {'stringValue': str(val)}

def get_token():
    config_path = os.path.expanduser('~/.config/configstore/firebase-tools.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data['tokens']['access_token']

def save_document(collection: str, doc_id: str, data: dict, token: str, project_id: str = 'debtlens-ise'):
    url = f'https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/{collection}/{doc_id}'
    fields = {k: to_fs(v) for k, v in data.items()}
    body = json.dumps({'fields': fields}).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        },
        method='PATCH'
    )
    with urllib.request.urlopen(req) as resp:
        return resp.getcode()

def main():
    token = get_token()
    now = datetime.now(timezone.utc)
    
    print("Populating Cloud Firestore database (debtlens-ise)...")

    # 1. Organizations
    org = {
        'id': 1,
        'name': 'FinTech Cloud Engineering',
        'slug': 'fintech-cloud',
        'created_at': now.isoformat()
    }
    save_document('organizations', '1', org, token)
    print("[OK] Organizations seeded")

    # 2. Projects
    project = {
        'id': 1,
        'organization_id': 1,
        'name': 'Payments & Settlement Platform',
        'key': 'PAY',
        'description': 'Core multi-tenant payment gateway, settlement processing, and webhook routing architecture.',
        'repo_url': 'https://github.com/fintech-cloud/payments-core.git',
        'created_at': now.isoformat()
    }
    save_document('projects', '1', project, token)
    print("[OK] Projects seeded")

    # 3. Users
    users = [
        {'id': 1, 'email': 'admin@debtlens.io', 'full_name': 'Suraj Deshpande (Admin)', 'role': 'admin', 'organization_id': 1},
        {'id': 2, 'email': 'lead@debtlens.io', 'full_name': 'Sushma Hiremath (Tech Lead)', 'role': 'tech_lead', 'organization_id': 1},
        {'id': 3, 'email': 'dev@debtlens.io', 'full_name': 'Sushma Patil (Developer)', 'role': 'developer', 'organization_id': 1},
        {'id': 4, 'email': 'viewer@debtlens.io', 'full_name': 'Sushma Mathapati (Viewer)', 'role': 'viewer', 'organization_id': 1}
    ]
    for u in users:
        save_document('users', str(u['id']), u, token)
    print("[OK] Users seeded")

    # 4. Cause Nodes
    causes = [
        {'id': 1, 'project_id': 1, 'description': 'Database Connection Pool Exhaustion under Unbounded Waiting', 'normalized_text': 'database connection pool exhaustion under unbounded waiting', 'category': 'DATABASE', 'degree_centrality': 0.625, 'betweenness_centrality': 0.714, 'incident_count': 3, 'created_at': now.isoformat()},
        {'id': 2, 'project_id': 1, 'description': 'Unbounded HTTP and Socket Timeout on External Services', 'normalized_text': 'unbounded http and socket timeout on external services', 'category': 'NETWORK', 'degree_centrality': 0.375, 'betweenness_centrality': 0.428, 'incident_count': 2, 'created_at': now.isoformat()},
        {'id': 3, 'project_id': 1, 'description': 'Missing Distributed Idempotency Key in Transaction API', 'normalized_text': 'missing distributed idempotency key in transaction api', 'category': 'CONCURRENCY', 'degree_centrality': 0.250, 'betweenness_centrality': 0.285, 'incident_count': 2, 'created_at': now.isoformat()},
        {'id': 4, 'project_id': 1, 'description': 'Synchronous Blocking Calls inside Async Event Loop', 'normalized_text': 'synchronous blocking calls inside async event loop', 'category': 'PERFORMANCE', 'degree_centrality': 0.250, 'betweenness_centrality': 0.142, 'incident_count': 2, 'created_at': now.isoformat()},
        {'id': 5, 'project_id': 1, 'description': 'Missing Circuit Breaker and Cascading Failure Protection', 'normalized_text': 'missing circuit breaker and cascading failure protection', 'category': 'ARCHITECTURE', 'degree_centrality': 0.250, 'betweenness_centrality': 0.285, 'incident_count': 1, 'created_at': now.isoformat()},
        {'id': 6, 'project_id': 1, 'description': 'Unindexed Large Table Scans during Batch Settlement', 'normalized_text': 'unindexed large table scans during batch settlement', 'category': 'DATABASE', 'degree_centrality': 0.250, 'betweenness_centrality': 0.142, 'incident_count': 2, 'created_at': now.isoformat()},
        {'id': 7, 'project_id': 1, 'description': 'In-Memory State Leak in Multi-Instance Scaled Services', 'normalized_text': 'in-memory state leak in multi-instance scaled services', 'category': 'MEMORY', 'degree_centrality': 0.125, 'betweenness_centrality': 0.000, 'incident_count': 1, 'created_at': now.isoformat()},
        {'id': 8, 'project_id': 1, 'description': 'Missing Distributed Lock for Stock State Check', 'normalized_text': 'missing distributed lock for stock state check', 'category': 'CONCURRENCY', 'degree_centrality': 0.125, 'betweenness_centrality': 0.000, 'incident_count': 1, 'created_at': now.isoformat()}
    ]
    for c in causes:
        save_document('cause_nodes', str(c['id']), c, token)
    print("[OK] Cause nodes seeded")

    # 5. Causal Edges
    edges = [
        {'id': 'e1', 'source': '4', 'target': '1', 'relation': 'caused_by', 'weight': 3, 'project_id': 1},
        {'id': 'e2', 'source': '2', 'target': '1', 'relation': 'caused_by', 'weight': 3, 'project_id': 1},
        {'id': 'e3', 'source': '5', 'target': '2', 'relation': 'caused_by', 'weight': 2, 'project_id': 1},
        {'id': 'e4', 'source': '6', 'target': '1', 'relation': 'caused_by', 'weight': 3, 'project_id': 1},
        {'id': 'e5', 'source': '3', 'target': '8', 'relation': 'caused_by', 'weight': 2, 'project_id': 1}
    ]
    for e in edges:
        save_document('causal_edges', e['id'], e, token)
    print("[OK] Causal edges seeded")

    # 6. Incidents
    incidents = [
        {
            'id': 1, 'project_id': 1, 'incident_number': 'INC-101',
            'title': 'Stripe Webhook Gateway Timeout during Cyber Monday Spike',
            'description': 'Inbound Stripe webhook callbacks timed out resulting in dropped settlement receipts and unconfirmed customer orders.',
            'severity': 'CRITICAL', 'status': 'RESOLVED', 'affected_module': 'payments', 'affected_component': 'Webhook Listener',
            'reported_by': 'SRE Observability Bot', 'resolution_effort_hours': 14.0,
            'reported_at': (now - timedelta(days=45)).isoformat(), 'resolved_at': (now - timedelta(days=44)).isoformat()
        },
        {
            'id': 2, 'project_id': 1, 'incident_number': 'INC-102',
            'title': 'Database Connection Pool Starvation during Batch Settlement',
            'description': 'Nightly reconciliation job consumed all available pool connections, starving live payment processing requests for 48 minutes.',
            'severity': 'CRITICAL', 'status': 'RESOLVED', 'affected_module': 'database', 'affected_component': 'Connection Manager',
            'reported_by': 'SRE Observability Bot', 'resolution_effort_hours': 18.0,
            'reported_at': (now - timedelta(days=38)).isoformat(), 'resolved_at': (now - timedelta(days=37)).isoformat()
        },
        {
            'id': 3, 'project_id': 1, 'incident_number': 'INC-103',
            'title': 'Duplicate Charges on Mobile App Network Disconnect',
            'description': 'Users on flaky 4G connections received duplicate charges when double-clicking submit upon transient socket drop.',
            'severity': 'HIGH', 'status': 'RESOLVED', 'affected_module': 'orders', 'affected_component': 'Checkout Controller',
            'reported_by': 'SRE Observability Bot', 'resolution_effort_hours': 10.0,
            'reported_at': (now - timedelta(days=30)).isoformat(), 'resolved_at': (now - timedelta(days=29)).isoformat()
        },
        {
            'id': 4, 'project_id': 1, 'incident_number': 'INC-104',
            'title': 'Third-Party Tax API Latency Cascading to Checkout Block',
            'description': 'Avalara Tax API degraded to 12s response times, causing entire checkout pipeline to stall without graceful fallback.',
            'severity': 'HIGH', 'status': 'RESOLVED', 'affected_module': 'checkout', 'affected_component': 'Tax Calculation Client',
            'reported_by': 'SRE Observability Bot', 'resolution_effort_hours': 8.0,
            'reported_at': (now - timedelta(days=22)).isoformat(), 'resolved_at': (now - timedelta(days=21)).isoformat()
        },
        {
            'id': 5, 'project_id': 1, 'incident_number': 'INC-105',
            'title': 'Payment Gateway Timeout Surge under High Concurrency',
            'description': 'Active incident: Payment webhook requests timing out under sustained 500 RPS traffic surge. Similar pattern to INC-101.',
            'severity': 'CRITICAL', 'status': 'OPEN', 'affected_module': 'payments', 'affected_component': 'Webhook Listener',
            'reported_by': 'SRE Observability Bot', 'resolution_effort_hours': 12.0,
            'reported_at': (now - timedelta(days=2)).isoformat(), 'resolved_at': None
        },
        {
            'id': 6, 'project_id': 1, 'incident_number': 'INC-106',
            'title': 'Notification Webhook Worker Thread Starvation',
            'description': 'Customer email and SMS webhook worker threads exhausted due to synchronous blocking external REST calls.',
            'severity': 'MEDIUM', 'status': 'RESOLVED', 'affected_module': 'notification', 'affected_component': 'Event Dispatcher',
            'reported_by': 'SRE Observability Bot', 'resolution_effort_hours': 6.0,
            'reported_at': (now - timedelta(days=15)).isoformat(), 'resolved_at': (now - timedelta(days=14)).isoformat()
        },
        {
            'id': 7, 'project_id': 1, 'incident_number': 'INC-107',
            'title': 'Auth Service Memory Out-of-Bounds on Revocation Peak',
            'description': 'During mass token revocation event, in-memory blacklist consumed 98% of JVM container memory resulting in OOM kills.',
            'severity': 'HIGH', 'status': 'RESOLVED', 'affected_module': 'auth', 'affected_component': 'JWT Middleware',
            'reported_by': 'SRE Observability Bot', 'resolution_effort_hours': 7.0,
            'reported_at': (now - timedelta(days=12)).isoformat(), 'resolved_at': (now - timedelta(days=11)).isoformat()
        },
        {
            'id': 8, 'project_id': 1, 'incident_number': 'INC-108',
            'title': 'Flash Sale Oversell Incident due to Race Condition',
            'description': 'Two customers successfully purchased the final inventory unit simultaneously due to uncoordinated stock checks.',
            'severity': 'HIGH', 'status': 'RESOLVED', 'affected_module': 'inventory', 'affected_component': 'Stock Reservation',
            'reported_by': 'SRE Observability Bot', 'resolution_effort_hours': 9.0,
            'reported_at': (now - timedelta(days=8)).isoformat(), 'resolved_at': (now - timedelta(days=7)).isoformat()
        },
        {
            'id': 9, 'project_id': 1, 'incident_number': 'INC-109',
            'title': 'Settlement Reconciliation Latency Degraded to 4 Hours',
            'description': 'Database query plan regression causing sequential table scan across 12M audit rows during reconciliation run.',
            'severity': 'MEDIUM', 'status': 'INVESTIGATING', 'affected_module': 'settlement', 'affected_component': 'Batch Engine',
            'reported_by': 'SRE Observability Bot', 'resolution_effort_hours': 6.0,
            'reported_at': (now - timedelta(days=1)).isoformat(), 'resolved_at': None
        }
    ]
    for inc in incidents:
        save_document('incidents', str(inc['id']), inc, token)
    print("[OK] Incidents seeded")

    # 7. Technical Debt Items
    debts = [
        {
            'id': 1, 'project_id': 1, 'debt_key': 'DEBT-101',
            'title': 'Refactor Database Connection Pool to HikariCP with Dynamic Backpressure',
            'description': 'Replace current naive thread pool with asynchronous connection pool featuring adaptive capacity, fast-fail timeout, and circuit breaker.',
            'category': 'ARCHITECTURAL', 'module_name': 'database', 'file_path': 'database/connection_pool.py',
            'effort_principal': 16.0, 'accrued_interest': 64.2, 'break_even_status': True, 'risk_score': 9.4,
            'status': 'PRIORITIZED', 'assignee': 'Sushma Patil', 'root_cause_id': 1,
            'created_at': (now - timedelta(days=40)).isoformat(), 'updated_at': now.isoformat(),
            'prerequisite_ids': [], 'linked_incident_count': 3, 'age_days': 40
        },
        {
            'id': 2, 'project_id': 1, 'debt_key': 'DEBT-102',
            'title': 'Implement Distributed Idempotency Interceptor via Redis Redlock',
            'description': 'Enforce mandatory Client-Request-Id header with Redis-backed distributed lock and 24-hour response caching on all mutable payment APIs.',
            'category': 'ARCHITECTURAL', 'module_name': 'payments', 'file_path': 'payments/gateway_client.py',
            'effort_principal': 12.0, 'accrued_interest': 32.5, 'break_even_status': True, 'risk_score': 8.8,
            'status': 'PRIORITIZED', 'assignee': 'Sushma Patil', 'root_cause_id': 3,
            'created_at': (now - timedelta(days=30)).isoformat(), 'updated_at': now.isoformat(),
            'prerequisite_ids': [], 'linked_incident_count': 2, 'age_days': 30
        },
        {
            'id': 3, 'project_id': 1, 'debt_key': 'DEBT-103',
            'title': 'Add Resilience4j Circuit Breakers to Third-Party Tax & Gateway Clients',
            'description': 'Wrap all external HTTP client calls with configurable circuit breakers, exponential backoff with jitter, and static fallback stubs.',
            'category': 'INFRASTRUCTURE', 'module_name': 'checkout', 'file_path': 'checkout/checkout_flow.py',
            'effort_principal': 8.0, 'accrued_interest': 14.2, 'break_even_status': True, 'risk_score': 7.2,
            'status': 'IDENTIFIED', 'assignee': 'Sushma Patil', 'root_cause_id': 5,
            'created_at': (now - timedelta(days=25)).isoformat(), 'updated_at': now.isoformat(),
            'prerequisite_ids': [], 'linked_incident_count': 1, 'age_days': 25
        },
        {
            'id': 4, 'project_id': 1, 'debt_key': 'DEBT-104',
            'title': 'Add Composite Partitioning and Indexes to Transaction Audit Log',
            'description': 'Add compound index on (tenant_id, settlement_date, status) and partition postgres table by month to eliminate 4-hour sequential scans.',
            'category': 'CODE_SMELL', 'module_name': 'settlement', 'file_path': 'settlement/reconciliation_engine.py',
            'effort_principal': 6.0, 'accrued_interest': 28.0, 'break_even_status': True, 'risk_score': 8.1,
            'status': 'PRIORITIZED', 'assignee': 'Sushma Patil', 'root_cause_id': 6,
            'created_at': (now - timedelta(days=35)).isoformat(), 'updated_at': now.isoformat(),
            'prerequisite_ids': [], 'linked_incident_count': 2, 'age_days': 35
        },
        {
            'id': 5, 'project_id': 1, 'debt_key': 'DEBT-105',
            'title': 'Refactor Notification Dispatcher to Asynchronous SQS/Kafka Pipeline',
            'description': 'Eliminate synchronous HTTP calls from notification worker threads by introducing persistent broker queues with retry dead-letter topics.',
            'category': 'ARCHITECTURAL', 'module_name': 'notification', 'file_path': 'notification/webhook_dispatcher.py',
            'effort_principal': 18.0, 'accrued_interest': 9.8, 'break_even_status': False, 'risk_score': 5.6,
            'status': 'IDENTIFIED', 'assignee': 'Sushma Patil', 'root_cause_id': 4,
            'created_at': (now - timedelta(days=20)).isoformat(), 'updated_at': now.isoformat(),
            'prerequisite_ids': [], 'linked_incident_count': 1, 'age_days': 20
        },
        {
            'id': 6, 'project_id': 1, 'debt_key': 'DEBT-106',
            'title': 'Migrate In-Memory JWT Revocation List to Scaled Redis Bloom Filter',
            'description': 'Replace memory-hogging dictionary with distributed Redis Bloom Filter and 2-hour sliding window TTL to prevent container OOM.',
            'category': 'SECURITY_DEBT', 'module_name': 'auth', 'file_path': 'auth/jwt_token_validator.py',
            'effort_principal': 10.0, 'accrued_interest': 11.5, 'break_even_status': True, 'risk_score': 6.9,
            'status': 'IDENTIFIED', 'assignee': 'Sushma Patil', 'root_cause_id': 7,
            'created_at': (now - timedelta(days=15)).isoformat(), 'updated_at': now.isoformat(),
            'prerequisite_ids': [], 'linked_incident_count': 1, 'age_days': 15
        },
        {
            'id': 7, 'project_id': 1, 'debt_key': 'DEBT-107',
            'title': 'Deploy Horizontal Read Replicas and Query Routing (Requires DEBT-101)',
            'description': 'Route reporting and settlement queries to dedicated PostgreSQL read replica; depends on connection pool support from DEBT-101.',
            'category': 'INFRASTRUCTURE', 'module_name': 'database', 'file_path': 'database/connection_pool.py',
            'effort_principal': 20.0, 'accrued_interest': 22.0, 'break_even_status': True, 'risk_score': 7.8,
            'status': 'IDENTIFIED', 'assignee': 'Sushma Patil', 'root_cause_id': 1,
            'created_at': (now - timedelta(days=10)).isoformat(), 'updated_at': now.isoformat(),
            'prerequisite_ids': [1], 'linked_incident_count': 1, 'age_days': 10
        }
    ]
    for d in debts:
        save_document('technical_debt_items', str(d['id']), d, token)
    print("[OK] Technical debt items seeded")

    # 8. File Hotspots
    hotspots = [
        {'id': 1, 'file_path': 'database/connection_pool.py', 'module_name': 'database', 'churn_count': 68, 'cyclomatic_complexity': 24.5, 'risk_score': 95.2, 'blast_radius': 5, 'project_id': 1},
        {'id': 2, 'file_path': 'payments/gateway_client.py', 'module_name': 'payments', 'churn_count': 54, 'cyclomatic_complexity': 18.0, 'risk_score': 82.4, 'blast_radius': 4, 'project_id': 1},
        {'id': 3, 'file_path': 'settlement/reconciliation_engine.py', 'module_name': 'settlement', 'churn_count': 47, 'cyclomatic_complexity': 21.0, 'risk_score': 78.6, 'blast_radius': 3, 'project_id': 1},
        {'id': 4, 'file_path': 'orders/order_processor.py', 'module_name': 'orders', 'churn_count': 39, 'cyclomatic_complexity': 15.5, 'risk_score': 63.8, 'blast_radius': 3, 'project_id': 1},
        {'id': 5, 'file_path': 'auth/jwt_token_validator.py', 'module_name': 'auth', 'churn_count': 26, 'cyclomatic_complexity': 12.0, 'risk_score': 48.0, 'blast_radius': 2, 'project_id': 1},
        {'id': 6, 'file_path': 'checkout/checkout_flow.py', 'module_name': 'checkout', 'churn_count': 32, 'cyclomatic_complexity': 14.0, 'risk_score': 52.5, 'blast_radius': 2, 'project_id': 1},
        {'id': 7, 'file_path': 'notification/webhook_dispatcher.py', 'module_name': 'notification', 'churn_count': 28, 'cyclomatic_complexity': 10.5, 'risk_score': 39.0, 'blast_radius': 1, 'project_id': 1},
        {'id': 8, 'file_path': 'inventory/stock_manager.py', 'module_name': 'inventory', 'churn_count': 22, 'cyclomatic_complexity': 11.0, 'risk_score': 36.5, 'blast_radius': 1, 'project_id': 1}
    ]
    for h in hotspots:
        save_document('hotspots', str(h['id']), h, token)
    print("[OK] Hotspots seeded")

    # 9. SATD
    satd = [
        {'id': 1, 'file_path': 'database/connection_pool.py', 'line_number': 84, 'marker_type': 'FIXME', 'comment_text': 'Connection pool leak when async transaction rolls back during timeout', 'module_name': 'database', 'status': 'OPEN', 'project_id': 1},
        {'id': 2, 'file_path': 'database/connection_pool.py', 'line_number': 142, 'marker_type': 'TODO', 'comment_text': 'Replace unbounded waiting with bounded semaphore and exponential backoff', 'module_name': 'database', 'status': 'OPEN', 'project_id': 1},
        {'id': 3, 'file_path': 'payments/gateway_client.py', 'line_number': 112, 'marker_type': 'HACK', 'comment_text': 'Bypassing idempotency token check for fast-track legacy card checkouts', 'module_name': 'payments', 'status': 'OPEN', 'project_id': 1},
        {'id': 4, 'file_path': 'payments/gateway_client.py', 'line_number': 205, 'marker_type': 'OPTIMIZE', 'comment_text': 'Circuit breaker fallback is synchronous; blocks worker threads during outage', 'module_name': 'payments', 'status': 'OPEN', 'project_id': 1},
        {'id': 5, 'file_path': 'orders/order_processor.py', 'line_number': 97, 'marker_type': 'BUG', 'comment_text': 'Race condition if duplicate webhook arrives within 20ms', 'module_name': 'orders', 'status': 'OPEN', 'project_id': 1},
        {'id': 6, 'file_path': 'settlement/reconciliation_engine.py', 'line_number': 163, 'marker_type': 'DEPRECATED', 'comment_text': 'Using legacy unindexed batch scan over entire transaction ledger table', 'module_name': 'settlement', 'status': 'OPEN', 'project_id': 1},
        {'id': 7, 'file_path': 'auth/jwt_token_validator.py', 'line_number': 52, 'marker_type': 'HACK', 'comment_text': 'In-memory token blacklist leaks heap memory under high load', 'module_name': 'auth', 'status': 'OPEN', 'project_id': 1}
    ]
    for s in satd:
        save_document('satd', str(s['id']), s, token)
    print("[OK] SATD items seeded")

    # 10. Module Dependencies
    deps = [
        {'id': 'd1', 'source': 'orders', 'target': 'payments', 'project_id': 1},
        {'id': 'd2', 'source': 'orders', 'target': 'inventory', 'project_id': 1},
        {'id': 'd3', 'source': 'orders', 'target': 'auth', 'project_id': 1},
        {'id': 'd4', 'source': 'payments', 'target': 'database', 'project_id': 1},
        {'id': 'd5', 'source': 'settlement', 'target': 'database', 'project_id': 1},
        {'id': 'd6', 'source': 'settlement', 'target': 'payments', 'project_id': 1},
        {'id': 'd7', 'source': 'checkout', 'target': 'orders', 'project_id': 1},
        {'id': 'd8', 'source': 'checkout', 'target': 'payments', 'project_id': 1},
        {'id': 'd9', 'source': 'checkout', 'target': 'auth', 'project_id': 1},
        {'id': 'd10', 'source': 'notification', 'target': 'orders', 'project_id': 1},
        {'id': 'd11', 'source': 'reporting', 'target': 'database', 'project_id': 1},
        {'id': 'd12', 'source': 'reporting', 'target': 'settlement', 'project_id': 1}
    ]
    for d in deps:
        save_document('dependencies', d['id'], d, token)
    print("[OK] Module dependencies seeded")

    print("\nSUCCESS: All DebtLens collections successfully populated in Cloud Firestore!")

if __name__ == '__main__':
    main()
