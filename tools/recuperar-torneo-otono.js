/* ============================================================================
   RECUPERAR el torneo "Torneo Otoño 2026" en la nube.

   Contexto: un test de la web (que toca la nube de verdad) borró el torneo.
   Datos reconstruidos desde las capturas de pantalla y las comprobaciones que
   se hicieron contra Supabase antes de la pérdida:

     · 6 jugadores (Leo, Javi, Marcos, Iker, Rubén, Hugo) con sus emojis/colores
     · Liguilla ida y vuelta = 30 partidos (calendario del método del círculo)
     · 4 resultados apuntados:
         Rubén 2-2 Javi   · Rubén 1-1 Leo   · Marcos 0-4 Iker   · Iker 0-2 Hugo
       Que dan la clasificación exacta que se veía:
         1º Iker 3 pts (4-2) · 2º Hugo 3 pts (2-0) · 3º Rubén 2 pts (3-3, dos empates)
         4º Javi 1 pt (2-2) · 5º Leo 1 pt (1-1) · 6º Marcos 0 pts (0-4)
       Y los mismos totales del resumen: 4/30 jugados, 12 goles, 3.0 por partido.

   Uso:  node tools/recuperar-torneo-otono.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const raiz = path.join(__dirname, '..');
const fuente = ['js/config.js', 'js/modelo.js']
  .map(f => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n');
vm.runInThisContext(fuente + ';globalThis.__api = { CONFIG_DEFECTO, generarCalendario };');
const { CONFIG_DEFECTO, generarCalendario } = globalThis.__api;

const URL = 'https://raccyikqsekbrnkjfvur.supabase.co/rest/v1';
const CLAVE = 'sb_publishable_uhPIwnHofJ9p3abBAnC88w_Sq85YIB2';
const cabeceras = {
  apikey: CLAVE,
  Authorization: 'Bearer ' + CLAVE,
  'Content-Type': 'application/json'
};

const ID_TORNEO = 't-otono-2026';

const JUGADORES = [
  { id: 'jotono-leo',    nombre: 'Leo',    emoji: '🟢', color: '#00E676' },
  { id: 'jotono-javi',   nombre: 'Javi',   emoji: '🔵', color: '#4DA3FF' },
  { id: 'jotono-marcos', nombre: 'Marcos', emoji: '🟡', color: '#FFD54F' },
  { id: 'jotono-iker',   nombre: 'Iker',   emoji: '🔴', color: '#FF4D5E' },
  { id: 'jotono-ruben',  nombre: 'Rubén',  emoji: '🟣', color: '#B388FF' },
  { id: 'jotono-hugo',   nombre: 'Hugo',   emoji: '🟠', color: '#FFA24D' }
];

const CONFIG = Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFECTO)), {
  vueltas: 2,
  clasificados: 4,
  codigo: 'W77U47'          // el mismo código que Leo ya tenía
});

/* Los 4 resultados, como se apuntaron (por nombre de jugador) */
const RESULTADOS = [
  { a: 'Rubén', b: 'Javi',  ga: 2, gb: 2 },
  { a: 'Rubén', b: 'Leo',   ga: 1, gb: 1 },
  { a: 'Marcos', b: 'Iker', ga: 0, gb: 4 },
  { a: 'Iker',  b: 'Hugo',  ga: 0, gb: 2 }
];

async function pedir(ruta, metodo, cuerpo) {
  const r = await fetch(URL + ruta, {
    method: metodo,
    headers: Object.assign({}, cabeceras, { Prefer: 'return=minimal' }),
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  if (!r.ok) throw new Error(metodo + ' ' + ruta + ' → ' + r.status + ' ' + (await r.text()));
  return r;
}

(async () => {
  console.log('\n=== RECUPERANDO "Torneo Otoño 2026" ===\n');

  // 1. El calendario completo (30 partidos de liguilla)
  const partidos = generarCalendario(JUGADORES, CONFIG);
  console.log('  calendario generado:', partidos.length, 'partidos');

  // 2. Apuntar los 4 resultados en sus cruces (el primero del calendario)
  const idPorNombre = {};
  JUGADORES.forEach(j => { idPorNombre[j.nombre] = j.id; });

  let puestos = 0;
  RESULTADOS.forEach(r => {
    const local = idPorNombre[r.a], visit = idPorNombre[r.b];
    const p = partidos.find(x =>
      !x.jugado &&
      ((x.localId === local && x.visitanteId === visit) ||
       (x.localId === visit && x.visitanteId === local)));

    if (!p) { console.log('  ⚠️  no encuentro el cruce', r.a, 'vs', r.b); return; }

    // El marcador se pone en el lado que toca según quién es local en ese partido
    const esLocal = p.localId === local;
    p.golesLocal     = esLocal ? r.ga : r.gb;
    p.golesVisitante = esLocal ? r.gb : r.ga;
    p.jugado = true;
    puestos++;
    const nombreLocal = JUGADORES.find(j => j.id === p.localId).nombre;
    const nombreVisit = JUGADORES.find(j => j.id === p.visitanteId).nombre;
    console.log('  ✓', nombreLocal, p.golesLocal, '-', p.golesVisitante, nombreVisit,
                '(jornada', p.jornada + ')');
  });
  console.log('  resultados apuntados:', puestos, 'de', RESULTADOS.length);

  // 3. Subir el torneo, los jugadores y los partidos
  console.log('\n  Subiendo a Supabase...');
  await pedir('/torneos', 'POST', [{
    id: ID_TORNEO,
    nombre: 'Torneo Otoño 2026',
    estado: 'en_curso',
    config: CONFIG
  }]);
  console.log('  ✓ torneo');

  await pedir('/jugadores', 'POST', JUGADORES.map(j => ({
    id: j.id, torneo_id: ID_TORNEO, nombre: j.nombre, emoji: j.emoji, color: j.color
  })));
  console.log('  ✓ ' + JUGADORES.length + ' jugadores');

  await pedir('/partidos', 'POST', partidos.map(p => ({
    id: p.id,
    torneo_id: ID_TORNEO,
    fase: p.fase || 'liga',
    jornada: p.jornada,
    local_id: p.localId,
    visitante_id: p.visitanteId,
    goles_local: p.golesLocal,
    goles_visitante: p.golesVisitante,
    jugado: p.jugado,
    fecha: null
  })));
  console.log('  ✓ ' + partidos.length + ' partidos');

  // 4. Comprobar que ha quedado bien (leer de la nube otra vez)
  console.log('\n  Comprobando lo que hay ahora en la nube...');
  const ver = async (ruta) => {
    const r = await fetch(URL + ruta, { headers: cabeceras });
    return r.json();
  };
  const t = (await ver('/torneos?id=eq.' + ID_TORNEO + '&select=*'))[0];
  const js = await ver('/jugadores?torneo_id=eq.' + ID_TORNEO + '&select=*');
  const ps = await ver('/partidos?torneo_id=eq.' + ID_TORNEO + '&select=*');

  const jugados = ps.filter(p => p.jugado);
  const goles = jugados.reduce((s, p) => s + p.goles_local + p.goles_visitante, 0);

  console.log('  torneo:', t.nombre, '| código:', t.config.codigo);
  console.log('  jugadores:', js.length, '→', js.map(j => j.emoji + j.nombre).join(' '));
  console.log('  partidos:', ps.length, '| jugados:', jugados.length, '| goles:', goles);

  console.log('\n' + (ps.length === 30 && js.length === 6 && jugados.length === 4 && goles === 12
    ? '✅ TORNEO RECUPERADO Y COMPROBADO'
    : '❌ algo no cuadra, revisar') + '\n');
})();
