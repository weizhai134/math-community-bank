@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies, please wait...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Check Node.js installation and network.
    pause
    exit /b 1
  )
)

echo.
echo ============================================================
echo  Gaoshu Quest - starting server on all network interfaces
echo.
echo  This computer : http://localhost:5173
echo  Phone / other : http://YOUR-PC-IP:5173
echo                  (same Wi-Fi; run "ipconfig" to find IPv4)
echo.
echo  Close the server window to stop it.
echo ============================================================
echo.

start "Gaoshu Quest Server" cmd /k "npm run dev:lan"
timeout /t 4 >nul
start "" http://localhost:5173
