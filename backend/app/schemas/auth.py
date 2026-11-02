from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str
    email: str
    organization_id: Optional[int] = None
    project_id: Optional[int] = None

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "developer"
    organization_id: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    organization_id: Optional[int]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class OrgCreate(BaseModel):
    name: str
    slug: str

class OrgResponse(BaseModel):
    id: int
    name: str
    slug: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ProjectCreate(BaseModel):
    organization_id: int
    name: str
    key: str
    description: Optional[str] = None
    repo_url: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    key: str
    description: Optional[str]
    repo_url: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
