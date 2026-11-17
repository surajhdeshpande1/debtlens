@echo off
REM Start DebtLens without MySQL (SQLite file in your user profile) — the quickest fallback.
cd /d "%~dp0\..\.."
call .venv\Scripts\activate.bat
start "" http://localhost:8000
python -m debtlens serve --host 127.0.0.1 --port 8000
