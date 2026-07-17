@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
echo Starting backend on http://127.0.0.1:8000 ...
".venv\Scripts\uvicorn.exe" app.main:app --host 127.0.0.1 --port 8000
pause
