@echo off
setlocal
cd /d "%~dp0"
where bash >nul 2>&1
if %ERRORLEVEL%==0 (
  bash "%~dp0launcher" %*
  exit /b %ERRORLEVEL%
)
node "%~dp0invoke-host.mjs" launcher %*
