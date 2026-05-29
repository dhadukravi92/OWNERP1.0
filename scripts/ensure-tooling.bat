@echo off
setlocal EnableExtensions

set "OWNERP_ROOT=%~dp0.."

call :prepend_path "%OWNERP_ROOT%"
call :prepend_path "C:\Program Files\nodejs"
call :prepend_path "%ProgramFiles(x86)%\nodejs"
call :prepend_path "%LOCALAPPDATA%\Programs\nodejs"
call :prepend_path "C:\Program Files\Git\cmd"
call :prepend_path "C:\Python314"
call :prepend_path "%LOCALAPPDATA%\Programs\Python\Python314"
call :prepend_path "%APPDATA%\Python\Python314\Scripts"

if defined PATH (
  endlocal & set "PATH=%PATH%"
) else (
  endlocal
)
exit /b 0

:prepend_path
if "%~1"=="" exit /b 0
if not exist "%~1" exit /b 0
echo ;%PATH%; | find /I ";%~1;" >nul
if errorlevel 1 set "PATH=%~1;%PATH%"
exit /b 0
