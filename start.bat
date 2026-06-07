@echo off
title Verhuurdashboard - 't Hart Verloskunde

echo.
echo  ===================================================
echo   Verhuurdashboard ^| 't Hart Verloskunde
echo  ===================================================
echo.

echo  Stap 1: Afhankelijkheden installeren...
call npm install --ignore-scripts
if errorlevel 1 (
  echo.
  echo  FOUT: npm install mislukt. Controleer je Node.js installatie.
  echo.
  pause
  exit /b 1
)

echo.
echo  Stap 2: Frontend bouwen...
cd client
call npm install
if errorlevel 1 (
  cd ..
  echo  FOUT bij client npm install
  pause
  exit /b 1
)
call npm run build
if errorlevel 1 (
  cd ..
  echo  FOUT bij frontend build
  pause
  exit /b 1
)
cd ..

echo.
echo  ===================================================
echo   Server gestart op http://localhost:3000
echo  ===================================================
echo.
echo  Inloggegevens (eerste keer):
echo    Admin:     admin@thart.nl     ^| Admin123!
echo    Assistent: assistent@thart.nl ^| Assistent123!
echo.
echo  Open je browser op: http://localhost:3000
echo  Druk Ctrl+C om te stoppen, daarna bevestig met J.
echo.

npm start

echo.
echo  Server gestopt.
pause
