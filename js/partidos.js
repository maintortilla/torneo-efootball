/* ==========================================================================
   PANTALLA: PARTIDOS
   La lista completa de partidos del torneo: filtros, agrupados por jornada y
   el botón de apuntar/editar en cada uno. Las eliminatorias salen al final.
   ========================================================================== */

let torneoActual = null;
let filtroPartidos = 'todos';

async function arrancarPartidos() {
  /* Si falla la conexión se dice; si falla el dibujado, se dice también.
     (Antes todo iba junto y los fallos de código se contaban como "no hay nube"). */
  let torneos;
  try {
    await arrancarCandado();     // ¿esta web pide contraseña para apuntar?
    torneos = await Store.iniciar();
  } catch (e) {
    console.error(e);
    avisar('No se pudo conectar con la nube: ' + e.message, true);
    window.__listo = true;
    return;
  }

  try {
    const idInicial = elegirTorneoInicial(torneos);
    if (!idInicial) {   // no hay torneos: a la lista
      window.location.href = 'index.html';
      return;
    }

    torneoActual = Store.torneo(idInicial);
    recordarTorneo(torneoActual.id);

    configurarComun(torneoActual, () => pintarTodoPartidos());
    pintarModoDatos();
    pintarNombreTorneo(torneoActual);
    enlacesConTorneo(torneoActual.id);
    pintarTodoPartidos();
    engancharPartidos();
  } catch (e) {
    console.error('Fallo al dibujar los partidos:', e);
    avisar('La página ha fallado al dibujarse: ' + e.message, true, 6000);
  }
  window.__listo = true;
}

function pintarTodoPartidos() {
  pintarResumenPartidos();
  pintarProgreso();
  pintarLista();
}

/* ------------------------------------------------------------- resumen */
function pintarResumenPartidos() {
  const liga = torneoActual.partidos.filter(p => p.fase === 'liga');
  const jugados = liga.filter(p => p.jugado).length;
  const pendientes = liga.length - jugados;
  const goles = torneoActual.partidos.filter(p => p.jugado)
    .reduce((s, p) => s + p.golesLocal + p.golesVisitante, 0);
  const media = jugados ? (goles / jugados).toFixed(1) : '0.0';

  const caja = $('#resumen-partidos');
  caja.innerHTML = '';

  // Torneo recién creado: aún no hay ningún partido
  if (!liga.length) {
    caja.appendChild(el('div', 'dato dato-col-4',
      `<span class="etiqueta">Sin partidos todavía</span>
       <small style="font-size:15px;color:var(--texto);white-space:normal">
         Este torneo se monta jornada a jornada: pulsa <b>🎰 Ruleta</b> para sortear
         el primer cruce, o <b>+ Añadir partido</b> para ponerlo a mano.
       </small>`));
    return;
  }

  const estado = estadoDeFases(torneoActual);
  const textosEstado = {
    liga: `${estado.pendientes} partidos para acabar la liguilla`,
    generar_semis: 'Liguilla terminada: toca generar semifinales',
    semis: 'Semifinales en juego',
    generar_final: 'Final lista para generar',
    final: 'Final en juego',
    terminado: 'Torneo terminado 🏆'
  };

  [
    { etiqueta: 'Partidos jugados', valor: jugados + '/' + liga.length, extra: pendientes + ' pendientes', color: 1 },
    { etiqueta: 'Goles totales', valor: goles, extra: media + ' por partido', color: 2 },
    { etiqueta: 'Estado', valor: '', extra: textosEstado[estado.paso] || '—', textoLargo: true, color: 4 }
  ].forEach(d => {
    const div = el('div', 'dato dato-col-' + d.color,
      `<span class="etiqueta">${d.etiqueta}</span>
       ${d.textoLargo
          ? `<small style="font-size:15px;color:var(--texto);white-space:normal">${d.extra}</small>`
          : `<span class="valor">${d.valor}</span><small>${d.extra}</small>`}`);
    caja.appendChild(div);
  });
}

function pintarProgreso() {
  // En la barra de arriba se ve cuántos jugadores tiene el torneo
  const n = torneoActual.jugadores.length;
  $('#progreso').textContent = n + (n === 1 ? ' jugador' : ' jugadores');
}

/* -------------------------------------------------------------- la lista */
function pintarLista() {
  const caja = $('#lista-partidos');
  caja.innerHTML = '';

  let liga = torneoActual.partidos.filter(p => p.fase === 'liga');
  let eliminatorias = torneoActual.partidos.filter(p => ['semifinal', 'final', 'tercer_puesto'].includes(p.fase));
  let amistosos = torneoActual.partidos.filter(p => p.fase === 'amistoso');

  const pendientes = liga.filter(p => !p.jugado);
  const jornadaEnCurso = pendientes.length ? pendientes[0].jornada : null;

  if (filtroPartidos === 'pendientes') {
    liga = liga.filter(p => !p.jugado);
    eliminatorias = eliminatorias.filter(p => !p.jugado);
    amistosos = amistosos.filter(p => !p.jugado);
  } else if (filtroPartidos === 'jugados') {
    liga = liga.filter(p => p.jugado);
    eliminatorias = eliminatorias.filter(p => p.jugado);
    amistosos = amistosos.filter(p => p.jugado);
  } else if (filtroPartidos === 'proximos') {
    liga = liga.filter(p => p.jornada === jornadaEnCurso && !p.jugado);
    eliminatorias = [];
    amistosos = [];
  }

  $('#contador-partidos').textContent = (liga.length + eliminatorias.length + amistosos.length) + ' en pantalla';

  if (!liga.length && !eliminatorias.length && !amistosos.length) {
    const sinNada = !torneoActual.partidos.length;
    caja.appendChild(el('div', 'vacio', sinNada
      ? 'Este torneo aún no tiene partidos.<br>Pulsa <b>🎰 Ruleta</b> arriba para sortear el primero, o <b>+ Añadir partido</b> para montarlo a mano.'
      : 'No hay partidos en esta vista 👀'));
    return;
  }

  const porJornada = {};
  liga.forEach(p => { (porJornada[p.jornada] = porJornada[p.jornada] || []).push(p); });

  Object.keys(porJornada).sort((a, b) => a - b).forEach(j => {
    const partidos = porJornada[j];
    const esActual = Number(j) === jornadaEnCurso;
    const completa = partidos.every(p => p.jugado);

    const bloque = el('div', 'jornada' + (esActual ? ' en-curso' : '') + (completa ? ' completa' : ''));
    bloque.appendChild(el('div', 'cabecera-jornada',
      `<span class="num">${j}</span>
       <span class="etiqueta">Jornada</span>
       ${esActual ? '<span class="estado">en curso</span>' : ''}
       ${completa ? '<span class="estado hecho">completa ✅</span>' : ''}`));

    partidos.forEach(p => bloque.appendChild(filaDePartido(p)));
    caja.appendChild(bloque);
  });

  if (eliminatorias.length) {
    const bloque = el('div', 'jornada');
    bloque.appendChild(el('div', 'cabecera-jornada',
      `<span class="num">🏟️</span><span class="etiqueta">Eliminatorias</span>`));
    eliminatorias.forEach(p => bloque.appendChild(filaDePartido(p)));
    caja.appendChild(bloque);
  }

  if (amistosos.length) {
    const bloque = el('div', 'jornada');
    bloque.appendChild(el('div', 'cabecera-jornada',
      `<span class="num">🤝</span><span class="etiqueta">Amistosos</span><span class="estado hecho">no cuentan</span>`));
    amistosos.forEach(p => bloque.appendChild(filaDePartido(p)));
    caja.appendChild(bloque);
  }
}

/* ------------------------------------------- añadir un partido nuevo */
function abrirModalNuevoPartido() {
  const local = $('#np-local'), visit = $('#np-visitante');
  local.innerHTML = ''; visit.innerHTML = '';

  torneoActual.jugadores.forEach(j => {
    const o1 = el('option', null, `${j.emoji} ${j.nombre}`); o1.value = j.id;
    local.appendChild(o1);
    const o2 = el('option', null, `${j.emoji} ${j.nombre}`); o2.value = j.id;
    visit.appendChild(o2);
  });

  // Por defecto: los dos primeros jugadores (distintos)
  if (torneoActual.jugadores.length > 1) {
    local.value = torneoActual.jugadores[0].id;
    visit.value = torneoActual.jugadores[1].id;
  }

  // Jornada por defecto: la primera que aún no esté completa
  $('#np-jornada').value = jornadaSugerida(torneoActual);

  $('#np-tipo').value = 'liga';
  actualizarTipoPartido();
  $('#modal-nuevo').hidden = false;
}

function actualizarTipoPartido() {
  $('#np-jornada-caja').hidden = $('#np-tipo').value === 'amistoso';
}

function cerrarModalNuevo() {
  $('#modal-nuevo').hidden = true;
}

async function guardarNuevoPartido() {
  const localId = $('#np-local').value;
  const visitanteId = $('#np-visitante').value;
  const tipo = $('#np-tipo').value;

  if (!localId || !visitanteId) { avisar('Elige los dos jugadores 👥', true); return; }
  if (localId === visitanteId) { avisar('Un jugador no puede jugar contra sí mismo 😅', true); return; }

  const nuevo = {
    id: nuevoId('p'),
    fase: tipo === 'amistoso' ? 'amistoso' : 'liga',
    jornada: tipo === 'amistoso' ? null : Math.max(1, Number($('#np-jornada').value) || 1),
    localId, visitanteId,
    golesLocal: 0, golesVisitante: 0,
    jugado: false, goles: [], stats: null, fecha: null
  };

  // No dejar crear el mismo partido dos veces en la misma jornada
  const repetido = torneoActual.partidos.some(p =>
    p.fase === nuevo.fase && p.jornada === nuevo.jornada &&
    ((p.localId === localId && p.visitanteId === visitanteId) ||
     (p.localId === visitanteId && p.visitanteId === localId)));

  if (repetido) { avisar('Ese partido ya existe ahí 🤔', true); return; }

  torneoActual.partidos.push(nuevo);
  const boton = $('#np-guardar');
  boton.disabled = true;
  try {
    // Solo se guarda el partido nuevo (no todo el torneo): así no se pisa nada de los demás
    await Store.guardarPartido(torneoActual.id, nuevo);
    cerrarModalNuevo();
    pintarTodoPartidos();
    avisar(tipo === 'amistoso'
      ? 'Amistoso añadido 🤝'
      : 'Partido añadido a la jornada ' + nuevo.jornada + ' ✅');
  } catch (e) {
    torneoActual.partidos.pop();
    console.error(e);
    avisar('No se pudo añadir: ' + e.message, true);
  } finally {
    boton.disabled = false;
  }
}

/* ------------------------------------------------------------- eventos */
function engancharPartidos() {
  $$('[data-filtro]').forEach(t => {
    t.onclick = () => {
      filtroPartidos = t.dataset.filtro;
      $$('[data-filtro]').forEach(x => x.classList.toggle('activo', x === t));
      pintarLista();
    };
  });

  engancharModal();

  // Añadir partido (de liga o amistoso)
  $('#btn-nuevo-partido').onclick = abrirModalNuevoPartido;
  $('#np-tipo').onchange = actualizarTipoPartido;
  $('#np-guardar').onclick = guardarNuevoPartido;
  $('#np-cancelar').onclick = cerrarModalNuevo;
  $('#modal-nuevo').onclick = (e) => {
    if (e.target.id === 'modal-nuevo') cerrarModalNuevo();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal-nuevo').hidden) cerrarModalNuevo();
  });

  engancharActualizar(() => {
    torneoActual = Store.torneo(torneoActual.id);
    configurarComun(torneoActual, () => pintarTodoPartidos());
    pintarNombreTorneo(torneoActual);
    pintarTodoPartidos();
  });
}

document.addEventListener('DOMContentLoaded', arrancarPartidos);

/* Al entrar o salir del candado, la lista se repinta: los botones de cada
   partido cambian entre "Apuntar" y "🔑 entrar" */
document.addEventListener('candado-cambiado', () => {
  if (torneoActual) pintarTodoPartidos();
});
