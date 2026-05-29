@echo off
title OwnERP - Building EXE Installer
color 0A
echo.
echo  Building OwnERP Windows Installer...
echo  This will take 3-8 minutes.
echo.
IF EXIST "C:\Program Files\nodejs\npm.cmd" (
    SET "PATH=C:\Program Files\nodejs;%PATH%"
)
IF EXIST "%ProgramFiles(x86)%\nodejs\npm.cmd" (
    SET "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
)
IF EXIST "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" (
    SET "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)
call npm run build
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] React build failed. Check errors above.
    pause
    exit /b 1
)
echo.
echo  React build complete. Packaging Electron app...
call npm run package
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Packaging failed. Check errors above.
    pause
    exit /b 1
)
echo.
echo  ========================================
echo   BUILD SUCCESSFUL!
echo   Installer: dist\OwnERP Setup 1.0.0.exe
echo  ========================================
echo.
explorer dist
pause
