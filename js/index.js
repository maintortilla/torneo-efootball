/* ==========================================================================
   PANTALLA: PORTADA / CUADRO DE MANDO
   Clasificación + partidos + pichichi, todo a la vista en PC.
   Todos los números salen del modelo (js/modelo.js): aquí solo se pintan.
   ========================================================================== */

let torneoActual;
let filtroPartidos = 'todos';

function arrancarIndex() {
  const torneos = Store.iniciar();
  torneoActual = Store.torneo(torneos[0].id);

  pintarSelectorTorneo(torneos);
  pintarTodo();
  engancharIndex();
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
}

function pintarTodo() {
  pintarResumen();
  pintarClasificacion();
  pintarPartidos();
  pintarGoleadores();
  pintarTipos();
}

/* ------------------------------------------------------------- resumen */
function pintarResumen() {
  const jugados = torneoActual.partidos.filter(p => p.jugado);
  const total = torneoActual.partidos.length;
  const goles = jugados.reduce((s, p) => s + p.golesLocal + p.golesVisitante, 0);
  const media = jugados.length ? (goles / jugados.length).toFixed(1) : '0.0';

  // Partido más abultado
  let goleada = null;
  jugados.forEach(p => {
    const dif = Math.abs(p.golesLocal - p.golesVisitante);
    if (!goleada || dif > goleada.dif) goleada = { dif, p };
  });

  let textoGoleada = '—';
  if (goleada) {
    const l = jugador(torneoActual, goleada.p.localId);
    const v = jugador(torneoActual, goleada.p.visitanteId);
    textoGoleada = `${l.nombre} ${goleada.p.golesLocal}-${goleada.p.golesVisitante} ${v.nombre}`;
  }

  // Jornada actual: la primera con partidos pendientes
  const pendientes = torneoActual.partidos.filter(p => !p.jugado && p.fase === 'liga');
  const jornadaActual = pendientes.length ? pendientes[0].jornada : null;
  const badge = $('#badge-jornada');
  badge.textContent = pendientes.length
    ? `Jornada ${jornadaActual} en juego`
    : 'Liguilla terminada 🏁';

  const caja = $('#resumen');
  caja.innerHTML = '';
  const datos = [
    { etiqueta: 'Partidos jugados', valor: jugados.length + '/' + total, extra: pendientes.length + ' pendientes' },
    { etiqueta: 'Goles totales', valor: goles, extra: media + ' por partido', verde: true },
    { etiqueta: 'Jugadores', valor: torneoActual.jugadores.length, extra: (torneoActual.config.vueltas === 2 ? 'ida y vuelta' : 'una vuelta') },
    { etiqueta: 'Mayor goleada', valor: goleada ? goleada.dif + ' de dif.' : '—', extra: textoGoleada }
  ];

  datos.forEach(d => {
    const div = el('div', 'dato',
      `<span class="etiqueta">${d.etiqueta}</span>
       <span class="valor${d.verde ? ' verde' : ''}">${d.valor}</span>
       <small>${d.extra}</small>`);
    caja.appendChild(div);
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

/* ------------------------------------------------------------ partidos */
function pintarPartidos() {
  const caja = $('#lista-partidos');
  caja.innerHTML = '';

  let lista = torneoActual.partidos.filter(p => p.fase === 'liga');
  if (filtroPartidos === 'pendientes') lista = lista.filter(p => !p.jugado);
  if (filtroPartidos === 'jugados') lista = lista.filter(p => p.jugado);

  $('#contador-partidos').textContent =
    lista.length + (filtroPartidos === 'todos' ? ' partidos' : ' mostrados');

  if (!lista.length) {
    caja.appendChild(el('div', 'vacio', 'No hay partidos en esta vista 👀'));
    return;
  }

  // Agrupados por jornada
  const porJornada = {};
  lista.forEach(p => { (porJornada[p.jornada] = porJornada[p.jornada] || []).push(p); });

  Object.keys(porJornada).sort((a, b) => a - b).forEach(j => {
    const cab = el('div', 'cabecera-jornada', `Jornada ${j}`);
    caja.appendChild(cab);

    porJornada[j].forEach(p => {
      const local = jugador(torneoActual, p.localId);
      const visit = jugador(torneoActual, p.visitanteId);

      const fila = el('div', 'partido-fila ' + (p.jugado ? 'jugado' : 'pendiente'));

      const ganaLocal = p.jugado && p.golesLocal > p.golesVisitante;
      const ganaVisit = p.jugado && p.golesVisitante > p.golesLocal;

      fila.innerHTML = `
        <span class="quien ${ganaLocal ? 'gana' : ''}">${local.emoji} ${local.nombre}</span>
        <span class="marcador-mini ${p.jugado ? '' : 'pend'}">
          ${p.jugado ? p.golesLocal + ' - ' + p.golesVisitante : 'vs'}
        </span>
        <span class="quien der ${ganaVisit ? 'gana' : ''}">${visit.nombre} ${visit.emoji}</span>`;

      const boton = el('button', 'btn-mini-ir', p.jugado ? 'Editar' : 'Apuntar');
      boton.onclick = () => { window.location.href = 'acta.html?partido=' + p.id; };
      fila.appendChild(boton);

      caja.appendChild(fila);
    });
  });
}

/* --------------------------------------------------------- goleadores */
function pintarGoleadores() {
  const caja = $('#lista-goleadores');
  caja.innerHTML = '';

  const goleadores = calcularGoleadores(torneoActual);
  if (!goleadores.length) {
    caja.appendChild(el('div', 'vacio', 'Todavía no hay goles detallados. Se apuntan al meter el resultado ⚽'));
    return;
  }

  const max = goleadores[0].goles;
  goleadores.slice(0, 10).forEach((g, i) => {
    const tipos = Object.entries(g.tipos).map(([t, n]) => {
      const def = tipoGol(torneoActual, t);
      return `${def.emoji} ${def.nombre} ×${n}`;
    }).join(' · ');

    const div = el('div', 'goleador' + (i === 0 ? ' primero' : ''),
      `<span class="puesto">${i + 1}</span>
       <span>
         <span class="nombre-fut">${g.nombre}</span>
         <span class="detalle">${tipos}</span>
         <span class="barra"><i style="width:${Math.round(g.goles / max * 100)}%"></i></span>
       </span>
       <span class="cifra">${g.goles}</span>`);
    caja.appendChild(div);
  });
}

/* ------------------------------------------------------- goles por tipo */
function pintarTipos() {
  const caja = $('#lista-tipos');
  caja.innerHTML = '';

  const totales = {};
  torneoActual.partidos.forEach(p => (p.goles || []).forEach(g => {
    totales[g.tipoId] = (totales[g.tipoId] || 0) + 1;
  }));

  const filas = Object.entries(totales).sort((a, b) => b[1] - a[1]);
  if (!filas.length) {
    caja.appendChild(el('div', 'vacio', 'Sin datos todavía.'));
    return;
  }

  const total = filas.reduce((s, f) => s + f[1], 0);
  filas.forEach(([id, n]) => {
    const def = tipoGol(torneoActual, id);
    const fila = el('div', 'goleador',
      `<span class="puesto">${def.emoji}</span>
       <span>
         <span class="nombre-fut">${def.nombre}</span>
         <span class="detalle">${Math.round(n / total * 100)}% de los goles</span>
         <span class="barra"><i style="width:${Math.round(n / total * 100)}%"></i></span>
       </span>
       <span class="cifra">${n}</span>`);
    caja.appendChild(fila);
  });
}

/* ------------------------------------------------------------- eventos */
function engancharIndex() {
  $('#selector-torneo').onchange = (e) => {
    torneoActual = Store.torneo(e.target.value);
    pintarTodo();
  };

  $$('[data-filtro]').forEach(t => {
    t.onclick = () => {
      filtroPartidos = t.dataset.filtro;
      $$('[data-filtro]').forEach(x => x.classList.toggle('activo', x === t));
      pintarPartidos();
    };
  });
}

document.addEventListener('DOMContentLoaded', arrancarIndex);
