/* ==========================================================================
   PREFERENCIAS DE LA WEB (las de cada uno, no las del torneo)
   --------------------------------------------------------------------------
   Aquí viven los ajustes que NO son de un torneo concreto: el sonido, el
   volumen y la actualización automática. Se guardan en ESTE navegador
   (localStorage), así que cada uno puede tener los suyos sin molestar a los
   demás. El aspecto (los temas) vive en js/tema.js por ser más antiguo.

   Se cambian desde la página "Ajustes de la web" (ajustes-web.html).
   ========================================================================== */

const PREF = {
  sonido:        'sonido-web',              // '1' con sonido · '0' sin sonido
  volumen:       'volumen-web',             // 0 a 100
  autoRefresco:  'auto-refresco',           // '1' encendido · '0' apagado
  segundos:      'auto-refresco-segundos'   // cada cuántos segundos se refresca
};

/* Los segundos que se pueden elegir (el valor por defecto es el primero) */
const SEGUNDOS_OPCIONES = [15, 30, 60, 120];

function leerPref(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? porDefecto : v;
  } catch (e) {
    return porDefecto;
  }
}

function guardarPref(clave, valor) {
  try { localStorage.setItem(clave, String(valor)); return true; }
  catch (e) { return false; }
}

/* ¿Suena la web? Por defecto sí.
   Compatibilidad: antes el silencio de la ruleta se guardaba en otra clave
   ('ruleta-silencio'); si existe y no hay preferencia nueva, se respeta. */
function sonidoActivo() {
  const guardado = leerPref(PREF.sonido, null);
  if (guardado !== null) return guardado === '1';

  const viejo = leerPref('ruleta-silencio', null);
  if (viejo !== null) return viejo !== '1';

  return true;
}

function ponerSonido(activo) {
  return guardarPref(PREF.sonido, activo ? '1' : '0');
}

/* El volumen, de 0 a 1 (para el audio). Se guarda de 0 a 100. */
function volumenWeb() {
  const n = Number(leerPref(PREF.volumen, '70'));
  const valor = isNaN(n) ? 70 : Math.max(0, Math.min(100, n));
  return valor / 100;
}

function volumenWebPorCiento() {
  return Math.round(volumenWeb() * 100);
}

function ponerVolumen(porCiento) {
  const n = Math.max(0, Math.min(100, Math.round(Number(porCiento) || 0)));
  return guardarPref(PREF.volumen, n);
}

/* ¿Se refresca sola la página? Por defecto sí, cada 30 segundos. */
function autoRefrescoActivo() {
  return leerPref(PREF.autoRefresco, '1') === '1';
}

function ponerAutoRefresco(activo) {
  return guardarPref(PREF.autoRefresco, activo ? '1' : '0');
}

/* Cada cuántos segundos. Si el valor guardado no es de los permitidos, 30. */
function segundosAutoRefresco() {
  const n = Number(leerPref(PREF.segundos, '30'));
  return SEGUNDOS_OPCIONES.includes(n) ? n : 30;
}

function ponerSegundosAutoRefresco(segundos) {
  const n = Number(segundos);
  const valor = SEGUNDOS_OPCIONES.includes(n) ? n : 30;
  return guardarPref(PREF.segundos, valor);
}
