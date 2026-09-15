/* ==========================================================================
   PANTALLA: ACTA DE PARTIDO
   Regla de oro: nada de escribir a mano. Marcador con botones, futbolista de
   una lista, tipo de gol con botones, stats con contadores y un deslizador.
   ========================================================================== */

let torneo;
let partido;            // el partido que se está apuntando
let borrador;           // copia de trabajo (no se guarda hasta pulsar Guardar)
let ladoElegido = null; // 'local' | 'visitante' al apuntar un gol
let tipoElegido = 'normal';

/* ---------------------------------------------------------------- arranque */
function arrancar() {
  const torneos = Store.iniciar();
  torneo = Store.torneo(torneos[0].id);

  pintarSelectorPartidos();

  // Si venimos de la lista de partidos con ?partido=pX, abrimos ese directamente
  const pedido = new URLSearchParams(window.location.search).get('partido');
  const existePedido = pedido && torneo.partidos.some(p => p.id === pedido);
  cargarPartido(existePedido ? pedido : torneo.partidos[0].id);

  pintarChipsTipo();
  pintarContadoresStats();
  engancharEventos();
}

/* --------------------------------------------------- selector de partidos */
function pintarSelectorPartidos() {
  const sel = $('#selector-partido');
  sel.innerHTML = '';

  torneo.partidos.forEach(p => {
    const local = jugador(torneo, p.localId);
    const visit = jugador(torneo, p.visitanteId);
    const estado = p.jugado
      ? `✅ ${p.golesLocal}-${p.golesVisitante}`
      : '· pendiente';
    const opcion = el('option', null,
      `J${p.jornada} · ${local.nombre} vs ${visit.nombre}${p.jugado ? ' ✅ ' + p.golesLocal + '-' + p.golesVisitante : ' · pendiente'}`);
    opcion.value = p.id;
    sel.appendChild(opcion);
  });
}

function cargarPartido(id) {
  partido = torneo.partidos.find(p => p.id === id);
  borrador = JSON.parse(JSON.stringify(partido));   // copia para no tocar el original

  ladoElegido = null;
  tipoElegido = 'normal';
  $('#panel-gol').hidden = true;
  $('#badge-jornada').textContent = 'Jornada ' + (borrador.jornada || '—');
  $('#selector-partido').value = id;

  pintarMarcador();
  pintarGoles();
  pintarPosesion();
  pintarContadoresStats();

  const local = jugador(torneo, borrador.localId);
  const visit = jugador(torneo, borrador.visitanteId);
  $('#nota-partido').textContent = borrador.jugado
    ? `Este partido ya tiene resultado guardado (${borrador.golesLocal}-${borrador.golesVisitante}). Puedes corregirlo y volver a guardar.`
    : `Partido pendiente entre ${local.nombre} y ${visit.nombre}.`;
}

/* ------------------------------------------------------------- marcador */
function pintarMarcador() {
  const local = jugador(torneo, borrador.localId);
  const visit = jugador(torneo, borrador.visitanteId);

  $('#av-local').textContent = local.emoji;
  $('#nom-local').textContent = local.nombre;
  $('#av-visit').textContent = visit.emoji;
  $('#nom-visit').textContent = visit.nombre;
  $('#lado-nom-local').textContent = local.nombre;
  $('#lado-nom-visit').textContent = visit.nombre;

  $('#cifra-local').textContent = borrador.golesLocal;
  $('#cifra-visit').textContent = borrador.golesVisitante;

  const detLocal = borrador.goles.filter(g => g.lado === 'local').length;
  const detVisit = borrador.goles.filter(g => g.lado === 'visitante').length;
  const totalDet = detLocal + detVisit;
  const totalGoles = borrador.golesLocal + borrador.golesVisitante;

  $('#contador-detalle').textContent = totalGoles
    ? `${totalDet} de ${totalGoles} goles detallados`
    : '';
  $('#lado-det-local').textContent = `${detLocal} de ${borrador.golesLocal} detallados`;
  $('#lado-det-visit').textContent = `${detVisit} de ${borrador.golesVisitante} detallados`;
}

/* ------------------------------------------------------------- acta/goles */
function pintarGoles() {
  const lista = $('#lista-goles');
  lista.innerHTML = '';
  const aviso = $('#aviso-goles');
  aviso.innerHTML = '';

  if (!borrador.goles.length) {
    lista.appendChild(el('li', 'vacio',
      borrador.golesLocal + borrador.golesVisitante > 0
        ? 'Hay resultado pero ningún gol detallado. Pulsa <b>+ Añadir gol</b> si queréis el pichichi.'
        : 'Todavía no hay goles apuntados.'));
    comprobarDescuadre(aviso);
    return;
  }

  // Ordenados por minuto (los sin minuto, al final)
  const ordenados = borrador.goles.slice().sort((a, b) => {
    const ma = a.minuto === null || a.minuto === undefined ? 999 : Number(a.minuto);
    const mb = b.minuto === null || b.minuto === undefined ? 999 : Number(b.minuto);
    return ma - mb;
  });

  ordenados.forEach(g => {
    const jug = jugador(torneo, g.lado === 'local' ? borrador.localId : borrador.visitanteId);
    const fut = futbolista(torneo, g.futbolistaId);
    const tipo = tipoGol(torneo, g.tipoId);

    const item = el('li', 'gol-item' + (g.lado === 'visitante' ? ' visitante' : ''));
    item.innerHTML =
      `<span class="minuto">${g.minuto ? g.minuto + "'" : '—'}</span>
       <span class="quien">
         <b>${tipo.emoji} ${fut.nombre}</b>
         <small>${tipo.nombre}${g.auto ? ' · sin detallar' : ''} · de ${jug.emoji} ${jug.nombre}</small>
       </span>`;

    const quitar = el('button', 'quitar', '✕');
    quitar.title = 'Borrar este gol';
    quitar.onclick = () => {
      borrador.goles.splice(borrador.goles.indexOf(g), 1);
      // Al borrar un gol detallado, el marcador baja con él
      if (g.lado === 'local') borrador.golesLocal = Math.max(0, borrador.golesLocal - 1);
      else borrador.golesVisitante = Math.max(0, borrador.golesVisitante - 1);
      pintarMarcador(); pintarGoles(); pintarContadoresStats();
    };
    item.appendChild(quitar);
    lista.appendChild(item);
  });

  comprobarDescuadre(aviso);
}

/* Avisa si el marcador y los goles detallados no cuadran */
function comprobarDescuadre(contenedor) {
  const detLocal = borrador.goles.filter(g => g.lado === 'local').length;
  const detVisit = borrador.goles.filter(g => g.lado === 'visitante').length;
  const faltan = (borrador.golesLocal - detLocal) + (borrador.golesVisitante - detVisit);

  if (faltan > 0) {
    contenedor.appendChild(el('div', 'aviso',
      `<span>ℹ️</span><span>Faltan <b>${faltan}</b> gol(es) por detallar. Puedes guardar así — el marcador es correcto — pero no contarán para el pichichi.</span>`));
  } else if (faltan < 0) {
    contenedor.appendChild(el('div', 'aviso',
      `<span>⚠️</span><span>Hay <b>${-faltan}</b> gol(es) detallados de más. Sube el marcador o borra alguno.</span>`));
  }
}

/* --------------------------------------------------------- chips de tipo */
function pintarChipsTipo() {
  const caja = $('#chips-tipo');
  caja.innerHTML = '';
  torneo.config.tiposGol.forEach(t => {
    const chip = el('button', 'chip' + (t.id === tipoElegido ? ' activo' : ''), `${t.emoji} ${t.nombre}`);
    chip.onclick = () => {
      tipoElegido = t.id;
      pintarChipsTipo();
    };
    caja.appendChild(chip);
  });
}

/* ------------------------------------------------------------- posesión */
function pintarPosesion() {
  const pos = borrador.stats ? borrador.stats.posesionLocal : 50;
  $('#slider-posesion').value = pos;
  $('#pos-local').textContent = pos + '%';
  $('#pos-visit').textContent = (100 - pos) + '%';
}

/* ------------------------------------------- contadores de stats opcionales */
const FILAS_STATS = [
  { clave: 'tirosLocal',   etiqueta: 'Tiros',              lado: 'local' },
  { clave: 'tirosVisitante', etiqueta: 'Tiros',            lado: 'visitante' },
  { clave: 'paradasLocal', etiqueta: 'Paradas',            lado: 'local' },
  { clave: 'paradasVisitante', etiqueta: 'Paradas',        lado: 'visitante' },
  { clave: 'amarillasLocal', etiqueta: 'Tarjetas amarillas', lado: 'local' },
  { clave: 'amarillasVisitante', etiqueta: 'Tarjetas amarillas', lado: 'visitante' },
  { clave: 'rojasLocal',   etiqueta: 'Tarjetas rojas',     lado: 'local' },
  { clave: 'rojasVisitante', etiqueta: 'Tarjetas rojas',   lado: 'visitante' }
];

function pintarContadoresStats() {
  const caja = $('#stats-contadores');
  caja.innerHTML = '';

  const grupos = ['Tiros', 'Paradas', 'Tarjetas amarillas', 'Tarjetas rojas'];
  grupos.forEach(nombre => {
    const filas = FILAS_STATS.filter(f => f.etiqueta === nombre);
    const linea = el('div', 'stat-fila');

    const local = filas.find(f => f.lado === 'local');
    const visit = filas.find(f => f.lado === 'visitante');
    const vLocal = borrador.stats ? (Number(borrador.stats[local.clave]) || 0) : 0;
    const vVisit = borrador.stats ? (Number(borrador.stats[visit.clave]) || 0) : 0;

    linea.innerHTML =
      `<div class="contador-mini">
         <button class="btn-mini" data-stat="${local.clave}" data-delta="-1">−</button>
         <span class="stat-valor">${vLocal}</span>
         <button class="btn-mini" data-stat="${local.clave}" data-delta="1">+</button>
       </div>
       <span class="stat-nombre">${nombre}</span>
       <div class="contador-mini der">
         <button class="btn-mini" data-stat="${visit.clave}" data-delta="-1">−</button>
         <span class="stat-valor">${vVisit}</span>
         <button class="btn-mini" data-stat="${visit.clave}" data-delta="1">+</button>
       </div>`;

    caja.appendChild(linea);
  });
}

/* ------------------------------------------------------------- eventos */
function engancharEventos() {
  // Elegir partido
  $('#selector-partido').onchange = (e) => cargarPartido(e.target.value);

  // Contadores de marcador
  $$('[data-paso]').forEach(b => {
    b.onclick = () => {
      const lado = b.dataset.paso;
      const delta = Number(b.dataset.delta);
      if (lado === 'local') borrador.golesLocal = Math.max(0, borrador.golesLocal + delta);
      else borrador.golesVisitante = Math.max(0, borrador.golesVisitante + delta);
      pintarMarcador(); pintarGoles(); pintarContadoresStats();
    };
  });

  // Abrir/cerrar el panel de gol
  $('#btn-abrir-gol').onclick = () => {
    $('#panel-gol').hidden = !$('#panel-gol').hidden;
    if (!$('#panel-gol').hidden) pintarMarcador();
  };
  $('#btn-cancelar-gol').onclick = () => { $('#panel-gol').hidden = true; };

  // Lado del gol
  $$('[data-lado]').forEach(b => {
    b.onclick = () => {
      ladoElegido = b.dataset.lado;
      $$('[data-lado]').forEach(x => x.classList.toggle('activo', x.dataset.lado === ladoElegido));
    };
  });

  // Catálogo de futbolistas
  pintarSelectFutbolistas();
  $('#btn-nuevo-futbolista').onclick = () => {
    const caja = $('#caja-nuevo-futbolista');
    caja.hidden = !caja.hidden;
    if (!caja.hidden) $('#input-nuevo-futbolista').focus();
  };
  $('#btn-confirmar-futbolista').onclick = añadirFutbolista;
  $('#input-nuevo-futbolista').onkeydown = (e) => { if (e.key === 'Enter') añadirFutbolista(); };

  // Añadir el gol
  $('#btn-anadir-gol').onclick = añadirGol;
  $('#btn-sin-minuto').onclick = () => { $('#input-minuto').value = ''; $('#input-minuto').focus(); };

  // Pestañas
  $$('[data-pestana]').forEach(t => {
    t.onclick = () => {
      $$('[data-pestana]').forEach(x => x.classList.toggle('activo', x === t));
      $('#pestana-stats').hidden = t.dataset.pestana !== 'stats';
    };
  });

  // Posesión
  $('#slider-posesion').onchange = (e) => {
    asegurarStats();
    borrador.stats.posesionLocal = Number(e.target.value);
    pintarPosesion();
  };
  $('#slider-posesion').oninput = (e) => {
    $('#pos-local').textContent = e.target.value + '%';
    $('#pos-visit').textContent = (100 - e.target.value) + '%';
  };

  // Contadores de stats (delegado, porque se repintan)
  $('#stats-contadores').onclick = (e) => {
    const b = e.target.closest('[data-stat]');
    if (!b) return;
    asegurarStats();
    const clave = b.dataset.stat;
    const delta = Number(b.dataset.delta);
    borrador.stats[clave] = Math.max(0, (Number(borrador.stats[clave]) || 0) + delta);
    pintarContadoresStats();
  };

  $('#btn-limpiar-stats').onclick = () => {
    borrador.stats = null;
    pintarPosesion(); pintarContadoresStats();
    avisar('Datos de más borrados 🧹');
  };

  // Guardar
  $('#btn-guardar').onclick = guardarResultado;
}

function pintarSelectFutbolistas() {
  const sel = $('#sel-futbolista');
  sel.innerHTML = '';
  sel.appendChild(el('option', null, '— elige futbolista —')).value = '';
  torneo.futbolistas.forEach(f => {
    const o = el('option', null, f.nombre);
    o.value = f.id;
    sel.appendChild(o);
  });
}

function añadirFutbolista() {
  const caja = $('#input-nuevo-futbolista');
  const nombre = caja.value.trim();
  if (!nombre) { avisar('Escribe un nombre primero ✍️'); return; }

  const nuevo = { id: nuevoId('f'), nombre };
  torneo.futbolistas.push(nuevo);
  Store.guardarTorneo(torneo);          // queda en el catálogo para siempre

  pintarSelectFutbolistas();
  $('#sel-futbolista').value = nuevo.id;
  caja.value = '';
  $('#caja-nuevo-futbolista').hidden = true;
  avisar(`"${nombre}" añadido al catálogo ✅`);
}

/* ------------------------------------------------------------- añadir gol */
function añadirGol() {
  if (!ladoElegido) { avisar('Elige de quién es el gol (arriba) ⬆️'); return; }

  const futId = $('#sel-futbolista').value;
  if (!futId) { avisar('Elige el futbolista de la lista ⚽'); return; }

  const minutoCrudo = $('#input-minuto').value;
  const minuto = minutoCrudo === '' ? null : Math.max(1, Math.min(120, Number(minutoCrudo)));

  borrador.goles.push({
    lado: ladoElegido,
    futbolistaId: futId,
    minuto,
    tipoId: tipoElegido
  });

  // El gol que apuntas suma al marcador (así no hay que ir a los dos sitios)
  if (ladoElegido === 'local') borrador.golesLocal++;
  else borrador.golesVisitante++;

  // Reset del formulario, listo para el siguiente gol
  ladoElegido = null;
  tipoElegido = 'normal';
  $('#input-minuto').value = '';
  $('#sel-futbolista').value = '';
  $$('[data-lado]').forEach(x => x.classList.remove('activo'));
  pintarChipsTipo();

  pintarMarcador(); pintarGoles();
  avisar('Gol apuntado ⚽');
}

function asegurarStats() {
  if (!borrador.stats) {
    borrador.stats = {
      posesionLocal: 50, tirosLocal: 0, tirosVisitante: 0,
      paradasLocal: 0, paradasVisitante: 0,
      amarillasLocal: 0, amarillasVisitante: 0,
      rojasLocal: 0, rojasVisitante: 0
    };
  }
}

/* --------------------------------------------------------------- guardar */
function guardarResultado() {
  const detLocal = borrador.goles.filter(g => g.lado === 'local').length;
  const detVisit = borrador.goles.filter(g => g.lado === 'visitante').length;

  // Validaciones: lo único obligatorio es que el marcador cuadre con los goles detallados
  if (detLocal > borrador.golesLocal || detVisit > borrador.golesVisitante) {
    avisar('Hay más goles detallados que en el marcador ⚠️', true);
    return;
  }

  // Las stats solo se guardan si se han tocado (si no, se quedan vacías)
  const statsTocadas = borrador.stats && (
    borrador.stats.posesionLocal !== 50 ||
    borrador.stats.tirosLocal || borrador.stats.tirosVisitante ||
    borrador.stats.paradasLocal || borrador.stats.paradasVisitante ||
    borrador.stats.amarillasLocal || borrador.stats.amarillasVisitante ||
    borrador.stats.rojasLocal || borrador.stats.rojasVisitante
  );
  if (!statsTocadas) borrador.stats = null;

  borrador.jugado = true;
  borrador.fecha = new Date().toISOString().slice(0, 10);

  const i = torneo.partidos.findIndex(p => p.id === borrador.id);
  torneo.partidos[i] = JSON.parse(JSON.stringify(borrador));
  Store.guardarTorneo(torneo);

  pintarSelectorPartidos();
  $('#selector-partido').value = borrador.id;
  cargarPartido(borrador.id);
  avisar('Resultado guardado ✅');
}

/* ---------------------------------------------------- aviso flotante (toast) */
let temporizadorAviso = null;
function avisar(texto, esError) {
  let t = $('#toast');
  if (!t) {
    t = el('div', null, '');
    t.id = 'toast';
    t.style.cssText = `position:fixed;left:50%;bottom:104px;transform:translateX(-50%);
      background:#0E1621;border:1px solid ${esError ? '#FF4D5E' : '#00E676'};
      color:${esError ? '#FF4D5E' : '#00E676'};padding:12px 18px;border-radius:12px;
      font-weight:700;z-index:50;max-width:88vw;text-align:center;
      box-shadow:0 0 20px rgba(0,0,0,.5);font-family:var(--fuente)`;
    document.body.appendChild(t);
  }
  t.textContent = texto;
  t.style.borderColor = esError ? '#FF4D5E' : '#00E676';
  t.style.color = esError ? '#FF4D5E' : '#00E676';
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => t.remove(), 2600);
}

document.addEventListener('DOMContentLoaded', arrancar);
