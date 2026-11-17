@echo off
REM DebtLens offline demo — one-time setup on Windows (Python 3.10+ and MySQL 8 already installed).
REM Run from the repository folder:  scripts\windows\setup.bat
cd /d "%~dp0\..\.."
where python >nul 2>nul || (echo Python is not on PATH. Install Python 3.12 from python.org and tick "Add to PATH". & exit /b 1)
if not exist .venv (python -m venv .venv || exit /b 1)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
pip install -r requirements.txt "typer>=0.12" "rich>=13" "waitress>=3.0" || exit /b 1
echo.
echo Creating the MySQL database and user (you will be asked for the MySQL root password)...
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS debtlens CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'debtlens'@'localhost' IDENTIFIED BY 'debtlens'; GRANT ALL PRIVILEGES ON debtlens.* TO 'debtlens'@'localhost'; FLUSH PRIVILEGES;"
if errorlevel 1 echo (If the mysql command was not found, run the same SQL in MySQL Workbench - see docs\LOCAL_SETUP.md)
echo.
echo Downloading the MiniLM model once, so the demo also works without internet...
python -m debtlens model download
echo.
echo Setup done. Start the website with:  scripts\windows\start.bat
