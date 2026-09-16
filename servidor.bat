@echo off
rem ============================================================
rem  Servidor de pruebas del Torneo eFootball
rem  Doble clic en este archivo y deja la ventana abierta.
rem  Luego abre en el navegador:  http://127.0.0.1:8765
rem  Para pararlo: cierra esta ventana (o pulsa Ctrl+C).
rem
rem  Usa tools/servidor-pruebas.py (multihilo): el servidor normal de
rem  Python se atasca cuando un navegador corta una conexión a medias.
rem ============================================================
cd /d "%~dp0"
python tools\servidor-pruebas.py
pause
