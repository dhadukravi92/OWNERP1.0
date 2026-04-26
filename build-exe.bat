@echo off
title PanelERP - Building EXE Installer
color 0A
echo.
echo  Building PanelERP Windows Installer...
echo  This will take 3-8 minutes.
echo.
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
echo   Installer: dist\PanelERP Setup 1.0.0.exe
echo  ========================================
echo.
explorer dist
pause
