import os
os.environ["DISABLE_SQLALCHEMY_CEXT"] = "1"

import pytest
from app.database import Base, engine, SessionLocal
from app.seed_data import seed_database
from app.models.incident import Incident
from app.models.debt import DebtItem, DebtPrerequisite
from app.services.causal_graph import get_causal_graph_data
from app.services.similarity_engine import similarity_engine
from app.services.knapsack_optimiser import solve_knapsack_remediation, run_what_if_simulation
from app.services.debt_economics import update_debt_economics
from app.services.repo_analyzer import calculate_python_complexity, scan_file_for_satd
from app.services.pdf_service import generate_pdf_report

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    yield db
    db.close()

def test_database_seeding(db_session):
    incidents = db_session.query(Incident).all()
    debts = db_session.query(DebtItem).all()
    assert len(incidents) >= 8
    assert len(debts) >= 6

def test_hybrid_similarity_engine(db_session):
    incidents = db_session.query(Incident).all()
    similar = similarity_engine.find_similar_incidents(incidents[0], incidents[1:], threshold=0.1)
    assert isinstance(similar, list)

def test_regression_detection(db_session):
    incidents = db_session.query(Incident).all()
    regressions = similarity_engine.detect_regressions(incidents, tau=0.3)
    assert isinstance(regressions, list)

def test_causal_graph_centrality(db_session):
    graph = get_causal_graph_data(db_session, project_id=1)
    assert "nodes" in graph
    assert "edges" in graph
    assert len(graph["systemic_causes"]) > 0
    top_cause = graph["systemic_causes"][0]
    assert top_cause["betweenness_centrality"] >= 0.0

def test_knapsack_remediation_optimizer(db_session):
    plan = solve_knapsack_remediation(db_session, project_id=1, sprint_budget_hours=40.0)
    assert plan["total_effort_allocated"] <= 40.0
    assert len(plan["selected_items"]) > 0
    assert plan["total_risk_reduced"] > 0

def test_what_if_simulation(db_session):
    scenarios = run_what_if_simulation(db_session, project_id=1, budgets=[20.0, 40.0, 60.0])
    assert len(scenarios) == 3
    assert scenarios[2]["risk_reduction"] >= scenarios[0]["risk_reduction"]

def test_repo_analyzer_complexity():
    code = """
def process(items):
    total = 0
    for it in items:
        if it > 0 and it % 2 == 0:
            total += it
        elif it < 0:
            total -= 1
    return total
"""
    cc = calculate_python_complexity(code)
    assert cc >= 4

def test_repo_analyzer_satd():
    code = """
# TODO: migrate this to async queue
def send_email():
    # FIXME: handle socket timeout
    pass
"""
    satd = scan_file_for_satd("test.py", code, "notification")
    assert len(satd) == 2
    assert satd[0]["marker_type"] == "TODO"
    assert satd[1]["marker_type"] == "FIXME"

def test_pdf_report_generation(db_session):
    pdf = generate_pdf_report(db_session, project_id=1)
    assert len(pdf) > 1000
    assert pdf.startswith(b"%PDF")

def test_transitive_prerequisite_closure(db_session):
    debts = db_session.query(DebtItem).filter(DebtItem.project_id == 1).order_by(DebtItem.id.asc()).all()
    if len(debts) >= 3:
        d1, d2, d3 = debts[0].id, debts[1].id, debts[2].id
        db_session.query(DebtPrerequisite).filter(DebtPrerequisite.debt_id.in_([d2, d3])).delete()
        db_session.add(DebtPrerequisite(debt_id=d2, prerequisite_debt_id=d1))
        db_session.add(DebtPrerequisite(debt_id=d3, prerequisite_debt_id=d2))
        db_session.commit()

        plan = solve_knapsack_remediation(db_session, project_id=1, sprint_budget_hours=120.0, force_include_debt_ids=[d3])
        selected_ids = {it["id"] for it in plan["selected_items"]}
        assert d3 in selected_ids
        assert d2 in selected_ids
        assert d1 in selected_ids

def test_analyze_code_snippet():
    from app.services.repo_analyzer import analyze_code_snippet
    snippet = """
def payment_handler(order, user):
    # TODO: optimize query latency
    if not order or not user:
        return False
    for item in order.items:
        if item.price > 100:
            # FIXME: apply promo discount
            apply_discount(item)
    return True
"""
    result = analyze_code_snippet(snippet, "python")
    assert result["cyclomatic_complexity"] >= 3
    assert result["branch_breakdown"]["total_lines"] > 0
    assert len(result["satd_markers"]) == 2
    assert result["satd_markers"][0]["marker_type"] in ["TODO", "FIXME"]

def test_pairwise_similarity_matrix():
    t1 = "Payment gateway socket timeout on checkout processing"
    t2 = "Checkout API connection timeout with payment processor"
    t3 = "User avatar upload S3 bucket permissions error"
    hyb, lex, sem = similarity_engine.compute_hybrid_matrix([t1, t2, t3])
    assert hyb[0, 1] > hyb[0, 2]
    assert lex[0, 1] > lex[0, 2]

def test_csv_export_endpoints(db_session):
    from app.routers.debt import export_debt_csv
    from app.routers.incidents import export_incidents_csv

    debt_resp = export_debt_csv(project_id=1, db=db_session)
    assert debt_resp.status_code == 200
    assert "text/csv" in debt_resp.media_type
    assert b"Debt Key,Title,Category" in debt_resp.body

    inc_resp = export_incidents_csv(project_id=1, db=db_session)
    assert inc_resp.status_code == 200
    assert "text/csv" in inc_resp.media_type
    assert b"Incident ID,Title,Severity" in inc_resp.body
