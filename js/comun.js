/* ==========================================================================
   DETECTOR DE ERRORES DE JAVASCRIPT
   --------------------------------------------------------------------------
   Todo error suelto se guarda en window.__erroresJS. Sirve para dos cosas:
     · verlos desde la consola del navegador cuando algo va raro
     · que la prueba de arranque (docs/prueba-arranque.html) los cace sola

   Nace de un fallo real: al renombrar una función (engancharRefrescar →
   engancharActualizar) se quedó una llamada con el nombre viejo y la página
   avisaba "no se pudo conectar con la nube" en vez de decir lo que pasaba.
   ========================================================================== */
window.__erroresJS = window.__erroresJS || [];
window.addEventListener('error', (e) => {
  window.__erroresJS.push(String((e && e.message) || (e && e.error) || 'error'));
});
window.addEventListener('unhandledrejection', (e) => {
  const motivo = e && e.reason ? (e.reason.message || e.reason) : 'promesa rechazada';
  window.__erroresJS.push('promesa: ' + String(motivo));
});

/* ==========================================================================
   COMÚN — piezas que comparten la clasificación y la página de partidos
   --------------------------------------------------------------------------
   Aquí viven: los avisos flotantes (toast), la ventanita de apuntar resultado
   y las filas de partido. Así el mismo código sirve en las dos pantallas sin
   duplicarlo.
   ========================================================================== */

let torneoComun = null;      // el torneo con el que trabaja la pantalla
let alCambiarComun = null;   // función a llamar cuando se guarda algo
let partidoEnEdicion = null;
let marcadorEdit = { local: 0, visitante: 0 };

/* Cada pantalla llama a esto al arrancar */
function configurarComun(torneo, alCambiar) {
  torneoComun = torneo;
  alCambiarComun = alCambiar || (() => {});
}

/* ==========================================================================
   TORNEO ACTIVO — que cada página sepa en qué torneo está
   --------------------------------------------------------------------------
   Antes, todas las páginas cargaban el PRIMER torneo de la lista, así que al
   cambiar de pantalla te podía llevar a otro torneo distinto. Ahora el torneo
   viaja en la dirección (?torneo=...) y además se recuerda en el navegador.
   ========================================================================== */

const CLAVE_TORNEO_ACTIVO = 'torneo-activo';

function torneoDeURL() {
  return new URLSearchParams(window.location.search).get('torneo');
}

function recordarTorneo(id) {
  try { localStorage.setItem(CLAVE_TORNEO_ACTIVO, id); } catch (e) {}
}

function torneoRecordado() {
  try { return localStorage.getItem(CLAVE_TORNEO_ACTIVO); } catch (e) { return null; }
}

/* Decide con qué torneo abrir la página:
   1º el que venga en la dirección, 2º el último que se usó, 3º el primero */
function elegirTorneoInicial(torneos) {
  const deUrl = torneoDeURL();
  if (deUrl && torneos.some(t => t.id === deUrl)) return deUrl;

  const recordado = torneoRecordado();
  if (recordado && torneos.some(t => t.id === recordado)) return recordado;

  return torneos.length ? torneos[0].id : null;
}

/* Pone el ?torneo= en los enlaces del menú lateral (y de la barra de arriba),
   para que al cambiar de página NO se pierda el torneo */
function enlacesConTorneo(torneoId) {
  if (!torneoId) return;
  document.querySelectorAll('[data-pagina]').forEach(a => {
    a.href = a.dataset.pagina + '?torneo=' + encodeURIComponent(torneoId);
  });
}

/* Escribe el nombre del torneo en la barra de arriba */
function pintarNombreTorneo(torneo) {
  const caja = $('#nombre-torneo');
  if (!caja || !torneo) return;
  const estado = torneo.estado === 'finalizado' ? ' · finalizado' : '';
  caja.innerHTML = `<span class="emoji-torneo">🏆</span> ${torneo.nombre}${estado}`;
}

/* ------------------------------------------------- ventanita de resultado */
function abrirModal(idPartido) {
  // Sin entrar (modo mirar) no se abre: se invita a entrar con la contraseña
  if (!dentroDelCandado()) { pedirEntrarParaEscribir(); return; }

  partidoEnEdicion = torneoComun.partidos.find(p => p.id === idPartido);
  if (!partidoEnEdicion) return;

  marcadorEdit = {
    local: Number(partidoEnEdicion.golesLocal) || 0,
    visitante: Number(partidoEnEdicion.golesVisitante) || 0
  };

  const local = jugador(torneoComun, partidoEnEdicion.localId);
  const visit = jugador(torneoComun, partidoEnEdicion.visitanteId);

  $('#modal-av-local').textContent = local.emoji;
  $('#modal-nom-local').textContent = local.nombre;
  $('#modal-av-visit').textContent = visit.emoji;
  $('#modal-nom-visit').textContent = visit.nombre;

  const nombresFase = { semifinal: 'la semifinal', final: 'la final', tercer_puesto: 'el 3º y 4º puesto' };
  if (partidoEnEdicion.fase && partidoEnEdicion.fase !== 'liga') {
    const etiqueta = nombresFase[partidoEnEdicion.fase] || 'la eliminatoria';
    $('#modal-nota').innerHTML = partidoEnEdicion.jugado
      ? `Partido de <b>${etiqueta}</b> ya jugado: puedes cambiar el resultado y volver a guardar.`
      : `Partido de <b>${etiqueta}</b>. Si acaba en empate, pasa el que mejor quedó en la liguilla 🎯`;
  } else {
    $('#modal-nota').textContent = partidoEnEdicion.jugado
      ? 'Este partido ya tiene resultado: puedes cambiarlo y volver a guardar.'
      : `Jornada ${partidoEnEdicion.jornada} · pon el resultado con los botones.`;
  }

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

  const i = torneoComun.partidos.findIndex(p => p.id === partidoEnEdicion.id);
  torneoComun.partidos[i].golesLocal = marcadorEdit.local;
  torneoComun.partidos[i].golesVisitante = marcadorEdit.visitante;
  torneoComun.partidos[i].jugado = true;
  torneoComun.partidos[i].fecha = new Date().toISOString().slice(0, 10);

  const boton = $('#modal-guardar');
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  try {
    // Se guarda SOLO este partido: así no se pisan los resultados que apunten los demás
    await Store.guardarPartido(torneoComun.id, torneoComun.partidos[i]);
    cerrarModal();
    alCambiarComun();
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

  const i = torneoComun.partidos.findIndex(p => p.id === partidoEnEdicion.id);
  torneoComun.partidos[i].jugado = false;
  torneoComun.partidos[i].golesLocal = 0;
  torneoComun.partidos[i].golesVisitante = 0;
  torneoComun.partidos[i].fecha = null;

  try {
    // Igual que al guardar: solo se toca este partido
    await Store.guardarPartido(torneoComun.id, torneoComun.partidos[i]);
    cerrarModal();
    alCambiarComun();
    avisar('Resultado borrado: el partido vuelve a estar pendiente 🧹');
  } catch (e) {
    console.error(e);
    avisar('No se pudo borrar: ' + e.message, true);
  }
}

/* Quita el partido del torneo (para cuando la ruleta o el apunte se equivocan) */
async function eliminarPartido() {
  if (!partidoEnEdicion) return;

  const local = jugador(torneoComun, partidoEnEdicion.localId);
  const visit = jugador(torneoComun, partidoEnEdicion.visitanteId);
  const conResultado = partidoEnEdicion.jugado
    ? `\n\nOjo: ya tiene resultado (${partidoEnEdicion.golesLocal}-${partidoEnEdicion.golesVisitante}) y dejará de contar en la clasificación.`
    : '';

  const seguro = confirm(
    `¿Eliminar del torneo el partido ${local.nombre} vs ${visit.nombre}?${conResultado}\n\nNo se puede deshacer.`
  );
  if (!seguro) return;

  const copia = torneoComun.partidos.slice();
  const idQuitado = partidoEnEdicion.id;
  torneoComun.partidos = torneoComun.partidos.filter(p => p.id !== idQuitado);

  try {
    // Se quita SOLO ese partido de la nube (antes había que rehacerlos TODOS,
    // y eso se llevaba por delante los que otra persona hubiera apuntado entre medias)
    await Store.borrarPartido(torneoComun.id, idQuitado);
    cerrarModal();
    alCambiarComun();
    avisar(`Partido ${local.nombre} vs ${visit.nombre} eliminado 🗑️`);
  } catch (e) {
    console.error(e);
    torneoComun.partidos = copia;      // si falla, se queda como estaba
    avisar('No se pudo eliminar: ' + e.message, true);
  }
}

/* Engancha los botones de la ventanita (se llama una vez al arrancar) */
function engancharModal() {
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
  if ($('#modal-eliminar')) $('#modal-eliminar').onclick = eliminarPartido;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal-fondo').hidden) cerrarModal();
  });
  $('#modal-fondo').onclick = (e) => {
    if (e.target.id === 'modal-fondo') cerrarModal();
  };
}

/* --------------------------------------------------- filas de partido */
const NOMBRES_FASE = { semifinal: 'Semifinal', final: 'Final', tercer_puesto: '3º y 4º' };

/* Devuelve una fila lista para meter en una lista de partidos.
   conCabecera = true → muestra el nombre de la fase en vez de "vs" cuando está pendiente */
function filaDePartido(p) {
  const local = jugador(torneoComun, p.localId);
  const visit = jugador(torneoComun, p.visitanteId);
  const ganaLocal = p.jugado && p.golesLocal > p.golesVisitante;
  const ganaVisit = p.jugado && p.golesVisitante > p.golesLocal;

  const fila = el('div', 'partido-fila ' + (p.jugado ? 'jugado' : 'pendiente'));
  fila.innerHTML = `
    <span class="quien ${ganaLocal ? 'gana' : ''}">${local.emoji} ${local.nombre}</span>
    <span class="marcador-mini ${p.jugado ? '' : 'pend'}">
      ${p.jugado ? p.golesLocal + ' - ' + p.golesVisitante : (NOMBRES_FASE[p.fase] || 'vs')}
    </span>
    <span class="quien der ${ganaVisit ? 'gana' : ''}">${visit.nombre} ${visit.emoji}</span>`;

  const boton = el('button', 'btn-mini-ir', p.jugado ? 'Editar' : 'Apuntar');
  if (dentroDelCandado()) {
    boton.onclick = () => abrirModal(p.id);
  } else {
    // Modo mirar: en vez de editar, el botón invita a entrar
    boton.textContent = '🔑';
    boton.title = 'Entra con la contraseña del grupo para apuntar';
    boton.classList.add('btn-candado');
    boton.onclick = pedirEntrarParaEscribir;
  }
  fila.appendChild(boton);

  return fila;
}

/* ------------------------------------------- pastilla del modo de datos */
function pintarModoDatos() {
  const caja = $('#nota-guardado');
  if (!caja) return;

  const nube = Store.modo() === 'nube';
  const datos = nube
    ? '<span class="pastilla nube">☁️ Datos en la nube</span>'
    : '<span class="pastilla local">💾 Modo local</span>';

  // Si hay candado y no se ha entrado, se avisa de que solo se puede mirar
  const mirando = (typeof candadoActivo === 'function' && candadoActivo() && !dentroDelCandado())
    ? '<span class="pastilla mirando" title="Entra con la contraseña del grupo para apuntar resultados">👀 Solo lectura</span>'
    : '';

  caja.innerHTML = datos + mirando;
}

/* ---------------------------------------------------- aviso flotante (toast) */
let temporizadorAviso = null;
function avisar(texto, esError, duracionMs) {
  let t = $('#toast');
  if (!t) {
    t = el('div', null, '');
    t.id = 'toast';
    t.style.cssText = `position:fixed;left:50%;bottom:34px;transform:translateX(-50%);
      background:var(--panel-2);padding:12px 20px;border-radius:12px;font-weight:700;z-index:200;
      max-width:80vw;text-align:center;box-shadow:0 0 22px rgba(0,0,0,.55);font-family:var(--fuente)`;
    document.body.appendChild(t);
  }
  t.textContent = texto;
  const color = esError ? 'var(--peligro)' : 'var(--neon)';
  t.style.border = '1px solid ' + color;
  t.style.color = color;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => t.remove(), duracionMs || (esError ? 5200 : 2400));
}

/* -------------------------------------------------- menú lateral plegable */
/* El menú de la izquierda se puede plegar: queda una franja con los iconos y
   se despliega al volver a pulsar. Cada navegador recuerda cómo lo dejaste. */
function engancharMenuLateral() {
  const sidebar = $('#sidebar');
  const boton = $('#btn-plegar');
  if (!sidebar || !boton) return;

  const aplicar = (plegado) => {
    sidebar.classList.toggle('plegado', plegado);
    const layout = sidebar.closest('.layout');
    if (layout) layout.classList.toggle('plegado', plegado);
    boton.textContent = plegado ? '»' : '«';
    boton.title = plegado ? 'Desplegar el menú' : 'Plegar el menú';
    boton.setAttribute('aria-expanded', String(!plegado));
    try { localStorage.setItem('menu-plegado', plegado ? '1' : '0'); } catch (e) {}
  };

  let plegado = false;
  try { plegado = localStorage.getItem('menu-plegado') === '1'; } catch (e) {}
  aplicar(plegado);

  boton.onclick = () => aplicar(!sidebar.classList.contains('plegado'));
}

document.addEventListener('DOMContentLoaded', engancharMenuLateral);

/* -------------------------------------------------- botón de actualizar */
/* Vuelve a leer de la nube lo que hayan apuntado los demás. El botón se crea
   solo en la barra de arriba, así vale para todas las páginas sin tocar el
   HTML de cada una. En modo local no hay nada que actualizar, así que no sale. */
function engancharActualizar(alActualizar) {
  const caja = document.querySelector('.topbar-derecha');
  if (!caja) return;
  if (typeof Store === 'undefined' || Store.modo() !== 'nube') return;

  let boton = document.getElementById('btn-actualizar');
  if (!boton) {
    boton = el('button', 'btn-actualizar');
    boton.id = 'btn-actualizar';
    boton.innerHTML = '<span class="giro">🔄</span> <span>Actualizar</span>';
    boton.title = 'Volver a leer de la nube lo que hayan apuntado los demás';
    caja.appendChild(boton);
  }

  boton.onclick = async () => {
    if (boton.disabled) return;
    boton.disabled = true;
    boton.classList.add('girando');
    try {
      await Store.recargar();
      if (alActualizar) await alActualizar();
      avisar('Datos puestos al día 🔄');
    } catch (e) {
      console.error(e);
      avisar('No se pudo actualizar: ' + e.message, true);
    } finally {
      boton.disabled = false;
      boton.classList.remove('girando');
    }
  };
}

/* ==========================================================================
   CÓDIGO DEL TORNEO — compartir por código (tipo código de sala de un juego)
   ========================================================================== */

/* A los torneos creados antes de que existiera el código se les pone uno.
   Devuelve cuántos se han cambiado. Se llama al arrancar (Mis torneos, Ajustes). */
async function darCodigosQueFalten() {
  const cambiados = asegurarCodigos(Store.cache);
  for (const t of cambiados) {
    try {
      await Store.guardarTorneo(t);
    } catch (e) {
      console.warn('No se pudo guardar el código del torneo', t.nombre, e);
    }
  }
  return cambiados.length;
}

/* El enlace directo a un torneo, listo para pegar en WhatsApp */
function enlaceDelTorneo(id) {
  const carpeta = window.location.pathname.replace(/[^/]*$/, '');
  return window.location.origin + carpeta + 'clasificacion.html?torneo=' + encodeURIComponent(id);
}

/* Copiar al portapapeles, con aviso. Si el navegador no deja (o no hay https),
   se enseña el texto para copiarlo a mano en vez de quedarse en silencio. */
async function copiarAlPortapapeles(texto, mensajeOk) {
  if (!texto) return false;
  try {
    await navigator.clipboard.writeText(texto);
    avisar(mensajeOk || 'Copiado ✅');
    return true;
  } catch (e) {
    console.warn('No se pudo copiar al portapapeles:', e);
    avisar('No se pudo copiar solo. Copia esto a mano: ' + texto, true, 9000);
    return false;
  }
}
