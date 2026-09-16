/* ==========================================================================
   STORE — la única puerta por la que entran y salen los datos.
   --------------------------------------------------------------------------
   Tiene DOS MODOS y las pantallas no necesitan saber en cuál está:

     · MODO LOCAL  → guarda en el navegador (localStorage). Sirve para trabajar
                     sin internet. Cada uno ve su propia copia.
     · MODO NUBE   → guarda en Supabase. Todos los que abran la web ven y
                     escriben los mismos datos.

   El modo se elige solo: si js/config-nube.js tiene la url y la clave
   rellenas, se usa la nube; si no, el navegador.

   Truco de diseño: las pantallas siempre piden los datos con Store.iniciar(),
   Store.torneo() y Store.guardarTorneo(). Por eso cambiar de local a nube no
   obliga a tocar ni una línea de la portada.
   ========================================================================== */

const CLAVE_LOCAL = 'torneos-efootball-v1';

/* ==========================================================================
   MODO LOCAL (navegador)
   ========================================================================== */
const StoreLocal = {
  leer() {
    try {
      const crudo = localStorage.getItem(CLAVE_LOCAL);
      return crudo ? JSON.parse(crudo) : null;
    } catch (e) {
      console.warn('No se pudo leer el almacén local:', e);
      return null;
    }
  },

  guardar(torneos) {
    try {
      localStorage.setItem(CLAVE_LOCAL, JSON.stringify(torneos));
      return true;
    } catch (e) {
      console.warn('No se pudo guardar en el almacén local:', e);
      return false;
    }
  },

  async iniciar() {
    let torneos = this.leer();
    if (!torneos || !torneos.length) {
      torneos = [aplicarResultadosEjemplo(TORNEO_PRUEBA)];
      this.guardar(torneos);
    }
    return torneos;
  },

  async guardarTorneo(torneo, modo) {
    const torneos = (this.leer() || []);
    const i = torneos.findIndex(t => t.id === torneo.id);
    if (i >= 0) torneos[i] = torneo; else torneos.push(torneo);
    this.guardar(torneos);
    return torneo;
  },

  async borrarTorneo(id) {
    const torneos = (this.leer() || []).filter(t => t.id !== id);
    this.guardar(torneos);
    return torneos;
  },

  async reiniciarDemo() {
    localStorage.removeItem(CLAVE_LOCAL);
    return this.iniciar();
  }
};

/* ==========================================================================
   MODO NUBE (Supabase)
   ========================================================================== */
const StoreNube = {
  cliente: null,

  /* Crea (una sola vez) la conexión con Supabase */
  conectar() {
    if (this.cliente) return this.cliente;
    if (typeof supabase === 'undefined') {
      throw new Error('La librería de Supabase no se ha cargado (¿sin internet?)');
    }
    this.cliente = supabase.createClient(NUBE_CONFIG.url, NUBE_CONFIG.anonKey);
    return this.cliente;
  },

  /* Trae TODOS los torneos con sus jugadores, partidos y futbolistas */
  async iniciar() {
    const c = this.conectar();

    let torneos = await this.traerTodo();

    // Primera vez: la base de datos está vacía → se sube el torneo de prueba
    if (!torneos.length) {
      await this.guardarTorneo(aplicarResultadosEjemplo(TORNEO_PRUEBA));
      torneos = await this.traerTodo();
    }

    return torneos;
  },

  async traerTodo() {
    const c = this.conectar();
    const T = NUBE_CONFIG.tablas;

    const [resT, resJ, resP, resF] = await Promise.all([
      c.from(T.torneos).select('*').order('creado_en', { ascending: true }),
      c.from(T.jugadores).select('*'),
      c.from(T.partidos).select('*'),
      c.from(T.futbolistas).select('*')
    ]);

    const error = resT.error || resJ.error || resP.error || resF.error;
    if (error) throw new Error('Error leyendo de Supabase: ' + error.message);

    return (resT.data || []).map(t => filasATorneo(t,
      (resJ.data || []).filter(j => j.torneo_id === t.id),
      (resP.data || []).filter(p => p.torneo_id === t.id),
      (resF.data || []).filter(f => f.torneo_id === t.id)
    ));
  },

  /* Sube un torneo completo (el torneo, sus jugadores, sus partidos y sus futbolistas)
     modo = 'reemplazar' → borra los partidos viejos antes de insertar los nuevos
     (se usa al regenerar el calendario, para no dejar partidos sueltos) */
  async guardarTorneo(torneo, modo) {
    const c = this.conectar();
    const T = NUBE_CONFIG.tablas;
    const filas = torneoAFilas(torneo);

    const resTorneo = await c.from(T.torneos).upsert(filas.torneo);
    if (resTorneo.error) throw new Error('No se pudo guardar el torneo: ' + resTorneo.error.message);

    if (filas.jugadores.length) {
      const r = await c.from(T.jugadores).upsert(filas.jugadores);
      if (r.error) throw new Error('No se pudieron guardar los jugadores: ' + r.error.message);
    }

    if (filas.futbolistas.length) {
      const r = await c.from(T.futbolistas).upsert(filas.futbolistas);
      if (r.error) throw new Error('No se pudieron guardar los futbolistas: ' + r.error.message);
    }

    if (modo === 'reemplazar') {
      const borrado = await c.from(T.partidos).delete().eq('torneo_id', torneo.id);
      if (borrado.error) throw new Error('No se pudieron borrar los partidos viejos: ' + borrado.error.message);
      if (filas.partidos.length) {
        const r = await c.from(T.partidos).insert(filas.partidos);
        if (r.error) throw new Error('No se pudieron guardar los partidos: ' + r.error.message);
      }
    } else if (filas.partidos.length) {
      const r = await c.from(T.partidos).upsert(filas.partidos);
      if (r.error) throw new Error('No se pudieron guardar los partidos: ' + r.error.message);
    }

    return torneo;
  },

  async reiniciarDemo() {
    throw new Error('En modo nube el borrado se hará desde los ajustes del torneo (Fase 3)');
  },

  /* Borra un torneo entero. Los partidos, jugadores y futbolistas caen solos
     (las tablas hijas tienen ON DELETE CASCADE en Supabase) */
  async borrarTorneo(id) {
    const c = this.conectar();
    const r = await c.from(NUBE_CONFIG.tablas.torneos).delete().eq('id', id);
    if (r.error) throw new Error('No se pudo borrar el torneo: ' + r.error.message);
    return this.traerTodo();
  }
};

/* ==========================================================================
   TRADUCCIONES entre el "idioma" de la web y el de la base de datos
   (En la web: localId, golesLocal... En la base de datos: local_id, goles_local)
   ========================================================================== */

function torneoAFilas(t) {
  return {
    torneo: {
      id: t.id,
      nombre: t.nombre,
      estado: t.estado || 'en_curso',
      config: t.config
    },
    jugadores: (t.jugadores || []).map(j => ({
      id: j.id, torneo_id: t.id, nombre: j.nombre, emoji: j.emoji || null, color: j.color || null
    })),
    futbolistas: (t.futbolistas || []).map(f => ({
      id: f.id, torneo_id: t.id, nombre: f.nombre
    })),
    partidos: (t.partidos || []).map(p => ({
      id: p.id,
      torneo_id: t.id,
      fase: p.fase || 'liga',
      jornada: p.jornada,
      local_id: p.localId,
      visitante_id: p.visitanteId,
      goles_local: Number(p.golesLocal) || 0,
      goles_visitante: Number(p.golesVisitante) || 0,
      jugado: Boolean(p.jugado),
      fecha: p.fecha || null
    }))
  };
}

function filasATorneo(t, jugadores, partidos, futbolistas) {
  // Si el torneo no trae configuración, se le pone la de por defecto
  const config = (t.config && Object.keys(t.config).length)
    ? t.config
    : JSON.parse(JSON.stringify(CONFIG_DEFECTO));

  return {
    id: t.id,
    nombre: t.nombre,
    estado: t.estado,
    config,
    jugadores: jugadores.map(j => ({ id: j.id, nombre: j.nombre, emoji: j.emoji, color: j.color })),
    futbolistas: futbolistas.map(f => ({ id: f.id, nombre: f.nombre })),
    partidos: partidos.map(p => ({
      id: p.id,
      fase: p.fase,
      jornada: p.jornada,
      localId: p.local_id,
      visitanteId: p.visitante_id,
      golesLocal: p.goles_local,
      golesVisitante: p.goles_visitante,
      jugado: p.jugado,
      fecha: p.fecha,
      goles: [],     // se rellenarán en la Fase 6 (lectura de la captura)
      stats: null
    }))
  };
}

/* ==========================================================================
   STORE: la puerta única. Elige el modo y guarda los torneos en memoria
   ========================================================================== */
const Store = {
  cache: [],
  motor: null,

  /* Decide si trabajamos contra la nube o contra el navegador */
  elegirMotor() {
    if (!this.motor) {
      this.motor = nubeConfigurada() ? StoreNube : StoreLocal;
    }
    return this.motor;
  },

  /* Carga TODO y lo deja en memoria. Es lo primero que llama la web. */
  async iniciar() {
    const motor = this.elegirMotor();
    this.cache = await motor.iniciar();
    return this.cache;
  },

  /* Devuelve un torneo de la memoria (por eso es instantáneo) */
  torneo(id) {
    return this.cache.find(t => t.id === id) || this.cache[0] || null;
  },

  /* Cualquier cambio de un torneo pasa por aquí */
  async guardarTorneo(torneo, modo) {
    const motor = this.elegirMotor();
    await motor.guardarTorneo(torneo, modo);

    const i = this.cache.findIndex(t => t.id === torneo.id);
    if (i >= 0) this.cache[i] = torneo; else this.cache.push(torneo);

    return torneo;
  },

  /* Volver a leer de la nube (para ver lo que han apuntado los demás) */
  async recargar() {
    return this.iniciar();
  },

  /* Crea un torneo nuevo (lo deja guardado y en memoria) */
  async crearTorneo(torneo) {
    await this.guardarTorneo(torneo);
    return torneo;
  },

  /* Borra un torneo y devuelve la lista que queda */
  async borrarTorneo(id) {
    const motor = this.elegirMotor();
    this.cache = await motor.borrarTorneo(id);
    return this.cache;
  },

  async reiniciarDemo() {
    const motor = this.elegirMotor();
    this.cache = await motor.reiniciarDemo();
    return this.cache;
  },

  /* ¿En qué modo estamos? Para avisar al usuario */
  modo() { return modoDatos(); }
};

/* Exponer el Store en window: así se puede inspeccionar desde la consola del
   navegador (útil para depurar) y lo usan las pruebas automáticas. */
if (typeof window !== 'undefined') window.Store = Store;

/* ==========================================================================
   El cliente de Supabase a mano (lo usa el candado, para el login).
   Solo tiene sentido en modo nube.
   ========================================================================== */
function clienteNube() {
  return StoreNube.conectar();
}

/* ==========================================================================
   AYUDANTES cortos que usan mucho las pantallas
   ========================================================================== */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function el(etiqueta, clase, html) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (html !== undefined) nodo.innerHTML = html;
  return nodo;
}

function jugador(torneo, id) {
  return (torneo.jugadores || []).find(j => j.id === id)
    || { nombre: '¿?', emoji: '❔', color: '#7E93A8' };
}

function futbolista(torneo, id) {
  return (torneo.futbolistas || []).find(f => f.id === id) || { nombre: '¿?' };
}

function tipoGol(torneo, id) {
  return (torneo.config.tiposGol || []).find(t => t.id === id) || { nombre: '—', emoji: '' };
}

/* nuevoId() vive en modelo.js (se carga antes y así está disponible para todo) */
