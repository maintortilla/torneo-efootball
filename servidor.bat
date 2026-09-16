@echo off
rem ============================================================
rem  Servidor de pruebas del Torneo eFootball
rem  Doble clic en este archivo y deja la ventana abierta.
rem  Luego abre en el navegador:  http://127.0.0.1:8765
rem  Para pararlo: cierra esta ventana (o pulsa Ctrl+C).
rem
rem  OJO: usa tools\servidor-pruebas.py (multihilo), NO "python -m http.server".
rem  El de python atiende una peticion a la vez y se atasca cuando el navegador
rem  corta una conexion: entonces la web "no abre" aunque el proceso siga vivo.
rem ============================================================
cd /d "%~dp0"
python tools\servidor-pruebas.py
pause
