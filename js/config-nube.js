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

/* ¿Está configurada la nube? (si no, la web tira del navegador) */
function nubeConfigurada() {
  return Boolean(NUBE_CONFIG.url && NUBE_CONFIG.anonKey &&
                 String(NUBE_CONFIG.url).startsWith('http'));
}

/* Texto corto para que la web pueda avisar en qué modo está */
function modoDatos() {
  return nubeConfigurada() ? 'nube' : 'local';
}
