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

  // Los emojis, cada uno en el centro de su sector
  rueda.innerHTML = '';
  torneo.jugadores.forEach((j, i) => {
    const angulo = i * paso + paso / 2;
    const span = document.createElement('span');
    span.className = 'ruleta-emoji';
    span.textContent = j.emoji || '⚪';
    span.title = j.nombre;
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
  const avisos = [];
  if (jugadorYaJuegaEnJornada(torneo, local.id, jornada)) avisos.push(`${local.emoji} ${local.nombre} ya juega en la Jornada ${jornada}`);
  if (jugadorYaJuegaEnJornada(torneo, visit.id, jornada)) avisos.push(`${visit.emoji} ${visit.nombre} ya juega en la Jornada ${jornada}`);

  $('#ruleta-nota').innerHTML = avisos.length
    ? `⚠️ ${avisos.join(' y ')}. Puedes apuntarlo igual, pero mira que no se repita el cruce.`
    : `🎰 <b>${local.emoji} ${local.nombre}</b> contra <b>${visit.emoji} ${visit.nombre}</b> · se apunta en la Jornada ${jornada}. Pulsa <b>Apuntar el partido</b>.`;
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

async function girarRuleta() {
  const torneo = torneoActual;
  if (!torneo || ruletaEstado.girando) return;

  // Si ya estaban los dos, esto empieza un partido nuevo
  if (ruletaEstado.elegidos.length >= 2) ruletaEstado.elegidos = [];

  const permitirRepetir = $('#ruleta-repetir').checked;
  const candidatos = candidatosRuleta(torneo, {
    yaElegidos: ruletaEstado.elegidos,
    localId: ruletaEstado.elegidos[0] || null,
    permitirRepetir: permitirRepetir
  });

  if (!candidatos.length) {
    $('#ruleta-nota').innerHTML = 'No queda ningún cruce nuevo con ese jugador. Marca <b>«Permitir repetir un cruce»</b> si queréis repetir alguno 🔁';
    return;
  }

  const elegido = elegirAlAzar(candidatos);

  ruletaEstado.girando = true;
  $('#ruleta-girar').disabled = true;
  $('#ruleta-nota').textContent = 'Girando… 🎡';
  girarRuedaA(torneo, elegido);

  await esperarMs(RULETA_GIRO_MS + 140);

  ruletaEstado.girando = false;
  ruletaEstado.elegidos.push(elegido.id);
  pintarElegidosRuleta();
}

/* ------------------------------------------------------------------ guardar */
async function guardarPartidoRuleta() {
  const torneo = torneoActual;
  if (!torneo || ruletaEstado.elegidos.length < 2) return;

  const [localId, visitId] = ruletaEstado.elegidos;
  const jornada = Number($('#ruleta-jornada').value);
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

/* ------------------------------------------------------------------ eventos */
function engancharRuleta() {
  if (!$('#btn-ruleta')) return;

  $('#btn-ruleta').onclick = abrirRuleta;
  $('#ruleta-girar').onclick = girarRuleta;
  $('#ruleta-otra').onclick = () => { ruletaEstado.elegidos = []; pintarElegidosRuleta(); girarRuleta(); };
  $('#ruleta-cerrar').onclick = cerrarRuleta;
  $('#ruleta-guardar').onclick = guardarPartidoRuleta;
  $('#ruleta-jornada').onchange = () => pintarElegidosRuleta();

  $('#modal-ruleta').onclick = (e) => { if (e.target.id === 'modal-ruleta') cerrarRuleta(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal-ruleta').hidden) cerrarRuleta();
  });
}

document.addEventListener('DOMContentLoaded', engancharRuleta);
