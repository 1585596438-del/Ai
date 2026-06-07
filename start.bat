@echo off
title Novel2Script StarScript - One-click Start

echo ============================================================
echo   Novel2Script - StarScript
echo   Starting backend and frontend...
echo ============================================================
echo.

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"

REM ---- 1. Check Python virtual environment ----
if not exist "%BACKEND_DIR%\.venv\Scripts\activate.bat" (
    echo [ERROR] Python venv not found at backend\.venv
    echo   Run: cd backend
    echo   python -m venv .venv
    echo   .venv\Scripts\activate ^&^& pip install -r requirements.txt
    pause
    exit /b 1
)

REM ---- 2. Check frontend node_modules ----
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [WARN] node_modules not found, installing dependencies...
    pushd "%FRONTEND_DIR%"
    call npm install
    popd
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)

REM ---- 3. Start backend in new window ----
echo [1/2] Starting backend ^(FastAPI ::8000^)...
start "Novel2Script_Backend" /D "%BACKEND_DIR%" cmd /c ".venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

REM ---- 4. Start frontend in new window ----
echo [2/2] Starting frontend ^(Vite ::5173^)...
start "Novel2Script_Frontend" /D "%FRONTEND_DIR%" cmd /c "npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo   All services started!
echo   Backend API Docs: http://localhost:8000/docs
echo   Frontend:         http://localhost:5173
echo ============================================================
echo.
echo   Close backend/frontend windows to stop services.

start "" http://localhost:5173

pause
