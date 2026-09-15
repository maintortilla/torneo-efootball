/* ==========================================================================
   RULETA DE EMPAREJAMIENTOS
   --------------------------------------------------------------------------
   El torneo no trae calendario: los cruces se sortean aquí, jornada a jornada.
   Se gira la rueda dos veces (local y visitante) y el partido se apunta donde
   diga el desplegable de jornada.
   La lógica del sorteo vive en JS/modelo.js (parejaYaExiste, candidatosRuleta,
   elegirAlAzar...), no aquí. Esto es solo la rueda y sus botones.
   ========================================================================== */

const RULETA_GIRO_MS = 3600;          // lo que tarda en parar la rueda
const RULETA_RADIO_EMOJI = 98;        // a qué distancia del centro se pintan los emojis

let ruletaEstado = {
  girando: false,
  rotacion: 0,      // grados acumulados (siempre sumando, la rueda nunca "vuelve")
  elegidos: []      // ids en orden: [local, visitante]
};

const esperarMs = ms => new Promise(r => setTimeout(r, ms));
const escapar = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------------------------------------- abrir/cerrar */
function abrirRuleta() {
  const torneo = torneoActual;
  if (!torneo) return;
  if (torneo.jugadores.length < 2) {
    avisar('Hacen falta al menos 2 jugadores en el torneo 🙂', true);
    return;
  }

  ruletaEstado.elegidos = [];
  pintarRueda(torneo);
  pintarElegidosRuleta();
  pintarOpcionesJornada(torneo);
  $('#ruleta-nota').textContent = 'Pulsa GIRAR: el primero que salga juega en casa 🏠';
  $('#modal-ruleta').hidden = false;
}

function cerrarRuleta() {
  $('#modal-ruleta').hidden = true;
  ruletaEstado.elegidos = [];
}

/* ----------------------------------------------------------------- dibujado */
/* La rueda tiene un sector por jugador, con su color, y su emoji dentro.
   El sector 0 empieza a las 12 en punto y va en sentido de las agujas. */
function pintarRueda(torneo) {
  const rueda = $('#ruleta-rueda');
  const n = torneo.jugadores.length;
  const paso = 360 / n;

  const trozos = torneo.jugadores.map((j, i) =>
    `${colorSuave(j.color)} ${(i * paso).toFixed(2)}deg ${((i + 1) * paso).toFixed(2)}deg`);
  rueda.style.background = `conic-gradient(from 0deg, ${trozos.join(', ')})`;

  // Los emojis, cada uno en el centro de su sector (con una envoltura dentro
  // para poder animar el emoji sin perder su sitio en la rueda)
  rueda.innerHTML = '';
  torneo.jugadores.forEach((j, i) => {
    const angulo = i * paso + paso / 2;
    const span = document.createElement('span');
    span.className = 'ruleta-emoji';
    span.title = j.nombre;

    const dentro = document.createElement('span');
    dentro.className = 'emoji-int';
    dentro.textContent = j.emoji || '⚪';
    span.appendChild(dentro);

    span.style.transform =
      `rotate(${angulo}deg) translateY(-${RULETA_RADIO_EMOJI}px) rotate(${-angulo}deg)`;
    rueda.appendChild(span);
  });

  // La rueda vuelve a su sitio si se reabre la ventana
  ruletaEstado.rotacion = 0;
  rueda.style.transition = 'none';
  rueda.style.transform = 'rotate(0deg)';
  void rueda.offsetWidth;                      // fuerza a aplicar el cambio antes de animar
  rueda.style.transition = '';
}

/* Un color un poco translúcido para que se vea el fondo oscuro del estadio */
function colorSuave(color) {
  const c = color || '#00E676';
  return c.length === 7 ? c + 'CC' : c;
}

function pintarElegidosRuleta() {
  const torneo = torneoActual;
  const [localId, visitId] = ruletaEstado.elegidos;
  const local = localId ? jugador(torneo, localId) : null;
  const visit = visitId ? jugador(torneo, visitId) : null;

  ponerElegido('local', local);
  ponerElegido('visit', visit);

  const listo = !!(local && visit);
  $('#ruleta-guardar').disabled = !listo;
  $('#ruleta-girar').disabled = ruletaEstado.girando;

  if (ruletaEstado.girando) return;

  if (!listo) {
    $('#ruleta-nota').textContent = local
      ? 'Ahora el rival: pulsa GIRAR otra vez 🎡'
      : 'Pulsa GIRAR: el primero que salga juega en casa 🏠';
    return;
  }

  const jornada = Number($('#ruleta-jornada').value);
  $('#ruleta-nota').innerHTML =
    `🎰 <b>${local.emoji} ${local.nombre}</b> contra <b>${visit.emoji} ${visit.nombre}</b> · se apunta en la Jornada ${jornada}. Pulsa <b>Apuntar el partido</b>.`;
}

function ponerElegido(lado, j) {
  const av = $('#ruleta-av-' + lado);
  const nom = $('#ruleta-nom-' + lado);
  if (j) {
    av.textContent = j.emoji || '⚪';
    nom.textContent = j.nombre;
    nom.classList.remove('vacio');
  } else {
    av.textContent = '·';
    nom.textContent = 'sin sortear';
    nom.classList.add('vacio');
  }
}

function pintarOpcionesJornada(torneo) {
  const sel = $('#ruleta-jornada');
  const liga = torneo.partidos.filter(p => p.fase === 'liga');
  const maxima = liga.length ? Math.max(...liga.map(p => Number(p.jornada) || 1)) : 0;
  const sugerida = jornadaSugerida(torneo);

  sel.innerHTML = '';
  for (let j = 1; j <= Math.max(maxima, sugerida); j++) {
    const o = document.createElement('option');
    o.value = j;
    const cuantos = partidosDeJornada(torneo, j).length;
    o.textContent = `Jornada ${j}` + (cuantos ? ` (${cuantos} ${cuantos === 1 ? 'partido' : 'partidos'})` : ' (nueva)');
    sel.appendChild(o);
  }
  sel.value = sugerida;
}

/* -------------------------------------------------------------------- girar */
/* Gira la rueda hasta dejar el sector del jugador elegido bajo la flecha.
   El ángulo se calcula desde el centro del sector y siempre girando hacia
   adelante, para que la rueda nunca parezca que "vuelve". */
function girarRuedaA(torneo, jugadorElegido) {
  const rueda = $('#ruleta-rueda');
  const n = torneo.jugadores.length;
  const i = torneo.jugadores.findIndex(j => j.id === jugadorElegido.id);
  const paso = 360 / n;
  const centro = i * paso + paso / 2;

  const destino = (360 - centro + 360) % 360;              // grados donde debe parar
  const actual = ((ruletaEstado.rotacion % 360) + 360) % 360;
  let delta = destino - actual;
  if (delta < 0) delta += 360;

  ruletaEstado.rotacion += 5 * 360 + delta;                // cinco vueltas y para
  rueda.style.transform = `rotate(${ruletaEstado.rotacion}deg)`;
}

/* Explica por qué la ruleta no puede dar a nadie más (y qué se puede hacer) */
function avisarSinCandidatos(torneo, jornada) {
  const libres = torneo.jugadores.filter(j => !jugadorYaJuegaEnJornada(torneo, j.id, jornada));
  const [localId] = ruletaEstado.elegidos;
  const local = localId ? jugador(torneo, localId) : null;
  const nota = $('#ruleta-nota');

  if (!libres.length) {
    nota.innerHTML = `En la <b>Jornada ${jornada}</b> ya están jugando todos. Elige otra jornada (o añade una nueva) y vuelve a girar 🎡`;
    return;
  }
  if (local && libres.filter(j => j.id !== local.id).length === 0) {
    nota.innerHTML = `No queda nadie libre en la Jornada ${jornada} para jugar contra <b>${local.emoji} ${local.nombre}</b>. Elige otra jornada 🎡`;
    return;
  }
  if (local) {
    nota.innerHTML = `Todos los cruces de <b>${local.emoji} ${local.nombre}</b> en la Jornada ${jornada} ya están apuntados. Marca <b>«Permitir repetir un cruce»</b> si queréis repetir alguno 🔁`;
    return;
  }
  nota.innerHTML = `En la Jornada ${jornada} no queda nadie libre. Elige otra jornada 🎡`;
}

async function girarRuleta() {
  const torneo = torneoActual;
  if (!torneo || ruletaEstado.girando) return;

  // Si ya estaban los dos, esto empieza un partido nuevo
  if (ruletaEstado.elegidos.length >= 2) ruletaEstado.elegidos = [];

  const jornada = Number($('#ruleta-jornada').value);
  const candidatos = candidatosRuleta(torneo, {
    yaElegidos: ruletaEstado.elegidos,
    localId: ruletaEstado.elegidos[0] || null,
    permitirRepetir: $('#ruleta-repetir').checked,
    jornada: jornada
  });

  if (!candidatos.length) {
    avisarSinCandidatos(torneo, jornada);
    return;
  }

  const elegido = elegirAlAzar(candidatos);
  const lado = ruletaEstado.elegidos.length === 0 ? 'local' : 'visit';

  ruletaEstado.girando = true;
  $('#ruleta-girar').disabled = true;
  $('#ruleta-nota').textContent = 'Girando… 🎡';

  $('#ruleta-caja').classList.add('girando');
  girarRuedaA(torneo, elegido);
  seguirTics(torneo);                    // el sonido va pegado a lo que se ve

  await esperarMs(RULETA_GIRO_MS + 140);

  $('#ruleta-caja').classList.remove('girando');
  ruletaEstado.girando = false;
  ruletaEstado.elegidos.push(elegido.id);

  sonarElegido();
  pintarElegidosRuleta();
  efectoElegido(torneo, elegido, lado);
}

/* ------------------------------------------------------------------ guardar */
async function guardarPartidoRuleta() {
  const torneo = torneoActual;
  if (!torneo || ruletaEstado.elegidos.length < 2) return;

  const [localId, visitId] = ruletaEstado.elegidos;
  const jornada = Number($('#ruleta-jornada').value);

  // Nadie juega dos veces en la misma jornada (por si se cambió de jornada
  // después de haber sorteado)
  const repetido = [localId, visitId].find(id => jugadorYaJuegaEnJornada(torneo, id, jornada));
  if (repetido) {
    const j = jugador(torneo, repetido);
    ruletaEstado.elegidos = [];
    pintarElegidosRuleta();
    avisar(`${j.emoji} ${j.nombre} ya juega en la Jornada ${jornada}: sorteo limpiado, vuelve a girar 🔄`, true);
    return;
  }

  const partido = nuevoPartidoLiga(localId, visitId, jornada);

  torneo.partidos.push(partido);

  const boton = $('#ruleta-guardar');
  boton.disabled = true;
  boton.textContent = 'Apuntando...';
  try {
    await Store.guardarTorneo(torneo);
    cerrarRuleta();
    if (typeof pintarTodoPartidos === 'function') pintarTodoPartidos();
    const l = jugador(torneo, localId), v = jugador(torneo, visitId);
    avisar(`🎰 ${l.emoji} ${l.nombre} vs ${v.emoji} ${v.nombre} apuntado en la Jornada ${jornada}`);
  } catch (e) {
    console.error(e);
    torneo.partidos = torneo.partidos.filter(p => p.id !== partido.id);
    avisar('No se pudo apuntar: ' + e.message, true);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Apuntar el partido';
  }
}

/* ==========================================================================
   SONIDO (Web Audio: no hace falta ningún archivo de audio)
   --------------------------------------------------------------------------
   - Tics mientras gira: se calculan mirando el ángulo REAL de la rueda en cada
     fotograma, así suenan clavados con lo que se ve y desaceleran solos.
   - Fanfarria corta (do·mi·sol·do) cuando sale el jugador.
   El navegador solo deja sonar después de que toques algo: el primer sonido
   siempre va detrás del botón GIRAR, así que no hay problema.
   ========================================================================== */
let ctxAudio = null;
let silencioRuleta = false;
try { silencioRuleta = localStorage.getItem('ruleta-silencio') === '1'; } catch (e) {}

function contextoAudio() {
  if (silencioRuleta) return null;
  try {
    if (!ctxAudio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxAudio = new AC();
    }
    if (ctxAudio.state === 'suspended') ctxAudio.resume();
    return ctxAudio;
  } catch (e) { return null; }
}

/* Un "tac" cortito, como el de una ruleta de feria */
function sonarTic(intensidad) {
  const ctx = contextoAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const vol = Math.max(0.05, Math.min(0.28, 0.3 * (intensidad || 1)));

  const osc = ctx.createOscillator();
  const filtro = ctx.createBiquadFilter();
  const gana = ctx.createGain();

  filtro.type = 'bandpass';
  filtro.frequency.value = 2300;
  filtro.Q.value = 1.1;

  osc.type = 'square';
  osc.frequency.setValueAtTime(2500, t);
  osc.frequency.exponentialRampToValueAtTime(1000, t + 0.045);

  gana.gain.setValueAtTime(0.0001, t);
  gana.gain.exponentialRampToValueAtTime(vol, t + 0.003);
  gana.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

  osc.connect(filtro).connect(gana).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.075);
}

/* Fanfarria de cuatro notas al salir un jugador */
function sonarElegido() {
  const ctx = contextoAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {     // do · mi · sol · do
    const t = t0 + i * 0.075;
    const ultima = i === 3;
    const osc = ctx.createOscillator();
    const gana = ctx.createGain();
    osc.type = ultima ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(f, t);
    gana.gain.setValueAtTime(0.0001, t);
    gana.gain.exponentialRampToValueAtTime(ultima ? 0.26 : 0.18, t + 0.02);
    gana.gain.exponentialRampToValueAtTime(0.0001, t + (ultima ? 0.55 : 0.28));
    osc.connect(gana).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  });
}

/* Los tics: se mira el ángulo real de la rueda en cada fotograma */
function seguirTics(torneo) {
  const rueda = $('#ruleta-rueda');
  if (!rueda) return;

  const paso = 360 / torneo.jugadores.length;
  const inicio = performance.now();
  let anguloPrevio = null, anguloTotal = 0, sectorPrevio = 0, ultimoTic = 0;

  function fotograma(ahora) {
    let ang = 0;
    try {
      const m = new DOMMatrixReadOnly(getComputedStyle(rueda).transform);
      ang = Math.atan2(m.b, m.a) * 180 / Math.PI;
    } catch (e) { ang = 0; }

    if (anguloPrevio === null) anguloPrevio = ang;
    let d = ang - anguloPrevio;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    anguloTotal += d;
    anguloPrevio = ang;

    if (Math.floor(anguloTotal / paso) !== sectorPrevio) {
      const cuando = performance.now();
      if (cuando - ultimoTic > 22) {
        sonarTic(Math.min(1, Math.abs(d) / 6));    // los últimos tics suenan más flojos
        ultimoTic = cuando;
      }
      sectorPrevio = Math.floor(anguloTotal / paso);
    }

    if (ahora - inicio < RULETA_GIRO_MS - 40) requestAnimationFrame(fotograma);
  }
  requestAnimationFrame(fotograma);
}

/* ==========================================================================
   EFECTOS: rebote de la rueda, onda, salto del emoji y el recuadro que entra
   ========================================================================== */
function animarOtraVez(nodo, clase) {
  if (!nodo) return;
  nodo.classList.remove(clase);
  void nodo.offsetWidth;              // así la animación se reinicia de verdad
  nodo.classList.add(clase);
}

function efectoElegido(torneo, elegido, lado) {
  animarOtraVez($('#ruleta-caja'), 'parada');
  animarOtraVez($('#ruleta-onda'), 'sale');
  animarOtraVez(lado === 'local' ? $('#ruleta-caja-local') : $('#ruleta-caja-visit'), 'nuevo');

  // El emoji elegido pega un salto
  const emojis = $('#ruleta-rueda').querySelectorAll('.ruleta-emoji');
  emojis.forEach(e => e.classList.remove('elegido'));
  const i = torneo.jugadores.findIndex(j => j.id === elegido.id);
  if (emojis[i]) animarOtraVez(emojis[i], 'elegido');

  // Y el centro de la rueda lo canta un momento
  const centro = $('#ruleta-centro');
  if (centro) {
    centro.textContent = elegido.emoji || '⚪';
    clearTimeout(centro.volverAlCentro);
    centro.volverAlCentro = setTimeout(() => { centro.textContent = '🎰'; }, 1500);
  }
}

/* ----------------------------------------------------------- botón de sonido */
function engancharSonidoRuleta() {
  const boton = $('#ruleta-sonido');
  if (!boton) return;

  const pintar = () => {
    boton.textContent = silencioRuleta ? '🔇' : '🔊';
    boton.classList.toggle('apagado', silencioRuleta);
    boton.title = silencioRuleta ? 'Activar el sonido' : 'Silenciar la ruleta';
  };
  pintar();

  boton.onclick = () => {
    silencioRuleta = !silencioRuleta;
    try { localStorage.setItem('ruleta-silencio', silencioRuleta ? '1' : '0'); } catch (e) {}
    pintar();
    if (!silencioRuleta) sonarTic(1);      // un tic para confirmar
  };
}

/* ------------------------------------------------------------------ eventos */
function engancharRuleta() {
  if (!$('#btn-ruleta')) return;

  engancharSonidoRuleta();
  $('#btn-ruleta').onclick = abrirRuleta;
  $('#ruleta-girar').onclick = girarRuleta;
  $('#ruleta-otra').onclick = () => { ruletaEstado.elegidos = []; pintarElegidosRuleta(); girarRuleta(); };
  $('#ruleta-cerrar').onclick = cerrarRuleta;
  $('#ruleta-guardar').onclick = guardarPartidoRuleta;
  $('#ruleta-jornada').onchange = () => {
    const torneo = torneoActual;
    const jornada = Number($('#ruleta-jornada').value);

    // Si ya habían salido jugadores y en la nueva jornada alguno ya juega,
    // el sorteo deja de valer y se limpia
    if (torneo && ruletaEstado.elegidos.length &&
        ruletaEstado.elegidos.some(id => jugadorYaJuegaEnJornada(torneo, id, jornada))) {
      ruletaEstado.elegidos = [];
      pintarElegidosRuleta();
      $('#ruleta-nota').innerHTML =
        `🔄 En la <b>Jornada ${jornada}</b> ya juega alguno de los que habían salido: sorteo limpiado, vuelve a girar 🎡`;
      return;
    }
    pintarElegidosRuleta();
  };

  $('#modal-ruleta').onclick = (e) => { if (e.target.id === 'modal-ruleta') cerrarRuleta(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal-ruleta').hidden) cerrarRuleta();
  });
}

document.addEventListener('DOMContentLoaded', engancharRuleta);
