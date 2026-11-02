from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import Organization, Project, ProjectMember, User
from app.schemas.auth import OrgResponse, OrgCreate, ProjectResponse, ProjectCreate
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/workspace", tags=["Workspace"])

@router.get("/organizations", response_model=List[OrgResponse])
def get_organizations(db: Session = Depends(get_db)):
    return db.query(Organization).all()

@router.get("/projects", response_model=List[ProjectResponse])
def get_projects(org_id: int = None, db: Session = Depends(get_db)):
    query = db.query(Project)
    if org_id:
        query = query.filter(Project.organization_id == org_id)
    return query.all()

@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project_by_id(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.get("/projects/{project_id}/members")
def get_project_members(project_id: int, db: Session = Depends(get_db)):
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    results = []
    for m in members:
        u = db.query(User).filter(User.id == m.user_id).first()
        if u:
            results.append({
                "id": m.id,
                "user_id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role": m.role
            })
    return results

