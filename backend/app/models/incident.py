from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base
from app.utils import utc_now

class IncidentSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    incident_number = Column(String(30), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(20), default=IncidentSeverity.MEDIUM.value, nullable=False)
    status = Column(String(20), default=IncidentStatus.OPEN.value, nullable=False)
    affected_module = Column(String(100), nullable=False, index=True)
    affected_component = Column(String(100), nullable=True)
    reported_by = Column(String(100), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolution_effort_hours = Column(Float, default=4.0)
    reported_at = Column(DateTime, default=utc_now, index=True)
    resolved_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="incidents")
    causal_links = relationship("IncidentCausalLink", back_populates="incident", cascade="all, delete-orphan")
    debt_links = relationship("DebtIncidentLink", back_populates="incident", cascade="all, delete-orphan")

