import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "DebtLens: Incident-Driven Technical Debt Intelligence"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "debtlens_super_secret_jwt_key_2026_ise_miniproject")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # SQLite by default for zero-friction setup, PostgreSQL supported via env var
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./debtlens.db")
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Economic model hyperparameters
    LAMBDA_CHURN: float = 0.15
    LAMBDA_BLAST_RADIUS: float = 1.8
    SIMILARITY_ALPHA: float = 0.55  # weight for lexical (TF-IDF) vs semantic
    REGRESSION_THRESHOLD: float = 0.65

settings = Settings()

