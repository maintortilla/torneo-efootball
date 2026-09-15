# ⚽ Torneo eFootball

Web para organizar torneos de eFootball con los colegas: apuntar resultados, ver la
clasificación, quién va clasificando a las eliminatorias y el historial.

**Es una plataforma de torneos, no un torneo:** la idea es crear todos los que
queráis y configurarlo todo desde la propia web, sin tocar código.

## Cómo abrirlo en tu PC

**Opción rápida:** doble clic en `index.html`.

**Opción recomendada para trabajar:** abre la carpeta en VS Code y en su terminal:

```bash
python -m http.server 8765
```

Luego entra en http://127.0.0.1:8765 (F5 para recargar al cambiar algo).

## Apuntar un resultado

En la portada, pulsa **Apuntar** en cualquier partido → sale una **ventanita** con dos
botones `+` y `−` para el marcador y el botón *Guardar*. Sin pantallas de por medio.
Si te equivocas, pulsa **Editar** y usa *Borrar el resultado y dejarlo pendiente*.

## Estructura del proyecto

```
Torneo-Efootball/
├── index.html            Portada: resumen, clasificación, partidos, eliminatorias
├── css/estilos.css       Todo el estilo (tema oscuro + verde neón)
├── js/
│   ├── config.js         Ajustes por defecto con los que nace cada torneo
│   ├── modelo.js         Las reglas: clasificación, calendario, eliminatorias
│   ├── store.js          Única puerta de los datos (hoy: navegador / Fase 2: nube)
│   ├── datos-prueba.js   Torneo de mentira para poder probar
│   └── index.js          Lógica de la portada y de la ventanita
├── docs/
│   ├── DISENO-TORNEO.md      El diseño acordado (¡leer esto!)
│   ├── verificar-modelo.js   Comprobaciones del cálculo (Node)
│   └── prueba-flujo.html     Prueba de la ventanita en el navegador
└── assets/               Capturas de prueba
```

## Comprobar que todo funciona

**1. Las reglas del juego (rápido, sin navegador):**

```bash
node docs/verificar-modelo.js
```

Revisa el calendario (que cada uno juegue 10 partidos, que no se repitan cruces), la
clasificación con distintos puntos y los formatos con 4, 5, 6, 8 y 10 jugadores.
Termina en `✅ TODO CORRECTO`.

**2. La ventanita de apuntar (en el navegador):**

Abre http://127.0.0.1:8765/docs/prueba-flujo.html — simula apuntar un 3-1 y comprueba
que se guarda y que la clasificación se recalcula sola.

## Estado por fases

- [x] **Fase 0** — carpeta, git y esqueleto
- [x] **Fase 1** — clasificación, partidos, eliminatorias y ventanita de resultados
- [x] **Fase 2** — Supabase conectado: los datos viven en la nube y todos veis lo mismo
- [ ] **Fase 3** — ajustes desde la web: crear torneo, configurar, generar calendario
- [ ] **Fase 4** — publicar + login con Google + permisos
- [ ] **Fase 5** — historial, gráficas, MVP
- [ ] **Fase 6 (extra)** — leer las estadísticas del partido desde una captura de pantalla

## La nube (Fase 2) ✅

Los datos viven en **Supabase** (proyecto `raccyikqsekbrnkjfvur`, servidores en Europa).
En la barra de arriba de la web verás una pastilla:

- **☁️ Datos en la nube** → todo va a Supabase: quien abra la web ve lo mismo
- **💾 Modo local** → (solo si no hay internet o falta la configuración) los datos se
  quedan en ese PC

Las dos claves de la conexión están en `js/config-nube.js` y **son públicas a propósito**
(van en el navegador; lo que protege los datos son las políticas de la base de datos).
La contraseña de la base de datos y el token de administración **no** se guardan en el
repositorio (`.gitignore`).

## Reglas del juego (importante)

- Todo lo configurable (puntos, vueltas, clasificados, tipos de gol...) se guarda
  **por torneo**, nunca en el código.
- Los goles detallados, el pichichi y las estadísticas finas están **aparcados** hasta
  la Fase 6, cuando se leerán de la captura de pantalla del partido. El modelo ya los
  soporta (tabla `goles`), solo falta la puerta de entrada.
