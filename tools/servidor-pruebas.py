"""Servidor de pruebas del Torneo eFootball.

Por qué no vale `python -m http.server` a secas: ese servidor atiende UNA
petición a la vez y se queda atascado cuando un navegador corta una conexión a
medias (pasa mucho al hacer capturas automáticas). Entonces la web "no abre"
aunque el proceso siga vivo.

Este servidor es multihilo: atiende varias peticiones a la vez y no se atasca.
Además reutiliza el puerto, así que se puede reiniciar sin esperar.

Uso:  python tools/servidor-pruebas.py      (o doble clic en servidor.bat)
"""

import http.server
import os
import socketserver

PUERTO = 8765
CARPETA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=CARPETA, **kwargs)

    def log_message(self, *args):
        # Sin ruido: la ventana solo avisa de la dirección
        pass


class Servidor(socketserver.ThreadingTCPServer):
    allow_reuse_address = True   # reiniciar sin "address already in use"
    daemon_threads = True        # no se queda colgado con conexiones cortadas


if __name__ == '__main__':
    with Servidor(('127.0.0.1', PUERTO), Manejador) as httpd:
        print()
        print('  ============================================')
        print('   TORNEO EFOOTBALL - servidor de pruebas')
        print('  ============================================')
        print()
        print('   Abre en el navegador:  http://127.0.0.1:%d' % PUERTO)
        print()
        print('   (deja esta ventana abierta mientras juegas)')
        print()
        httpd.serve_forever()
