/* ==========================================================================
   TEMA VISUAL — la paleta de colores de la web
   --------------------------------------------------------------------------
   · "verde"  → el tema de siempre (verde neón sobre azul noche)
   · "morado" → la paleta de plataforma (violeta sobre gris oscuro)

   Se guarda en el navegador (cada uno puede tener la suya) y se cambia desde
   Ajustes → Aspecto de la web.

   Este archivo se carga en el <head> de las páginas a propósito: aplica el
   tema ANTES de que se pinte nada, así no se ve el parpadeo de color al
   cambiar de página.
   ========================================================================== */

const TEMAS = {
  verde:  { nombre: 'Verde neón', emoji: '🟢', descripcion: 'El de siempre: verde neón sobre azul noche' },
  morado: { nombre: 'Morado',     emoji: '🟣', descripcion: 'Violeta sobre gris oscuro, estilo plataforma' }
};

const CLAVE_TEMA = 'tema-web';
const TEMA_POR_DEFECTO = 'verde';

function temaGuardado() {
  try {
    const t = localStorage.getItem(CLAVE_TEMA);
    return TEMAS[t] ? t : TEMA_POR_DEFECTO;
  } catch (e) {
    return TEMA_POR_DEFECTO;
  }
}

function temaActual() {
  return document.documentElement.getAttribute('data-tema') || TEMA_POR_DEFECTO;
}

/* Pone el tema. Con guardar = false no toca el navegador (se usa al arrancar). */
function aplicarTema(tema, guardar) {
  const elegido = TEMAS[tema] ? tema : TEMA_POR_DEFECTO;

  if (elegido === TEMA_POR_DEFECTO) {
    document.documentElement.removeAttribute('data-tema');
  } else {
    document.documentElement.setAttribute('data-tema', elegido);
  }

  if (guardar !== false) {
    try { localStorage.setItem(CLAVE_TEMA, elegido); } catch (e) {}
  }
  return elegido;
}

/* Al cargar la página: se aplica lo que hubiera guardado (sin volver a guardar) */
aplicarTema(temaGuardado(), false);
