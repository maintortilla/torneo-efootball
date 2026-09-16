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
  elegirAlAzar, nuevoPartidoLiga, caraACara,
  nuevoCodigoTorneo, normalizarCodigo, codigoDeTorneo, asegurarCodigos,
  buscarTorneoPorCodigo, ALFABETO_CODIGO, LARGO_CODIGO };`);
const { CONFIG_DEFECTO, TORNEO_PRUEBA, aplicarResultadosEjemplo,
        calcularClasificacion, calcularGoleadores, generarCalendario,
        generarEliminatorias, estadoDeFases, crearTorneoNuevo, clavePareja,
        parejaYaExiste, partidosDeJornada, jugadorYaJuegaEnJornada,
        siguienteJornada, jornadaSugerida, candidatosRuleta, elegirAlAzar,
        nuevoPartidoLiga, nuevoCodigoTorneo, normalizarCodigo, codigoDeTorneo,
        asegurarCodigos, buscarTorneoPorCodigo, ALFABETO_CODIGO, LARGO_CODIGO,
        caraACara } = globalThis.__api;

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

console.log('\n=== CÓDIGO DE TORNEO (para entrar directo) ===');

const cod1 = nuevoCodigoTorneo();
comprobar('el código tiene 6 caracteres', cod1.length === 6, cod1);
comprobar('el código solo usa letras y números que no se confunden (sin O, 0, I, L, 1)',
  !/[O0IL1]/.test(cod1), cod1);
comprobar('todos los caracteres salen del alfabeto previsto',
  [...cod1].every(c => ALFABETO_CODIGO.includes(c)), cod1);

// No repite un código que ya esté en uso
const todosIguales = nuevoCodigoTorneo([cod1], 0.0001);   // con azar fijo saldría el mismo
comprobar('nunca devuelve un código que ya esté en uso', todosIguales !== cod1, todosIguales);
comprobar('con azar fijo el código es siempre el mismo (repetible)',
  nuevoCodigoTorneo([], 0) === nuevoCodigoTorneo([], 0), nuevoCodigoTorneo([], 0));

// Se compara en limpio: da igual mayúsculas, espacios y guiones
comprobar('el código se limpia para compararlo (" k7m2-qx " = K7M2QX)',
  normalizarCodigo(' k7m2-qx ') === 'K7M2QX', normalizarCodigo(' k7m2-qx '));

// Un torneo nuevo nace con su código
const tCod = crearTorneoNuevo('Torneo con código', [{ id: 'a', nombre: 'Uno' }]);
comprobar('un torneo nuevo nace con código', codigoDeTorneo(tCod).length === 6, codigoDeTorneo(tCod));
const tCod2 = crearTorneoNuevo('Otro', [{ id: 'b', nombre: 'Dos' }], null, [codigoDeTorneo(tCod)]);
comprobar('dos torneos nuevos no comparten código', codigoDeTorneo(tCod2) !== codigoDeTorneo(tCod),
  codigoDeTorneo(tCod) + ' / ' + codigoDeTorneo(tCod2));

// Los torneos viejos (sin código) reciben uno, y los que ya lo tienen no cambian
const viejos = [
  { id: 't-viejo-1', nombre: 'Viejo uno', config: {} },
  { id: 't-viejo-2', nombre: 'Viejo dos', config: { codigo: 'AAAAAA' } },
  { id: 't-viejo-3', nombre: 'Viejo tres' }   // ni config tiene
];
const cambiados = asegurarCodigos(viejos);
comprobar('a los torneos sin código se les pone uno', cambiados.length === 2, cambiados.map(t => t.id).join(', '));
comprobar('al que ya tenía código NO se le cambia', codigoDeTorneo(viejos[1]) === 'AAAAAA', codigoDeTorneo(viejos[1]));
comprobar('los códigos puestos a los viejos no coinciden entre sí',
  codigoDeTorneo(viejos[0]) !== codigoDeTorneo(viejos[2]),
  codigoDeTorneo(viejos[0]) + ' / ' + codigoDeTorneo(viejos[2]));
comprobar('pasarlo dos veces no cambia nada la segunda vez', asegurarCodigos(viejos).length === 0);
comprobar('un torneo sin config no revienta (se le crea)', Boolean(viejos[2].config && viejos[2].config.codigo));

// Buscar por código, por id, por nombre o pegando el enlace entero
const listaBuscar = [
  { id: 't-uno', nombre: 'Torneo Otoño 2026', config: { codigo: 'K7M2QX' } },
  { id: 't-dos', nombre: 'Torneo Septiembre', config: { codigo: 'PQR456' } }
];
comprobar('se encuentra el torneo por su código', (buscarTorneoPorCodigo(listaBuscar, 'k7m2qx') || {}).id === 't-uno');
comprobar('se encuentra escribiéndolo con espacios y guiones',
  (buscarTorneoPorCodigo(listaBuscar, ' K7M2-QX ') || {}).id === 't-uno');
comprobar('se encuentra por su id interno', (buscarTorneoPorCodigo(listaBuscar, 't-dos') || {}).id === 't-dos');
comprobar('se encuentra por el nombre del torneo',
  (buscarTorneoPorCodigo(listaBuscar, 'torneo septiembre') || {}).id === 't-dos');
comprobar('pegando el enlace entero también encuentra el torneo',
  (buscarTorneoPorCodigo(listaBuscar, 'https://maintortilla.github.io/torneo-efootball/clasificacion.html?torneo=t-uno') || {}).id === 't-uno');
comprobar('un código que no existe devuelve null', buscarTorneoPorCodigo(listaBuscar, 'ZZZZZZ') === null);
comprobar('el campo vacío no encuentra nada', buscarTorneoPorCodigo(listaBuscar, '   ') === null);

console.log('\n=== VUELTAS (de 1 a 4) ===');

const seisJug = [
  { id: 'v1', nombre: 'Uno' }, { id: 'v2', nombre: 'Dos' }, { id: 'v3', nombre: 'Tres' },
  { id: 'v4', nombre: 'Cuatro' }, { id: 'v5', nombre: 'Cinco' }, { id: 'v6', nombre: 'Seis' }
];

[1, 2, 3, 4].forEach(v => {
  const cfg = Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFECTO)), { vueltas: v });
  const ps = generarCalendario(seisJug, cfg);

  comprobar(`con ${v} vuelta(s) salen ${15 * v} partidos`, ps.length === 15 * v, ps.length + ' partidos');

  const cuenta = {};
  ps.forEach(p => {
    cuenta[p.localId] = (cuenta[p.localId] || 0) + 1;
    cuenta[p.visitanteId] = (cuenta[p.visitanteId] || 0) + 1;
  });
  comprobar(`con ${v} vuelta(s) cada jugador juega ${5 * v} partidos`,
    Object.values(cuenta).every(c => c === 5 * v), Object.values(cuenta).join(','));

  comprobar(`con ${v} vuelta(s) todos los partidos tienen id distinto`,
    new Set(ps.map(p => p.id)).size === ps.length);

  // En las vueltas pares se cambia el campo: cada uno juega lo mismo en casa que fuera
  if (v % 2 === 0) {
    const casa = {}, fuera = {};
    ps.forEach(p => {
      casa[p.localId] = (casa[p.localId] || 0) + 1;
      fuera[p.visitanteId] = (fuera[p.visitanteId] || 0) + 1;
    });
    comprobar(`con ${v} vueltas cada uno juega las mismas veces en casa que fuera`,
      seisJug.every(j => casa[j.id] === fuera[j.id]),
      seisJug.map(j => j.nombre + ' ' + casa[j.id] + '/' + fuera[j.id]).join('  '));
  }
});

// Cada cruce se repite tantas veces como vueltas
const ps3 = generarCalendario(seisJug, Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFECTO)), { vueltas: 3 }));
const claveCruce = p => [p.localId, p.visitanteId].sort().join('-');
const porCruce = {};
ps3.forEach(p => { porCruce[claveCruce(p)] = (porCruce[claveCruce(p)] || 0) + 1; });
comprobar('con 3 vueltas cada cruce de pareja aparece 3 veces',
  Object.keys(porCruce).length === 15 && Object.values(porCruce).every(c => c === 3),
  Object.keys(porCruce).length + ' cruces distintos');

// Las jornadas siguen creciendo, no se repiten
const ps2 = generarCalendario(seisJug, Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFECTO)), { vueltas: 2 }));
const jornadasUsadas = [...new Set(ps2.map(p => p.jornada))].sort((a, b) => a - b);
comprobar('con 2 vueltas las jornadas van de la 1 a la 10 (sin repetirse)',
  jornadasUsadas.length === 10 && jornadasUsadas[0] === 1 && jornadasUsadas[9] === 10,
  'jornadas ' + jornadasUsadas.join(','));

// Y si alguien escribe más de 4, se limita
const ps9 = generarCalendario(seisJug, Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFECTO)), { vueltas: 9 }));
comprobar('si se pide más de 4 vueltas, se queda en 4 (60 partidos)', ps9.length === 60, ps9.length + ' partidos');

console.log('\n=== CARA A CARA ===');

const juego = (localId, visitanteId, gl, gv, jugado = true) => ({
  id: 'c' + Math.random().toString(36).slice(2, 7), fase: 'liga', jornada: 1,
  localId, visitanteId, golesLocal: gl, golesVisitante: gv, jugado
});

let cara = caraACara({ partidos: [] }, 'a', 'b');
comprobar('sin enfrentamientos sale todo a cero',
  cara.total === 0 && cara.ganaA === 0 && cara.ganaB === 0, 'total ' + cara.total);

cara = caraACara({ partidos: [juego('a', 'b', 3, 1)] }, 'a', 'b');
comprobar('cuenta la victoria y los goles del primero',
  cara.total === 1 && cara.ganaA === 1 && cara.golesA === 3 && cara.golesB === 1,
  `${cara.golesA} - ${cara.golesB}`);

cara = caraACara({ partidos: [juego('a', 'b', 3, 1)] }, 'b', 'a');
comprobar('mirándolo al revés, gana el otro',
  cara.ganaB === 1 && cara.golesA === 1 && cara.golesB === 3, `${cara.golesA} - ${cara.golesB}`);

cara = caraACara({ partidos: [juego('b', 'a', 0, 2)] }, 'a', 'b');
comprobar('los goles se cuentan a favor del primero aunque juegue fuera',
  cara.ganaA === 1 && cara.golesA === 2 && cara.golesB === 0, `${cara.golesA} - ${cara.golesB}`);

cara = caraACara({ partidos: [juego('a', 'b', 2, 2)] }, 'a', 'b');
comprobar('los empates se cuentan aparte',
  cara.empates === 1 && cara.ganaA === 0 && cara.ganaB === 0, cara.empates + ' empates');

cara = caraACara({ partidos: [juego('a', 'b', 1, 0), juego('b', 'a', 3, 1)] }, 'a', 'b');
comprobar('con ida y vuelta suma los dos partidos',
  cara.total === 2 && cara.ganaA === 1 && cara.ganaB === 1 && cara.golesA === 2 && cara.golesB === 3,
  `${cara.golesA}-${cara.golesB} en ${cara.total} partidos`);

cara = caraACara({ partidos: [juego('a', 'b', 0, 0, false), juego('a', 'c', 5, 0)] }, 'a', 'b');
comprobar('los partidos sin jugar y los de otros rivales no cuentan', cara.total === 0, 'total ' + cara.total);

console.log('\n' + (fallos === 0 ? '✅ TODO CORRECTO' : '❌ ' + fallos + ' comprobaciones fallidas'));
process.exit(fallos === 0 ? 0 : 1);
