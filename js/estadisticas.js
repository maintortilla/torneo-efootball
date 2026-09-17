/* ==========================================================================
   PANTALLA: ESTADÍSTICAS
   Todo se calcula con los resultados ya apuntados (funciones del motor):
   fichas por jugador, rachas, gráfica de puntos, goleadas, partidos locos
   y el cara a cara de todos contra todos.
   ========================================================================== */

let torneoActual = null;

async function arrancarEstadisticas() {
  let torneos;
  try {
    await arrancarCandado();
    torneos = await Store.iniciar();
  } catch (e) {
    console.error(e);
    avisar('No se pudo conectar con la nube: ' + e.message, true);
    window.__listo = true;
    return;
  }

  try {
    const idInicial = elegirTorneoInicial(torneos);
    if (!idInicial) { window.location.href = 'index.html'; return; }

    torneoActual = Store.torneo(idInicial);
    recordarTorneo(torneoActual.id);

    configurarComun(torneoActual, () => pintarPantallaEstadisticas());
    pintarModoDatos();
    pintarNombreTorneo(torneoActual);
    enlacesConTorneo(torneoActual.id);
    pintarPantallaEstadisticas();

    engancharActualizar(() => {
      torneoActual = Store.torneo(torneoActual.id);
      configurarComun(torneoActual, () => pintarPantallaEstadisticas());
      pintarNombreTorneo(torneoActual);
      pintarPantallaEstadisticas();
    });
  } catch (e) {
    console.error('Fallo al dibujar las estadísticas:', e);
    avisar('La página ha fallado al dibujarse: ' + e.message, true, 6000);
  }
  window.__listo = true;
}

/* ------------------------------------------------------------- pintado */
function pintarPantallaEstadisticas() {
  const hayDatos = (torneoActual.partidos || []).some(p => p.jugado);

  pintarResumenEstadisticas();
  pintarTablaEstadisticas();
  pintarGrafica();
  pintarRachas();
  pintarGoleadas();
  pintarLocos();
  pintarDuelos();

  // Los paneles de "lo que ha pasado" no salen si no ha pasado nada todavía
  ['panel-grafica', 'panel-rachas', 'panel-goleadas', 'panel-locos', 'panel-duelos']
    .forEach(id => {
      const p = document.getElementById(id);
      if (p) p.hidden = !hayDatos;
    });
}

function jugadores() { return torneoActual.jugadores || []; }

/* La ficha de un jugador en una línea de lista */
function lineaJugador(j, texto, valor, extra) {
  return el('div', 'estad-linea',
    `<span class="estad-quien">${j.emoji} ${j.nombre}</span>
     <span class="estad-texto">${texto}</span>
     ${valor !== undefined ? `<span class="estad-valor">${valor}</span>` : ''}
     ${extra ? `<span class="estad-extra">${extra}</span>` : ''}`);
}

function pintarResumenEstadisticas() {
  const caja = document.getElementById('resumen');
  caja.innerHTML = '';

  const jugados = (torneoActual.partidos || []).filter(p => p.jugado);
  const goles = jugados.reduce((s, p) => s + (Number(p.golesLocal) || 0) + (Number(p.golesVisitante) || 0), 0);
  const media = jugados.length ? (goles / jugados.length) : 0;
  const tabla = tablaEstadisticas(torneoActual).filter(t => t.jugados > 0);

  const masGoles = tabla.slice().sort((a, b) => b.golesFavor - a.golesFavor)[0];
  const menosEnca = tabla.slice().sort((a, b) => a.mediaContra - b.mediaContra)[0];

  [
    { etiqueta: 'Partidos jugados', valor: String(jugados.length), extra: 'en total', color: 1 },
    { etiqueta: 'Goles', valor: String(goles), extra: media.toFixed(1).replace('.', ',') + ' por partido', color: 2 },
    { etiqueta: 'Mejor ataque', valor: masGoles ? masGoles.emoji + ' ' + masGoles.nombre : '—',
      extra: masGoles ? masGoles.golesFavor + ' goles a favor' : 'sin datos', color: 3 },
    { etiqueta: 'Mejor defensa', valor: menosEnca ? menosEnca.emoji + ' ' + menosEnca.nombre : '—',
      extra: menosEnca ? menosEnca.golesContra + ' goles en contra' : 'sin datos', color: 4 }
  ].forEach(d => {
    caja.appendChild(el('div', 'dato dato-col-' + d.color,
      `<span class="etiqueta">${d.etiqueta}</span>
       <span class="valor" style="font-size:23px">${d.valor}</span>
       <small>${d.extra}</small>`));
  });
}

function pintarTablaEstadisticas() {
  const tabla = document.getElementById('tabla-estadisticas');
  const etiqueta = document.getElementById('etiqueta-tabla');
  tabla.innerHTML = '';

  const filas = tablaEstadisticas(torneoActual);
  const conDatos = filas.filter(f => f.jugados > 0);
  etiqueta.textContent = conDatos.length ? conDatos.length + ' con partidos' : 'sin partidos aún';

  const cabecera = el('thead', null,
    `<tr>
       <th class="nombre">Jugador</th>
       <th data-ayuda="Partidos jugados">PJ</th>
       <th data-ayuda="Partidos ganados">G</th>
       <th data-ayuda="Partidos empatados">E</th>
       <th data-ayuda="Partidos perdidos">P</th>
       <th data-ayuda="Goles a favor: los que ha metido">GF</th>
       <th data-ayuda="Goles en contra: los que le han metido">GC</th>
       <th data-ayuda="Diferencia de goles (a favor menos en contra)">DG</th>
       <th data-ayuda="Puntos">PTS</th>
       <th data-ayuda="Goles que mete por partido de media">Media a favor</th>
       <th data-ayuda="Goles que le meten por partido de media">Media en contra</th>
     </tr>`);
  tabla.appendChild(cabecera);

  const cuerpo = el('tbody');
  filas.forEach(f => {
    const tr = el('tr');
    if (!f.jugados) tr.className = 'fuera';
    const dg = f.diferencia > 0 ? '+' + f.diferencia : String(f.diferencia);
    const claseDg = f.diferencia > 0 ? 'dg-pos' : f.diferencia < 0 ? 'dg-neg' : '';
    tr.innerHTML = `
      <td class="jugador"><span class="emoji">${f.emoji || ''}</span>${f.nombre}</td>
      <td>${f.jugados}</td>
      <td>${f.ganados}</td>
      <td>${f.empatados}</td>
      <td>${f.perdidos}</td>
      <td>${f.golesFavor}</td>
      <td>${f.golesContra}</td>
      <td class="${claseDg}">${dg}</td>
      <td class="pts">${f.puntos}</td>
      <td>${f.mediaFavor.toFixed(1).replace('.', ',')}</td>
      <td>${f.mediaContra.toFixed(1).replace('.', ',')}</td>`;
    cuerpo.appendChild(tr);
  });
  tabla.appendChild(cuerpo);
}

/* --- La gráfica de puntos: una línea por jugador, en SVG --- */
function pintarGrafica() {
  const caja = document.getElementById('grafica');
  const etiqueta = document.getElementById('etiqueta-grafica');
  caja.innerHTML = '';

  const { maxJornada, serie } = puntosPorJornada(torneoActual);
  if (!maxJornada) {
    etiqueta.textContent = '—';
    caja.appendChild(el('div', 'vacio', 'Aparecerá cuando haya jornadas jugadas.'));
    return;
  }

  const lista = jugadores();
  const maxReal = Math.max(1, ...lista.map(j => Math.max(...(serie[j.id] || [0]))));
  // Se deja un poco de aire arriba para que el que va primero no quede pegado al borde
  const maxPuntos = Math.max(2, Math.ceil(maxReal * 1.12));
  etiqueta.textContent = 'hasta la jornada ' + maxJornada;

  // Lienzo
  const AN = 620, AL = 300, M = { arr: 26, aba: 34, izq: 34, der: 16 };
  const ancho = AN - M.izq - M.der, alto = AL - M.arr - M.aba;
  const x = i => M.izq + (maxJornada ? (i / maxJornada) * ancho : 0);
  const y = v => M.arr + alto - (v / maxPuntos) * alto;

  const svg = [];
  svg.push(`<svg viewBox="0 0 ${AN} ${AL}" class="grafica-svg" role="img"
                 aria-label="Puntos jornada a jornada">`);

  // Rejilla horizontal + etiquetas del eje
  const pasos = Math.min(5, maxPuntos);
  for (let k = 0; k <= pasos; k++) {
    const valor = Math.round((maxPuntos / pasos) * k);
    const yy = y(valor);
    svg.push(`<line x1="${M.izq}" y1="${yy}" x2="${AN - M.der}" y2="${yy}" class="grafica-rejilla"/>`);
    svg.push(`<text x="${M.izq - 8}" y="${yy + 4}" class="grafica-eje" text-anchor="end">${valor}</text>`);
  }

  // Etiquetas de jornada (sin amontonar si hay muchas)
  const salto = Math.ceil(maxJornada / 10);
  for (let j = 0; j <= maxJornada; j += salto) {
    svg.push(`<text x="${x(j)}" y="${AL - M.aba + 20}" class="grafica-eje" text-anchor="middle">${j}</text>`);
  }

  // Una línea por jugador
  lista.forEach(j => {
    const puntos = serie[j.id] || [0];
    const d = puntos.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    svg.push(`<path d="${d}" class="grafica-linea" style="stroke:${j.color || 'var(--neon)'}"/>`);
    puntos.forEach((v, i) => {
      svg.push(`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" class="grafica-punto"
                       style="fill:${j.color || 'var(--neon)'}"><title>${j.nombre}: ${v} puntos (jornada ${i})</title></circle>`);
    });
  });

  svg.push('</svg>');
  caja.appendChild(el('div', 'grafica-caja', svg.join('')));

  // Leyenda con los colores de cada jugador
  const leyenda = el('div', 'grafica-leyenda');
  lista.forEach(j => {
    const puntos = serie[j.id] || [0];
    leyenda.appendChild(el('span', 'grafica-clave',
      `<span class="grafica-color" style="background:${j.color || 'var(--neon)'}"></span>
       ${j.emoji} ${j.nombre} <b>${puntos[puntos.length - 1]}</b>`));
  });
  caja.appendChild(leyenda);
}

/* --- Rachas: quién va en racha, quién lleva más sin perder, mejor racha --- */
function pintarRachas() {
  const caja = document.getElementById('rachas');
  caja.innerHTML = '';

  const tabla = tablaEstadisticas(torneoActual).filter(t => t.jugados > 0);
  if (!tabla.length) {
    caja.appendChild(el('div', 'vacio', 'Todavía no hay partidos jugados.'));
    return;
  }

  const nombreRacha = r => {
    if (!r.tipo) return '—';
    const n = r.n;
    if (r.tipo === 'G') return n + (n === 1 ? ' victoria seguida' : ' victorias seguidas');
    if (r.tipo === 'E') return n + (n === 1 ? ' empate seguido' : ' empates seguidos');
    return n + (n === 1 ? ' derrota seguida' : ' derrotas seguidas');
  };

  // 1. El que va mejor ahora mismo (racha de victorias más larga)
  const enRacha = tabla.filter(t => t.racha.tipo === 'G').sort((a, b) => b.racha.n - a.racha.n)[0];
  caja.appendChild(lineaJugador(
    enRacha || { emoji: '—', nombre: 'Nadie' },
    enRacha ? 'va en racha 🔥' : 'nadie va en racha ahora mismo',
    enRacha ? nombreRacha(enRacha.racha) : ''));

  // 2. El que lleva más partidos sin perder
  const invicto = tabla.slice().sort((a, b) => b.sinPerder - a.sinPerder)[0];
  caja.appendChild(lineaJugador(
    invicto,
    'lleva más sin perder 🛡️',
    invicto.sinPerder + (invicto.sinPerder === 1 ? ' partido' : ' partidos')));

  // 3. La mejor racha del torneo
  const mejor = tabla.slice().sort((a, b) => b.mejorRacha - a.mejorRacha)[0];
  caja.appendChild(lineaJugador(
    mejor,
    'mejor racha del torneo ⚡',
    mejor.mejorRacha + (mejor.mejorRacha === 1 ? ' victoria seguida' : ' victorias seguidas')));

  // 4. El que está más flojo ahora (peor racha actual)
  const flojo = tabla.slice().sort((a, b) => {
    const peso = t => t.racha.tipo === 'P' ? t.racha.n : (t.racha.tipo === 'E' ? t.racha.n / 2 : 0);
    return peso(b) - peso(a);
  })[0];
  if (flojo && flojo.racha.tipo === 'P') {
    caja.appendChild(lineaJugador(flojo, 'va cuesta abajo 😬', nombreRacha(flojo.racha)));
  }
}

/* --- Goleadas y partidos locos --- */
function pintarGoleadas() {
  const caja = document.getElementById('goleadas');
  caja.innerHTML = '';
  const lista = mayoresGoleadas(torneoActual, 5);

  if (!lista.length) {
    caja.appendChild(el('div', 'vacio', 'Todavía no hay goleadas que contar.'));
    return;
  }
  lista.forEach((p, i) => caja.appendChild(filaDePartidoDeEstadistica(p, i + 1)));
}

function pintarLocos() {
  const caja = document.getElementById('locos');
  caja.innerHTML = '';
  const lista = partidosMasLocos(torneoActual, 5);

  if (!lista.length) {
    caja.appendChild(el('div', 'vacio', 'Todavía no hay partidos que contar.'));
    return;
  }
  lista.forEach((p, i) => caja.appendChild(filaDePartidoDeEstadistica(p, i + 1)));
}

function filaDePartidoDeEstadistica(p, puesto) {
  const local = jugador(torneoActual, p.localId);
  const visit = jugador(torneoActual, p.visitanteId);
  return el('div', 'estad-partido',
    `<span class="estad-puesto">${puesto}</span>
     <span class="quien">${local.emoji} ${local.nombre}</span>
     <span class="marcador-mini">${p.golesLocal} - ${p.golesVisitante}</span>
     <span class="quien der">${visit.nombre} ${visit.emoji}</span>`);
}

/* --- Todos contra todos --- */
function pintarDuelos() {
  const caja = document.getElementById('duelos');
  const etiqueta = document.getElementById('etiqueta-duelos');
  caja.innerHTML = '';

  const duelos = todosLosDuelos(torneoActual);
  etiqueta.textContent = duelos.length ? duelos.length + ' duelos jugados' : 'sin enfrentamientos aún';

  if (!duelos.length) {
    caja.appendChild(el('div', 'vacio', 'Cuando juguéis entre vosotros, aquí saldrá el historial de cada pareja.'));
    return;
  }

  duelos.forEach(d => {
    // Se pinta desde el punto de vista del que va ganando el duelo
    const lider = d.ganaA > d.ganaB ? d.a : d.b;
    const otro = lider === d.a ? d.b : d.a;
    const victoriasLider = lider === d.a ? d.ganaA : d.ganaB;

    caja.appendChild(el('div', 'duelo',
      `<span class="duelo-quien">${lider.emoji} ${lider.nombre}</span>
       <span class="duelo-datos">
         <b>${victoriasLider}</b> - <b>${d.empates}</b> - <b>${d.total - victoriasLider - d.empates}</b>
       </span>
       <span class="duelo-quien der">${otro.nombre} ${otro.emoji}</span>
       <span class="duelo-total">${d.total} ${d.total === 1 ? 'partido' : 'partidos'}</span>`));
  });

  // Se explica qué son las tres cifras, que si no hay que adivinarlo
  caja.appendChild(el('p', 'nota',
    'Las cifras son <b>victorias – empates – derrotas</b> del jugador de la izquierda contra el de la derecha.'));
}

document.addEventListener('DOMContentLoaded', arrancarEstadisticas);
