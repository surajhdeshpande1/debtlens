"""MySQL schema (SQLAlchemy 2).  The eight tables shown at Demo 1 keep their names —
user, project, module, assignment, technical_debt, incident, root_cause, resolution —
and are extended with the tables the analytics need.

Works unchanged on MySQL 8 (local), TiDB Cloud Starter (Vercel) and SQLite (tests).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (JSON, Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text,
                        UniqueConstraint, Index)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


class Base(DeclarativeBase):
    pass


ROLES = ("admin", "tech_lead", "developer", "qa", "manager", "viewer")
SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW")
INCIDENT_STATUSES = ("OPEN", "INVESTIGATING", "RESOLVED")
DEBT_STATUSES = ("IDENTIFIED", "PRIORITIZED", "IN_PROGRESS", "DEFERRED", "REMEDIATED")
DEBT_CATEGORIES = ("ARCHITECTURAL", "CODE_SMELL", "TEST_DEBT", "INFRASTRUCTURE", "SECURITY_DEBT", "DOCUMENTATION")
PRIORITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW")


class Organization(Base):
    __tablename__ = "organization"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    is_sandbox: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class User(Base):
    """Demo 1: USER(user_id, name, email, password, role)."""
    __tablename__ = "user"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(190), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="developer")
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    can_login: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Project(Base):
    """Demo 1: PROJECT(project_id, project_name, repository_url, created_at)."""
    __tablename__ = "project"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    project_name: Mapped[str] = mapped_column(String(160))
    project_key: Mapped[str] = mapped_column(String(12))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    repository_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(60), nullable=True)
    scenario_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_sandbox: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    sandbox_key: Mapped[str | None] = mapped_column(String(40), nullable=True, unique=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    next_incident_no: Mapped[int] = mapped_column(Integer, default=101)
    next_debt_no: Mapped[int] = mapped_column(Integer, default=101)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ProjectMember(Base):
    __tablename__ = "project_member"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20), default="developer")


class Module(Base):
    """Demo 1: MODULE(module_id, project_id, module_name, path)."""
    __tablename__ = "module"
    __table_args__ = (UniqueConstraint("project_id", "module_name"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    module_name: Mapped[str] = mapped_column(String(100))
    path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(400), nullable=True)
    churn: Mapped[float] = mapped_column(Float, default=0)
    complexity: Mapped[float] = mapped_column(Float, default=0)
    loc: Mapped[int] = mapped_column(Integer, default=0)
    files: Mapped[int] = mapped_column(Integer, default=0)


class ModuleDependency(Base):
    __tablename__ = "module_dependency"
    __table_args__ = (UniqueConstraint("source_module_id", "target_module_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    source_module_id: Mapped[int] = mapped_column(ForeignKey("module.id", ondelete="CASCADE"))
    target_module_id: Mapped[int] = mapped_column(ForeignKey("module.id", ondelete="CASCADE"))
    weight: Mapped[int] = mapped_column(Integer, default=1)


class Assignment(Base):
    """Demo 1: ASSIGNMENT(assignment_id, project_id, module_id, user_id, assigned_at) — module ownership."""
    __tablename__ = "assignment"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("module.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Incident(Base):
    """Demo 1: INCIDENT(incident_id, module_id, reported_by, description, severity, status, created_at)."""
    __tablename__ = "incident"
    __table_args__ = (UniqueConstraint("project_id", "incident_key"), Index("ix_incident_project_status", "project_id", "status"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    module_id: Mapped[int | None] = mapped_column(ForeignKey("module.id", ondelete="SET NULL"), nullable=True)
    incident_key: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    status: Mapped[str] = mapped_column(String(15), default="OPEN")
    reported_by: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    reporter_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reported_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    effort_hours: Mapped[float] = mapped_column(Float, default=4.0)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    external_ref: Mapped[str | None] = mapped_column(String(300), nullable=True)
    occurrences: Mapped[int] = mapped_column(Integer, default=1)
    group_label: Mapped[str | None] = mapped_column(String(30), nullable=True)
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class CauseNode(Base):
    """A reusable root-cause node; 5-Whys answers that mean the same thing converge here."""
    __tablename__ = "cause_node"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(300))
    normalized_label: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(20), default="MECHANISM")
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CauseEdge(Base):
    __tablename__ = "cause_edge"
    __table_args__ = (UniqueConstraint("source_node_id", "target_node_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    source_node_id: Mapped[int] = mapped_column(ForeignKey("cause_node.id", ondelete="CASCADE"))
    target_node_id: Mapped[int] = mapped_column(ForeignKey("cause_node.id", ondelete="CASCADE"))
    relation: Mapped[str] = mapped_column(String(20), default="caused_by")
    weight: Mapped[int] = mapped_column(Integer, default=1)


class RootCause(Base):
    """Demo 1: ROOT_CAUSE(cause_id, incident_id, why_level, explanation) + link to the reusable node."""
    __tablename__ = "root_cause"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incident.id", ondelete="CASCADE"), index=True)
    why_level: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[str] = mapped_column(String(400))
    cause_node_id: Mapped[int | None] = mapped_column(ForeignKey("cause_node.id", ondelete="SET NULL"), nullable=True, index=True)


class Resolution(Base):
    """Demo 1: RESOLUTION(resolution_id, incident_id, fixed_by, action_taken, resolved_at) + lessons learned."""
    __tablename__ = "resolution"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incident.id", ondelete="CASCADE"), unique=True)
    fixed_by: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    fixed_by_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    action_taken: Mapped[str] = mapped_column(Text, default="")
    lessons_learned: Mapped[str] = mapped_column(Text, default="")
    resolved_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    effort_hours: Mapped[float | None] = mapped_column(Float, nullable=True)


class TechnicalDebt(Base):
    """Demo 1: TECHNICAL_DEBT(debt_id, module_id, title, priority, status, assigned_to, created_at)
    + principal (estimated remediation hours) and links used by the ledger."""
    __tablename__ = "technical_debt"
    __table_args__ = (UniqueConstraint("project_id", "debt_key"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    module_id: Mapped[int | None] = mapped_column(ForeignKey("module.id", ondelete="SET NULL"), nullable=True)
    debt_key: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(20), default="CODE_SMELL")
    priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    status: Mapped[str] = mapped_column(String(15), default="IDENTIFIED")
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    assignee_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    root_cause_node_id: Mapped[int | None] = mapped_column(ForeignKey("cause_node.id", ondelete="SET NULL"), nullable=True)
    principal_hours: Mapped[float] = mapped_column(Float, default=8.0)
    file_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class DebtIncident(Base):
    __tablename__ = "debt_incident"
    __table_args__ = (UniqueConstraint("debt_id", "incident_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debt_id: Mapped[int] = mapped_column(ForeignKey("technical_debt.id", ondelete="CASCADE"), index=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incident.id", ondelete="CASCADE"), index=True)


class DebtDependency(Base):
    __tablename__ = "debt_dependency"
    __table_args__ = (UniqueConstraint("debt_id", "prerequisite_debt_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debt_id: Mapped[int] = mapped_column(ForeignKey("technical_debt.id", ondelete="CASCADE"), index=True)
    prerequisite_debt_id: Mapped[int] = mapped_column(ForeignKey("technical_debt.id", ondelete="CASCADE"))


class DebtPlaybook(Base):
    """The fix playbook chosen for a debt item (None = matched automatically) and the steps already done."""
    __tablename__ = "debt_playbook"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debt_id: Mapped[int] = mapped_column(ForeignKey("technical_debt.id", ondelete="CASCADE"), unique=True)
    playbook_key: Mapped[str | None] = mapped_column(String(40), nullable=True)
    steps_done: Mapped[list | None] = mapped_column(JSON, nullable=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class FileMetric(Base):
    __tablename__ = "file_metric"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    module_id: Mapped[int | None] = mapped_column(ForeignKey("module.id", ondelete="SET NULL"), nullable=True)
    file_path: Mapped[str] = mapped_column(String(255))
    language: Mapped[str | None] = mapped_column(String(15), nullable=True)
    churn: Mapped[int] = mapped_column(Integer, default=0)
    lines_changed: Mapped[int] = mapped_column(Integer, default=0)
    complexity: Mapped[float] = mapped_column(Float, default=0)
    max_function_complexity: Mapped[float | None] = mapped_column(Float, nullable=True)
    loc: Mapped[int] = mapped_column(Integer, default=0)
    authors: Mapped[int] = mapped_column(Integer, default=0)
    hotspot_score: Mapped[float] = mapped_column(Float, default=0)
    last_modified: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class SatdMarker(Base):
    __tablename__ = "satd_marker"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    module_id: Mapped[int | None] = mapped_column(ForeignKey("module.id", ondelete="SET NULL"), nullable=True)
    file_path: Mapped[str] = mapped_column(String(255))
    line_no: Mapped[int] = mapped_column(Integer)
    marker: Mapped[str] = mapped_column(String(15))
    text: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(15), default="DETECTED")
    debt_id: Mapped[int | None] = mapped_column(ForeignKey("technical_debt.id", ondelete="SET NULL"), nullable=True)


class RepoScan(Base):
    __tablename__ = "repo_scan"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(15))
    repository: Mapped[str | None] = mapped_column(String(300), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(120), nullable=True)
    commits_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    files_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    window_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warnings: Mapped[list | None] = mapped_column(JSON, nullable=True)
    scanned_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RemediationPlan(Base):
    __tablename__ = "remediation_plan"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    budget_hours: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String(20))
    selected_keys: Mapped[list] = mapped_column(JSON)
    total_value: Mapped[float] = mapped_column(Float)
    total_hours: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(12), default="APPROVED")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SimulationRun(Base):
    __tablename__ = "simulation_run"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(15))
    params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    run_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ApiToken(Base):
    __tablename__ = "api_token"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    prefix: Mapped[str] = mapped_column(String(16))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), nullable=True, index=True)
    actor: Mapped[str] = mapped_column(String(160))
    role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    action: Mapped[str] = mapped_column(String(60))
    entity: Mapped[str | None] = mapped_column(String(60), nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class EmbeddingCache(Base):
    """MiniLM vectors keyed by sha256(text), reused across sandboxes and projects."""
    __tablename__ = "embedding_cache"
    text_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    vector: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
