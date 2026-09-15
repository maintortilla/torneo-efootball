/* ==========================================================================
   PANTALLA: CLASIFICACIÓN
   Resumen + tabla de clasificación + eliminatorias + últimos resultados.
   El torneo viene en la dirección (?torneo=...) o del último que se usó.
   ========================================================================== */

let torneoActual = null;

async function arrancarClasificacion() {
  try {
    const torneos = await Store.iniciar();

    const idInicial = elegirTorneoInicial(torneos);
    if (!idInicial) {   // no hay torneos: a la lista para crear uno
      window.location.href = 'index.html';
      return;
    }

    torneoActual = Store.torneo(idInicial);
    recordarTorneo(torneoActual.id);

    configurarComun(torneoActual, () => pintarTodo());
    pintarModoDatos();
    pintarNombreTorneo(torneoActual);
    enlacesConTorneo(torneoActual.id);
    pintarTodo();
    engancharIndex();

    // Aviso si venimos de crear un torneo
    const creado = new URLSearchParams(window.location.search).get('creado');
    if (creado) {
      avisar(`Torneo "${creado}" creado 🎉`, false, 6000);
      window.history.replaceState({}, '', 'clasificacion.html?torneo=' + encodeURIComponent(torneoActual.id));
    }
  } catch (e) {
    console.error(e);
    avisar('No se pudo conectar con la nube: ' + e.message, true);
  }
  window.__listo = true;
}

function pintarTodo() {
  pintarResumen();
  pintarClasificacion();
  pintarEliminatorias();
  pintarUltimos();
}

/* ------------------------------------------------------------- resumen */
function pintarResumen() {
  const jugados = torneoActual.partidos.filter(p => p.jugado);
  const total = torneoActual.partidos.filter(p => p.fase === 'liga').length;
  const goles = jugados.reduce((s, p) => s + p.golesLocal + p.golesVisitante, 0);
  const media = jugados.length ? (goles / jugados.length).toFixed(1) : '0.0';

  let goleada = null;
  jugados.forEach(p => {
    const dif = Math.abs(p.golesLocal - p.golesVisitante);
    if (!goleada || dif > goleada.dif) goleada = { dif, p };
  });

  let textoGoleada = 'Todavía sin partidos';
  if (goleada) {
    const l = jugador(torneoActual, goleada.p.localId);
    const v = jugador(torneoActual, goleada.p.visitanteId);
    textoGoleada = `${l.nombre} ${goleada.p.golesLocal}-${goleada.p.golesVisitante} ${v.nombre}`;
  }

  const pendientes = torneoActual.partidos.filter(p => !p.jugado);
  const ligaPendiente = pendientes.filter(p => p.fase === 'liga');
  const jornadaActual = ligaPendiente.length ? ligaPendiente[0].jornada : null;
  $('#badge-jornada').textContent = ligaPendiente.length
    ? `Jornada ${jornadaActual} en juego`
    : (pendientes.length ? 'Eliminatorias en juego' : 'Torneo terminado 🏁');

  const caja = $('#resumen');
  caja.innerHTML = '';
  const datos = [
    { etiqueta: 'Partidos jugados', valor: jugados.length + '/' + total, extra: ligaPendiente.length + ' de liguilla pendientes' },
    { etiqueta: 'Goles totales', valor: goles, extra: media + ' por partido', verde: true },
    { etiqueta: 'Jugadores', valor: torneoActual.jugadores.length, extra: (torneoActual.config.vueltas === 2 ? 'ida y vuelta' : 'una vuelta') },
    { etiqueta: 'Mayor goleada', valor: goleada ? goleada.dif + ' de dif.' : '—', extra: textoGoleada }
  ];

  datos.forEach(d => {
    caja.appendChild(el('div', 'dato',
      `<span class="etiqueta">${d.etiqueta}</span>
       <span class="valor${d.verde ? ' verde' : ''}">${d.valor}</span>
       <small>${d.extra}</small>`));
  });
}

/* ------------------------------------------------------- clasificación */
function pintarClasificacion() {
  const tabla = calcularClasificacion(torneoActual);
  const nClasifican = torneoActual.config.clasificados;
  const cfg = torneoActual.config;

  $('#aviso-clasificados').textContent =
    `${nClasifican} pasan a eliminatorias · ${cfg.puntosVictoria}/${cfg.puntosEmpate}/${cfg.puntosDerrota} pts`;

  const t = $('#tabla-clasificacion');
  t.innerHTML = `
    <thead>
      <tr>
        <th>#</th><th class="nombre">Jugador</th>
        <th title="Partidos jugados">PJ</th>
        <th title="Ganados">G</th>
        <th title="Empatados">E</th>
        <th title="Perdidos">P</th>
        <th title="Goles a favor">GF</th>
        <th title="Goles en contra">GC</th>
        <th title="Diferencia de goles">DG</th>
        <th title="Puntos">PTS</th>
        <th title="Últimos resultados">Forma</th>
      </tr>
    </thead>
    <tbody></tbody>`;

  const cuerpo = t.querySelector('tbody');

  tabla.forEach((f, i) => {
    const clasifica = i < nClasifican;
    const tr = el('tr', clasifica ? 'clasifica' : 'fuera');
    tr.innerHTML = `
      <td class="pos">${i + 1}</td>
      <td class="nombre jugador"><span class="emoji">${f.emoji}</span>${f.nombre}</td>
      <td>${f.pj}</td>
      <td>${f.pg}</td>
      <td>${f.pe}</td>
      <td>${f.pp}</td>
      <td>${f.gf}</td>
      <td>${f.gc}</td>
      <td class="${f.dg > 0 ? 'dg-pos' : f.dg < 0 ? 'dg-neg' : ''}">${f.dg > 0 ? '+' + f.dg : f.dg}</td>
      <td class="pts">${f.pts}</td>
      <td>${formaHTML(f.forma)}</td>`;
    cuerpo.appendChild(tr);
  });
}

function formaHTML(forma) {
  const ultimos = forma.slice(-5);
  if (!ultimos.length) return '<span class="forma">—</span>';
  return '<span class="forma">' + ultimos.map(r => {
    const clase = r === 'G' ? 'g' : r === 'P' ? 'p' : '';
    return `<span class="${clase}">${r}</span>`;
  }).join('') + '</span>';
}

/* ------------------------------------------- eliminatorias */
function pintarEliminatorias() {
  const caja = $('#lista-eliminatorias');
  caja.innerHTML = '';
  const etiqueta = $('#etiqueta-eliminatorias');
  const FASES_FINALES = ['semifinal', 'final', 'tercer_puesto'];
  const generadas = torneoActual.partidos.filter(p => FASES_FINALES.includes(p.fase));

  if (generadas.length) {
    etiqueta.textContent = 'en juego';

    const final = generadas.find(p => p.fase === 'final');
    if (final && final.jugado) {
      const campeon = jugador(torneoActual, ganadorDe(torneoActual, final));
      caja.appendChild(el('div', 'aviso',
        `<span>🏆</span><span>Campeón del torneo: <b>${campeon.emoji} ${campeon.nombre}</b></span>`));
    }

    generadas.forEach(p => caja.appendChild(filaDePartido(p)));
    return;
  }

  etiqueta.textContent = 'si acabara hoy';

  const clasificacion = calcularClasificacion(torneoActual);
  const cruces = generarEliminatorias(clasificacion, torneoActual.config);
  const pendientes = torneoActual.partidos.filter(p => !p.jugado && p.fase === 'liga').length;

  if (!cruces.length) {
    caja.appendChild(el('div', 'vacio', 'Cuando haya jugadores en la liguilla aparecerán aquí los cruces.'));
    return;
  }

  if (pendientes) {
    caja.appendChild(el('div', 'aviso',
      `<span>ℹ️</span><span>Quedan <b>${pendientes}</b> partidos de liguilla: esto es cómo quedarían los cruces <b>si acabara hoy</b>.</span>`));
  }

  cruces.forEach(c => {
    const local = jugador(torneoActual, c.localId);
    const visit = jugador(torneoActual, c.visitanteId);
    const fila = el('div', 'partido-fila pendiente');
    fila.innerHTML = `
      <span class="quien">${local.emoji} ${local.nombre}</span>
      <span class="marcador-mini pend">${c.fase}</span>
      <span class="quien der">${visit.nombre} ${visit.emoji}</span>`;
    caja.appendChild(fila);
  });
}

/* ---------------------------------------------------- últimos resultados */
function pintarUltimos() {
  const caja = $('#lista-ultimos');
  caja.innerHTML = '';

  const jugados = torneoActual.partidos.filter(p => p.jugado).slice(-5).reverse();

  if (!jugados.length) {
    caja.appendChild(el('div', 'vacio', 'Todavía no hay resultados apuntados.'));
    return;
  }

  jugados.forEach(p => caja.appendChild(filaDePartido(p)));
}

/* ------------------------------------------------------------- eventos */
function engancharIndex() {
  engancharModal();
  engancharRefrescar(() => {
    torneoActual = Store.torneo(torneoActual.id);
    configurarComun(torneoActual, () => pintarTodo());
    pintarNombreTorneo(torneoActual);
    pintarTodo();
  });
}

document.addEventListener('DOMContentLoaded', arrancarClasificacion);
