@echo off
rem ============================================================
rem  Servidor de pruebas del Torneo eFootball
rem  Doble clic en este archivo y deja la ventana abierta.
rem  Luego abre en el navegador:  http://127.0.0.1:8765
rem  Para pararlo: cierra esta ventana (o pulsa Ctrl+C).
rem ============================================================
cd /d "%~dp0"
echo.
echo   ============================================
echo    TORNEO EFOOTBALL - servidor de pruebas
echo   ============================================
echo.
echo    Abre en el navegador:  http://127.0.0.1:8765
echo.
echo    (deja esta ventana abierta mientras juegas)
echo.
python -m http.server 8765 --bind 127.0.0.1
pause
