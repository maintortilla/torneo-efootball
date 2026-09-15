/* ==========================================================================
   MODELO — las reglas del juego, en funciones puras.
   Aquí vive TODO el cálculo: clasificación, calendario y eliminatorias.
   Nada de esto depende de la nube ni de la pantalla: entra un torneo, sale un
   resultado. Se configura entero desde torneo.config, sin nada fijo.
   ========================================================================== */

/* -------------------------------------------------------------------------
   IDENTIFICADORES ÚNICOS
   ¡Ojo! Tienen que ser únicos en TODA la base de datos, no solo dentro de un
   torneo. Si dos torneos generasen "p1", "p2"… se pisarían entre ellos.
   ------------------------------------------------------------------------- */
let contadorIds = 0;
function nuevoId(prefijo) {
  contadorIds++;
  return prefijo + '-' + Date.now().toString(36) + contadorIds.toString(36);
}

/* -------------------------------------------------------------------------
   CALENDARIO: reparte todos contra todos sin repetir ni dejarse ninguno.
   Usa el "método del círculo": uno se queda fijo y los demás van rotando.
   Si el torneo es a ida y vuelta (config.vueltas = 2), se repite la segunda
   vuelta con los campos local/visitante cambiados.
   ------------------------------------------------------------------------- */
function generarCalendario(jugadores, config) {
  const ids = jugadores.map(j => j.id);
  const lista = ids.slice();

  // Si son impares, se añade un "descansa" ficticio para que cuadre
  const descansa = '__libre__';
  if (lista.length % 2 !== 0) lista.push(descansa);

  const n = lista.length;
  const rondas = n - 1;
  const porRonda = n / 2;
  const partidos = [];

  for (let r = 0; r < rondas; r++) {
    for (let i = 0; i < porRonda; i++) {
      const local = lista[i];
      const visitante = lista[n - 1 - i];
      if (local === descansa || visitante === descansa) continue;
      partidos.push({
        id: nuevoId('p'),
        fase: 'liga',
        jornada: r + 1,
        localId: local,
        visitanteId: visitante,
        golesLocal: 0,
        golesVisitante: 0,
        jugado: false,
        goles: [],
        stats: null,
        fecha: null
      });
    }
    // Rotación: el primero fijo, el resto gira una posición
    lista.splice(1, 0, lista.pop());
  }

  // Segunda vuelta (ida y vuelta): mismos cruces con los lados invertidos
  if (config.vueltas === 2) {
    const segunda = partidos.map(p => ({
      ...p,
      id: nuevoId('p'),
      jornada: p.jornada + rondas,
      localId: p.visitanteId,
      visitanteId: p.localId,
      goles: [],
      jugado: false
    }));
    return partidos.concat(segunda);
  }

  return partidos;
}

/* -------------------------------------------------------------------------
   CLASIFICACIÓN: se calcula solo con los partidos ya jugados.
   Los puntos salen de la configuración del torneo (3/1/0 por defecto).
   El orden final respeta los desempates configurados.
   ------------------------------------------------------------------------- */
function calcularClasificacion(torneo) {
  const cfg = torneo.config;

  // Casillero de cada jugador
  const tabla = {};
  torneo.jugadores.forEach(j => {
    tabla[j.id] = {
      id: j.id,
      nombre: j.nombre,
      emoji: j.emoji,
      color: j.color,
      pj: 0, pg: 0, pe: 0, pp: 0,
      gf: 0, gc: 0, dg: 0,
      pts: 0,
      amarillas: 0,
      rojas: 0,
      forma: []           // últimos resultados, para la rachita
    };
  });

  const jugados = torneo.partidos.filter(p => p.jugado && p.fase === 'liga');

  jugados.forEach(p => {
    const local = tabla[p.localId];
    const visit = tabla[p.visitanteId];
    if (!local || !visit) return;

    const gl = Number(p.golesLocal) || 0;
    const gv = Number(p.golesVisitante) || 0;

    local.pj++; visit.pj++;
    local.gf += gl; local.gc += gv;
    visit.gf += gv; visit.gc += gl;

    if (gl > gv) {
      local.pg++; visit.pp++;
      local.pts += cfg.puntosVictoria;
      visit.pts += cfg.puntosDerrota;
      local.forma.push('G'); visit.forma.push('P');
    } else if (gl < gv) {
      visit.pg++; local.pp++;
      visit.pts += cfg.puntosVictoria;
      local.pts += cfg.puntosDerrota;
      visit.forma.push('G'); local.forma.push('P');
    } else {
      local.pe++; visit.pe++;
      local.pts += cfg.puntosEmpate;
      visit.pts += cfg.puntosEmpate;
      local.forma.push('E'); visit.forma.push('E');
    }

    // Tarjetas para el desempate por fair play (si están apuntadas)
    if (p.stats) {
      local.amarillas += Number(p.stats.amarillasLocal) || 0;
      local.rojas     += Number(p.stats.rojasLocal) || 0;
      visit.amarillas += Number(p.stats.amarillasVisitante) || 0;
      visit.rojas     += Number(p.stats.rojasVisitante) || 0;
    }
  });

  Object.values(tabla).forEach(e => { e.dg = e.gf - e.gc; });

  const fila = Object.values(tabla);

  // Orden final aplicando los desempates configurados, en su orden
  fila.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;

    for (const criterio of cfg.desempates) {
      if (criterio === 'diferenciaGoles' && b.dg !== a.dg) return b.dg - a.dg;
      if (criterio === 'golesFavor' && b.gf !== a.gf) return b.gf - a.gf;
      if (criterio === 'tarjetas') {
        const fairA = a.rojas * 3 + a.amarillas;
        const fairB = b.rojas * 3 + b.amarillas;
        if (fairA !== fairB) return fairA - fairB;
      }
      if (criterio === 'enfrentamientoDirecto') {
        const duelo = enfrentamientoDirecto(torneo, a.id, b.id);
        if (duelo !== 0) return duelo;
      }
    }
    return a.nombre.localeCompare(b.nombre);
  });

  return fila;
}

/* Quién ganó los duelos entre dos jugadores: negativo si gana "a" */
function enfrentamientoDirecto(torneo, aId, bId) {
  let saldoA = 0, saldoB = 0;
  torneo.partidos
    .filter(p => p.jugado && ((p.localId === aId && p.visitanteId === bId) ||
                              (p.localId === bId && p.visitanteId === aId)))
    .forEach(p => {
      const golesA = p.localId === aId ? Number(p.golesLocal) : Number(p.golesVisitante);
      const golesB = p.localId === bId ? Number(p.golesLocal) : Number(p.golesVisitante);
      saldoA += golesA; saldoB += golesB;
    });
  return (saldoB - saldoA);   // "a" gana si su saldo es mayor → devuelve negativo
}

/* -------------------------------------------------------------------------
   PICHICHI: máximos goleadores (futbolistas), más los goles por tipo.
   ------------------------------------------------------------------------- */
function calcularGoleadores(torneo) {
  const cuenta = {};
  torneo.partidos.forEach(p => {
    (p.goles || []).forEach(g => {
      if (!g.futbolistaId) return;
      if (!cuenta[g.futbolistaId]) cuenta[g.futbolistaId] = { id: g.futbolistaId, goles: 0, tipos: {} };
      cuenta[g.futbolistaId].goles++;
      cuenta[g.futbolistaId].tipos[g.tipoId] = (cuenta[g.futbolistaId].tipos[g.tipoId] || 0) + 1;
    });
  });
  const lista = Object.values(cuenta);
  lista.forEach(g => {
    const f = torneo.futbolistas.find(x => x.id === g.id);
    g.nombre = f ? f.nombre : '¿?';
  });
  lista.sort((a, b) => b.goles - a.goles);
  return lista;
}

/* -------------------------------------------------------------------------
   ELIMINATORIAS: coge a los N primeros y cruza 1º vs último clasificado.
   ------------------------------------------------------------------------- */
function generarEliminatorias(clasificacion, config) {
  const n = config.clasificados;
  const clasificados = clasificacion.slice(0, n);
  const partidos = [];

  if (clasificados.length < 2) return partidos;

  // Cruces: 1º contra el último, 2º contra el penúltimo, etc.
  const cruces = [];
  for (let i = 0; i < clasificados.length / 2; i++) {
    cruces.push([clasificados[i], clasificados[clasificados.length - 1 - i]]);
  }

  const nombreFase = clasificados.length === 4 ? 'semifinal'
                   : clasificados.length === 8 ? 'cuartos'
                   : clasificados.length === 2 ? 'final'
                   : 'ronda';

  cruces.forEach((c, i) => {
    partidos.push({
      id: 'e' + (i + 1),
      fase: nombreFase,
      jornada: null,
      localId: c[0].id,
      visitanteId: c[1].id,
      golesLocal: 0,
      golesVisitante: 0,
      jugado: false,
      goles: [],
      stats: null,
      fecha: null
    });
  });

  return partidos;
}

/* Media de posesión, tiros y paradas de un jugador (para las estadísticas) */
function calcularStatsJugador(torneo, jugadorId) {
  let posesion = 0, tiros = 0, paradas = 0, partidosConStats = 0;

  torneo.partidos.filter(p => p.jugado && p.stats).forEach(p => {
    const esLocal = p.localId === jugadorId;
    const esVisit = p.visitanteId === jugadorId;
    if (!esLocal && !esVisit) return;

    partidosConStats++;
    posesion += Number(esLocal ? p.stats.posesionLocal : (100 - Number(p.stats.posesionLocal))) || 0;
    tiros    += Number(esLocal ? p.stats.tirosLocal : p.stats.tirosVisitante) || 0;
    paradas  += Number(esLocal ? p.stats.paradasLocal : p.stats.paradasVisitante) || 0;
  });

  if (!partidosConStats) return null;
  return {
    partidos: partidosConStats,
    posesionMedia: Math.round(posesion / partidosConStats),
    tirosMedia: (tiros / partidosConStats).toFixed(1),
    paradasMedia: (paradas / partidosConStats).toFixed(1)
  };
}

/* =========================================================================
   RULETA DE EMPAREJAMIENTOS (jornadas a mano)
   -------------------------------------------------------------------------
   El torneo nace SIN partidos: los cruces se sortean o se apuntan a mano
   jornada a jornada. Aquí vive la lógica del sorteo, que es pura.
   ========================================================================= */

/* Clave de una pareja, dé igual quién fue local (para saber si ya existe) */
function clavePareja(aId, bId) {
  return [aId, bId].sort().join('|');
}

/* ¿Estos dos ya tienen un partido apuntado (jugado o pendiente) en la liga? */
function parejaYaExiste(torneo, aId, bId) {
  const clave = clavePareja(aId, bId);
  return torneo.partidos.some(p =>
    p.fase === 'liga' && clavePareja(p.localId, p.visitanteId) === clave);
}

/* Los partidos de liga de una jornada concreta */
function partidosDeJornada(torneo, jornada) {
  return torneo.partidos.filter(p => p.fase === 'liga' && Number(p.jornada) === Number(jornada));
}

/* ¿Este jugador ya tiene partido en esa jornada? (para avisar, no para prohibir) */
function jugadorYaJuegaEnJornada(torneo, jugadorId, jornada) {
  return partidosDeJornada(torneo, jornada)
    .some(p => p.localId === jugadorId || p.visitanteId === jugadorId);
}

/* ¿Cuál sería la jornada siguiente a la última que hay? */
function siguienteJornada(torneo) {
  const liga = torneo.partidos.filter(p => p.fase === 'liga');
  if (!liga.length) return 1;
  return Math.max(...liga.map(p => Number(p.jornada) || 1)) + 1;
}

/* En qué jornada apetece apuntar el siguiente partido: la primera que aún no
   tenga todos los cruces posibles (con 6 jugadores, 3 partidos por jornada). */
function jornadaSugerida(torneo) {
  const porJornada = Math.max(1, Math.floor(torneo.jugadores.length / 2));
  let j = 1;
  while (partidosDeJornada(torneo, j).length >= porJornada) j++;
  return j;
}

/* A quién puede tocarle el turno en la ruleta:
   - nadie elegido aún  → todos los jugadores
   - ya hay un local    → los demás, quitando los cruces ya apuntados
     (salvo que se permita repetir)
   Nunca se ofrece a quien ya ha salido en este mismo sorteo, ni a quien YA
   JUEGA en la jornada para la que se está sorteando (nadie juega dos veces
   en la misma jornada). */
function candidatosRuleta(torneo, opciones) {
  const o = opciones || {};
  const yaElegidos = o.yaElegidos || [];

  let candidatos = torneo.jugadores.filter(j => !yaElegidos.includes(j.id));

  if (o.jornada) {
    candidatos = candidatos.filter(j => !jugadorYaJuegaEnJornada(torneo, j.id, o.jornada));
  }

  if (o.localId && !o.permitirRepetir) {
    candidatos = candidatos.filter(j => !parejaYaExiste(torneo, o.localId, j.id));
  }
  return candidatos;
}

/* Elige uno al azar de la lista. El número (0 a 1) se puede pasar para poder
   probarlo; si no, se usa el azar de verdad. */
function elegirAlAzar(lista, azar) {
  if (!lista.length) return null;
  const n = (typeof azar === 'number') ? azar : Math.random();
  const i = Math.max(0, Math.min(lista.length - 1, Math.floor(n * lista.length)));
  return lista[i];
}

/* Un partido de liga nuevo y vacío, listo para apuntarle el resultado */
function nuevoPartidoLiga(localId, visitanteId, jornada) {
  return {
    id: nuevoId('p'),
    fase: 'liga',
    jornada: Number(jornada) || 1,
    localId: localId,
    visitanteId: visitanteId,
    golesLocal: 0,
    golesVisitante: 0,
    jugado: false,
    goles: [],
    stats: null,
    fecha: null
  };
}

/* =========================================================================
   TORNEO NUEVO Y FASES FINALES (Fase 3)
   ========================================================================= */

/* Monta un torneo nuevo desde cero.
   Nace SIN partidos: los cruces se montan jornada a jornada (con la ruleta o a
   mano). Si algún día se quiere el calendario entero de golpe, están
   generarCalendario() y regenerarCalendario(). */
function crearTorneoNuevo(nombre, jugadores, configPersonalizada) {
  const config = Object.assign(
    JSON.parse(JSON.stringify(CONFIG_DEFECTO)),
    configPersonalizada || {}
  );

  const torneo = {
    id: nuevoId('t'),
    nombre: nombre,
    estado: 'en_curso',
    config: config,
    jugadores: jugadores,
    futbolistas: [],
    partidos: []
  };

  return torneo;
}

/* Regenera el calendario de un torneo que ya existe (se pierden los resultados) */
function regenerarCalendario(torneo) {
  const ids = {};
  torneo.jugadores.forEach(j => { ids[j.nombre] = 0; });   // solo para saber que existen

  // Los partidos viejos de liga se tiran; se conserva lo que ya se jugó en
  // eliminatorias (normalmente no hay nada) para no romper nada.
  const eliminatorias = torneo.partidos.filter(p => p.fase !== 'liga');
  torneo.partidos = generarCalendario(torneo.jugadores, torneo.config).concat(eliminatorias);
  return torneo;
}

/* ¿En qué punto está el torneo y qué toca hacer? */
function estadoDeFases(torneo) {
  const liga = torneo.partidos.filter(p => p.fase === 'liga');
  const semis = torneo.partidos.filter(p => p.fase === 'semifinal');
  const final = torneo.partidos.filter(p => p.fase === 'final');
  const tercero = torneo.partidos.filter(p => p.fase === 'tercer_puesto');

  if (!liga.length) return { paso: 'sin_calendario' };

  const ligaPendientes = liga.filter(p => !p.jugado).length;
  if (ligaPendientes > 0) return { paso: 'liga', pendientes: ligaPendientes };

  if (!semis.length) return { paso: 'generar_semis' };

  const semisPendientes = semis.filter(p => !p.jugado).length;
  if (semisPendientes > 0) return { paso: 'semis', pendientes: semisPendientes };

  if (!final.length) return { paso: 'generar_final' };

  const finalPendiente = final.filter(p => !p.jugado).length;
  const terceroPendiente = torneo.config.partidoTercerPuesto
    ? tercero.filter(p => !p.jugado).length : 0;

  if (finalPendiente === 0 && terceroPendiente === 0) return { paso: 'terminado' };
  return { paso: 'final', pendientes: finalPendiente + terceroPendiente };
}

/* Genera la ronda que toque (semifinales o final) a partir de los resultados */
function generarSiguienteRonda(torneo) {
  const estado = estadoDeFases(torneo);
  const clasificacion = calcularClasificacion(torneo);
  const nuevos = [];

  if (estado.paso === 'generar_semis') {
    generarEliminatorias(clasificacion, torneo.config).forEach(c => {
      nuevos.push({
        id: nuevoId('e'),
        fase: 'semifinal',
        jornada: null,
        localId: c.localId,
        visitanteId: c.visitanteId,
        golesLocal: 0, golesVisitante: 0,
        jugado: false, goles: [], stats: null, fecha: null
      });
    });
    return { nuevos, mensaje: 'Semifinales generadas ✅' };
  }

  if (estado.paso === 'generar_final') {
    const semis = torneo.partidos.filter(p => p.fase === 'semifinal');
    const ganadores = semis.map(s => ganadorDe(torneo, s, clasificacion));
    if (ganadores.some(g => !g)) {
      return { nuevos: [], mensaje: 'Faltan resultados de semifinales' };
    }

    nuevos.push({
      id: nuevoId('e'),
      fase: 'final',
      jornada: null,
      localId: ganadores[0],
      visitanteId: ganadores[1],
      golesLocal: 0, golesVisitante: 0,
      jugado: false, goles: [], stats: null, fecha: null
    });

    if (torneo.config.partidoTercerPuesto) {
      const perdedores = semis.map(s => perdedorDe(torneo, s, clasificacion));
      nuevos.push({
        id: nuevoId('e'),
        fase: 'tercer_puesto',
        jornada: null,
        localId: perdedores[0],
        visitanteId: perdedores[1],
        golesLocal: 0, golesVisitante: 0,
        jugado: false, goles: [], stats: null, fecha: null
      });
    }

    return { nuevos, mensaje: 'Final generada ✅' };
  }

  return { nuevos: [], mensaje: 'Todavía no toca generar nada' };
}

/* Quién gana un partido. Si empatan en eliminatorias, pasa el que mejor quedó
   en la liguilla (regla habitual en los torneos y así no hace falta que nadie
   apunte los penaltis). */
function ganadorDe(torneo, partido, clasificacion) {
  if (!partido.jugado) return null;
  if (partido.golesLocal > partido.golesVisitante) return partido.localId;
  if (partido.golesVisitante > partido.golesLocal) return partido.visitanteId;

  const orden = (clasificacion || calcularClasificacion(torneo)).map(f => f.id);
  const posLocal = orden.indexOf(partido.localId);
  const posVisit = orden.indexOf(partido.visitanteId);
  return posLocal <= posVisit ? partido.localId : partido.visitanteId;
}

function perdedorDe(torneo, partido, clasificacion) {
  const g = ganadorDe(torneo, partido, clasificacion);
  if (!g) return null;
  return g === partido.localId ? partido.visitanteId : partido.localId;
}

/* ¿Este jugador tiene partidos jugados? (para no dejarle quitar del torneo) */
function tienePartidosJugados(torneo, jugadorId) {
  return torneo.partidos.some(p => p.jugado && (p.localId === jugadorId || p.visitanteId === jugadorId));
}

/* ¿Hay algún resultado apuntado en la liguilla? */
function hayResultados(torneo) {
  return torneo.partidos.some(p => p.jugado);
}
