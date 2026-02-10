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
set INSTALL_DIR=%APPDATA%\FTD
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

:: Create FTD directory in AppData
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copy agent files to AppData
echo Copying agent files...
copy /Y "%SCRIPT_DIR%local-agent.js" "%INSTALL_DIR%\local-agent.js" >nul
copy /Y "%SCRIPT_DIR%agent-config.json" "%INSTALL_DIR%\agent-config.json" >nul

:: Create VBS launcher (runs Node.js hidden, no console window)
echo Creating hidden launcher...
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
echo WshShell.Run "node ""%INSTALL_DIR%\local-agent.js""", 0, False
) > "%INSTALL_DIR%\run-agent.vbs"

:: Create startup shortcut
echo Creating startup shortcut...
copy /Y "%INSTALL_DIR%\run-agent.vbs" "%STARTUP_DIR%\FTD-Agent.vbs" >nul

:: Start the agent now
echo Starting FTD Local Agent...
start "" wscript "%INSTALL_DIR%\run-agent.vbs"

echo.
echo ============================================
echo   Installation complete!
echo.
echo   The agent is now running and will
echo   auto-start when Windows starts.
echo.
echo   Files installed to: %INSTALL_DIR%
echo   Config: %INSTALL_DIR%\agent-config.json
echo.
echo   To uninstall, delete:
echo   %INSTALL_DIR%
echo   %STARTUP_DIR%\FTD-Agent.vbs
echo ============================================
echo.
pause
