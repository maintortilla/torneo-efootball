/* ==========================================================================
   MODELO — las reglas del juego, en funciones puras.
   Aquí vive TODO el cálculo: clasificación, calendario y eliminatorias.
   Nada de esto depende de la nube ni de la pantalla: entra un torneo, sale un
   resultado. Se configura entero desde torneo.config, sin nada fijo.
   ========================================================================== */

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
  let idPartido = 1;

  for (let r = 0; r < rondas; r++) {
    for (let i = 0; i < porRonda; i++) {
      const local = lista[i];
      const visitante = lista[n - 1 - i];
      if (local === descansa || visitante === descansa) continue;
      partidos.push({
        id: 'p' + idPartido++,
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
    const vueltas = partidos.length;
    const segunda = partidos.map(p => ({
      ...p,
      id: 'p' + idPartido++,
      jornada: p.jornada + rondas,
      localId: p.visitanteId,
      visitanteId: p.localId,
      goles: [],
      jugado: false
    }));
    return partidos.concat(segunda).slice(0, partidos.length * 2);
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
