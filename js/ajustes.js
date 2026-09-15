/* ==========================================================================
   PANTALLA: AJUSTES DEL TORNEO (Fase 3)
   Aquí se crean los torneos y se configura TODO: jugadores, formato, puntos,
   desempates y las fases finales. Nada está fijo en el código.
   ========================================================================== */

let torneos = [];
let torneoActual = null;
let desempates = [];              // criterios, en orden de prioridad
let jugadoresBorrador = [];       // filas del formulario de "nuevo torneo"
const EMOJIS = ['🟢','🔵','🟡','🔴','🟣','🟠','⚫','⚪','🟤','🔷','🔶','🟩','🟥','🟦','⭐','🔥'];
const COLORES = ['#00E676','#4DA3FF','#FFD54F','#FF4D5E','#B388FF','#FFA24D','#90A4AE','#E8F2FF','#A1887F','#42A5F5','#FF9800','#66BB6A','#EF5350','#29B6F6','#FFC107','#FF7043'];

/* ---------------------------------------------------------------- arranque */
async function arrancarAjustes() {
  try {
    torneos = await Store.iniciar();
    pintarModoDatos();

    const quiereNuevo = new URLSearchParams(window.location.search).get('nuevo') === '1';
    if (quiereNuevo || !torneos.length) {
      abrirCrear();
    } else {
      cargarTorneo(elegirTorneoInicial(torneos));
    }
  } catch (e) {
    console.error(e);
    avisar('No se pudo conectar con la nube: ' + e.message, true);
  }
  window.__listo = true;
}

function pintarModoDatos() {
  const nube = Store.modo() === 'nube';
  $('#nota-guardado').innerHTML = nube
    ? '<span class="pastilla nube">☁️ Datos en la nube</span>'
    : '<span class="pastilla local">💾 Modo local</span>';
}

/* ------------------------------------------------------- abrir / cerrar */
function abrirCrear() {
  torneoActual = null;
  jugadoresBorrador = [];
  for (let i = 0; i < 6; i++) anadirJugadorBorrador();

  $('#zona-crear').hidden = false;
  $('#zona-editar').hidden = true;
  $('#estado-torneo').textContent = 'Nuevo torneo';
  $('#nuevo-nombre').value = 'Torneo ' + new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  pintarJugadoresBorrador();
  pintarPistaPartidos();
  $('#nuevo-nombre').focus();
}

function cargarTorneo(id) {
  torneoActual = Store.torneo(id);
  if (!torneoActual) { abrirCrear(); return; }

  $('#zona-crear').hidden = true;
  $('#zona-editar').hidden = false;

  const cfg = torneoActual.config;
  $('#edit-nombre').value = torneoActual.nombre;
  $('#edit-estado').value = torneoActual.estado || 'en_curso';
  $('#edit-vueltas').value = String(cfg.vueltas || 2);
  $('#edit-clasificados').value = String(cfg.clasificados || 4);
  $('#edit-tercero').checked = Boolean(cfg.partidoTercerPuesto);
  $('#edit-elim-ida').checked = Boolean(cfg.eliminatoriasIdaYVuelta);
  $('#edit-pts-v').value = cfg.puntosVictoria;
  $('#edit-pts-e').value = cfg.puntosEmpate;
  $('#edit-pts-d').value = cfg.puntosDerrota;

  desempates = (cfg.desempates || []).slice();

  const jugados = torneoActual.partidos.filter(p => p.jugado).length;
  const total = torneoActual.partidos.filter(p => p.fase === 'liga').length;
  $('#resumen-torneo').textContent = `${torneoActual.jugadores.length} jugadores · ${total} partidos de liguilla · ${jugados} jugados`;
  $('#cuenta-jugadores').textContent = torneoActual.jugadores.length + ' en juego';

  pintarJugadoresEdit();
  pintarDesempates();
  pintarFases();
  pintarPistaPartidos();
  pintarCalendarioAviso();

  // Que la página recuerde este torneo y los enlaces del menú lo arrastren
  recordarTorneo(torneoActual.id);
  pintarNombreTorneo(torneoActual);
  enlacesConTorneo(torneoActual.id);
  $('#estado-torneo').textContent = torneoActual.estado === 'finalizado' ? 'Finalizado' : 'En curso';
}

/* ------------------------------------------------- jugadores (edición) */
function pintarJugadoresEdit() {
  const caja = $('#lista-jugadores');
  caja.innerHTML = '';

  torneoActual.jugadores.forEach(j => {
    const fila = el('div', 'jugador-linea');
    const conPartidos = tienePartidosJugados(torneoActual, j.id);

    fila.innerHTML =
      `<input type="text" class="j-emoji" value="${j.emoji || '⚪'}" maxlength="4" title="Emoji del jugador">
       <input type="text" class="j-nombre" value="${j.nombre}" maxlength="20" title="Nombre">
       <input type="color" class="j-color" value="${j.color || '#00E676'}" title="Color">`;

    const quitar = el('button', 'btn-mini-ir', 'Quitar');
    quitar.title = conPartidos ? 'Tiene partidos jugados: no se puede quitar' : 'Quitar del torneo';
    quitar.disabled = conPartidos;
    quitar.style.opacity = conPartidos ? .4 : 1;
    quitar.style.color = conPartidos ? 'var(--muted)' : 'var(--peligro)';
    quitar.style.borderColor = conPartidos ? 'var(--linea)' : 'var(--peligro)';
    quitar.onclick = () => {
      torneoActual.jugadores = torneoActual.jugadores.filter(x => x.id !== j.id);
      pintarJugadoresEdit();
    };
    fila.appendChild(quitar);

    fila.querySelector('.j-emoji').oninput = (e) => { j.emoji = e.target.value; };
    fila.querySelector('.j-nombre').oninput = (e) => { j.nombre = e.target.value; };
    fila.querySelector('.j-color').oninput = (e) => { j.color = e.target.value; };

    caja.appendChild(fila);
  });
}

/* ----------------------------------------------- jugadores (torneo nuevo) */
function anadirJugadorBorrador() {
  const i = jugadoresBorrador.length;
  jugadoresBorrador.push({
    id: nuevoId('j'),
    nombre: '',
    emoji: EMOJIS[i % EMOJIS.length],
    color: COLORES[i % COLORES.length]
  });
}

function pintarJugadoresBorrador() {
  const caja = $('#lista-jugadores-nuevo');
  caja.innerHTML = '';

  jugadoresBorrador.forEach((j, i) => {
    const fila = el('div', 'jugador-linea');
    fila.innerHTML =
      `<input type="text" class="j-emoji" value="${j.emoji}" maxlength="4">
       <input type="text" class="j-nombre" value="${j.nombre}" maxlength="20" placeholder="Nombre del jugador ${i + 1}">
       <input type="color" class="j-color" value="${j.color}">`;

    const quitar = el('button', 'btn-mini-ir', 'Quitar');
    quitar.style.color = 'var(--peligro)';
    quitar.style.borderColor = 'var(--peligro)';
    quitar.onclick = () => {
      jugadoresBorrador = jugadoresBorrador.filter(x => x.id !== j.id);
      pintarJugadoresBorrador();
      pintarPistaPartidos();
    };
    fila.appendChild(quitar);

    fila.querySelector('.j-emoji').oninput = (e) => { j.emoji = e.target.value; };
    fila.querySelector('.j-nombre').oninput = (e) => { j.nombre = e.target.value; };
    fila.querySelector('.j-color').oninput = (e) => { j.color = e.target.value; };

    caja.appendChild(fila);
  });
}

/* ------------------------------------------------------------ desempates */
function pintarDesempates() {
  const caja = $('#lista-desempates');
  caja.innerHTML = '';

  desempates.forEach((criterio, i) => {
    const fila = el('li', 'desempate-linea');
    fila.innerHTML =
      `<span class="orden">${i + 1}º</span>
       <span class="nombre">${NOMBRES_DESEMPATE[criterio] || criterio}</span>`;

    const flechas = el('div', 'flechas');
    const subir = el('button', null, '↑');
    subir.title = 'Subir (más importante)';
    subir.disabled = i === 0;
    subir.style.opacity = i === 0 ? .3 : 1;
    subir.onclick = () => {
      [desempates[i - 1], desempates[i]] = [desempates[i], desempates[i - 1]];
      pintarDesempates();
    };
    const bajar = el('button', null, '↓');
    bajar.title = 'Bajar (menos importante)';
    bajar.disabled = i === desempates.length - 1;
    bajar.style.opacity = i === desempates.length - 1 ? .3 : 1;
    bajar.onclick = () => {
      [desempates[i + 1], desempates[i]] = [desempates[i], desempates[i + 1]];
      pintarDesempates();
    };
    flechas.appendChild(subir);
    flechas.appendChild(bajar);
    fila.appendChild(flechas);

    caja.appendChild(fila);
  });
}

/* ------------------------------------------------------- fases finales */
function pintarFases() {
  const estado = estadoDeFases(torneoActual);
  const caja = $('#pasos-torneo');
  caja.innerHTML = '';

  const pasos = [];
  const cfg = torneoActual.config;

  if (estado.paso === 'liga') {
    pasos.push({ texto: `Liguilla en juego: quedan <b>${estado.pendientes}</b> partidos`, hecho: false });
    pasos.push({ texto: `Cuando acabe: semifinales entre los <b>${cfg.clasificados}</b> primeros`, hecho: false });
  } else if (estado.paso === 'generar_semis') {
    pasos.push({ texto: 'Liguilla terminada ✅', hecho: true });
    pasos.push({ texto: 'Semifinales listas para generar (los 4 primeros)', hecho: false });
  } else if (estado.paso === 'semis') {
    pasos.push({ texto: 'Liguilla terminada ✅', hecho: true });
    pasos.push({ texto: `Semifinales en juego: quedan <b>${estado.pendientes}</b>`, hecho: false });
  } else if (estado.paso === 'generar_final') {
    pasos.push({ texto: 'Liguilla terminada ✅', hecho: true });
    pasos.push({ texto: 'Semifinales jugadas ✅', hecho: true });
    pasos.push({ texto: 'La final está lista para generar', hecho: false });
  } else if (estado.paso === 'final') {
    pasos.push({ texto: 'Liguilla terminada ✅', hecho: true });
    pasos.push({ texto: 'Semifinales jugadas ✅', hecho: true });
    pasos.push({ texto: `Final${cfg.partidoTercerPuesto ? ' y 3º puesto' : ''} en juego: quedan <b>${estado.pendientes}</b>`, hecho: false });
  } else if (estado.paso === 'terminado') {
    const final = torneoActual.partidos.find(p => p.fase === 'final');
    const campeon = final ? ganadorDe(torneoActual, final) : null;
    const nombre = campeon ? jugador(torneoActual, campeon).nombre : '—';
    pasos.push({ texto: 'Liguilla terminada ✅', hecho: true });
    pasos.push({ texto: 'Semifinales jugadas ✅', hecho: true });
    pasos.push({ texto: `🏆 Campeón: <b>${nombre}</b>`, hecho: true });
  } else {
    pasos.push({ texto: 'Este torneo no tiene calendario todavía', hecho: false });
  }

  pasos.forEach(p => caja.appendChild(el('li', p.hecho ? 'hecho' : '', p.texto)));

  const etiquetas = {
    liga: 'fase de liguilla', generar_semis: 'semifinales listas', semis: 'semifinales en juego',
    generar_final: 'final lista', final: 'final en juego', terminado: 'torneo terminado'
  };
  $('#estado-fases').textContent = etiquetas[estado.paso] || '';

  // Botón de generar
  const boton = $('#btn-generar-ronda');
  const puedeGenerar = ['generar_semis', 'generar_final'].includes(estado.paso);
  boton.disabled = !puedeGenerar;
  boton.style.opacity = puedeGenerar ? 1 : .45;
  boton.textContent = estado.paso === 'generar_final'
    ? 'Generar la final 🏆'
    : 'Generar las semifinales 🏟️';

  // Eliminatorias ya generadas
  const lista = $('#lista-eliminatorias');
  lista.innerHTML = '';
  const eliminatorias = torneoActual.partidos.filter(p => p.fase !== 'liga');
  eliminatorias.forEach(p => {
    const local = jugador(torneoActual, p.localId);
    const visit = jugador(torneoActual, p.visitanteId);
    const nombresFase = { semifinal: 'Semifinal', final: 'Final', tercer_puesto: '3º y 4º puesto' };
    const fila = el('div', 'partido-fila ' + (p.jugado ? 'jugado' : 'pendiente'));
    fila.innerHTML =
      `<span class="quien">${local.emoji} ${local.nombre}</span>
       <span class="marcador-mini ${p.jugado ? '' : 'pend'}">${p.jugado ? p.golesLocal + ' - ' + p.golesVisitante : nombresFase[p.fase] || p.fase}</span>
       <span class="quien der">${visit.nombre} ${visit.emoji}</span>`;
    lista.appendChild(fila);
  });
}

/* ------------------------------------------------------ pistas y avisos */
function pintarPistaPartidos() {
  const n = jugadoresBorrador.length;
  const vueltas = Number($('#nuevo-vueltas').value);
  const total = (n * (n - 1) / 2) * vueltas;
  const porJugador = (n - 1) * vueltas;
  $('#pista-partidos-nuevo').textContent = n < 2
    ? 'Añade al menos 2 jugadores'
    : `${total} partidos en total · ${porJugador} por jugador`;

  if (torneoActual) {
    const jugadores = torneoActual.jugadores.length;
    const v = Number($('#edit-vueltas').value);
    const t = (jugadores * (jugadores - 1) / 2) * v;
    $('#pista-partidos-edit').textContent = `${t} partidos en total · ${(jugadores - 1) * v} por jugador`;
  }
}

function pintarCalendarioAviso() {
  const jugados = torneoActual.partidos.filter(p => p.jugado).length;
  $('#aviso-calendario').innerHTML = jugados
    ? `⚠️ Hay <b>${jugados}</b> partidos con resultado. Regenerar el calendario los borraría todos.`
    : 'Todavía no hay resultados: regenerar el calendario no rompe nada.';
}

/* ------------------------------------------------------------- creación */
async function crearTorneo() {
  const nombre = $('#nuevo-nombre').value.trim();
  const jugadores = jugadoresBorrador
    .filter(j => j.nombre.trim())
    .map(j => ({ id: j.id, nombre: j.nombre.trim(), emoji: j.emoji, color: j.color }));

  if (!nombre) { avisar('Ponle un nombre al torneo ✍️', true); return; }
  if (jugadores.length < 2) { avisar('Hacen falta al menos 2 jugadores 👥', true); return; }
  if (new Set(jugadores.map(j => j.nombre.toLowerCase())).size !== jugadores.length) {
    avisar('Hay dos jugadores con el mismo nombre 😅', true); return;
  }

  const config = {
    vueltas: Number($('#nuevo-vueltas').value),
    clasificados: Number($('#nuevo-clasificados').value),
    partidoTercerPuesto: $('#nuevo-tercero').checked,
    puntosVictoria: Number($('#nuevo-pts-v').value),
    puntosEmpate: Number($('#nuevo-pts-e').value),
    puntosDerrota: Number($('#nuevo-pts-d').value)
  };

  const torneo = crearTorneoNuevo(nombre, jugadores, config);

  const boton = $('#btn-crear');
  boton.disabled = true;
  boton.textContent = 'Creando...';
  try {
    await Store.crearTorneo(torneo);
    torneos = Store.cache;
    torneoActual = torneo;
    recordarTorneo(torneo.id);
    // Se va a la clasificación de ese torneo, con su aviso
    window.location.href = 'clasificacion.html?torneo=' + encodeURIComponent(torneo.id) +
                           '&creado=' + encodeURIComponent(nombre);
  } catch (e) {
    console.error(e);
    avisar('No se pudo crear: ' + e.message, true);
    boton.disabled = false;
    boton.textContent = 'Crear torneo y generar calendario';
  }
}

/* -------------------------------------------------------------- guardar */
async function guardarCambios() {
  const cfg = torneoActual.config;
  const nombre = $('#edit-nombre').value.trim();
  if (!nombre) { avisar('El torneo necesita un nombre ✍️', true); return; }

  const nuevosJugadores = torneoActual.jugadores.filter(j => j.nombre.trim());
  if (nuevosJugadores.length < 2) { avisar('Hacen falta al menos 2 jugadores 👥', true); return; }

  const jugadoresCambiados = nuevosJugadores.length !== torneoActual.jugadores.length;
  const vueltasAntes = cfg.vueltas;
  const vueltasAhora = Number($('#edit-vueltas').value);
  const formatoCambiado = jugadoresCambiados || String(vueltasAntes) !== String(vueltasAhora);

  if (formatoCambiado && hayResultados(torneoActual)) {
    const seguro = confirm(
      'Has cambiado el número de jugadores o de vueltas.\n\n' +
      'Eso obliga a rehacer el calendario y se PERDERÁN todos los resultados apuntados.\n\n' +
      '¿Seguro que quieres seguir?'
    );
    if (!seguro) return;
  }

  // Aplicar los cambios
  torneoActual.nombre = nombre;
  torneoActual.estado = $('#edit-estado').value;
  torneoActual.jugadores = nuevosJugadores;
  cfg.vueltas = vueltasAhora;
  cfg.clasificados = Number($('#edit-clasificados').value);
  cfg.partidoTercerPuesto = $('#edit-tercero').checked;
  cfg.eliminatoriasIdaYVuelta = $('#edit-elim-ida').checked;
  cfg.puntosVictoria = Number($('#edit-pts-v').value);
  cfg.puntosEmpate = Number($('#edit-pts-e').value);
  cfg.puntosDerrota = Number($('#edit-pts-d').value);
  cfg.desempates = desempates.slice();

  if (formatoCambiado) regenerarCalendario(torneoActual);

  const boton = $('#btn-guardar');
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  try {
    await Store.guardarTorneo(torneoActual, formatoCambiado ? 'reemplazar' : null);
    torneos = Store.cache;
    cargarTorneo(torneoActual.id);
    avisar('Cambios guardados ✅');
  } catch (e) {
    console.error(e);
    avisar('No se pudo guardar: ' + e.message, true);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar los cambios';
  }
}

/* ------------------------------------------------- regenerar y eliminar */
async function regenerar() {
  if (hayResultados(torneoActual)) {
    const seguro = confirm('Regenerar el calendario BORRARÁ todos los resultados apuntados.\n\n¿Continuar?');
    if (!seguro) return;
  }
  regenerarCalendario(torneoActual);
  try {
    await Store.guardarTorneo(torneoActual, 'reemplazar');
    cargarTorneo(torneoActual.id);
    avisar('Calendario regenerado 🗓️');
  } catch (e) {
    avisar('No se pudo regenerar: ' + e.message, true);
  }
}

async function generarRonda() {
  const resultado = generarSiguienteRonda(torneoActual);
  if (!resultado.nuevos.length) { avisar(resultado.mensaje, true); return; }

  torneoActual.partidos = torneoActual.partidos.concat(resultado.nuevos);
  try {
    await Store.guardarTorneo(torneoActual);
    pintarFases();
    avisar(resultado.mensaje + ' · apúntalos desde la clasificación');
  } catch (e) {
    avisar('No se pudo guardar: ' + e.message, true);
  }
}

async function borrarTorneo() {
  const seguro = confirm(`¿Seguro que quieres borrar "${torneoActual.nombre}"?\n\nSe borrarán también todos sus partidos y resultados.`);
  if (!seguro) return;

  const id = torneoActual.id;
  try {
    const restantes = await Store.borrarTorneo(id);
    torneos = restantes;

    if (!restantes.length) {
      window.location.href = 'index.html';   // ya no queda ningún torneo
      return;
    }

    torneoActual = null;
    cargarTorneo(restantes[0].id);
    avisar('Torneo borrado 🗑️');
  } catch (e) {
    console.error(e);
    avisar('No se pudo borrar: ' + e.message, true);
  }
}

/* ------------------------------------------------------------- eventos */
function engancharAjustes() {
  $('#btn-add-jugador-nuevo').onclick = () => { anadirJugadorBorrador(); pintarJugadoresBorrador(); pintarPistaPartidos(); };
  $('#btn-autocompletar').onclick = () => {
    jugadoresBorrador.forEach((j, i) => { j.emoji = EMOJIS[i % EMOJIS.length]; j.color = COLORES[i % COLORES.length]; });
    pintarJugadoresBorrador();
  };
  $('#nuevo-vueltas').onchange = pintarPistaPartidos;
  $('#btn-crear').onclick = crearTorneo;
  $('#btn-cancelar-crear').onclick = () => {
    if (torneos.length) cargarTorneo(elegirTorneoInicial(torneos));
    else window.location.href = 'index.html';
  };

  $('#btn-add-jugador').onclick = () => {
    const i = torneoActual.jugadores.length;
    torneoActual.jugadores.push({ id: nuevoId('j'), nombre: '', emoji: EMOJIS[i % EMOJIS.length], color: COLORES[i % COLORES.length] });
    pintarJugadoresEdit();
  };
  $('#edit-vueltas').onchange = pintarPistaPartidos;
  $('#btn-guardar').onclick = guardarCambios;
  $('#btn-regenerar').onclick = regenerar;
  $('#btn-generar-ronda').onclick = generarRonda;
  $('#btn-borrar').onclick = borrarTorneo;
}

document.addEventListener('DOMContentLoaded', () => {
  arrancarAjustes();
  engancharAjustes();
});
