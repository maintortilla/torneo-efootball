/* ==========================================================================
   PANTALLA: CLASIFICACIÓN
   Resumen + tabla de clasificación + eliminatorias + últimos resultados.
   El torneo viene en la dirección (?torneo=...) o del último que se usó.
   ========================================================================== */

let torneoActual = null;

async function arrancarClasificacion() {
  /* Dos bloques separados a propósito: si falla la CONEXIÓN se dice eso, y si
     falla el DIBUJADO se dice eso. Antes todo iba junto y cualquier error
     acababa contando "no se pudo conectar con la nube" (así se escondían los
     fallos de verdad). */
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

    // Botón de actualizar: vuelve a leer la nube y repinta (sin recargar la página)
    engancharActualizar(() => {
      torneoActual = Store.torneo(torneoActual.id);
      configurarComun(torneoActual, () => pintarTodo());
      pintarNombreTorneo(torneoActual);
      pintarTodo();
    });

    // Aviso si venimos de crear un torneo
    const creado = new URLSearchParams(window.location.search).get('creado');
    if (creado) {
      avisar(`Torneo "${creado}" creado 🎉 Sortea la primera jornada con la ruleta 🎰`, false, 6000);
      window.history.replaceState({}, '', 'clasificacion.html?torneo=' + encodeURIComponent(torneoActual.id));
    }
  } catch (e) {
    console.error('Fallo al dibujar la clasificación:', e);
    avisar('La página ha fallado al dibujarse: ' + e.message, true, 6000);
  }
  window.__listo = true;
}

function pintarTodo() {
  pintarResumen();
  pintarClasificacion();
  pintarEliminatorias();
  pintarCaraACara();
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

  // En la barra de arriba se ve cuántos jugadores tiene el torneo
  const nJugadores = torneoActual.jugadores.length;
  $('#badge-jornada').textContent = nJugadores + (nJugadores === 1 ? ' jugador' : ' jugadores');

  const caja = $('#resumen');
  caja.innerHTML = '';
  const datos = [
    { etiqueta: 'Partidos jugados', valor: jugados.length + '/' + total, color: 1,   // verde: lo hecho
      extra: jornadaActual
        ? `Jornada ${jornadaActual} en juego · ${ligaPendiente.length} pendientes`
        : (pendientes.length ? 'Quedan las eliminatorias' : 'Liguilla terminada') },
    { etiqueta: 'Goles totales', valor: goles, extra: media + ' por partido', color: 2 },  // ámbar: los goles
    { etiqueta: 'Jugadores', valor: torneoActual.jugadores.length, extra: 'en el torneo', color: 3 },  // azul
    { etiqueta: 'Mayor goleada', valor: goleada ? goleada.dif + ' de dif.' : '—', extra: textoGoleada, color: 4 }  // lila
  ];

  datos.forEach(d => {
    caja.appendChild(el('div', 'dato dato-col-' + d.color,
      `<span class="etiqueta">${d.etiqueta}</span>
       <span class="valor">${d.valor}</span>
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
        <th data-ayuda="Puesto en la tabla (1º es el primero)">#</th>
        <th class="nombre">Jugador</th>
        <th data-ayuda="Partidos jugados">PJ</th>
        <th data-ayuda="Partidos ganados">G</th>
        <th data-ayuda="Partidos empatados">E</th>
        <th data-ayuda="Partidos perdidos">P</th>
        <th data-ayuda="Goles a favor: los que ha metido">GF</th>
        <th data-ayuda="Goles en contra: los que le han metido">GC</th>
        <th data-ayuda="Diferencia de goles (a favor menos en contra)">DG</th>
        <th data-ayuda="Puntos">PTS</th>
        <th data-ayuda="Sus últimos resultados, el más reciente a la derecha">Forma</th>
      </tr>
    </thead>
    <tbody></tbody>`;

  const cuerpo = t.querySelector('tbody');
  const MEDALLAS = ['🥇', '🥈', '🥉'];      // insignias del podio (1º, 2º y 3º)

  tabla.forEach((f, i) => {
    const clasifica = i < nClasifican;
    const medalla = MEDALLAS[i];

    const clases = [clasifica ? 'clasifica' : 'fuera'];
    if (medalla) clases.push('podio', 'podio-' + (i + 1));

    const tr = el('tr', clases.join(' '));
    tr.innerHTML = `
      <td class="pos"${medalla ? ` title="${i + 1}º puesto"` : ''}>${medalla ? `<span class="medalla">${medalla}</span>` : (i + 1)}</td>
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

/* ------------------------------------------- cara a cara (dos jugadores) */
function pintarCaraACara() {
  const selA = $('#cara-a');
  const selB = $('#cara-b');
  const caja = $('#lista-cara');
  if (!selA || !selB || !caja) return;

  const etiqueta = $('#etiqueta-cara');
  const jugadores = torneoActual.jugadores || [];
  const controles = $('#cara-controles');

  /* Torneo recién creado (sin ningún partido jugado): no hay nada que comparar,
     así que no se ponen dos jugadores "puestos" de mentira. */
  if (!(torneoActual.partidos || []).some(p => p.jugado)) {
    if (controles) controles.hidden = true;
    etiqueta.textContent = 'todavía nada';
    caja.innerHTML = '';
    caja.appendChild(el('div', 'vacio', 'Aparecerá en cuanto juguéis algún partido.'));
    return;
  }
  if (controles) controles.hidden = false;

  // Los desplegables se rellenan solo la primera vez (o si cambia el torneo)
  if (selA.options.length !== jugadores.length) {
    const antesA = selA.value;
    const antesB = selB.value;
    selA.innerHTML = '';
    selB.innerHTML = '';
    jugadores.forEach(j => {
      const o1 = el('option', null, `${j.emoji} ${j.nombre}`); o1.value = j.id; selA.appendChild(o1);
      const o2 = el('option', null, `${j.emoji} ${j.nombre}`); o2.value = j.id; selB.appendChild(o2);
    });
    const existe = id => jugadores.some(j => j.id === id);
    selA.value = existe(antesA) ? antesA : (jugadores[0] || {}).id;

    // Por defecto, el segundo será alguien con quien YA haya jugado el primero
    // (así el panel enseña un cara a cara de verdad desde el primer momento)
    if (!existe(antesB) || antesB === selA.value) {
      const yaJugo = otro => (torneoActual.partidos || []).some(p => p.jugado &&
        ((p.localId === selA.value && p.visitanteId === otro) ||
         (p.visitanteId === selA.value && p.localId === otro)));
      const rival = jugadores.find(j => j.id !== selA.value && yaJugo(j.id));
      selB.value = (rival || jugadores.find(j => j.id !== selA.value) || {}).id;
    }
  }

  caja.innerHTML = '';

  if (jugadores.length < 2) {
    etiqueta.textContent = '—';
    caja.appendChild(el('div', 'vacio', 'Hacen falta al menos 2 jugadores.'));
    return;
  }

  if (selA.value === selB.value) {
    etiqueta.textContent = 'elige dos distintos';
    caja.appendChild(el('div', 'vacio', 'Elige dos jugadores diferentes 🙂'));
    return;
  }

  const A = jugador(torneoActual, selA.value);
  const B = jugador(torneoActual, selB.value);
  const r = caraACara(torneoActual, A.id, B.id);

  etiqueta.textContent = r.total ? r.total + (r.total === 1 ? ' partido' : ' partidos') : 'sin jugar aún';

  if (!r.total) {
    caja.appendChild(el('div', 'vacio',
      `Todavía no se han enfrentado ${A.emoji} ${A.nombre} y ${B.emoji} ${B.nombre} 🥊`));
    return;
  }

  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

  caja.appendChild(el('div', 'cara-resumen',
    `<span class="cara-lado">
       <b>${A.emoji} ${A.nombre}</b>
       <span class="cara-linea">${plural(r.ganaA, 'victoria', 'victorias')}</span>
       <span class="cara-goles">${plural(r.golesA, 'gol', 'goles')}</span>
     </span>
     <span class="cara-centro">${plural(r.empates, 'empate', 'empates')}</span>
     <span class="cara-lado der">
       <b>${B.emoji} ${B.nombre}</b>
       <span class="cara-linea">${plural(r.ganaB, 'victoria', 'victorias')}</span>
       <span class="cara-goles">${plural(r.golesB, 'gol', 'goles')}</span>
     </span>`));

  r.partidos.forEach(p => {
    const local = jugador(torneoActual, p.localId);
    const visit = jugador(torneoActual, p.visitanteId);
    caja.appendChild(el('div', 'cara-fila',
      `<span class="quien">${local.emoji} ${local.nombre}</span>
       <span class="marcador-mini">${p.golesLocal} - ${p.golesVisitante}</span>
       <span class="quien der">${visit.emoji} ${visit.nombre}</span>`));
  });
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

  /* Torneo recién creado (sin ningún partido jugado): no se inventan cruces.
     Solo se enseña lo que ya está jugado de verdad. */
  if (!torneoActual.partidos.some(p => p.jugado)) {
    etiqueta.textContent = 'todavía nada';
    caja.appendChild(el('div', 'vacio', 'Aparecerán en cuanto juguéis algún partido.'));
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
      `<span>ℹ️</span><span>Quedan <b>${pendientes}</b> ${pendientes === 1 ? 'partido' : 'partidos'} de liguilla: esto es cómo quedarían los cruces <b>si acabara hoy</b>.</span>`));
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

  /* El panel entero se esconde hasta que haya algo que enseñar: así, en un
     torneo recién creado, no aparece un hueco con "todavía no hay resultados".
     En cuanto se juega el primer partido, sale solo. */
  const panel = $('#panel-ultimos');
  if (panel) panel.hidden = !jugados.length;
  if (!jugados.length) return;

  jugados.forEach(p => caja.appendChild(filaDePartido(p)));
}

/* ------------------------------------------------------------- eventos */
function engancharIndex() {
  engancharModal();

  // Cara a cara: al cambiar cualquiera de los dos jugadores, se repinta
  const selA = $('#cara-a');
  const selB = $('#cara-b');
  if (selA) selA.onchange = pintarCaraACara;
  if (selB) selB.onchange = pintarCaraACara;
  // (El botón de actualizar lo engancha arrancarClasificacion con engancharActualizar)
}

document.addEventListener('DOMContentLoaded', arrancarClasificacion);

/* Al entrar o salir del candado, se repinta (los botones de los últimos
   resultados cambian entre "Apuntar" y "🔑 entrar") */
document.addEventListener('candado-cambiado', () => {
  if (torneoActual) pintarTodo();
});
