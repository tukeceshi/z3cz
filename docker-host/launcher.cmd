@echo off
setlocal
cd /d "%~dp0"
node "%~dp0launcher.mjs" %*
