import re
import networkx as nx
from sqlalchemy.orm import Session
from app.models.causal import CauseNode, CausalEdge, IncidentCausalLink

def normalize_cause_string(text: str) -> str:
    """Normalize cause text for deduplication and convergence."""
    t = text.lower().strip()
    t = re.sub(r'[^\w\s]', '', t)
    t = re.sub(r'\s+', ' ', t)
    return t

def find_or_create_cause_node(db: Session, project_id: int, description: str, category: str = "GENERAL") -> CauseNode:
    norm = normalize_cause_string(description)
    # Check if a cause with this normalized text already exists
    node = db.query(CauseNode).filter(
        CauseNode.project_id == project_id,
        CauseNode.normalized_text == norm
    ).first()
    
    if not node:
        # Check partial token match (over 80% word overlap) to converge semantically equivalent causes
        words = set(norm.split())
        all_nodes = db.query(CauseNode).filter(CauseNode.project_id == project_id).all()
        for existing in all_nodes:
            exist_words = set(existing.normalized_text.split())
            if words and exist_words:
                overlap = len(words & exist_words) / float(max(len(words), len(exist_words)))
                if overlap >= 0.80:
                    node = existing
                    break

    if not node:
        node = CauseNode(
            project_id=project_id,
            description=description.strip(),
            normalized_text=norm,
            category=category
        )
        db.add(node)
        db.commit()
        db.refresh(node)

    return node

def add_causal_edge(db: Session, project_id: int, source_id: int, target_id: int, relation: str = "caused_by") -> CausalEdge:
    if source_id == target_id:
        return None
    edge = db.query(CausalEdge).filter(
        CausalEdge.project_id == project_id,
        CausalEdge.source_cause_id == source_id,
        CausalEdge.target_cause_id == target_id
    ).first()
    
    if edge:
        edge.frequency += 1
    else:
        edge = CausalEdge(
            project_id=project_id,
            source_cause_id=source_id,
            target_cause_id=target_id,
            relation_type=relation,
            frequency=1
        )
        db.add(edge)
    db.commit()
    return edge

def recompute_centrality_metrics(db: Session, project_id: int):
    """
    Constructs a NetworkX DiGraph from CauseNode and CausalEdge,
    computes Degree Centrality and Betweenness Centrality,
    and updates the database nodes.
    """
    nodes = db.query(CauseNode).filter(CauseNode.project_id == project_id).all()
    edges = db.query(CausalEdge).filter(CausalEdge.project_id == project_id).all()

    G = nx.DiGraph()
    for n in nodes:
        G.add_node(n.id)
    for e in edges:
        G.add_edge(e.source_cause_id, e.target_cause_id, weight=e.frequency)

    if len(G) == 0:
        return

    # Total degree centrality (in + out)
    deg_centrality = nx.degree_centrality(G)
    
    # Betweenness centrality measures how often a node falls on shortest paths
    try:
        between_centrality = nx.betweenness_centrality(G, weight="weight")
    except Exception:
        between_centrality = {n: 0.0 for n in G.nodes()}

    for n in nodes:
        n.degree_centrality = round(deg_centrality.get(n.id, 0.0), 4)
        n.betweenness_centrality = round(between_centrality.get(n.id, 0.0), 4)
    db.commit()

def get_causal_graph_data(db: Session, project_id: int) -> dict:
    recompute_centrality_metrics(db, project_id)
    nodes = db.query(CauseNode).filter(CauseNode.project_id == project_id).all()
    edges = db.query(CausalEdge).filter(CausalEdge.project_id == project_id).all()

    cyto_nodes = []
    for n in nodes:
        inc_count = db.query(IncidentCausalLink).filter(IncidentCausalLink.cause_node_id == n.id).count()
        cyto_nodes.append({
            "data": {
                "id": f"cause_{n.id}",
                "node_id": n.id,
                "label": n.description,
                "category": n.category,
                "degree_centrality": n.degree_centrality,
                "betweenness_centrality": n.betweenness_centrality,
                "incident_count": inc_count
            }
        })

    cyto_edges = []
    for e in edges:
        cyto_edges.append({
            "data": {
                "id": f"edge_{e.id}",
                "source": f"cause_{e.source_cause_id}",
                "target": f"cause_{e.target_cause_id}",
                "relation": e.relation_type,
                "weight": e.frequency
            }
        })

    # Sort systemic causes by highest composite centrality (betweenness + degree)
    systemic_nodes = sorted(
        nodes,
        key=lambda x: (x.betweenness_centrality * 1.5 + x.degree_centrality),
        reverse=True
    )

    return {
        "nodes": cyto_nodes,
        "edges": cyto_edges,
        "systemic_causes": [
            {
                "id": n.id,
                "project_id": n.project_id,
                "description": n.description,
                "normalized_text": n.normalized_text,
                "category": n.category,
                "degree_centrality": n.degree_centrality,
                "betweenness_centrality": n.betweenness_centrality,
                "created_at": n.created_at,
                "incident_count": db.query(IncidentCausalLink).filter(IncidentCausalLink.cause_node_id == n.id).count()
            }
            for n in systemic_nodes[:6]
        ]
    }

