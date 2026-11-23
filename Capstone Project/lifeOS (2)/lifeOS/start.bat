@echo off
setlocal enabledelayedexpansion
title LifeOS - Smart Personal Productivity Dashboard
color 0B

:: Ensure working directory is the script folder
cd /d "%~dp0"

echo ===================================================
echo   LifeOS - Smart Personal Productivity Dashboard
echo ===================================================
echo.

:: ---------------------------------------------------
:: 1. Check for Python installation
:: ---------------------------------------------------
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_CMD=python"
    goto check_env
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_CMD=py"
    goto check_env
)

color 0C
echo ===================================================
echo  [ERROR] Python was not found in your system PATH!
echo ===================================================
echo  Please install Python 3.10 or higher from:
echo    https://www.python.org/downloads/
echo.
echo  IMPORTANT: During installation, make sure to check:
echo    [x] "Add python.exe to PATH"
echo ===================================================
echo.
pause
exit /b 1

:: ---------------------------------------------------
:: 2. Check for .env file
:: ---------------------------------------------------
:check_env
if exist ".env" goto check_mysql

if exist ".env.example" (
    echo [INFO] .env not found. Creating .env from .env.example...
    copy ".env.example" ".env" >nul
    echo [NOTICE] Default .env created.
    goto check_mysql
)

color 0C
echo ===================================================
echo  [ERROR] Configuration file .env was not found!
echo ===================================================
echo  Please ensure .env exists in the project root folder.
echo.
pause
exit /b 1

:: ---------------------------------------------------
:: 3. Check Database availability
:: ---------------------------------------------------
:check_mysql
%PY_CMD% -c "import sys; sys.path.insert(0, 'backend'); from config import Config; sys.exit(0 if Config.DB_TYPE != 'mysql' else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Database configured: SQLite (database\lifeos.db)
    goto check_deps
)

echo [INFO] Database configured: MySQL. Checking MySQL on port 3306...
%PY_CMD% -c "import socket; s = socket.socket(); err = s.connect_ex(('127.0.0.1', 3306)); s.close(); exit(err)" >nul 2>&1
if %errorlevel% equ 0 goto check_deps

color 0C
echo ===================================================
echo  [ERROR] MySQL Server is NOT reachable on port 3306!
echo ===================================================
echo  DB_TYPE in .env is set to mysql, but port 3306 is not open.
echo.
echo  Options:
echo  1. Start MySQL server, or
echo  2. Set DB_TYPE=sqlite in .env to use database\lifeos.db
echo ===================================================
echo.
pause
exit /b 1

:: ---------------------------------------------------
:: 4. Check required Python dependencies
:: ---------------------------------------------------
:check_deps
%PY_CMD% -c "import flask, flask_cors, flask_sqlalchemy, sqlalchemy, pymysql, cryptography" >nul 2>&1
if %errorlevel% equ 0 goto check_duplicate

echo [INFO] Installing required dependencies from backend\requirements.txt...
%PY_CMD% -m pip install -r backend\requirements.txt --disable-pip-version-check
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ===================================================
    echo  [ERROR] Failed to install required Python packages!
    echo ===================================================
    echo  Please check your internet connection and run:
    echo    pip install -r backend\requirements.txt
    echo ===================================================
    echo.
    pause
    exit /b 1
)
echo [INFO] Dependencies verified.

:: ---------------------------------------------------
:: 5. Check if LifeOS is already running on port 5000
:: ---------------------------------------------------
:check_duplicate
%PY_CMD% -c "import socket; s = socket.socket(); err = s.connect_ex(('127.0.0.1', 5000)); s.close(); exit(0 if err == 0 else 1)" >nul 2>&1
if %errorlevel% neq 0 goto launch_app

color 0A
echo ===================================================
echo  [NOTICE] LifeOS Server is ALREADY RUNNING!
echo ===================================================
echo  Sign In URL: http://127.0.0.1:5000/auth.html
echo.
echo  Opening LifeOS Sign In in your default browser...
echo ===================================================
echo.
start "" http://127.0.0.1:5000/auth.html
echo  To stop the running server, close its existing terminal
echo  window or terminate the python process.
echo.
pause
exit /b 0

:: ---------------------------------------------------
:: Launch LifeOS Full-Stack Application
:: ---------------------------------------------------
:launch_app
echo ===================================================
echo  [OK] Pre-flight checks passed successfully!
echo.
echo  Architecture:
echo   - Backend  : Flask REST API [Python]
echo   - Frontend : LifeOS Single-Page Dashboard [Vanilla JS]
echo   - Database : SQLite [database\lifeos.db]
echo   - DSA      : Queue, Tree, Stack, HashMap
echo.
echo  Starting server at: http://127.0.0.1:5000/auth.html
echo ===================================================
echo  Press Ctrl+C in this window at any time to stop
echo ===================================================
echo.

:: Automatically open browser once the server starts
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:5000/auth.html"

:: Run Flask Full-Stack Server
%PY_CMD% run.py

if %errorlevel% neq 0 (
    echo.
    color 0C
    echo ===================================================
    echo  [ERROR] LifeOS server stopped with an error.
    echo ===================================================
    pause
)
