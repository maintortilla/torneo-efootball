# DISEÑO — Web de Torneos eFootball

**Estado:** ✅ APROBADO por Leo (15 sep 2026) · Fases 0 y 1 terminadas
**Versión:** v3 — plataforma de torneos, **exclusiva de PC**, entrada de datos por opciones
**Proyecto:** gestión de torneos de eFootball entre amigos (6 jugadores de momento)

---

## 1. Objetivo

Web para organizar torneos de eFootball entre colegas: apuntar resultados y goles,
ver la clasificación, el pichichi y las eliminatorias, y **reutilizarla** creando
torneos nuevos cuando queramos.

**Prioridad número uno (dicho por Leo):** que TODO se configure desde la web. No es
"la web de un torneo", es **una plataforma de torneos**.

## 2. Alcance

### Lo que SÍ hace
- Crear varios torneos, cada uno con su configuración propia
- Apuntar resultados, goleadores y stats del partido (todo con opciones, sección 6)
- Clasificación automática + cuadro de eliminatorias
- Estadísticas: pichichi, goles por tipo, tarjetas, mejores partidos
- Login con Google y permisos (admin / editor / solo mirar)

### Lo que NO hace (por ahora, YAGNI)
- No se apunta el equipo que usa cada amigo
- No se conecta al juego: los datos se meten a mano
- No hay comentarios ni chat dentro de la web
- No hay apuestas ni dinero, tranquilo 😄

## 3. Decisiones cerradas

| Tema | Decisión |
|---|---|
| **Plataforma** | **Solo PC** (pantalla de escritorio, 1920x1080). Sin diseño móvil. |
| **Layout** | Sidebar de navegación + contenido en columnas: clasificación, partidos y goleadores a la vez |
| Formato por defecto | Liguilla única de 6, ida y vuelta (10 partidos cada uno) → semis 1º-4º y 2º-3º → final |
| Configurable | Formato, nº de vueltas, nº de clasificados, 3º/4º puesto, **puntuación**, desempates, listas de opciones |
| Cuaderno de datos | Supabase (base de datos en la nube + login Google) — Fase 2 |
| Por partido | Resultado (obligatorio) · goles: futbolista + minuto + tipo · stats (opcionales) |
| Cuándo se apunta | En el PC, **después** de jugar los partidos (no hace falta que sea exprés) |
| Stats opcionales | Posesión, tiros, paradas, tarjetas: se rellenan si apetece, nunca obligan |
| **Entrada de datos** | **Todo con opciones cerradas (botones/listas): nada de escribir a mano**, salvo bautizar jugadores y futbolistas |
| Equipos | No se guardan |
| 3º y 4º puesto | Interruptor en los ajustes (sin decidir todavía) |
| Visual | Oscuro tipo estadio + verde neón + tipografía de marcador (Rajdhani / Saira) |
| Dónde se ve | Web publicada gratis (Netlify o GitHub Pages) + Supabase |

## 4. Modelo de datos (el "cuaderno")

6 tablas en Supabase. Explicado en lenguaje normal:

**`torneos`** — cada liga que creéis
`id`, `nombre`, `estado` (en_curso / finalizado), `config` (TODOS los ajustes, sección 5), `creado_en`

**`jugadores`** — los amigos de cada torneo
`id`, `torneo_id`, `nombre`, `emoji`, `color`

**`futbolistas`** — catálogo de futbolistas del torneo (para el pichichi)
`id`, `torneo_id`, `nombre`. Se añaden desde la pantalla al apuntar un gol; una vez en
la lista, se eligen con un clic. Así el pichichi nunca se rompe por una errata.

**`partidos`**
`id`, `torneo_id`, `fase` (liga / semifinal / final / tercer_puesto), `jornada`,
`local_id`, `visitante_id`, `goles_local`, `goles_visitante`, `jugado`, `fecha`, y las
stats opcionales: `posesion_local`, `tiros_local`, `tiros_visitante`, `paradas_local`,
`paradas_visitante`, `amarillas_local`, `amarillas_visitante`, `rojas_local`, `rojas_visitante`

**`goles`** — el acta, gol a gol
`id`, `partido_id`, `lado` (local / visitante), `futbolista_id`, `minuto` (opcional),
`tipo_id`

**`perfiles`** — quién puede hacer qué
`user_id` (cuenta Google), `rol` (admin / editor / lector), `jugador_id` (opcional)

## 5. Configuración del torneo (todo editable desde la web)

Pantalla de **Ajustes del torneo** (solo admin):

**Puntuación**
- Puntos por **victoria** (por defecto 3) · **empate** (1) · **derrota** (0)

**Desempates en la tabla** (ordenables por prioridad)
- Diferencia de goles · Goles a favor · Enfrentamiento directo · Tarjetas (fair play)

**Formato**
- Liguilla única / Grupos + eliminatorias
- Una vuelta / ida y vuelta
- Cuántos clasifican a eliminatorias (2, 4, 8...)
- Partido de 3º y 4º puesto: sí / no
- Eliminatorias a partido único o ida y vuelta

**Listas de opciones** (ampliables sin tocar código)
- **Tipos de gol** — por defecto: Normal · Penalti · Falta directa · Cabeza · Remate ·
  Propia puerta · Fuera de juego
- **Futbolistas** — catálogo del torneo; renombrar y fusionar duplicados
- **Jugadores** — añadir, editar emoji/color, dar de baja

## 6. Entrada de datos: todo a golpe de botón

Regla de oro: **el teclado se usa lo mínimo**. Nada de escribir en campos de texto
salvo para bautizar a un jugador o un futbolista la primera vez.

### Pantalla "Apuntar partido"
1. **Marcador**: dos contadores grandes con `−` y `+`
2. Botón **"+ Añadir gol"** → formulario de un gol:
   - **¿De quién es el gol?** → botones `LOCAL` / `VISITANTE` (con el contador de
     cuántos van detallados de cada lado)
   - **Futbolista** → desplegable del catálogo + botón "+ Nuevo futbolista"
   - **Tipo de gol** → botones: Normal · Penalti · Falta directa · Cabeza · Remate ·
     Propia puerta · Fuera de juego
   - **Minuto** → campo numérico + botón "*No lo sé*"
3. **Acta**: los goles apuntados se listan con su minuto, futbolista, tipo y de quién
   son, y se pueden borrar con un clic
4. **Datos de más** (opcionales, panel aparte): posesión con deslizador (el otro lado se
   calcula solo), tiros / paradas / tarjetas amarillas y rojas con contadores `−` `+`
5. **Guardar resultado** ✅

### Por qué así y no escribiendo
- **Cero erratas**: el pichichi no se parte en dos por un acento o una mayúscula
- **Estadísticas que cuadran**: permite "Máximo goleador de penalti", "Goles de cabeza"...
- **Rápido**: apuntar un partido son unos segundos

## 7. Reglas del juego (lógica de la web)

- **Puntos:** salen de la configuración del torneo
- **Desempate:** según el orden configurado
- **Calendario:** generado automáticamente (método del círculo) — con 6 jugadores e ida
  y vuelta salen 30 partidos y cada uno juega 10. Probado con 4, 5, 6, 8 y 10 jugadores
- **Eliminatorias:** cruces 1º vs último clasificado, 2º vs penúltimo, etc.
- **Validaciones:** no se guardan más goles detallados que los del marcador; todo se
  puede corregir después
- **Clasificación:** una función en JavaScript a partir de los partidos jugados, así
  sirve igual para cualquier torneo y tamaño

## 8. Pantallas

| Pantalla | Estado |
|---|---|
| Portada: resumen + clasificación + partidos + pichichi + goles por tipo | ✅ hecha |
| Apuntar partido (marcador, goles, datos de más, guardar) | ✅ hecha |
| Eliminatorias (cuadro) | ⏳ Fase 3 |
| Estadísticas (por jugador, rachas, comparador) | ⏳ Fase 5 |
| Ajustes del torneo (lo de la sección 5) | ⏳ Fase 3 |
| Crear torneo / lista de torneos / historial | ⏳ Fase 3 |
| Login con Google + permisos | ⏳ Fase 4 |

## 9. Fases de trabajo

| Fase | Qué se hace | Estado |
|---|---|---|
| **0** | Carpeta, git, esqueleto HTML/CSS/JS | ✅ |
| **1** | Clasificación, partidos, pichichi y acta con datos de prueba + estilo estadio | ✅ |
| **2** | Supabase: tablas + leer/escribir desde la nube | ⏳ |
| **3** | Ajustes desde la web: crear torneo, configurar, generar calendario y eliminatorias | ⏳ |
| **4** | Publicar + login Google + permisos (admin/editor/lector) | ⏳ |
| **5** | Historial de torneos, gráficas, MVP, piques | ⏳ |

## 10. Archivos del proyecto

```
Torneo-Efootball/
├── index.html          Portada (clasificación, partidos, goleadores)
├── acta.html           Apuntar un partido
├── css/estilos.css     Todo el estilo (tema estadio)
├── js/config.js        Ajustes por defecto de un torneo nuevo
├── js/modelo.js        Cálculo: clasificación, calendario, eliminatorias, pichichi
├── js/store.js         Única puerta de los datos (navegador hoy, Supabase en Fase 2)
├── js/datos-prueba.js  Torneo de mentira para probar
├── js/index.js         Lógica de la portada
├── js/acta.js          Lógica de apuntar partido
├── docs/               Este diseño + verificar-modelo.js
└── assets/             Capturas de prueba
```

**Truco importante:** las pantallas nunca hablan directamente con el almacén de datos:
siempre pasan por `js/store.js`. En la Fase 2 solo se reescribe ese archivo y todo lo
demás sigue funcionando igual.

## 11. Riesgos y cómo los evitamos

- **Que nadie apunte las stats** → campos opcionales y botones en vez de teclado
- **Claves de Supabase mal puestas** → en la web solo va la clave pública; la de
  escritura se queda en Supabase, con reglas de permisos
- **Resultados mal tecleados** → siempre se pueden editar
- **Pichichi duplicado o mal escrito** → listas cerradas de futbolistas
- **Formatos raros** → el generador de calendario está probado con 4, 5, 6, 8 y 10 jugadores

## 12. Preguntas abiertas

- Nombres y emojis de los 6 jugadores (los de prueba son de mentira)
- ¿Partido de 3º y 4º puesto? → queda como interruptor, se decide al llegar
- ¿Cuándo es el primer torneo de verdad?
- ¿Alguien más será admin aparte de Leo?
