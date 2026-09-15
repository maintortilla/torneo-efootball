/* Comprueba la lógica del modelo sin abrir el navegador.
   Se ejecuta con:  node docs/verificar-modelo.js  (desde la carpeta del proyecto) */

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const archivos = ['js/config.js', 'js/modelo.js', 'js/datos-prueba.js'];
const fuente = archivos.map(f => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n');

// Ejecutamos el código real de la web (es JavaScript normal, funciona igual aquí)
const vm = require('vm');
vm.runInThisContext(fuente + `
;globalThis.__api = { CONFIG_DEFECTO, TORNEO_PRUEBA, aplicarResultadosEjemplo,
  calcularClasificacion, calcularGoleadores, generarCalendario, generarEliminatorias,
  estadoDeFases, crearTorneoNuevo, clavePareja, parejaYaExiste, partidosDeJornada,
  jugadorYaJuegaEnJornada, siguienteJornada, jornadaSugerida, candidatosRuleta,
  elegirAlAzar, nuevoPartidoLiga };`);
const { CONFIG_DEFECTO, TORNEO_PRUEBA, aplicarResultadosEjemplo,
        calcularClasificacion, calcularGoleadores, generarCalendario,
        generarEliminatorias, estadoDeFases, crearTorneoNuevo, clavePareja,
        parejaYaExiste, partidosDeJornada, jugadorYaJuegaEnJornada,
        siguienteJornada, jornadaSugerida, candidatosRuleta, elegirAlAzar,
        nuevoPartidoLiga } = globalThis.__api;

const torneo = JSON.parse(JSON.stringify(TORNEO_PRUEBA));
aplicarResultadosEjemplo(torneo);

let fallos = 0;
function comprobar(nombre, condicion, detalle) {
  const marca = condicion ? 'OK  ' : 'FALLO';
  if (!condicion) fallos++;
  console.log(`[${marca}] ${nombre}${detalle ? ' → ' + detalle : ''}`);
}

console.log('\n=== CALENDARIO ===');
comprobar('6 jugadores, ida y vuelta = 30 partidos', torneo.partidos.length === 30, torneo.partidos.length + ' partidos');

const porJugador = {};
torneo.partidos.forEach(p => {
  porJugador[p.localId] = (porJugador[p.localId] || 0) + 1;
  porJugador[p.visitanteId] = (porJugador[p.visitanteId] || 0) + 1;
});
const todosDiez = Object.values(porJugador).every(v => v === 10);
comprobar('cada jugador juega 10 partidos', todosDiez, JSON.stringify(porJugador));

const parejas = new Set();
let repetidos = 0;
torneo.partidos.forEach(p => {
  const clave = [p.localId, p.visitanteId].sort().join('-');
  if (parejas.has(clave)) repetidos++;
  parejas.add(clave);
});
comprobar('nadie se enfrenta 3 veces (solo ida y vuelta)', repetidos === 15, repetidos + ' segundas vueltas de 15 cruces');

const jornadas = [...new Set(torneo.partidos.map(p => p.jornada))];
comprobar('10 jornadas de 3 partidos', jornadas.length === 10, jornadas.join(','));

console.log('\n=== CLASIFICACIÓN (con 4 resultados de ejemplo) ===');
const tabla = calcularClasificacion(torneo);
tabla.forEach((f, i) => {
  console.log(`  ${i + 1}. ${f.emoji} ${f.nombre.padEnd(8)} ${f.pts} pts | PJ ${f.pj} | ${f.gf}-${f.gc} | DG ${f.dg > 0 ? '+' + f.dg : f.dg}`);
});
const sumaPuntos = tabla.reduce((s, f) => s + f.pts, 0);
// 4 partidos de ejemplo: 2 victorias (3+0) + 2 empates (1+1) = 10 puntos
comprobar('los puntos cuadran con los resultados jugados', sumaPuntos === 10, sumaPuntos + ' puntos repartidos');
comprobar('las victorias valen lo configurado (3)', torneo.config.puntosVictoria === 3);

// Si cambiamos la puntuación, la tabla debe cambiar sola (configurabilidad)
const copia = JSON.parse(JSON.stringify(torneo));
copia.config.puntosVictoria = 10;
copia.config.puntosEmpate = 5;
const tabla2 = calcularClasificacion(copia);
comprobar('cambiar puntos por victoria cambia la tabla',
  tabla2[0].pts !== tabla[0].pts, tabla2[0].nombre + ' pasaría a ' + tabla2[0].pts + ' pts');

console.log('\n=== GOLEADORES/PICHICHI ===');
const goleadores = calcularGoleadores(torneo);
goleadores.forEach(g => {
  const tipos = Object.entries(g.tipos).map(([t, n]) => {
    const def = torneo.config.tiposGol.find(x => x.id === t);
    return (def ? def.nombre : t) + ' x' + n;
  }).join(', ');
  console.log(`  ${g.nombre.padEnd(16)} ${g.goles} goles  (${tipos})`);
});
const totalGolesDetallados = goleadores.reduce((s, g) => s + g.goles, 0);
const golesEnActa = torneo.partidos.reduce((s, p) => s + (p.goles || []).length, 0);
comprobar('los goles del pichichi coinciden con el acta', totalGolesDetallados === golesEnActa, golesEnActa + ' goles');

console.log('\n=== ELIMINATORIAS ===');
const elim = generarEliminatorias(tabla, torneo.config);
elim.forEach(e => {
  const l = torneo.jugadores.find(j => j.id === e.localId).nombre;
  const v = torneo.jugadores.find(j => j.id === e.visitanteId).nombre;
  console.log(`  ${e.fase}: ${l} vs ${v}`);
});
comprobar('semifinales 1º-4º y 2º-3º', elim.length === 2 && elim[0].localId === tabla[0].id && elim[0].visitanteId === tabla[3].id);

console.log('\n=== FORMATOS ALTERNATIVOS (configurabilidad) ===');
[4, 5, 6, 8, 10].forEach(n => {
  // Jugadores de mentira para probar tamaños distintos a los 6 reales
  const jugadores = Array.from({ length: n }, (_, i) => ({ id: 'x' + i, nombre: 'J' + i, emoji: '⚪' }));
  const p1 = generarCalendario(jugadores, { vueltas: 1 });
  const p2 = generarCalendario(jugadores, { vueltas: 2 });
  const esperado1 = (n * (n - 1)) / 2;
  const ok = p1.length === esperado1 && p2.length === esperado1 * 2;
  if (!ok) fallos++;
  console.log(`[${ok ? 'OK  ' : 'FALLO'}] ${n} jugadores → ${p1.length} partidos (1 vuelta) / ${p2.length} (ida y vuelta)`);

  // Nadie juega dos veces el mismo partido en la misma vuelta, ni se repite cruce 3 veces
  const cruces = {};
  p2.forEach(p => { const k = [p.localId, p.visitanteId].join('>'); cruces[k] = (cruces[k] || 0) + 1; });
  const repetidos = Object.values(cruces).some(v => v > 1);
  if (repetidos) { fallos++; console.log(`[FALLO] ${n} jugadores → hay cruces repetidos`); }
});

console.log('\n=== RULETA (jornadas a jornada) ===');

// El torneo nuevo nace sin partidos: los cruces se montan a mano
const tRuleta = crearTorneoNuevo('Prueba ruleta', [
  { id: 'j1', nombre: 'Ana',  emoji: '🔵', color: '#00E676' },
  { id: 'j2', nombre: 'Beto', emoji: '🟡', color: '#FFD400' },
  { id: 'j3', nombre: 'Cris', emoji: '🔴', color: '#FF4D5E' },
  { id: 'j4', nombre: 'Dani', emoji: '🟣', color: '#B388FF' }
]);
comprobar('un torneo nuevo nace SIN partidos', tRuleta.partidos.length === 0, tRuleta.partidos.length + ' partidos');
comprobar('el torneo nuevo conserva sus jugadores', tRuleta.jugadores.length === 4);

// Sorteo: al empezar pueden salir todos; el azar se puede fijar para probarlo
comprobar('al empezar a sortear pueden salir todos', candidatosRuleta(tRuleta, {}).length === 4);
const primero = elegirAlAzar(candidatosRuleta(tRuleta, {}), 0);
comprobar('el sorteo con azar 0 saca al primero de la lista', primero && primero.nombre === 'Ana', primero && primero.nombre);

const segundos = candidatosRuleta(tRuleta, { yaElegidos: ['j1'], localId: 'j1' });
comprobar('no se puede sortear contra uno mismo', !segundos.some(j => j.id === 'j1'), segundos.length + ' rivales posibles');

// Apuntamos un cruce: ya no debe volver a salir
tRuleta.partidos.push(nuevoPartidoLiga('j1', 'j2', 1));
comprobar('el cruce apuntado se detecta (dé igual el orden)',
  parejaYaExiste(tRuleta, 'j1', 'j2') && parejaYaExiste(tRuleta, 'j2', 'j1'));

const trasApuntar = candidatosRuleta(tRuleta, { yaElegidos: ['j1'], localId: 'j1' });
comprobar('la ruleta ya NO ofrece el cruce repetido',
  trasApuntar.length === 2 && !trasApuntar.some(j => j.id === 'j2'),
  trasApuntar.map(j => j.nombre).join(', '));

const conRepetir = candidatosRuleta(tRuleta, { yaElegidos: ['j1'], localId: 'j1', permitirRepetir: true });
comprobar('con «permitir repetir» sí vuelve a aparecer', conRepetir.length === 3, conRepetir.map(j => j.nombre).join(', '));

// La jornada sugerida: con 4 jugadores son 2 partidos por jornada
tRuleta.partidos.push(nuevoPartidoLiga('j3', 'j4', 1));
comprobar('la jornada sugerida pasa a la 2 cuando la 1 está llena', jornadaSugerida(tRuleta) === 2, 'jornada ' + jornadaSugerida(tRuleta));
comprobar('se sabe si alguien ya juega en una jornada',
  jugadorYaJuegaEnJornada(tRuleta, 'j1', 1) && !jugadorYaJuegaEnJornada(tRuleta, 'j1', 2));
comprobar('la jornada siguiente a la última es la 2', siguienteJornada(tRuleta) === 2, 'jornada ' + siguienteJornada(tRuleta));
comprobar('los partidos de una jornada se cuentan bien', partidosDeJornada(tRuleta, 1).length === 2, partidosDeJornada(tRuleta, 1).length + ' en la jornada 1');

// Nadie juega dos veces en la misma jornada
const candJ1 = candidatosRuleta(tRuleta, { jornada: 1 });
comprobar('en una jornada llena la ruleta no ofrece a nadie', candJ1.length === 0,
  candJ1.map(j => j.nombre).join(', ') || 'ninguno');
const candJ2 = candidatosRuleta(tRuleta, { jornada: 2 });
comprobar('en una jornada nueva sí pueden salir todos', candJ2.length === 4,
  candJ2.map(j => j.nombre).join(', '));

// Y con una jornada a medias, solo salen los que aún no juegan en ella
tRuleta.partidos.push(nuevoPartidoLiga('j1', 'j3', 2));
const candJ2b = candidatosRuleta(tRuleta, { jornada: 2 });
comprobar('con la jornada a medias solo salen los que aún no juegan en ella',
  candJ2b.length === 2 && !candJ2b.some(j => j.id === 'j1' || j.id === 'j3'),
  candJ2b.map(j => j.nombre).join(', '));

// Un torneo vacío no debe romper nada
const tVacio = crearTorneoNuevo('Vacío', [{ id: 'a', nombre: 'Uno', emoji: '⚪' }, { id: 'b', nombre: 'Dos', emoji: '⚪' }]);
const clasVacia = calcularClasificacion(tVacio);
comprobar('la clasificación sale a cero con el torneo vacío',
  clasVacia.length === 2 && clasVacia.every(f => f.pts === 0 && f.pj === 0));
comprobar('el estado de fases dice que no hay calendario',
  estadoDeFases(tVacio).paso === 'sin_calendario', estadoDeFases(tVacio).paso);

console.log('\n' + (fallos === 0 ? '✅ TODO CORRECTO' : '❌ ' + fallos + ' comprobaciones fallidas'));
process.exit(fallos === 0 ? 0 : 1);
