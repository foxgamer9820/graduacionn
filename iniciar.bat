@echo off
title Software educativo - Servidor
cd /d "%~dp0"

rem ===== Ruta de XAMPP (cambiala si lo instalaste en otro lugar) =====
set XAMPP=C:\xampp

rem ===== 1. Encender MySQL si no esta encendido =====
tasklist /FI "IMAGENAME eq mysqld.exe" | find /I "mysqld.exe" >nul
if errorlevel 1 (
  echo Encendiendo MySQL de XAMPP...
  start "MySQL" /min "%XAMPP%\mysql_start.bat"
  timeout /t 5 /nobreak >nul
) else (
  echo MySQL ya estaba encendido.
)

rem ===== 2. Instalar librerias la primera vez =====
if not exist node_modules (
  echo Instalando librerias, espera un momento...
  call npm.cmd install
)

rem ===== 3. Abrir el navegador cuando el servidor este listo =====
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

rem ===== 4. Encender el servidor =====
echo.
echo  Servidor encendido. NO cierres esta ventana mientras uses el sistema.
echo  Para apagarlo, cierra esta ventana o presiona Ctrl + C.
echo.
call npm.cmd start
pause
