@echo off
chcp 65001 >nul
cd /d "%~dp0frontend"
echo Starting frontend on http://localhost:1009 ...
call npm run dev
pause
