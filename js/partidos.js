/* ==========================================================================
   PANTALLA: PARTIDOS
   La lista completa de partidos del torneo: filtros, agrupados por jornada y
   el botón de apuntar/editar en cada uno. Las eliminatorias salen al final.
   ========================================================================== */

let torneoActual = null;
let filtroPartidos = 'todos';

async function arrancarPartidos() {
  try {
    const torneos = await Store.iniciar();
    torneoActual = Store.torneo(torneos[0].id);

    configurarComun(torneoActual, () => pintarTodoPartidos());
    pintarSelectorTorneo(torneos);
    pintarModoDatos();
    pintarTodoPartidos();
    engancharPartidos();
  } catch (e) {
    console.error(e);
    avisar('No se pudo conectar con la nube: ' + e.message, true);
  }
  window.__listo = true;
}

function pintarSelectorTorneo(torneos) {
  const sel = $('#selector-torneo');
  sel.innerHTML = '';
  torneos.forEach(t => {
    const o = el('option', null, t.nombre + (t.estado === 'finalizado' ? ' (finalizado)' : ''));
    o.value = t.id;
    if (t.id === torneoActual.id) o.selected = true;
    sel.appendChild(o);
  });
  const nuevo = el('option', null, '＋ Crear torneo nuevo…');
  nuevo.value = '__nuevo__';
  sel.appendChild(nuevo);
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

  const estado = estadoDeFases(torneoActual);
  const textosEstado = {
    liga: `${estado.pendientes} partidos para acabar la liguilla`,
    generar_semis: 'Liguilla terminada: toca generar semifinales',
    semis: 'Semifinales en juego',
    generar_final: 'Final lista para generar',
    final: 'Final en juego',
    terminado: 'Torneo terminado 🏆'
  };

  const caja = $('#resumen-partidos');
  caja.innerHTML = '';
  [
    { etiqueta: 'Partidos jugados', valor: jugados + '/' + liga.length, extra: pendientes + ' pendientes' },
    { etiqueta: 'Goles totales', valor: goles, extra: media + ' por partido', verde: true },
    { etiqueta: 'Estado', valor: '', extra: textosEstado[estado.paso] || '—', textoLargo: true }
  ].forEach(d => {
    const div = el('div', 'dato',
      `<span class="etiqueta">${d.etiqueta}</span>
       ${d.textoLargo
          ? `<small style="font-size:15px;color:var(--texto);white-space:normal">${d.extra}</small>`
          : `<span class="valor${d.verde ? ' verde' : ''}">${d.valor}</span><small>${d.extra}</small>`}`);
    caja.appendChild(div);
  });
}

function pintarProgreso() {
  const liga = torneoActual.partidos.filter(p => p.fase === 'liga');
  const jugados = liga.filter(p => p.jugado).length;
  $('#progreso').textContent = liga.length ? `${jugados} de ${liga.length} jugados` : 'sin calendario';
}

/* -------------------------------------------------------------- la lista */
function pintarLista() {
  const caja = $('#lista-partidos');
  caja.innerHTML = '';

  let liga = torneoActual.partidos.filter(p => p.fase === 'liga');
  let eliminatorias = torneoActual.partidos.filter(p => p.fase !== 'liga');

  const pendientes = liga.filter(p => !p.jugado);
  const jornadaEnCurso = pendientes.length ? pendientes[0].jornada : null;

  if (filtroPartidos === 'pendientes') {
    liga = liga.filter(p => !p.jugado);
    eliminatorias = eliminatorias.filter(p => !p.jugado);
  } else if (filtroPartidos === 'jugados') {
    liga = liga.filter(p => p.jugado);
    eliminatorias = eliminatorias.filter(p => p.jugado);
  } else if (filtroPartidos === 'proximos') {
    liga = liga.filter(p => p.jornada === jornadaEnCurso && !p.jugado);
    eliminatorias = [];
  }

  $('#contador-partidos').textContent = (liga.length + eliminatorias.length) + ' en pantalla';

  if (!liga.length && !eliminatorias.length) {
    caja.appendChild(el('div', 'vacio', 'No hay partidos en esta vista 👀'));
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
}

/* ------------------------------------------------------------- eventos */
function engancharPartidos() {
  $('#selector-torneo').onchange = (e) => {
    if (e.target.value === '__nuevo__') {
      window.location.href = 'ajustes.html?nuevo=1';
      return;
    }
    torneoActual = Store.torneo(e.target.value);
    configurarComun(torneoActual, () => pintarTodoPartidos());
    pintarTodoPartidos();
  };

  $$('[data-filtro]').forEach(t => {
    t.onclick = () => {
      filtroPartidos = t.dataset.filtro;
      $$('[data-filtro]').forEach(x => x.classList.toggle('activo', x === t));
      pintarLista();
    };
  });

  engancharModal();
  engancharRefrescar(() => {
    torneoActual = Store.torneo(torneoActual.id);
    configurarComun(torneoActual, () => pintarTodoPartidos());
    pintarSelectorTorneo(Store.cache);
    pintarTodoPartidos();
  });
}

document.addEventListener('DOMContentLoaded', arrancarPartidos);
