# ⚽ Torneo eFootball

Web para organizar torneos de eFootball con los colegas: apuntar resultados, ver la
clasificación, quién va clasificando a las eliminatorias y configurarlo **todo** desde
la propia web (crear torneos, jugadores, formato, puntos, desempates).

**Es una plataforma de torneos, no un torneo:** se crean todos los que queráis, sin
tocar código.

## Cómo abrirlo

**Opción rápida:** doble clic en `index.html`.

**Opción recomendada:** abre la carpeta en VS Code y en su terminal:

```bash
python -m http.server 8765
```

Luego entra en http://127.0.0.1:8765 (F5 para recargar).

## Qué se puede hacer

- **🎰 Ruleta de emparejamientos**: los torneos nuevos nacen **sin ningún partido**. En la
  página Partidos pulsas *Ruleta* y giras: el primer jugador que sale juega en casa y el
  segundo es el rival. La ruleta **no repite cruces** ya apuntados, **ni repite jugador
  dentro de la misma jornada** (si la jornada ya está llena, avisa y te toca elegir otra).
  Las jornadas se van montando **poco a poco**; también puedes poner los cruces a mano con
  *+ Añadir partido*
- **Sonido y efectos en la ruleta**: suena un **tic por cada sector** que pasa (desacelerando
  como una ruleta de verdad) y una **fanfarria** cuando sale el jugador, con efecto de onda,
  brillo del emoji y rebote de la rueda. Botón **🔊/🔇** para silenciarla (se recuerda)
- **Menú lateral plegable**: el botón **«** de arriba del menú lo deja en una franja solo
  con los iconos (y cada navegador recuerda cómo lo dejaste). Dentro está
  **🗂️ Cambiar de torneo**, para volver a la lista y elegir otro
- **🎨 Dos paletas de color**: en Ajustes → *Aspecto de la web* se cambia entre
  **Verde neón** (el de siempre) y **Morado** (violeta sobre gris oscuro, estilo plataforma).
  Se guarda en el navegador, así que cada uno puede tener la suya. La clasificación lleva
  **insignias 🥇🥈🥉** en el podio (en las dos paletas)
- **Filtros con color propio**: en Partidos cada filtro tiene su color — *Todos* el acento de
  la paleta, *Pendientes* ámbar, *Jugados* verde y *Solo la jornada en curso* azul. Cada paleta
  usa sus propios tonos (en morado van más apagados para que peguen con el gris)
- **Mis torneos** (página de inicio): la lista de todos los torneos en tarjetas. Desde ahí
  se entra a la clasificación, a los partidos o a los ajustes de cada uno, y se crean
  torneos nuevos. **Cada página recuerda en qué torneo estás** (queda en la dirección), así
  que al pasar de Partidos a Clasificación ya no se cambia de torneo solo
- **Apuntar un resultado**: botón *Apuntar* en cualquier partido → ventanita con los dos
  marcadores → Guardar. La clasificación, las eliminatorias y el resumen se recalculan solos.
  En esa misma ventanita se puede **borrar el resultado** (deja el partido pendiente) o
  **eliminar el partido** del torneo si os habéis equivocado al apuntarlo
- **Ajustes** (menú lateral): crear un torneo nuevo, cambiar jugadores (emoji y color),
  formato, vueltas, cuántos clasifican, 3º y 4º puesto, puntos por victoria/empate/derrota
  y el orden de los desempates (con flechitas ↑↓)
- **Añadir partido**: en Partidos, botón *+ Añadir partido* para meter un partido de liga
  (con su jornada) o un amistoso (no cuenta para la clasificación)
- **Eliminatorias**: cuando acaba la liguilla, un botón genera las semifinales; después,
  la final (y el 3º puesto si está activado). Si un partido de eliminatoria acaba en
  empate, pasa el que mejor quedó en la liguilla
- **Refrescar**: el botón 🔄 trae lo que hayan apuntado los demás

## Estructura del proyecto

```
Torneo-Efootball/
├── index.html            Mis torneos: la lista de torneos y el botón de crear uno nuevo
├── clasificacion.html    Clasificación: resumen, tabla, eliminatorias, últimos resultados
├── partidos.html         Todos los partidos: filtros, por jornadas, apuntar/editar
├── ajustes.html          Crear torneos y configurarlo todo
├── css/estilos.css       Todo el estilo (tema oscuro + verde neón)
├── js/
│   ├── config.js         Ajustes por defecto de un torneo nuevo
│   ├── config-nube.js    URL y clave pública de Supabase (son públicas a propósito)
│   ├── modelo.js         Las reglas: calendario, clasificación, eliminatorias, fases
│   ├── store.js          Única puerta de los datos (nube o navegador)
│   ├── comun.js          Piezas compartidas: torneo activo, ventanita, avisos, filas
│   ├── datos-prueba.js   Datos de mentira por si no hay conexión
│   ├── torneos.js        Lógica de la lista de torneos
│   ├── tema.js           Las paletas de color (verde neón / morado)
│   ├── clasificacion.js  Lógica de la clasificación
│   ├── partidos.js       Lógica de la página de partidos
│   ├── ruleta.js         La ruleta que sortea los emparejamientos
│   └── ajustes.js        Lógica de la pantalla de ajustes
├── docs/                 Diseño + tests + el SQL de la base de datos
├── tools/                Scripts de apoyo (creación del proyecto de Supabase)
└── assets/               Capturas de prueba
```

**Cómo viaja el torneo entre páginas:** todas las páginas de un torneo llevan `?torneo=<id>`
en la dirección. Si no viene, se usa el último torneo abierto (guardado en el navegador) y,
si tampoco hay, el primero de la lista. Los enlaces del menú lateral arrastran el `?torneo=`
solos (`enlacesConTorneo()` en `js/comun.js`).

## Comprobar que todo funciona

| Test | Cómo | Qué comprueba |
|---|---|---|
| Modelo | `node docs/verificar-modelo.js` | Calendario, puntos, desempates, eliminatorias, formatos de 4 a 10 jugadores y la lógica de la ruleta |
| Ruleta | abrir `docs/prueba-ruleta.html` | Que la ruleta sortea, no repite cruces ni jugadores en la misma jornada, apunta el partido y deja eliminar uno |
| Temas | abrir `docs/prueba-tema.html` | Que las dos paletas se aplican, se recuerdan al cambiar de página y que la verde queda intacta |
| Navegación | abrir `docs/prueba-navegacion.html` | Que al cambiar de página NO se cambia de torneo solo |
| Flujo | abrir `docs/prueba-flujo.html` | Que la ventanita apunta un resultado, el progreso sube y el borrado deja el partido pendiente |
| Ajustes | abrir `docs/prueba-ajustes.html` | Que se crea un torneo (sin partidos), se configura y se borra |

Los cuatro deben terminar en **✅ TODO CORRECTO**. Las tres pruebas de navegador **se limpian
solas**: dejan el torneo como estaba al terminar.

## Estado por fases

- [x] **Fase 0** — carpeta, git y esqueleto
- [x] **Fase 1** — portada, clasificación, partidos y ventanita de resultados
- [x] **Fase 2** — Supabase: los datos viven en la nube y todos veis lo mismo
- [x] **Fase 3** — ajustes desde la web: crear torneos, configurar y generar fases
- [ ] **Fase 4** — publicar la web + login con Google + permisos
- [ ] **Fase 5** — historial, gráficas, MVP
- [ ] **Fase 6 (extra)** — leer las estadísticas del partido desde una captura de pantalla
- [ ] **Fase 7** — temas visuales alternativos (azul, retro, claro...)

## La nube ☁️

Los datos viven en **Supabase**, con servidores en Europa. En la barra de arriba verás:

- **☁️ Datos en la nube** → todos los que abran la web ven y apuntan lo mismo
- **💾 Modo local** → (sin internet o sin configurar) los datos se quedan en ese PC

Las claves de `js/config-nube.js` **son públicas a propósito** (van en el navegador; quien
protege los datos son las políticas de la base de datos). La contraseña de la base de datos
y el token de administración **no** se guardan en el repositorio (`.gitignore`).

Las tablas están abiertas (cualquiera con la dirección puede escribir) — es temporal,
hasta la Fase 4 (login y permisos).

## Regla importante

Todo lo configurable (puntos, vueltas, clasificados, jugadores, desempates...) se guarda
**por torneo**, nunca en el código. Si algo no se puede cambiar desde Ajustes, es un bug.
