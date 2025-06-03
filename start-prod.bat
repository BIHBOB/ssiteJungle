@echo off
set NODE_ENV=production

REM Create necessary directories if they don't exist
if not exist "uploads" mkdir uploads
if not exist "dist" mkdir dist

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Build the project
echo Building the project...
call npm run build

REM Start the server
echo Starting the server...
node dist/index.js 