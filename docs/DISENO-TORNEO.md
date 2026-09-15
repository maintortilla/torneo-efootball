# DISEÑO — Web de Torneos eFootball

**Estado:** ✅ Fases 0, 1, 2 (nube) y **3 (ajustes)** terminadas · **Versión:** v6 (15 sep 2026)
**Proyecto:** plataforma de torneos de eFootball para Leo y sus amigos (6 jugadores)

> Proyecto de Supabase: `raccyikqsekbrnkjfvur` (región Europa) · la web ya lee y escribe
> en la nube: todos los que abran la página ven los mismos datos.
> **Torneo real ya creado:** "Torneo Otoño 2026" con Jairo, Borja, Leo, Alejandro,
> Pedro y Aritz (ida y vuelta, 30 partidos).
> Pendiente de Leo: **revocar el token de acceso** que no llegó a usarse.

---

## 1. Objetivo

Web para organizar torneos de eFootball entre colegas: apuntar resultados, ver la
clasificación y quién va clasificando a las eliminatorias, y **reutilizarla** creando
torneos nuevos cuando queramos.

**Prioridad número uno (dicho por Leo):** que TODO se configure desde la web. No es
"la web de un torneo", es **una plataforma de torneos**.

## 2. Alcance

### Lo que SÍ hace
- Crear varios torneos, cada uno con su configuración propia
- Apuntar el resultado de cada partido con una ventanita (sin salir de la portada)
- Clasificación automática con desempates configurables + racha de forma
- Cruces de eliminatorias calculados ("si acabara hoy")
- Últimos resultados, goles totales, mayor goleada
- (Fase 4) Login con Google y permisos: admin / editor / solo mirar

### Lo que NO hace (por ahora, YAGNI)
- No se apunta el equipo que usa cada amigo
- No se conecta al juego: los datos se meten a mano
- No hay comentarios ni chat dentro de la web
- **No hay goles detallados, pichichi ni estadísticas finas** → aparcado a la Fase 6

## 3. Decisiones cerradas

| Tema | Decisión |
|---|---|
| **Plataforma** | **Solo PC** (escritorio, 1920x1080). Sin diseño móvil |
| **Layout** | Sidebar de navegación + contenido en columnas |
| Formato por defecto | Liguilla única de 6, ida y vuelta (10 partidos cada uno) → semis 1º-4º y 2º-3º → final |
| Configurable | Formato, nº de vueltas, nº de clasificados, 3º/4º puesto, **puntuación**, desempates |
| **Apuntar un resultado** | **Ventanita en la portada**: botones `+`/`−` para los dos marcadores, Guardar, y botón para borrar el resultado |
| Cuándo se apunta | En el PC, después de jugar los partidos |
| Goles detallados / pichichi | **Aparcado a la Fase 6** (se leerán de la captura). El modelo ya los soporta |
| Stats finas (posesión, tiros...) | Aparcadas junto con lo anterior |
| Cuaderno de datos | Supabase (Fase 2) — hoy localStorage para poder trabajar |
| Visual | Oscuro tipo estadio + verde neón + tipografía de marcador (Rajdhani / Saira). **Temas alternativos**: aparcado, ver Fase 7 |
| Dónde se ve | Web publicada gratis (Netlify o GitHub Pages) + Supabase |

## 4. Modelo de datos

**`torneos`** — cada liga: `id`, `nombre`, `estado`, `config` (todos los ajustes), `creado_en`

**`jugadores`** — los amigos de cada torneo: `id`, `torneo_id`, `nombre`, `emoji`, `color`

**`partidos`** — `id`, `torneo_id`, `fase` (liga / semifinal / final / tercer_puesto),
`jornada`, `local_id`, `visitante_id`, `goles_local`, `goles_visitante`, `jugado`, `fecha`

**`futbolistas`** y **`goles`** — aparcados para la Fase 6 (el pichichi): `id`,
`partido_id`, `lado`, `futbolista_id`, `minuto`, `tipo_id`. El modelo ya los calcula
(`calcularGoleadores`), solo falta la entrada de datos.

**`perfiles`** — `user_id` (Google), `rol` (admin / editor / lector), `jugador_id`

## 5. Configuración del torneo (todo editable desde la web — Fase 3)

- **Puntuación**: victoria (3), empate (1), derrota (0)
- **Desempates por prioridad**: diferencia de goles · goles a favor · enfrentamiento
  directo · tarjetas (fair play)
- **Formato**: liguilla o grupos · una vuelta o ida y vuelta · cuántos clasifican ·
  3º y 4º puesto sí/no · eliminatorias a partido único o ida y vuelta
- **Jugadores del torneo**: añadir, editar emoji/color, dar de baja

## 6. Cómo se apunta un resultado

1. En la portada, botón **Apuntar** en la fila del partido
2. Sale la **ventanita**: nombres y emojis de los dos jugadores, dos contadores `+`/`−`
   y el marcador en grande
3. **Guardar** ✅ → la clasificación, los cruces de eliminatorias, el resumen y los
   últimos resultados se recalculan al momento
4. Con **Editar** se puede corregir, y hay un botón para **borrar el resultado** y
   dejar el partido pendiente otra vez
5. Se cierra con `Esc` o pinchando fuera

## 7. Reglas del juego (lógica de la web)

- **Puntos:** salen de la configuración del torneo
- **Desempate:** según el orden configurado
- **Calendario:** generado automáticamente (método del círculo) — con 6 jugadores e ida
  y vuelta salen 30 partidos y cada uno juega 10. Probado con 4, 5, 6, 8 y 10 jugadores
- **Eliminatorias:** cruces 1º vs último clasificado, 2º vs penúltimo, etc.
- **Clasificación:** una función en JavaScript a partir de los partidos jugados

## 8. Pantallas

| Pantalla | Estado |
|---|---|
| Portada (resumen + clasificación + partidos + eliminatorias + últimos resultados) | ✅ |
| Ventanita de apuntar/corregir resultado | ✅ |
| Ajustes del torneo / crear torneo / historial | ⏳ Fase 3 |
| Login con Google + permisos | ⏳ Fase 4 |
| Estadísticas y comparador entre jugadores | ⏳ Fase 5 |
| Lectura de la captura de estadísticas del partido | ⏳ Fase 6 (extra) |

## 9. Fases

| Fase | Qué se hace | Estado |
|---|---|---|
| **0** | Carpeta, git, esqueleto HTML/CSS/JS | ✅ |
| **1** | Portada completa + ventanita de resultados + estilo estadio | ✅ |
| **2** | Supabase: los datos pasan a la nube | ✅ |
| **3** | Ajustes desde la web: crear torneo, configurar, generar calendario y cruces | ✅ |
| **4** | Publicar + login Google + permisos | ⏳ |
| **5** | Historial de torneos, gráficas, MVP | ⏳ |
| **6** | **Extra:** leer las estadísticas de la captura del partido (OCR/visión) | ⏳ |
| **7** | **Temas visuales alternativos** (azul, retro, claro...) — idea de Leo, secundaria | ⏳ |

### Nota sobre la Fase 6 (idea de Leo)

Hay tres niveles, de menos a más complicado:
1. A mano (lo de ahora).
2. **Ya posible sin desarrollo**: Leo pasa la captura al chat y Hermes la lee con
   visión y mete los datos.
3. Automático en la web: subir la imagen y que un OCR/visión la interprete
   (necesita API de visión o Tesseract + bastante ajuste). Es el objetivo de la Fase 6.

## 10. Archivos

```
Torneo-Efootball/
├── index.html          Portada (única pantalla por ahora)
├── css/estilos.css     Todo el estilo
├── js/config.js        Ajustes por defecto de un torneo nuevo
├── js/modelo.js        Cálculo: clasificación, calendario, eliminatorias, (goles)
├── js/store.js         Única puerta de los datos
├── js/datos-prueba.js  Torneo de mentira para probar
├── js/index.js         Lógica de la portada y de la ventanita
├── docs/               Este diseño + los dos tests
└── assets/             Capturas de prueba
```

**Truco importante:** las pantallas nunca hablan directamente con el almacén de datos:
siempre pasan por `js/store.js`. En la Fase 2 solo se reescribe ese archivo.

## 11. Cómo se comprueba (tests)

| Test | Comando | Qué comprueba |
|---|---|---|
| Modelo | `node docs/verificar-modelo.js` | Calendario, puntos configurables, desempates, eliminatorias, formatos de 4 a 10 jugadores |
| Flujo | abrir `docs/prueba-flujo.html` | Que la ventanita abre, guarda, recalcula la clasificación y persiste |

## 12. Riesgos

- **Claves de Supabase mal puestas** → en la web solo va la clave pública; la de
  escritura se queda en Supabase, con reglas de permisos
- **Resultados mal tecleados** → siempre se pueden editar o borrar
- **Formatos raros** → el generador de calendario está probado con 4, 5, 6, 8 y 10 jugadores

## 13. Preguntas abiertas

- Nombres y emojis reales de los 6 jugadores (los de prueba son de mentira)
- ¿Partido de 3º y 4º puesto? → interruptor en los ajustes, se decide al llegar
- ¿Cuándo es el primer torneo de verdad?
- ¿Alguien más será admin aparte de Leo?
