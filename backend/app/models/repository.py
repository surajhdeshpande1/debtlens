from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.utils import utc_now

class RepoMetadata(Base):
    __tablename__ = "repo_metadata"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), unique=True, nullable=False)
    repo_url = Column(String(255), nullable=True)
    repo_path = Column(String(255), nullable=True)
    branch = Column(String(100), default="main")
    total_commits = Column(Integer, default=0)
    total_files = Column(Integer, default=0)
    last_synced_at = Column(DateTime, default=utc_now)

class FileHotspot(Base):
    __tablename__ = "file_hotspots"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    file_path = Column(String(255), nullable=False)
    module_name = Column(String(100), nullable=False, index=True)
    churn_count = Column(Integer, default=0)
    cyclomatic_complexity = Column(Float, default=1.0)
    risk_score = Column(Float, default=0.0)
    last_modified = Column(DateTime, default=utc_now)

    project = relationship("Project", back_populates="hotspots")

class ModuleDependency(Base):
    __tablename__ = "module_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    source_module = Column(String(100), nullable=False, index=True)
    target_module = Column(String(100), nullable=False, index=True)

class SelfAdmittedDebt(Base):
    __tablename__ = "self_admitted_debt"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    file_path = Column(String(255), nullable=False)
    line_number = Column(Integer, nullable=False)
    marker_type = Column(String(20), nullable=False)  # TODO, FIXME, HACK, etc.
    comment_text = Column(Text, nullable=False)
    module_name = Column(String(100), nullable=False)
    status = Column(String(30), default="DETECTED")   # DETECTED, CONVERTED_TO_DEBT, IGNORED
    detected_at = Column(DateTime, default=utc_now)

