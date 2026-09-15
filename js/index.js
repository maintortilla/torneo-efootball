/* ==========================================================================
   PANTALLA: PORTADA / CUADRO DE MANDO
   Clasificación + partidos + eliminatorias, todo a la vista en PC.
   El resultado se apunta con una ventanita, sin salir de esta pantalla.
   Todos los números salen del modelo (js/modelo.js): aquí solo se pintan.
   ========================================================================== */

let torneoActual;
let filtroPartidos = 'todos';
let partidoEnEdicion = null;                    // partido que se está apuntando
let marcadorEdit = { local: 0, visitante: 0 };  // marcador de la ventanita

async function arrancarIndex() {
  try {
    const torneos = await Store.iniciar();
    torneoActual = Store.torneo(torneos[0].id);

    pintarSelectorTorneo(torneos);
    pintarTodo();
    pintarModoDatos();
    engancharIndex();
  } catch (e) {
    // Si la nube falla (sin internet, configuración mal), avisamos sin romper la web
    console.error(e);
    avisar('No se pudo conectar con la nube: ' + e.message, true);
  }
  window.__listo = true;   // aviso para las pruebas automáticas
}

/* ¿Estamos leyendo del navegador o de la nube? */
function pintarModoDatos() {
  const caja = $('#nota-guardado');
  if (!caja) return;
  const nube = Store.modo() === 'nube';
  caja.innerHTML = nube
    ? '<span class="pastilla nube">☁️ Datos en la nube: todos veis lo mismo</span>'
    : '<span class="pastilla local">💾 Modo local: los datos están solo en este PC</span>';
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
  pintarEliminatorias();
  pintarUltimos();
}

/* ------------------------------------------------------------- resumen */
function pintarResumen() {
  const jugados = torneoActual.partidos.filter(p => p.jugado);
  const total = torneoActual.partidos.length;
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

  const pendientes = torneoActual.partidos.filter(p => !p.jugado && p.fase === 'liga');
  const jornadaActual = pendientes.length ? pendientes[0].jornada : null;
  $('#badge-jornada').textContent = pendientes.length
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

  const porJornada = {};
  lista.forEach(p => { (porJornada[p.jornada] = porJornada[p.jornada] || []).push(p); });

  Object.keys(porJornada).sort((a, b) => a - b).forEach(j => {
    caja.appendChild(el('div', 'cabecera-jornada', `Jornada ${j}`));

    porJornada[j].forEach(p => {
      const local = jugador(torneoActual, p.localId);
      const visit = jugador(torneoActual, p.visitanteId);
      const ganaLocal = p.jugado && p.golesLocal > p.golesVisitante;
      const ganaVisit = p.jugado && p.golesVisitante > p.golesLocal;

      const fila = el('div', 'partido-fila ' + (p.jugado ? 'jugado' : 'pendiente'));
      fila.innerHTML = `
        <span class="quien ${ganaLocal ? 'gana' : ''}">${local.emoji} ${local.nombre}</span>
        <span class="marcador-mini ${p.jugado ? '' : 'pend'}">
          ${p.jugado ? p.golesLocal + ' - ' + p.golesVisitante : 'vs'}
        </span>
        <span class="quien der ${ganaVisit ? 'gana' : ''}">${visit.nombre} ${visit.emoji}</span>`;

      const boton = el('button', 'btn-mini-ir', p.jugado ? 'Editar' : 'Apuntar');
      boton.onclick = () => abrirModal(p.id);
      fila.appendChild(boton);

      caja.appendChild(fila);
    });
  });
}

/* ------------------------------------------- eliminatorias de hoy mismo */
function pintarEliminatorias() {
  const caja = $('#lista-eliminatorias');
  caja.innerHTML = '';

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

  jugados.forEach(p => {
    const local = jugador(torneoActual, p.localId);
    const visit = jugador(torneoActual, p.visitanteId);
    const fila = el('div', 'partido-fila jugado');
    fila.innerHTML = `
      <span class="quien ${p.golesLocal > p.golesVisitante ? 'gana' : ''}">${local.emoji} ${local.nombre}</span>
      <span class="marcador-mini">${p.golesLocal} - ${p.golesVisitante}</span>
      <span class="quien der ${p.golesVisitante > p.golesLocal ? 'gana' : ''}">${visit.nombre} ${visit.emoji}</span>`;
    caja.appendChild(fila);
  });
}

/* ----------------------------------------------- ventanita del resultado */
function abrirModal(idPartido) {
  partidoEnEdicion = torneoActual.partidos.find(p => p.id === idPartido);
  if (!partidoEnEdicion) return;

  marcadorEdit = {
    local: Number(partidoEnEdicion.golesLocal) || 0,
    visitante: Number(partidoEnEdicion.golesVisitante) || 0
  };

  const local = jugador(torneoActual, partidoEnEdicion.localId);
  const visit = jugador(torneoActual, partidoEnEdicion.visitanteId);

  $('#modal-av-local').textContent = local.emoji;
  $('#modal-nom-local').textContent = local.nombre;
  $('#modal-av-visit').textContent = visit.emoji;
  $('#modal-nom-visit').textContent = visit.nombre;
  $('#modal-nota').textContent = partidoEnEdicion.jugado
    ? 'Este partido ya tiene resultado: puedes cambiarlo y volver a guardar.'
    : `Jornada ${partidoEnEdicion.jornada} · pon el resultado con los botones.`;

  pintarModal();
  $('#modal-fondo').hidden = false;
}

function pintarModal() {
  $('#modal-cifra-local').textContent = marcadorEdit.local;
  $('#modal-cifra-visit').textContent = marcadorEdit.visitante;
  $('#modal-borrar').hidden = !partidoEnEdicion.jugado;
}

function cerrarModal() {
  $('#modal-fondo').hidden = true;
  partidoEnEdicion = null;
}

async function guardarModal() {
  if (!partidoEnEdicion) return;

  const i = torneoActual.partidos.findIndex(p => p.id === partidoEnEdicion.id);
  torneoActual.partidos[i].golesLocal = marcadorEdit.local;
  torneoActual.partidos[i].golesVisitante = marcadorEdit.visitante;
  torneoActual.partidos[i].jugado = true;
  torneoActual.partidos[i].fecha = new Date().toISOString().slice(0, 10);

  // Guardamos (en la nube o en el navegador, según el modo)
  const boton = $('#modal-guardar');
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  try {
    await Store.guardarTorneo(torneoActual);
    cerrarModal();
    pintarTodo();
    avisar('Resultado guardado ✅');
  } catch (e) {
    console.error(e);
    avisar('No se pudo guardar: ' + e.message, true);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar ✅';
  }
}

async function borrarResultado() {
  if (!partidoEnEdicion) return;

  const i = torneoActual.partidos.findIndex(p => p.id === partidoEnEdicion.id);
  torneoActual.partidos[i].jugado = false;
  torneoActual.partidos[i].golesLocal = 0;
  torneoActual.partidos[i].golesVisitante = 0;
  torneoActual.partidos[i].fecha = null;

  try {
    await Store.guardarTorneo(torneoActual);
    cerrarModal();
    pintarTodo();
    avisar('Resultado borrado: el partido vuelve a estar pendiente 🧹');
  } catch (e) {
    console.error(e);
    avisar('No se pudo borrar: ' + e.message, true);
  }
}

/* --------------------------------------------------------------- eventos */
function engancharIndex() {
  $('#selector-torneo').onchange = (e) => {
    torneoActual = Store.torneo(e.target.value);
    pintarTodo();
  };

  // Refrescar: trae los datos que hayan apuntado los demás
  const refrescar = $('#btn-refrescar');
  if (refrescar) {
    refrescar.onclick = async () => {
      refrescar.disabled = true;
      refrescar.textContent = '⏳';
      try {
        await Store.recargar();
        torneoActual = Store.torneo(torneoActual.id);
        pintarSelectorTorneo(Store.cache);
        pintarTodo();
        avisar('Datos puestos al día 🔄');
      } catch (e) {
        console.error(e);
        avisar('No se pudo refrescar: ' + e.message, true);
      } finally {
        refrescar.disabled = false;
        refrescar.textContent = '🔄 Refrescar';
      }
    };
  }

  $$('[data-filtro]').forEach(t => {
    t.onclick = () => {
      filtroPartidos = t.dataset.filtro;
      $$('[data-filtro]').forEach(x => x.classList.toggle('activo', x === t));
      pintarPartidos();
    };
  });

  $$('[data-modal-paso]').forEach(b => {
    b.onclick = () => {
      const lado = b.dataset.modalPaso;
      const delta = Number(b.dataset.delta);
      marcadorEdit[lado] = Math.max(0, marcadorEdit[lado] + delta);
      pintarModal();
    };
  });

  $('#modal-guardar').onclick = guardarModal;
  $('#modal-cancelar').onclick = cerrarModal;
  $('#modal-borrar').onclick = borrarResultado;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal-fondo').hidden) cerrarModal();
  });
  $('#modal-fondo').onclick = (e) => {
    if (e.target.id === 'modal-fondo') cerrarModal();
  };
}

/* ---------------------------------------------------- aviso flotante (toast) */
let temporizadorAviso = null;
function avisar(texto, esError) {
  let t = $('#toast');
  if (!t) {
    t = el('div', null, '');
    t.id = 'toast';
    t.style.cssText = `position:fixed;left:50%;bottom:34px;transform:translateX(-50%);
      background:#0E1621;padding:12px 20px;border-radius:12px;font-weight:700;z-index:200;
      max-width:80vw;text-align:center;box-shadow:0 0 22px rgba(0,0,0,.55);font-family:var(--fuente)`;
    document.body.appendChild(t);
  }
  t.textContent = texto;
  t.style.border = '1px solid ' + (esError ? '#FF4D5E' : '#00E676');
  t.style.color = esError ? '#FF4D5E' : '#00E676';
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => t.remove(), esError ? 5200 : 2400);
}

document.addEventListener('DOMContentLoaded', arrancarIndex);
