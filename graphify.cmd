@echo off
setlocal EnableExtensions

call "%~dp0scripts\ensure-tooling.bat"

set "GRAPHIFY_PYTHON="

if exist "%~dp0.graphify_python" (
  set /p GRAPHIFY_PYTHON=<"%~dp0.graphify_python"
)

if not defined GRAPHIFY_PYTHON if exist "C:\Python314\python.exe" set "GRAPHIFY_PYTHON=C:\Python314\python.exe"
if not defined GRAPHIFY_PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" set "GRAPHIFY_PYTHON=%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
if not defined GRAPHIFY_PYTHON for %%I in (python.exe) do set "GRAPHIFY_PYTHON=%%~$PATH:I"

if not defined GRAPHIFY_PYTHON (
  echo [ERROR] Python was not found for graphify.
  echo Install Python or create .graphify_python with the full python.exe path.
  exit /b 1
)

if /I "%~1"=="update" (
  set "GRAPHIFY_TARGET=%~2"
  if not defined GRAPHIFY_TARGET set "GRAPHIFY_TARGET=."
  "%GRAPHIFY_PYTHON%" "%~dp0scripts\graphify_update_safe.py" "%GRAPHIFY_TARGET%"
  exit /b %ERRORLEVEL%
)

"%GRAPHIFY_PYTHON%" -m graphify %*
exit /b %ERRORLEVEL%
