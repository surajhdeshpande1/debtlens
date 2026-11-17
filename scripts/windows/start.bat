@echo off
REM Start the DebtLens website locally on http://localhost:8000 using MySQL 8.
cd /d "%~dp0\..\.."
call .venv\Scripts\activate.bat
if "%DATABASE_URL%"=="" set DATABASE_URL=mysql+pymysql://debtlens:debtlens@localhost:3306/debtlens?charset=utf8mb4
start "" http://localhost:8000
python -m debtlens serve --host 127.0.0.1 --port 8000 --db "%DATABASE_URL%"
