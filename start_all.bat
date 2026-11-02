@echo off
title DebtLens Platform Launcher
cd /d "%~dp0"
echo ========================================================
echo Launching DebtLens Backend and Frontend Services...
echo ========================================================

start "DebtLens Backend" start_backend.bat
start "DebtLens Frontend" start_frontend.bat

echo.
echo DebtLens is launching!
echo Backend API: http://localhost:8000 (Docs: http://localhost:8000/docs)
echo Frontend UI: http://localhost:5173
echo.
echo Waiting 4 seconds for services to initialize...
timeout /t 4 >nul
start http://localhost:5173


