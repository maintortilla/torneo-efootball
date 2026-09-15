# ⚽ Torneo eFootball

Web para organizar torneos de eFootball con los colegas: apuntar resultados y goles,
ver la clasificación, el pichichi y (pronto) las eliminatorias.

**Es una plataforma de torneos, no un torneo:** la idea es crear todos los que
queráis y configurarlo todo desde la propia web, sin tocar código.

## Cómo abrirlo en tu PC

**Opción 1 (la fácil):** doble clic en `index.html`. Se abre en el navegador.

**Opción 2 (recomendada para trabajar):** abre la carpeta en VS Code, y desde la
terminal de VS Code:

```bash
python -m http.server 8765
```

Luego entra en http://127.0.0.1:8765 en el navegador. Con esta opción los datos se
guardan bien y cualquier cambio se ve recargando la página (F5).

## Estructura del proyecto

```
Torneo-Efootball/
├── index.html            Portada: clasificación + partidos + goleadores
├── acta.html             Pantalla de apuntar un partido
├── css/estilos.css       Todo el estilo (tema oscuro + verde neón)
├── js/
│   ├── config.js         Ajustes por defecto con los que nace cada torneo
│   ├── modelo.js         Las reglas: clasificación, calendario, eliminatorias
│   ├── store.js          Única puerta de los datos (hoy: navegador / Fase 2: nube)
│   ├── datos-prueba.js   Torneo de mentira para poder probar
│   ├── index.js          Lógica de la portada
│   └── acta.js           Lógica de la pantalla de apuntar partido
├── docs/
│   ├── DISENO-TORNEO.md         El diseño acordado (¡leer esto!)
│   └── verificar-modelo.js      Comprobaciones automáticas del cálculo
└── assets/               Capturas de prueba
```

## Comprobar que la lógica está bien

```bash
node docs/verificar-modelo.js
```

Revisa el calendario (que cada uno juegue 10 partidos, que no se repitan cruces),
la clasificación con distintos puntos, el pichichi y los formatos con 4, 5, 6, 8 y
10 jugadores. Si todo va bien, termina con `✅ TODO CORRECTO`.

## Estado por fases

- [x] **Fase 0** — carpeta, git y esqueleto
- [x] **Fase 1** — clasificación, partidos, pichichi y acta (con datos de prueba)
- [ ] **Fase 2** — conectar Supabase (los datos pasan a la nube)
- [ ] **Fase 3** — ajustes desde la web: crear torneo, configurar, generar calendario
- [ ] **Fase 4** — publicar + login con Google + permisos
- [ ] **Fase 5** — historial, gráficas, MVP

## Reglas del juego (importante)

- Los goles se apuntan con **listas cerradas** (futbolista + tipo), nunca escribiendo
  a mano: así el pichichi nunca se rompe por una errata.
- Las stats (posesión, tiros, paradas, tarjetas) son **opcionales**. La web funciona
  igual sin ellas.
- Todo lo configurable (puntos, vueltas, clasificados, tipos de gol...) se guarda
  **por torneo**, no en el código.
