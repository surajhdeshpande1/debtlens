# DebtLens One-Click Launcher for Windows PowerShell
$root = $PSScriptRoot
Set-Location $root

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting DebtLens Backend & Frontend Services..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Start-Process -FilePath "$root\start_backend.bat" -WindowStyle Normal
Start-Process -FilePath "$root\start_frontend.bat" -WindowStyle Normal

Write-Host "`nDebtLens services started in separate console windows!" -ForegroundColor Green
Write-Host "Backend API: http://localhost:8000 (Docs: http://localhost:8000/docs)" -ForegroundColor Yellow
Write-Host "Frontend UI: http://localhost:5173" -ForegroundColor Yellow

Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

