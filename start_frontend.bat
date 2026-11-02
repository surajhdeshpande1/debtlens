@echo off
title DebtLens Frontend SPA
cd /d "%~dp0frontend"
echo ========================================================
echo Starting DebtLens React Vite Frontend on http://localhost:5173...
echo ========================================================
npm run dev -- --host 0.0.0.0 --port 5173
pause


