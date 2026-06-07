@echo off
chcp 65001 >nul
title Novel2Script · 星幕 — 一键启动

:: ============================================================
:: Novel2Script（星幕）一键启动脚本
:: 后端: FastAPI + Uvicorn → http://localhost:8000
:: 前端: Vite 开发服务器 → http://localhost:5173
:: ============================================================

echo ============================================================
echo   Novel2Script · 星幕（StarScript）
echo   正在启动前后端服务...
echo ============================================================
echo.

:: 使用 set "VAR=value" 避免路径含空格时截断
set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"

:: ---- 1. 检查 Python 虚拟环境 ----
if not exist "%BACKEND_DIR%\.venv\Scripts\activate.bat" (
    echo [错误] 未找到后端虚拟环境，请先在 backend\ 目录下执行：
    echo   python -m venv .venv
    echo   .venv\Scripts\activate ^&^& pip install -r requirements.txt
    pause
    exit /b 1
)

:: ---- 2. 检查前端 node_modules ----
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [警告] 未找到 node_modules，正在安装前端依赖...
    pushd "%FRONTEND_DIR%"
    call npm install
    popd
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
)

:: ---- 3. 启动后端（新窗口） ----
:: 使用 start /D 设置工作目录，避免 cmd /c 内嵌套引号冲突
echo [1/2] 启动后端服务 ^(FastAPI ::8000^)...
start "Novel2Script_Backend" /D "%BACKEND_DIR%" cmd /c ".venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

:: ---- 4. 稍等后端初始化 ----
timeout /t 3 /nobreak >nul

:: ---- 5. 启动前端（新窗口） ----
echo [2/2] 启动前端服务 ^(Vite ::5173^)...
start "Novel2Script_Frontend" /D "%FRONTEND_DIR%" cmd /c "npm run dev"

:: ---- 6. 等待前端启动后打开浏览器 ----
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo   启动完成！
echo   后端 API 文档: http://localhost:8000/docs
echo   前端页面:     http://localhost:5173
echo ============================================================
echo.
echo   关闭本窗口不会影响前后端运行。
echo   要停止服务，请分别关闭前后端的独立窗口。
echo.

start "" http://localhost:5173

pause
