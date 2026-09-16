/* ==========================================================================
   CONFIGURACIÓN DE LA NUBE (Supabase)
   --------------------------------------------------------------------------
   Estos dos datos hay que rellenarlos UNA vez, cuando el proyecto de Supabase
   esté creado. Son PÚBLICOS a propósito: la clave "anon" está pensada para ir
   en el navegador. Quien protege los datos son las políticas de la base de
   datos (RLS), no el secreto de esta clave.

   ⚠️ NUNCA poner aquí la clave "service_role": esa sí es secreta y da acceso
   total a la base de datos.

   Dónde se copian (Supabase → Project Settings → API):
     - url      = "Project URL"       (tipo https://xxxxxxxx.supabase.co)
     - anonKey  = "anon public"        (un texto largo que empieza por eyJ...)

   Si estos campos están vacíos, la web funciona en MODO LOCAL: los datos se
   guardan en el navegador (útil para trabajar sin internet). En cuanto se
   rellenan, TODOS los que abran la web ven y escriben los mismos datos.
   ========================================================================== */

const NUBE_CONFIG = {
  url: 'https://raccyikqsekbrnkjfvur.supabase.co',
  anonKey: 'sb_publishable_uhPIwnHofJ9p3abBAnC88w_Sq85YIB2',

  /* ---------------------------------------------------------------- CANDADO
     Para APUNTAR resultados hay que entrar con la contraseña del grupo.
     Sin entrar, la web se ve entera pero en modo mirar.

     activo = false → la web funciona como siempre (cualquiera puede escribir).
     Se pone en true cuando la cuenta del grupo YA existe en Supabase y las
     políticas de la base de datos están puestas (si no, nadie podría escribir).

     La contraseña NO se escribe aquí: la valida Supabase. Aquí solo va el
     email de la cuenta compartida que se crea en Supabase → Authentication. */
  candado: {
    activo: false,
    email: 'amigos@torneo-efootball.app'
  },

  // Nombre de las tablas (por si algún día hubiera que cambiarlas)
  tablas: {
    torneos: 'torneos',
    jugadores: 'jugadores',
    partidos: 'partidos',
    futbolistas: 'futbolistas',
    goles: 'goles'
  }
};

/* ==========================================================================
   MODO PRUEBA — los tests NUNCA tocan la nube de verdad
   --------------------------------------------------------------------------
   Cuando la web se abre DENTRO de una página de pruebas (docs/prueba-*.html),
   se fuerza el MODO LOCAL: los datos van al navegador del test, no a Supabase.
   Así un test no puede crear ni borrar los torneos de nadie.

   (Pasó: un test de la pantalla de Ajustes creó torneos de prueba y borró el
   torneo real de Leo mientras se ejecutaba la batería de pruebas.)

   Un test que necesite la nube de verdad puede pedirla con `?nube=1`, y ese
   test se encarga de limpiar lo que haya creado.

   El candado sí se puede probar en local (`Candado.encender(true)`): se
   comprueba a propósito sin nube, porque solo esconde botones.
   ========================================================================== */
function modoPruebaLocal() {
  try {
    const busqueda = String(window.location.search || '');
    if (/(^|[?&])nube=1(&|$)/.test(busqueda)) return false;   // lo pide a propósito
    if (/(^|[?&])local=1(&|$)/.test(busqueda)) return true;

    if (window.parent && window.parent !== window &&
        /\/docs\/prueba-/.test(String(window.parent.location.href))) {
      return true;
    }
  } catch (e) { /* si no se puede mirar, no forzamos nada */ }
  return false;
}

/* ¿Está configurada la nube? (si no, la web tira del navegador) */
function nubeConfigurada() {
  if (modoPruebaLocal()) return false;
  return Boolean(NUBE_CONFIG.url && NUBE_CONFIG.anonKey &&
                 String(NUBE_CONFIG.url).startsWith('http'));
}

/* Texto corto para que la web pueda avisar en qué modo está */
function modoDatos() {
  return nubeConfigurada() ? 'nube' : 'local';
}

/* ¿Estamos en el navegador de un test? (para avisarlo por consola) */
function enModoPrueba() {
  return modoPruebaLocal();
}
