/* ==========================================================================
   PANTALLA: MIS TORNEOS (la página de inicio)
   Aquí se elige con qué torneo trabajar. Es la puerta de entrada: desde una
   tarjeta se entra a la clasificación, a los partidos o a los ajustes.
   ========================================================================== */

async function arrancarTorneos() {
  /* Se distingue "no hay conexión" de "algo ha fallado al dibujar": así el aviso
     no engaña (antes cualquier error decía "no se pudo conectar con la nube"). */
  let torneos;
  try {
    await arrancarCandado();
    torneos = await Store.iniciar();
    await darCodigosQueFalten();     // a los torneos viejos, sin código, se les pone uno
  } catch (e) {
    console.error(e);
    avisar('No se pudo conectar con la nube: ' + e.message, true);
    window.__listo = true;
    return;
  }

  try {
    pintarModoDatos();
    pintarTorneos(torneos);
  } catch (e) {
    console.error('Fallo al dibujar la lista de torneos:', e);
    avisar('La página ha fallado al dibujarse: ' + e.message, true, 6000);
  }
  window.__listo = true;
}

/* ==========================================================================
   ENTRAR CON UN CÓDIGO — "me han pasado el código del torneo, entro directo"
   ========================================================================== */
function entrarConCodigo() {
  const campo = $('#codigo-a-buscar');
  if (!campo) return;

  const texto = campo.value.trim();
  if (!texto) {
    avisar('Escribe el código del torneo 🎫', true);
    campo.focus();
    return;
  }

  const torneo = buscarTorneoPorCodigo(Store.cache, texto);

  if (!torneo) {
    avisar('Ese código no es de ningún torneo 🤔 Revisa que esté bien escrito', true, 5200);
    campo.select();
    return;
  }

  recordarTorneo(torneo.id);
  window.location.href = 'clasificacion.html?torneo=' + encodeURIComponent(torneo.id);
}

function pintarTorneos(torneos) {
  const caja = $('#lista-torneos');
  caja.innerHTML = '';

  $('#cuenta-torneos').textContent = torneos.length
    ? torneos.length + (torneos.length === 1 ? ' torneo' : ' torneos')
    : '';

  if (!torneos.length) {
    caja.appendChild(el('div', 'vacio',
      'Todavía no hay ningún torneo. Pulsa <b>Crear torneo nuevo</b> y la web te monta el calendario sola 🙂'));
    return;
  }

  torneos.forEach(t => {
    const jugados = t.partidos.filter(p => p.jugado).length;
    const liga = t.partidos.filter(p => p.fase === 'liga').length;
    const finalizado = t.estado === 'finalizado';

    const tarjeta = el('div', 'tarjeta-torneo' + (finalizado ? ' finalizado' : ''));
    tarjeta.innerHTML = `
      <h3>${t.nombre}</h3>
      <span class="datos"><b>${t.jugadores.length}</b> jugadores · ${finalizado ? 'finalizado' : 'en curso'}</span>
      <div class="acciones">
        <a class="btn-mini-ir" href="clasificacion.html?torneo=${encodeURIComponent(t.id)}">Clasificación</a>
        <a class="btn-mini-ir" href="partidos.html?torneo=${encodeURIComponent(t.id)}">Partidos</a>
        <a class="btn-mini-ir" href="ajustes.html?torneo=${encodeURIComponent(t.id)}">Ajustes</a>
      </div>`;

    // Pista de progreso en el título de la tarjeta (sin recargar de datos)
    tarjeta.querySelector('h3').title = liga
      ? jugados + ' de ' + liga + ' partidos jugados'
      : 'Sin calendario';

    caja.appendChild(tarjeta);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  arrancarTorneos();
  engancharActualizar(() => pintarTorneos(Store.cache));

  // Caja del código: botón y tecla Intro
  const btn = $('#btn-buscar-codigo');
  const campo = $('#codigo-a-buscar');
  if (btn) btn.onclick = entrarConCodigo;
  if (campo) {
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') entrarConCodigo(); });
  }

  const boton = $('#btn-nuevo-torneo');
  if (boton) boton.onclick = () => { window.location.href = 'ajustes.html?nuevo=1'; };
});
