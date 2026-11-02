from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base
from app.utils import utc_now

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TECH_LEAD = "tech_lead"
    DEVELOPER = "developer"
    VIEWER = "viewer"

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False)
    slug = Column(String(120), unique=True, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    projects = relationship("Project", back_populates="organization", cascade="all, delete-orphan")
    users = relationship("User", back_populates="organization")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=False)
    role = Column(String(50), default=UserRole.DEVELOPER.value)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="users")
    project_memberships = relationship("ProjectMember", back_populates="user")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(120), nullable=False)
    key = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    repo_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="project", cascade="all, delete-orphan")
    debt_items = relationship("DebtItem", back_populates="project", cascade="all, delete-orphan")
    cause_nodes = relationship("CauseNode", back_populates="project", cascade="all, delete-orphan")
    hotspots = relationship("FileHotspot", back_populates="project", cascade="all, delete-orphan")

class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(50), default=UserRole.DEVELOPER.value)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")

