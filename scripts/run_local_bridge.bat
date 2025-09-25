@echo off
setlocal
set REPO=%~dp0..
set SRV=%REPO%\server
set VENV=%LOCALAPPDATA%\tonify-tts\venv
if not exist "%VENV%" (
  py -m venv "%VENV%"
  "%VENV%\Scripts\pip.exe" install --upgrade pip
  "%VENV%\Scripts\pip.exe" install -r "%SRV%\requirements.txt"
)
cd /d "%SRV%"
set PYTHONIOENCODING=utf-8
"%VENV%\Scripts\python.exe" server.py
