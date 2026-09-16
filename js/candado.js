/* ==========================================================================
   CANDADO — controla QUIÉN puede apuntar resultados
   --------------------------------------------------------------------------
   Dos formas de mirar la web:

     · SIN entrar  → se ve TODO (clasificación, partidos, resumen, ruleta…)
                     pero los botones que escriben no salen: modo MIRAR.
     · CON la contraseña del grupo → aparecen los botones y se puede apuntar.

   ⚠️ Importante: esconder botones NO es una seguridad. La seguridad de verdad
   la pone la base de datos (Supabase): allí las políticas (RLS) dejan LEER a
   cualquiera, pero solo dejan ESCRIBIR a quien tenga sesión. Así, aunque
   alguien llame a la API a mano, no puede tocar nada.

   La contraseña NO está escrita en ningún archivo del proyecto: la valida
   Supabase con la cuenta compartida del grupo. Lo único que se guarda en el
   navegador es la sesión que devuelve Supabase al entrar bien.

   Si el candado está apagado en js/config-nube.js (activo: false), esta web
   se comporta como siempre: todo abierto, sin pedir nada.
   ========================================================================== */

const CLAVE_RECORDADO = 'candado-recordado';

const CANDADO = {
  dentro: false,       // ¿ha entrado ya este navegador?
  email: null,         // la cuenta compartida que se usa para entrar
  listo: false         // ¿ya hemos preguntado a Supabase si había sesión?
};

/* ¿Esta web pide contraseña? (solo en modo nube y si está encendido)
   En las pruebas se puede encender aunque el modo sea local: así el candado se
   prueba sin tocar la nube de verdad. */
function candadoActivo() {
  const quiere = Boolean(NUBE_CONFIG.candado && NUBE_CONFIG.candado.activo);
  if (typeof enModoPrueba === 'function' && enModoPrueba()) return quiere;
  return nubeConfigurada() && quiere;
}

/* ¿Puede escribir quien está mirando la web? */
function dentroDelCandado() {
  return !candadoActivo() || CANDADO.dentro;
}

/* ==========================================================================
   Arranque: mira si este navegador ya tenía sesión guardada
   ========================================================================== */
async function arrancarCandado() {
  if (!candadoActivo()) {
    CANDADO.dentro = true;
    CANDADO.listo = true;
    aplicarCandado();
    return;
  }

  CANDADO.email = NUBE_CONFIG.candado.email;

  try {
    const c = clienteNube();

    // Supabase guarda la sesión sola: solo hay que escribir la contraseña la 1ª vez
    const { data } = await c.auth.getSession();
    ponSesion(data ? data.session : null);

    // Si la sesión caduca o se cierra desde otro sitio, la web se entera sola
    c.auth.onAuthStateChange((_evento, sesion) => {
      ponSesion(sesion);
      aplicarCandado();
    });
  } catch (e) {
    console.warn('No se pudo comprobar la sesión:', e);
    CANDADO.dentro = false;      // si hay dudas, MIRAR (nunca escribir de más)
  }

  CANDADO.listo = true;
  aplicarCandado();
}

function ponSesion(sesion) {
  CANDADO.dentro = Boolean(sesion);
  if (sesion && sesion.user) CANDADO.email = sesion.user.email;
  try {
    localStorage.setItem(CLAVE_RECORDADO, CANDADO.dentro ? '1' : '0');
  } catch (e) {}
}

/* ==========================================================================
   Entrar y salir
   ========================================================================== */
async function entrarConContrasena(texto) {
  const c = clienteNube();
  const { data, error } = await c.auth.signInWithPassword({
    email: NUBE_CONFIG.candado.email,
    password: texto
  });
  if (error) throw new Error(textoAmigable(error));
  ponSesion(data.session);
  aplicarCandado();
}

/* Los errores de Supabase, en cristiano */
function textoAmigable(error) {
  const m = String((error && error.message) || '');
  if (/invalid login credentials/i.test(m)) return 'Esa contraseña no es. Prueba otra vez.';
  if (/email not confirmed/i.test(m)) return 'La cuenta del grupo todavía no está activada en Supabase.';
  if (/failed to fetch|network|load failed/i.test(m)) return 'No hay conexión con la nube. ¿Tienes internet?';
  if (/too many requests|rate limit/i.test(m)) return 'Demasiados intentos seguidos. Espera un minuto.';
  return m || 'No se pudo entrar';
}

async function salirDelCandado() {
  try {
    await clienteNube().auth.signOut();
  } catch (e) {
    console.warn(e);
  }
  ponSesion(null);
  aplicarCandado();
  avisar('Has salido: la web queda en modo mirar 👀');
}

/* ==========================================================================
   Pintar: el botón de la barra de arriba y la pastilla del menú
   ========================================================================== */
function aplicarCandado() {
  document.documentElement.dataset.candado = dentroDelCandado() ? 'dentro' : 'fuera';
  pintarBotonSesion();
  if (typeof pintarModoDatos === 'function') pintarModoDatos();
  document.dispatchEvent(new CustomEvent('candado-cambiado'));
}

function pintarBotonSesion() {
  const caja = document.querySelector('.topbar-derecha');
  if (!caja) return;

  // Ojo: en "Mis torneos" la barra de la derecha ya tiene la pastilla de datos,
  // así que se quita SOLO el botón anterior y se respeta lo demás.
  const viejo = caja.querySelector('.btn-sesion');
  if (viejo) viejo.remove();

  if (!candadoActivo()) return;

  const b = el('button', 'btn-sesion');

  if (CANDADO.dentro) {
    b.classList.add('dentro');
    b.innerHTML = '🔓 <span>Estás dentro</span>';
    b.title = 'Puedes apuntar resultados. Pulsa para salir.';
    b.onclick = salirDelCandado;
  } else {
    b.innerHTML = '🔑 <span>Entrar para apuntar</span>';
    b.title = 'Escribe la contraseña del grupo para poder apuntar resultados';
    b.onclick = abrirCandado;
  }

  caja.appendChild(b);
}

/* ==========================================================================
   La ventanita de entrar (se crea sola, así vale para todas las páginas)
   ========================================================================== */
function crearModalCandado() {
  if (document.getElementById('modal-candado')) return;

  const fondo = el('div', 'modal-fondo');
  fondo.id = 'modal-candado';
  fondo.hidden = true;
  fondo.innerHTML = `
    <div class="modal modal-candado">
      <p class="panel-titulo">🔑 Entrar para apuntar</p>
      <p class="nota">
        Escribe la contraseña del grupo. Se queda guardada en este PC, así que
        solo hace falta escribirla una vez.
      </p>
      <div class="campo-form" style="margin-top:14px">
        <label>Contraseña del grupo</label>
        <input type="password" id="candado-clave" placeholder="••••••••"
               autocomplete="current-password">
      </div>
      <p class="nota candado-error" id="candado-error"></p>
      <div class="fila-2" style="margin-top:14px">
        <button class="btn btn-gol" id="candado-entrar">Entrar 🔓</button>
        <button class="btn btn-ghost" id="candado-cancelar">Solo quiero mirar</button>
      </div>
    </div>`;

  document.body.appendChild(fondo);

  const campo = fondo.querySelector('#candado-clave');
  const boton = fondo.querySelector('#candado-entrar');

  const intentar = async () => {
    const texto = campo.value;
    if (!texto) { ponerErrorCandado('Escribe la contraseña del grupo 😉'); campo.focus(); return; }

    boton.disabled = true;
    boton.textContent = 'Comprobando...';
    ponerErrorCandado('');
    try {
      await entrarConContrasena(texto);
      campo.value = '';
      cerrarCandado();
      avisar('¡Dentro! Ya puedes apuntar resultados ✅');
    } catch (e) {
      ponerErrorCandado(e.message);
      campo.select();
    } finally {
      boton.disabled = false;
      boton.textContent = 'Entrar 🔓';
    }
  };

  boton.onclick = intentar;
  fondo.querySelector('#candado-cancelar').onclick = cerrarCandado;
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') intentar(); });
  fondo.onclick = (e) => { if (e.target.id === 'modal-candado') cerrarCandado(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !fondo.hidden) cerrarCandado();
  });
}

function ponerErrorCandado(texto) {
  const caja = document.getElementById('candado-error');
  if (caja) caja.textContent = texto;
}

function abrirCandado() {
  if (CANDADO.dentro) return;      // ya está dentro: nada que pedir
  crearModalCandado();
  const fondo = document.getElementById('modal-candado');
  fondo.hidden = false;
  ponerErrorCandado('');
  const campo = fondo.querySelector('#candado-clave');
  campo.value = '';
  setTimeout(() => campo.focus(), 60);
}

function cerrarCandado() {
  const fondo = document.getElementById('modal-candado');
  if (fondo) fondo.hidden = true;
}

/* Si alguien intenta escribir sin haber entrado, se le abre la ventanita */
function pedirEntrarParaEscribir() {
  avisar('Para apuntar resultados hay que entrar con la contraseña 🔑', true, 4200);
  abrirCandado();
}

/* Al cargar, si esta web tiene candado, se crea la ventanita por si hace falta */
document.addEventListener('DOMContentLoaded', () => {
  if (candadoActivo()) crearModalCandado();
});

/* ==========================================================================
   Para las PRUEBAS automáticas y para depurar desde la consola del navegador.
   (Ojo: NUBE_CONFIG es un `const`, así que desde fuera no se puede tocar
   directamente: hay que pasar por aquí.)
   ========================================================================== */
if (typeof window !== 'undefined') {
  window.Candado = {
    estado: () => ({ activo: candadoActivo(), dentro: CANDADO.dentro, email: CANDADO.email }),
    encender: (v) => { NUBE_CONFIG.candado.activo = (v !== false); },
    arrancar: arrancarCandado,
    ponSesion,              // simular entrar/salir sin gastar intentos reales
    aplicar: aplicarCandado
  };
}
