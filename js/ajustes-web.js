/* ==========================================================================
   PANTALLA: AJUSTES DE LA WEB
   --------------------------------------------------------------------------
   Los ajustes que son de CADA UNO (no de un torneo): el aspecto, el sonido y
   la actualización automática. Se guardan en este navegador, así que cada uno
   puede tener los suyos. Los del torneo viven en ajustes.html.
   ========================================================================== */

/* En esta página no se refresca sola: estás configurando. */
window.__sinAutoRefresco = true;

/* ------------------------------------------------- aspecto de la web (temas) */
function pintarSelectorTema() {
  const caja = $('#selector-tema');
  if (!caja) return;

  caja.innerHTML = '';
  const actual = temaActual();

  Object.keys(TEMAS).forEach(clave => {
    const t = TEMAS[clave];
    const boton = el('button', 'tema-opcion' + (clave === actual ? ' activo' : ''));
    boton.type = 'button';
    boton.innerHTML =
      `<span class="tema-bola ${clave}"></span>
       <span class="tema-info">
         <span class="tema-nombre">${t.emoji} ${t.nombre}</span>
         <span class="tema-desc">${t.descripcion}</span>
       </span>
       <span class="tema-check">✓</span>`;

    boton.onclick = () => {
      if (temaActual() === clave) return;
      aplicarTema(clave);
      pintarSelectorTema();
      avisar(`Aspecto cambiado a ${t.nombre} ${t.emoji}`);
    };
    caja.appendChild(boton);
  });
}

/* ------------------------------------------------------------------ sonido */
function pintarSonido() {
  const chk = $('#chk-sonido');
  const vol = $('#volumen');
  const valor = $('#volumen-valor');
  const fila = $('#fila-volumen');
  const pista = $('#pista-sonido');
  if (!chk || !vol) return;

  const activo = sonidoActivo();
  const porCiento = volumenWebPorCiento();

  chk.checked = activo;
  vol.value = porCiento;
  valor.textContent = porCiento + '%';
  fila.classList.toggle('apagada', !activo);
  if (pista) {
    pista.textContent = activo
      ? 'Los efectos de la ruleta.'
      : 'Ahora mismo la web va sin sonido.';
  }
}

function engancharSonido() {
  const chk = $('#chk-sonido');
  const vol = $('#volumen');
  const valor = $('#volumen-valor');
  const boton = $('#btn-probar-sonido');
  if (!chk || !vol) return;

  chk.onchange = () => {
    ponerSonido(chk.checked);
    pintarSonido();
    avisar(chk.checked ? 'Sonido activado 🔊' : 'Sonido silenciado 🔇');
    if (chk.checked) sonarTic(1);          // un tic para confirmar
  };

  // Mientras arrastras, se guarda y se ve el número; al soltar, suena
  vol.oninput = () => {
    ponerVolumen(vol.value);
    valor.textContent = vol.value + '%';
  };
  vol.onchange = () => {
    ponerVolumen(vol.value);
    pintarSonido();
    sonarTic(1);                            // se oye cómo queda
  };

  if (boton) {
    boton.onclick = () => {
      if (!sonidoActivo()) {
        avisar('El sonido está apagado: enciéndelo para poder oírlo', true);
        return;
      }
      sonarElegido();                       // la fanfarria se nota más que un tic
    };
  }
}

/* ------------------------------------------------- actualización automática */
function pintarAuto() {
  const chk = $('#chk-auto');
  const sel = $('#segundos');
  const fila = $('#fila-segundos');
  if (!chk || !sel) return;

  // El desplegable de segundos se rellena una sola vez
  if (!sel.options.length) {
    SEGUNDOS_OPCIONES.forEach(s => {
      const o = el('option', null, String(s));
      o.value = s;
      sel.appendChild(o);
    });
  }

  const activo = autoRefrescoActivo();
  chk.checked = activo;
  sel.value = segundosAutoRefresco();
  fila.classList.toggle('apagada', !activo);
}

function engancharAuto() {
  const chk = $('#chk-auto');
  const sel = $('#segundos');
  if (!chk || !sel) return;

  chk.onchange = () => {
    ponerAutoRefresco(chk.checked);
    pintarAuto();
    avisar(chk.checked
      ? `Se actualizará sola cada ${segundosAutoRefresco()} s 🔄`
      : 'Actualización automática apagada (queda el botón 🔄)');
  };

  sel.onchange = () => {
    ponerSegundosAutoRefresco(sel.value);
    pintarAuto();
    avisar(`Se actualizará sola cada ${segundosAutoRefresco()} s 🔄`);
  };
}

/* ---------------------------------------------------------------- arranque */
function arrancarAjustesWeb() {
  try {
    pintarSelectorTema();
    pintarSonido();
    pintarAuto();
    engancharSonido();
    engancharAuto();
  } catch (e) {
    console.error('Fallo al dibujar los ajustes de la web:', e);
    avisar('La página ha fallado al dibujarse: ' + e.message, true, 6000);
  }
  window.__listo = true;
}

document.addEventListener('DOMContentLoaded', arrancarAjustesWeb);
