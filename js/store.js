/* ==========================================================================
   STORE — la única puerta por la que entran y salen los datos.
   HOY: guarda en el navegador (localStorage), para poder trabajar sin nube.
   FASE 2: este archivo se sustituye por Supabase y NADA MÁS cambia: las
   pantallas siempre piden los datos con Store.leer() y los mandan con
   Store.guardar(). Por eso está aislado aquí.
   ========================================================================== */

const CLAVE = 'torneos-efootball-v1';

const Store = {
  /* Devuelve la lista completa de torneos */
  leer() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      return JSON.parse(crudo);
    } catch (e) {
      console.warn('No se pudo leer el almacén local:', e);
      return null;
    }
  },

  /* Guarda la lista completa de torneos */
  guardar(torneos) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(torneos));
      return true;
    } catch (e) {
      console.warn('No se pudo guardar en el almacén local:', e);
      return false;
    }
  },

  /* Arranca el almacén con el torneo de prueba si está vacío */
  iniciar() {
    let torneos = this.leer();
    if (!torneos || !torneos.length) {
      torneos = [aplicarResultadosEjemplo(TORNEO_PRUEBA)];
      this.guardar(torneos);
    }
    return torneos;
  },

  /* Devuelve un torneo por su id */
  torneo(id) {
    const torneos = this.iniciar();
    return torneos.find(t => t.id === id) || torneos[0];
  },

  /* Guarda un torneo concreto dentro de la lista */
  guardarTorneo(torneo) {
    const torneos = this.iniciar();
    const i = torneos.findIndex(t => t.id === torneo.id);
    if (i >= 0) torneos[i] = torneo;
    else torneos.push(torneo);
    this.guardar(torneos);
  },

  /* Vuelve a dejar el torneo de prueba como estaba (botón de emergencia) */
  reiniciarDemo() {
    localStorage.removeItem(CLAVE);
    return this.iniciar();
  }
};

/* Ayudantes cortos que usan mucho las pantallas */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* Crea un elemento con clase y contenido de una vez */
function el(etiqueta, clase, html) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (html !== undefined) nodo.innerHTML = html;
  return nodo;
}

/* Saca un jugador del torneo por su id */
function jugador(torneo, id) {
  return torneo.jugadores.find(j => j.id === id) || { nombre: '¿?', emoji: '❔', color: '#7E93A8' };
}

/* Saca un futbolista del catálogo por su id */
function futbolista(torneo, id) {
  return torneo.futbolistas.find(f => f.id === id) || { nombre: '¿?' };
}

/* Saca un tipo de gol de la configuración por su id */
function tipoGol(torneo, id) {
  return torneo.config.tiposGol.find(t => t.id === id) || { nombre: '—', emoji: '' };
}

/* Genera un id nuevo para lo que se vaya creando */
function nuevoId(prefijo) {
  return prefijo + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
