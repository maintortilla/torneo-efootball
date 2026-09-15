/* ==========================================================================
   CONFIGURACIÓN POR DEFECTO
   Esto NO es la configuración de un torneo concreto: son los valores con los
   que nace un torneo nuevo cuando lo creas. Cada torneo guarda su propia copia
   y se puede editar entero desde la pantalla de Ajustes, sin tocar código.
   ========================================================================== */

const CONFIG_DEFECTO = {
  // --- Puntuación ---
  puntosVictoria: 3,
  puntosEmpate: 1,
  puntosDerrota: 0,

  // --- Formato ---
  formato: 'liguilla',          // 'liguilla' | 'grupos'
  vueltas: 2,                   // 1 = una vuelta, 2 = ida y vuelta
  clasificados: 4,              // cuántos pasan a eliminatorias
  partidoTercerPuesto: false,
  eliminatoriasIdaYVuelta: false,

  // --- Desempates, por orden de prioridad ---
  desempates: ['diferenciaGoles', 'golesFavor', 'enfrentamientoDirecto', 'tarjetas'],

  // --- Listas de opciones (se pueden ampliar desde Ajustes) ---
  tiposGol: [
    { id: 'normal',   nombre: 'Normal',        emoji: '⚽' },
    { id: 'penalti',  nombre: 'Penalti',       emoji: '🎯' },
    { id: 'falta',    nombre: 'Falta directa', emoji: '🌀' },
    { id: 'cabeza',   nombre: 'Cabeza',        emoji: '🗣️' },
    { id: 'remate',   nombre: 'Remate',        emoji: '🚀' },
    { id: 'propia',   nombre: 'Propia puerta', emoji: '😬' },
    { id: 'fuera',    nombre: 'Fuera de juego',emoji: '🚩' }
  ]
};

// Nombre legible de cada criterio de desempate (para la pantalla de Ajustes)
const NOMBRES_DESEMPATE = {
  diferenciaGoles:       'Diferencia de goles',
  golesFavor:            'Goles a favor',
  enfrentamientoDirecto: 'Enfrentamiento directo',
  tarjetas:              'Tarjetas (fair play)'
};
