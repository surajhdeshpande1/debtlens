from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, Base, engine
from app.seed_data import seed_database

router = APIRouter(prefix="/seed", tags=["Data Seeding"])

@router.post("/reload")
def reload_seed_data(db: Session = Depends(get_db)):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_database(db)
    return {"message": "Database refreshed and seeded with realistic enterprise corpus successfully."}

