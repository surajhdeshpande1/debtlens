from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.user import User, Organization, Project, ProjectMember, UserRole
from app.models.incident import Incident, IncidentSeverity, IncidentStatus
from app.models.causal import CauseNode, CausalEdge, IncidentCausalLink
from app.models.debt import DebtItem, DebtCategory, DebtStatus, DebtPrerequisite, DebtIncidentLink
from app.models.repository import RepoMetadata, FileHotspot, ModuleDependency, SelfAdmittedDebt
from app.services.auth_service import get_password_hash
from app.services.causal_graph import recompute_centrality_metrics
from app.services.debt_economics import update_debt_economics
from app.utils import utc_now

def seed_database(db: Session):
    # Check if already seeded
    if db.query(Organization).first():
        return

    print("Seeding DebtLens database with realistic enterprise corpus...")

    # 1. Organization
    org = Organization(name="FinTech Cloud Engineering", slug="fintech-cloud")
    db.add(org)
    db.flush()

    # 2. Users (Admin, Tech Lead, Developer, Viewer)
    default_pw = get_password_hash("password123")
    users = [
        User(email="admin@debtlens.io", full_name="Suraj Deshpande (Admin)", role=UserRole.ADMIN.value, hashed_password=default_pw, organization_id=org.id),
        User(email="lead@debtlens.io", full_name="Sushma Hiremath (Tech Lead)", role=UserRole.TECH_LEAD.value, hashed_password=default_pw, organization_id=org.id),
        User(email="dev@debtlens.io", full_name="Sushma Patil (Developer)", role=UserRole.DEVELOPER.value, hashed_password=default_pw, organization_id=org.id),
        User(email="viewer@debtlens.io", full_name="Sushma Mathapati (Viewer)", role=UserRole.VIEWER.value, hashed_password=default_pw, organization_id=org.id),
    ]
    for u in users:
        db.add(u)
    db.flush()

    # 3. Project
    proj = Project(
        organization_id=org.id,
        name="Payments & Settlement Platform",
        key="PAY",
        description="Core multi-tenant payment gateway, settlement processing, and webhook routing architecture.",
        repo_url="https://github.com/fintech-cloud/payments-core.git"
    )
    db.add(proj)
    db.flush()

    # Add Project Members
    for u in users:
        db.add(ProjectMember(project_id=proj.id, user_id=u.id, role=u.role))
    db.flush()

    # 4. Module Dependencies (Architecture Graph)
    # Target is depended upon by Source (Source -> Target)
    deps = [
        ("orders", "payments"),
        ("orders", "inventory"),
        ("orders", "auth"),
        ("payments", "database"),
        ("settlement", "database"),
        ("settlement", "payments"),
        ("checkout", "orders"),
        ("checkout", "payments"),
        ("checkout", "auth"),
        ("notification", "orders"),
        ("reporting", "database"),
        ("reporting", "settlement")
    ]
    for src, tgt in deps:
        db.add(ModuleDependency(project_id=proj.id, source_module=src, target_module=tgt))
    db.flush()

    # 5. File Hotspots (Complexity & Churn)
    hotspots_data = [
        ("database/connection_pool.py", "database", 68, 24.5, 95.2),
        ("payments/gateway_client.py", "payments", 54, 18.0, 82.4),
        ("settlement/reconciliation_engine.py", "settlement", 47, 21.0, 78.6),
        ("orders/order_processor.py", "orders", 39, 15.5, 63.8),
        ("auth/jwt_token_validator.py", "auth", 26, 12.0, 48.0),
        ("checkout/checkout_flow.py", "checkout", 32, 14.0, 52.5),
        ("notification/webhook_dispatcher.py", "notification", 28, 10.5, 39.0),
        ("inventory/stock_manager.py", "inventory", 22, 11.0, 36.5)
    ]
    for fp, mod, churn, cc, risk in hotspots_data:
        db.add(FileHotspot(
            project_id=proj.id,
            file_path=fp,
            module_name=mod,
            churn_count=churn,
            cyclomatic_complexity=cc,
            risk_score=risk
        ))
    db.flush()

    # 6. Self-Admitted Technical Debt (SATD)
    satd_data = [
        ("database/connection_pool.py", 84, "FIXME", "Connection pool leak when async transaction rolls back during timeout", "database"),
        ("database/connection_pool.py", 142, "TODO", "Replace unbounded waiting with bounded semaphore and exponential backoff", "database"),
        ("payments/gateway_client.py", 112, "HACK", "Bypassing idempotency token check for fast-track legacy card checkouts", "payments"),
        ("payments/gateway_client.py", 205, "OPTIMIZE", "Circuit breaker fallback is synchronous; blocks worker threads during outage", "payments"),
        ("orders/order_processor.py", 97, "BUG", "Race condition if duplicate webhook arrives within 20ms", "orders"),
        ("settlement/reconciliation_engine.py", 163, "DEPRECATED", "Using legacy unindexed batch scan over entire transaction ledger table", "settlement"),
        ("auth/jwt_token_validator.py", 52, "WORKAROUND", "In-memory token blacklist leaks heap memory under high load", "auth")
    ]
    for fp, ln, mt, ct, mod in satd_data:
        db.add(SelfAdmittedDebt(
            project_id=proj.id,
            file_path=fp,
            line_number=ln,
            marker_type=mt,
            comment_text=ct,
            module_name=mod
        ))
    db.flush()

    # 7. Causal Nodes (Reusable Root Causes)
    causes_data = [
        ("Database Connection Pool Exhaustion under Unbounded Waiting", "DATABASE"),
        ("Unbounded HTTP and Socket Timeout on External Services", "NETWORK"),
        ("Missing Distributed Idempotency Key in Transaction API", "CONCURRENCY"),
        ("Synchronous Blocking Calls inside Async Event Loop", "PERFORMANCE"),
        ("Missing Circuit Breaker and Cascading Failure Protection", "ARCHITECTURE"),
        ("Unindexed Large Table Scans during Batch Settlement", "DATABASE"),
        ("In-Memory State Leak in Multi-Instance Scaled Services", "MEMORY"),
        ("Missing Distributed Lock for Stock State Check", "CONCURRENCY")
    ]
    cause_objs = {}
    for desc, cat in causes_data:
        norm = desc.lower().strip()
        c = CauseNode(
            project_id=proj.id,
            description=desc,
            normalized_text=norm,
            category=cat
        )
        db.add(c)
        cause_objs[desc] = c
    db.flush()

    # 8. Causal Edges (5 Whys Directed Causal Relationships)
    # source -> target ("source caused target" or "target was caused by source")
    edges_data = [
        ("Synchronous Blocking Calls inside Async Event Loop", "Database Connection Pool Exhaustion under Unbounded Waiting"),
        ("Unbounded HTTP and Socket Timeout on External Services", "Database Connection Pool Exhaustion under Unbounded Waiting"),
        ("Missing Circuit Breaker and Cascading Failure Protection", "Unbounded HTTP and Socket Timeout on External Services"),
        ("Unindexed Large Table Scans during Batch Settlement", "Database Connection Pool Exhaustion under Unbounded Waiting"),
        ("Missing Distributed Idempotency Key in Transaction API", "Missing Distributed Lock for Stock State Check"),
    ]
    for s_desc, t_desc in edges_data:
        s_node = cause_objs[s_desc]
        t_node = cause_objs[t_desc]
        db.add(CausalEdge(
            project_id=proj.id,
            source_cause_id=s_node.id,
            target_cause_id=t_node.id,
            relation_type="caused_by",
            frequency=3
        ))
    db.flush()

    # 9. Realistic Incidents (History spanning 60 days)
    now = utc_now()
    incidents_data = [
        {
            "num": "INC-101",
            "title": "Stripe Webhook Gateway Timeout during Cyber Monday Spike",
            "desc": "Inbound Stripe webhook callbacks timed out resulting in dropped settlement receipts and unconfirmed customer orders.",
            "sev": "CRITICAL",
            "stat": "RESOLVED",
            "mod": "payments",
            "comp": "Webhook Listener",
            "effort": 14.0,
            "rep_delta": 45,
            "res_delta": 44,
            "causes": [
                (1, "Inbound requests backed up waiting for database client"),
                (2, "Database Connection Pool Exhaustion under Unbounded Waiting"),
                (3, "Unbounded HTTP and Socket Timeout on External Services"),
                (4, "Synchronous Blocking Calls inside Async Event Loop")
            ]
        },
        {
            "num": "INC-102",
            "title": "Database Connection Pool Starvation during Batch Settlement",
            "desc": "Nightly reconciliation job consumed all available pool connections, starving live payment processing requests for 48 minutes.",
            "sev": "CRITICAL",
            "stat": "RESOLVED",
            "mod": "database",
            "comp": "Connection Manager",
            "effort": 18.0,
            "rep_delta": 38,
            "res_delta": 37,
            "causes": [
                (1, "Batch queries locked connections for >300 seconds"),
                (2, "Unindexed Large Table Scans during Batch Settlement"),
                (3, "Database Connection Pool Exhaustion under Unbounded Waiting")
            ]
        },
        {
            "num": "INC-103",
            "title": "Duplicate Charges on Mobile App Network Disconnect",
            "desc": "Users on flaky 4G connections received duplicate charges when double-clicking submit upon transient socket drop.",
            "sev": "HIGH",
            "stat": "RESOLVED",
            "mod": "orders",
            "comp": "Checkout Controller",
            "effort": 10.0,
            "rep_delta": 30,
            "res_delta": 29,
            "causes": [
                (1, "Retried payment request processed twice by server"),
                (2, "Missing Distributed Idempotency Key in Transaction API")
            ]
        },
        {
            "num": "INC-104",
            "title": "Third-Party Tax API Latency Cascading to Checkout Block",
            "desc": "Avalara Tax API degraded to 12s response times, causing entire checkout pipeline to stall without graceful fallback.",
            "sev": "HIGH",
            "stat": "RESOLVED",
            "mod": "checkout",
            "comp": "Tax Calculation Client",
            "effort": 8.0,
            "rep_delta": 22,
            "res_delta": 21,
            "causes": [
                (1, "Tax calculation endpoint was blocking thread worker"),
                (2, "Missing Circuit Breaker and Cascading Failure Protection"),
                (3, "Unbounded HTTP and Socket Timeout on External Services")
            ]
        },
        {
            "num": "INC-105",
            "title": "Payment Gateway Timeout Surge under High Concurrency",
            "desc": "Active incident: Payment webhook requests timing out under sustained 500 RPS traffic surge. Similar pattern to INC-101.",
            "sev": "CRITICAL",
            "stat": "OPEN",
            "mod": "payments",
            "comp": "Webhook Listener",
            "effort": 12.0,
            "rep_delta": 2,
            "res_delta": None,
            "causes": [
                (1, "Database Connection Pool Exhaustion under Unbounded Waiting")
            ]
        },
        {
            "num": "INC-106",
            "title": "Notification Webhook Worker Thread Starvation",
            "desc": "Customer email and SMS webhook worker threads exhausted due to synchronous blocking external REST calls.",
            "sev": "MEDIUM",
            "stat": "RESOLVED",
            "mod": "notification",
            "comp": "Event Dispatcher",
            "effort": 6.0,
            "rep_delta": 15,
            "res_delta": 14,
            "causes": [
                (1, "Synchronous Blocking Calls inside Async Event Loop")
            ]
        },
        {
            "num": "INC-107",
            "title": "Auth Service Memory Out-of-Bounds on Revocation Peak",
            "desc": "During mass token revocation event, in-memory blacklist consumed 98% of JVM container memory resulting in OOM kills.",
            "sev": "HIGH",
            "stat": "RESOLVED",
            "mod": "auth",
            "comp": "JWT Middleware",
            "effort": 7.0,
            "rep_delta": 12,
            "res_delta": 11,
            "causes": [
                (1, "In-Memory State Leak in Multi-Instance Scaled Services")
            ]
        },
        {
            "num": "INC-108",
            "title": "Flash Sale Oversell Incident due to Race Condition",
            "desc": "Two customers successfully purchased the final inventory unit simultaneously due to uncoordinated stock checks.",
            "sev": "HIGH",
            "stat": "RESOLVED",
            "mod": "inventory",
            "comp": "Stock Reservation",
            "effort": 9.0,
            "rep_delta": 8,
            "res_delta": 7,
            "causes": [
                (1, "Missing Distributed Lock for Stock State Check"),
                (2, "Missing Distributed Idempotency Key in Transaction API")
            ]
        },
        {
            "num": "INC-109",
            "title": "Settlement Reconciliation Latency Degraded to 4 Hours",
            "desc": "Database query plan regression causing sequential table scan across 12M audit rows during reconciliation run.",
            "sev": "MEDIUM",
            "stat": "INVESTIGATING",
            "mod": "settlement",
            "comp": "Batch Engine",
            "effort": 6.0,
            "rep_delta": 1,
            "res_delta": None,
            "causes": [
                (1, "Unindexed Large Table Scans during Batch Settlement")
            ]
        }
    ]

    incident_objs = []
    for inc_data in incidents_data:
        rep_time = now - timedelta(days=inc_data["rep_delta"])
        res_time = (now - timedelta(days=inc_data["res_delta"])) if inc_data["res_delta"] is not None else None
        
        inc = Incident(
            project_id=proj.id,
            incident_number=inc_data["num"],
            title=inc_data["title"],
            description=inc_data["desc"],
            severity=inc_data["sev"],
            status=inc_data["stat"],
            affected_module=inc_data["mod"],
            affected_component=inc_data["comp"],
            reported_by="SRE Observability Bot",
            resolution_effort_hours=inc_data["effort"],
            reported_at=rep_time,
            resolved_at=res_time
        )
        db.add(inc)
        db.flush()
        incident_objs.append((inc, inc_data["causes"]))

        # Link 5 Whys causes
        for step, c_desc in inc_data["causes"]:
            if c_desc in cause_objs:
                c_node = cause_objs[c_desc]
                db.add(IncidentCausalLink(
                    incident_id=inc.id,
                    cause_node_id=c_node.id,
                    step_number=step
                ))
    db.flush()

    # 10. Technical Debt Items
    debt_data = [
        {
            "key": "DEBT-101",
            "title": "Refactor Database Connection Pool to HikariCP with Dynamic Backpressure",
            "desc": "Replace current naive thread pool with asynchronous connection pool featuring adaptive capacity, fast-fail timeout, and circuit breaker.",
            "cat": DebtCategory.ARCHITECTURAL.value,
            "mod": "database",
            "file": "database/connection_pool.py",
            "principal": 16.0,  # P(d) = 16 hours
            "status": DebtStatus.PRIORITIZED.value,
            "root_cause": "Database Connection Pool Exhaustion under Unbounded Waiting",
            "linked_incidents": ["INC-101", "INC-102", "INC-105"]
        },
        {
            "key": "DEBT-102",
            "title": "Implement Distributed Idempotency Interceptor via Redis Redlock",
            "desc": "Enforce mandatory Client-Request-Id header with Redis-backed distributed lock and 24-hour response caching on all mutable payment APIs.",
            "cat": DebtCategory.ARCHITECTURAL.value,
            "mod": "payments",
            "file": "payments/gateway_client.py",
            "principal": 12.0,  # P(d) = 12 hours
            "status": DebtStatus.PRIORITIZED.value,
            "root_cause": "Missing Distributed Idempotency Key in Transaction API",
            "linked_incidents": ["INC-103", "INC-108"]
        },
        {
            "key": "DEBT-103",
            "title": "Add Resilience4j Circuit Breakers to Third-Party Tax & Gateway Clients",
            "desc": "Wrap all external HTTP client calls with configurable circuit breakers, exponential backoff with jitter, and static fallback stubs.",
            "cat": DebtCategory.INFRASTRUCTURE.value,
            "mod": "checkout",
            "file": "checkout/checkout_flow.py",
            "principal": 8.0,  # P(d) = 8 hours
            "status": DebtStatus.IDENTIFIED.value,
            "root_cause": "Missing Circuit Breaker and Cascading Failure Protection",
            "linked_incidents": ["INC-104"]
        },
        {
            "key": "DEBT-104",
            "title": "Add Composite Partitioning and Indexes to Transaction Audit Log",
            "desc": "Add compound index on (tenant_id, settlement_date, status) and partition postgres table by month to eliminate 4-hour sequential scans.",
            "cat": DebtCategory.CODE_SMELL.value,
            "mod": "settlement",
            "file": "settlement/reconciliation_engine.py",
            "principal": 6.0,  # P(d) = 6 hours
            "status": DebtStatus.PRIORITIZED.value,
            "root_cause": "Unindexed Large Table Scans during Batch Settlement",
            "linked_incidents": ["INC-102", "INC-109"]
        },
        {
            "key": "DEBT-105",
            "title": "Refactor Notification Dispatcher to Asynchronous SQS/Kafka Pipeline",
            "desc": "Eliminate synchronous HTTP calls from notification worker threads by introducing persistent broker queues with retry dead-letter topics.",
            "cat": DebtCategory.ARCHITECTURAL.value,
            "mod": "notification",
            "file": "notification/webhook_dispatcher.py",
            "principal": 18.0,
            "status": DebtStatus.IDENTIFIED.value,
            "root_cause": "Synchronous Blocking Calls inside Async Event Loop",
            "linked_incidents": ["INC-106"]
        },
        {
            "key": "DEBT-106",
            "title": "Migrate In-Memory JWT Revocation List to Scaled Redis Bloom Filter",
            "desc": "Replace memory-hogging dictionary with distributed Redis Bloom Filter and 2-hour sliding window TTL to prevent container OOM.",
            "cat": DebtCategory.SECURITY_DEBT.value,
            "mod": "auth",
            "file": "auth/jwt_token_validator.py",
            "principal": 10.0,
            "status": DebtStatus.IDENTIFIED.value,
            "root_cause": "In-Memory State Leak in Multi-Instance Scaled Services",
            "linked_incidents": ["INC-107"]
        },
        {
            "key": "DEBT-107",
            "title": "Deploy Horizontal Read Replicas and Query Routing (Requires DEBT-101)",
            "desc": "Route reporting and settlement queries to dedicated PostgreSQL read replica; depends on connection pool support from DEBT-101.",
            "cat": DebtCategory.INFRASTRUCTURE.value,
            "mod": "database",
            "file": "database/connection_pool.py",
            "principal": 20.0,
            "status": DebtStatus.IDENTIFIED.value,
            "root_cause": "Database Connection Pool Exhaustion under Unbounded Waiting",
            "linked_incidents": ["INC-102"]
        }
    ]

    debt_map = {}
    inc_by_num = {inc[0].incident_number: inc[0] for inc in incident_objs}

    for d_data in debt_data:
        c_node = cause_objs.get(d_data["root_cause"])
        d_item = DebtItem(
            project_id=proj.id,
            debt_key=d_data["key"],
            title=d_data["title"],
            description=d_data["desc"],
            category=d_data["cat"],
            module_name=d_data["mod"],
            file_path=d_data["file"],
            effort_principal=d_data["principal"],
            accrued_interest=0.0,  # calculated next
            break_even_status=False,
            risk_score=0.0,
            status=d_data["status"],
            assignee="Sushma Patil",
            root_cause_id=c_node.id if c_node else None
        )
        db.add(d_item)
        db.flush()
        debt_map[d_data["key"]] = d_item

        # Link incidents
        for inc_num in d_data["linked_incidents"]:
            if inc_num in inc_by_num:
                db.add(DebtIncidentLink(
                    debt_id=d_item.id,
                    incident_id=inc_by_num[inc_num].id
                ))

    # Add Prerequisite: DEBT-107 requires DEBT-101 first!
    db.add(DebtPrerequisite(
        debt_id=debt_map["DEBT-107"].id,
        prerequisite_debt_id=debt_map["DEBT-101"].id
    ))
    db.flush()

    # Recompute Centrality & Economics
    recompute_centrality_metrics(db, proj.id)
    update_debt_economics(db, proj.id)

    print("Database successfully seeded with realistic corpus!")

