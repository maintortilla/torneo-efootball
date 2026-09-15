/* ==========================================================================
   DATOS DE PRUEBA — un torneo de mentira para poder ver la web funcionando
   mientras no está conectada la nube.
   Aquí NO hay nada fijo: estos datos existen solo hasta la Fase 3, cuando los
   torneos se creen de verdad desde la pantalla de Ajustes.
   ========================================================================== */

const JUGADORES_PRUEBA = [
  { id: 'j1', nombre: 'Leo',    emoji: '🟢', color: '#00E676' },
  { id: 'j2', nombre: 'Javi',   emoji: '🔵', color: '#4DA3FF' },
  { id: 'j3', nombre: 'Marcos', emoji: '🟡', color: '#FFD54F' },
  { id: 'j4', nombre: 'Iker',   emoji: '🔴', color: '#FF4D5E' },
  { id: 'j5', nombre: 'Rubén',  emoji: '🟣', color: '#B388FF' },
  { id: 'j6', nombre: 'Hugo',   emoji: '🟠', color: '#FFA24D' }
];

const FUTBOLISTAS_PRUEBA = [
  { id: 'f1',  nombre: 'Mbappé' },
  { id: 'f2',  nombre: 'Haaland' },
  { id: 'f3',  nombre: 'Vinicius' },
  { id: 'f4',  nombre: 'Bellingham' },
  { id: 'f5',  nombre: 'Lamine Yamal' },
  { id: 'f6',  nombre: 'Julián Álvarez' },
  { id: 'f7',  nombre: 'Kane' },
  { id: 'f8',  nombre: 'Dembélé' },
  { id: 'f9',  nombre: 'Pedri' },
  { id: 'f10', nombre: 'Raphinha' }
];

/* El torneo de prueba ya trae la liga generada (30 partidos, ida y vuelta)
   y un par de resultados apuntados, para que las tablas no salgan vacías. */
const TORNEO_PRUEBA = {
  id: 't-otono-2026',
  nombre: 'Torneo Otoño 2026',
  estado: 'en_curso',
  config: JSON.parse(JSON.stringify(CONFIG_DEFECTO)),
  jugadores: JUGADORES_PRUEBA,
  futbolistas: FUTBOLISTAS_PRUEBA,
  partidos: []
};

/* Genera el calendario del torneo de prueba usando el generador real de la web
   (así probamos de verdad el algoritmo, no una lista escrita a mano). */
if (typeof generarCalendario === 'function') {
  TORNEO_PRUEBA.partidos = generarCalendario(TORNEO_PRUEBA.jugadores, TORNEO_PRUEBA.config);
}

/* Resultados de ejemplo para que la clasificación tenga vida */
const RESULTADOS_EJEMPLO = [
  { indice: 0,  gl: 3, gv: 1, goles: [
      { lado: 'local',     futbolistaId: 'f1', minuto: 12, tipoId: 'normal' },
      { lado: 'local',     futbolistaId: 'f1', minuto: 44, tipoId: 'penalti' },
      { lado: 'visitante', futbolistaId: 'f2', minuto: 61, tipoId: 'cabeza' },
      { lado: 'local',     futbolistaId: 'f5', minuto: 88, tipoId: 'remate' }
  ], stats: { posesionLocal: 58, tirosLocal: 14, tirosVisitante: 9, paradasLocal: 3, paradasVisitante: 6, amarillasLocal: 1, amarillasVisitante: 3, rojasLocal: 0, rojasVisitante: 0 } },
  { indice: 1,  gl: 2, gv: 2, goles: [
      { lado: 'local',     futbolistaId: 'f7', minuto: 23, tipoId: 'normal' },
      { lado: 'visitante', futbolistaId: 'f4', minuto: 55, tipoId: 'falta' },
      { lado: 'local',     futbolistaId: 'f7', minuto: 70, tipoId: 'normal' },
      { lado: 'visitante', futbolistaId: 'f4', minuto: 90, tipoId: 'penalti' }
  ], stats: null },
  { indice: 2,  gl: 0, gv: 4, goles: [
      { lado: 'visitante', futbolistaId: 'f2', minuto: 8,  tipoId: 'normal' },
      { lado: 'visitante', futbolistaId: 'f2', minuto: 33, tipoId: 'remate' },
      { lado: 'visitante', futbolistaId: 'f6', minuto: 59, tipoId: 'normal' },
      { lado: 'visitante', futbolistaId: 'f2', minuto: 77, tipoId: 'propia' }
  ], stats: null },
  { indice: 3,  gl: 1, gv: 1, goles: [], stats: null }
];

function aplicarResultadosEjemplo(torneo) {
  RESULTADOS_EJEMPLO.forEach((r, i) => {
    const p = torneo.partidos[r.indice];
    if (!p) return;
    p.jugado = true;
    p.golesLocal = r.gl;
    p.golesVisitante = r.gv;
    p.goles = r.goles.map(g => ({ ...g }));
    p.stats = r.stats ? { ...r.stats } : null;
    p.fecha = '2026-09-' + String(12 + i).padStart(2, '0');
  });
  return torneo;
}
