from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.utils import utc_now

class CauseNode(Base):
    __tablename__ = "cause_nodes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    description = Column(String(255), nullable=False)
    normalized_text = Column(String(255), index=True, nullable=False)
    category = Column(String(50), default="GENERAL")
    degree_centrality = Column(Float, default=0.0)
    betweenness_centrality = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utc_now)

    project = relationship("Project", back_populates="cause_nodes")
    incident_links = relationship("IncidentCausalLink", back_populates="cause_node", cascade="all, delete-orphan")
    outgoing_edges = relationship("CausalEdge", foreign_keys="CausalEdge.source_cause_id", back_populates="source_node", cascade="all, delete-orphan")
    incoming_edges = relationship("CausalEdge", foreign_keys="CausalEdge.target_cause_id", back_populates="target_node", cascade="all, delete-orphan")

class CausalEdge(Base):
    __tablename__ = "causal_edges"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    source_cause_id = Column(Integer, ForeignKey("cause_nodes.id"), nullable=False)
    target_cause_id = Column(Integer, ForeignKey("cause_nodes.id"), nullable=False)
    relation_type = Column(String(50), default="caused_by")  # e.g., caused_by, enabled_by
    frequency = Column(Integer, default=1)

    source_node = relationship("CauseNode", foreign_keys=[source_cause_id], back_populates="outgoing_edges")
    target_node = relationship("CauseNode", foreign_keys=[target_cause_id], back_populates="incoming_edges")

class IncidentCausalLink(Base):
    __tablename__ = "incident_causal_links"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    cause_node_id = Column(Integer, ForeignKey("cause_nodes.id"), nullable=False)
    step_number = Column(Integer, default=1)  # 1 through 5 for 5 Whys
    notes = Column(Text, nullable=True)

    incident = relationship("Incident", back_populates="causal_links")
    cause_node = relationship("CauseNode", back_populates="incident_links")

