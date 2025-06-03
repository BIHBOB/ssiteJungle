@echo off
chcp 65001 > nul
set TITLE=Russkii Portal
title %TITLE%

echo ===== Russkii Portal =====
echo Checking for Node.js...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js and try again.
    pause
    exit /b
)

echo Node.js found!
echo.
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b
)

echo Dependencies installed!
echo.

REM Create uploads directory if it doesn't exist
if not exist "uploads" mkdir uploads

REM Create db directory if it doesn't exist
if not exist "db" mkdir db

REM Check if admin is configured
echo Checking admin settings...
if not exist "db\database.sqlite" (
    echo Database not found. Running admin setup...
    call setup-admin.bat
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to setup admin.
        pause
        exit /b
    )
)

echo Getting computer IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP:~1%

echo.
echo ============================================
echo Starting application in development mode...
echo.
echo [LOCAL ACCESS]
echo http://localhost:5000
echo.
echo [PHONE ACCESS]
echo 1. Make sure your phone is connected to the same Wi-Fi network
echo 2. Open in your phone's browser:
echo    http://%IP%:5000
echo.
echo [ADMIN PANEL LOGIN]
echo Email: fortnite08qwer@gmail.com
echo Password: Plmokn09
echo.
echo Press Ctrl+C to stop the server
echo ============================================
echo.

set NODE_ENV=development
set HOST=0.0.0.0
call npx tsx server/index-sqlite.ts

pause 