from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base
from app.utils import utc_now

class DebtCategory(str, enum.Enum):
    ARCHITECTURAL = "ARCHITECTURAL"
    CODE_SMELL = "CODE_SMELL"
    TEST_DEBT = "TEST_DEBT"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    SECURITY_DEBT = "SECURITY_DEBT"
    DOCUMENTATION = "DOCUMENTATION"

class DebtStatus(str, enum.Enum):
    IDENTIFIED = "IDENTIFIED"
    PRIORITIZED = "PRIORITIZED"
    IN_PROGRESS = "IN_PROGRESS"
    REMEDIATED = "REMEDIATED"

class DebtItem(Base):
    __tablename__ = "debt_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    debt_key = Column(String(30), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), default=DebtCategory.CODE_SMELL.value, nullable=False)
    module_name = Column(String(100), nullable=False, index=True)
    file_path = Column(String(255), nullable=True)
    
    # Financial representation
    effort_principal = Column(Float, nullable=False, default=8.0) # P(d)
    accrued_interest = Column(Float, default=0.0)                 # I(d)
    break_even_status = Column(Boolean, default=False)            # I(d) > P(d)
    risk_score = Column(Float, default=0.0)                       # R(d) composite
    
    status = Column(String(30), default=DebtStatus.IDENTIFIED.value, nullable=False)
    assignee = Column(String(100), nullable=True)
    root_cause_id = Column(Integer, ForeignKey("cause_nodes.id"), nullable=True)
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="debt_items")
    root_cause = relationship("CauseNode")
    incident_links = relationship("DebtIncidentLink", back_populates="debt_item", cascade="all, delete-orphan")
    prerequisites = relationship("DebtPrerequisite", foreign_keys="DebtPrerequisite.debt_id", back_populates="debt_item", cascade="all, delete-orphan")
    dependent_on_me = relationship("DebtPrerequisite", foreign_keys="DebtPrerequisite.prerequisite_debt_id", back_populates="prerequisite_debt", cascade="all, delete-orphan")

class DebtPrerequisite(Base):
    __tablename__ = "debt_prerequisites"

    id = Column(Integer, primary_key=True, index=True)
    debt_id = Column(Integer, ForeignKey("debt_items.id"), nullable=False)
    prerequisite_debt_id = Column(Integer, ForeignKey("debt_items.id"), nullable=False)

    debt_item = relationship("DebtItem", foreign_keys=[debt_id], back_populates="prerequisites")
    prerequisite_debt = relationship("DebtItem", foreign_keys=[prerequisite_debt_id], back_populates="dependent_on_me")

class DebtIncidentLink(Base):
    __tablename__ = "debt_incident_links"

    id = Column(Integer, primary_key=True, index=True)
    debt_id = Column(Integer, ForeignKey("debt_items.id"), nullable=False)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    linked_at = Column(DateTime, default=utc_now)

    debt_item = relationship("DebtItem", back_populates="incident_links")
    incident = relationship("Incident", back_populates="debt_links")

