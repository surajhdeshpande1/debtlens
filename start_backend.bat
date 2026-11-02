@echo off
title DebtLens Backend Service
cd /d "%~dp0backend"
set DISABLE_SQLALCHEMY_CEXT=1
echo ========================================================
echo Starting DebtLens FastAPI Backend on http://localhost:8000...
echo API Swagger Docs: http://localhost:8000/docs
echo ========================================================
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause


