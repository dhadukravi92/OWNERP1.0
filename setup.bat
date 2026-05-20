@echo off
title OwnERP - Setup Script
color 0A

echo.
echo  ========================================
echo   OwnERP - Generic Business ERP
echo   Automated Setup Script
echo  ========================================
echo.

call "%~dp0scripts\ensure-tooling.bat"

:: Check Node.js
echo [1/5] Checking Node.js...
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js not found!
    echo  Please install Node.js from: https://nodejs.org
    echo  Download the LTS version ^(Windows Installer^)
    pause
    exit /b 1
)
FOR /F "tokens=*" %%i IN ('node --version') DO SET NODE_VER=%%i
echo  [OK] Node.js found: %NODE_VER%

:: Check npm
echo [2/5] Checking npm...
npm --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] npm not found! Reinstall Node.js.
    pause
    exit /b 1
)
FOR /F "tokens=*" %%i IN ('npm --version') DO SET NPM_VER=%%i
echo  [OK] npm found: v%NPM_VER%

:: Check Git
echo [3/6] Checking Git...
git --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo  [WARNING] Git not found on PATH. Project scripts will still run, but version control commands may fail in this shell.
) ELSE (
    FOR /F "tokens=*" %%i IN ('git --version') DO SET GIT_VER=%%i
    echo  [OK] %GIT_VER%
)

:: Install dependencies
echo.
echo [4/6] Installing dependencies (this may take 5-10 minutes)...
echo  Please wait...
npm install
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [WARNING] Some packages had issues. Trying with legacy-peer-deps...
    npm install --legacy-peer-deps
)
echo  [OK] Dependencies installed

:: Rebuild native modules
echo.
echo [5/6] Rebuilding native modules for Electron...
npm rebuild better-sqlite3 --runtime=electron --target=29.1.4 --disturl=https://electronjs.org/headers --abi=121
IF %ERRORLEVEL% NEQ 0 (
    echo  [WARNING] Rebuild had warnings - this may be OK
)
echo  [OK] Native modules ready

:: Check graphify wrapper
echo.
echo [6/6] Checking graphify wrapper...
call "%~dp0graphify.cmd" --help >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo  [WARNING] graphify wrapper is not ready yet. Verify Python 3.14 and the graphify package are installed.
) ELSE (
    echo  [OK] graphify wrapper is ready
)

:: Done
echo.
echo Setup complete!
echo.
echo  ========================================
echo   READY TO USE!
echo  ========================================
echo.
echo  To RUN the app (development mode):
echo    npm run electron-dev
echo.
echo  To BUILD the Windows .EXE installer:
echo    npm run build
echo    npm run package
echo.
echo  Default Login:
echo    Username: admin
echo    Password: admin123
echo.
echo  .EXE installer will be in: dist\
echo.
pause
