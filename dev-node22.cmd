@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

REM Prefer WorkBuddy's bundled Node 22 runtime.
REM better-sqlite3 native module is built for ABI 127 (Node 22); using Node 25 causes NODE_MODULE_VERSION mismatch.
set "NODE22=%USERPROFILE%\.workbuddy\binaries\node\versions\22.12.0"
if exist "%NODE22%\node.exe" set "PATH=%NODE22%;%PATH%"

echo [weibao-cs-agent] Node version:
node -v
echo [weibao-cs-agent] Starting single-port app (Express serves API + built frontend on :3000)...
node start-app.js
goto :eof
