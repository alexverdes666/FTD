@echo off
echo ============================================
echo   FTD Local Agent - Installer
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Get the directory where this script is located
set SCRIPT_DIR=%~dp0
set AGENT_PATH=%SCRIPT_DIR%local-agent.js

:: Create a VBS script to run the agent hidden (no console window)
set VBS_PATH=%APPDATA%\FTD\run-agent.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

:: Create FTD directory in AppData
if not exist "%APPDATA%\FTD" mkdir "%APPDATA%\FTD"

:: Create VBS launcher (runs Node.js hidden)
echo Creating hidden launcher...
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run "node ""%AGENT_PATH%""", 0, False
) > "%VBS_PATH%"

:: Create startup shortcut
echo Creating startup shortcut...
copy "%VBS_PATH%" "%STARTUP_DIR%\FTD-Agent.vbs" >nul

:: Start the agent now
echo Starting FTD Local Agent...
start "" wscript "%VBS_PATH%"

echo.
echo ============================================
echo   Installation complete!
echo.
echo   The agent is now running and will
echo   auto-start when Windows starts.
echo.
echo   To uninstall, delete:
echo   %STARTUP_DIR%\FTD-Agent.vbs
echo ============================================
echo.
pause
