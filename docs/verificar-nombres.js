/* Comprueba que no haya dos funciones/variables con el mismo nombre en ficheros
   distintos de js/.

   POR QUÉ: esta web usa scripts "clásicos" (sin módulos), así que TODAS las
   funciones acaban en el mismo espacio global. Si dos ficheros definen el mismo
   nombre, la última en cargarse ANULA a la otra y nadie avisa. Ha pasado ya dos
   veces:

     · `pintarModoDatos`  → comun.js y ajustes.js (en Ajustes ganaba la de
                            ajustes.js, que no pinta la pastilla "Solo lectura")
     · `filaDePartido`    → comun.js (pinta una fila) y store.js (fila de la base
                            de datos) → guardar el torneo entero reventaba

   Uso:  node docs/verificar-nombres.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const CARPETA = path.join(__dirname, '..', 'js');

/* Choques que SÍ son aceptables, con el motivo. Si sale uno nuevo, hay que
   renombrarlo o añadirlo aquí a conciencia. */
const PERMITIDOS = {
  'torneoActual': 'cada pantalla declara la suya y solo se carga un fichero de pantalla a la vez (clasificacion.js, partidos.js, eliminatorias.js, ajustes.js)'
};
// Estos nombres se declaran en varios ficheros de pantalla y es así por diseño
const NOMBRES_DE_PANTALLA = ['torneoActual'];

const ficheros = fs.readdirSync(CARPETA).filter(f => f.endsWith('.js')).sort();
const donde = {};

for (const f of ficheros) {
  const src = fs.readFileSync(path.join(CARPETA, f), 'utf8');
  const nombres = new Set();

  // Solo lo que empieza en la COLUMNA 0: eso es de nivel superior (global).
  // Lo que va indentado son variables locales de dentro de una función y no chocan.
  // function nombre(...) / async function nombre(...)
  for (const m of src.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) nombres.add(m[1]);
  // const nombre = / let nombre = / var nombre =
  for (const m of src.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) nombres.add(m[1]);

  for (const n of nombres) (donde[n] = donde[n] || []).push(f);
}

const problemas = [];
const avisos = [];

for (const [nombre, lista] of Object.entries(donde)) {
  if (lista.length < 2) continue;
  // El mismo nombre en dos ficheros de pantalla distintos también vale: solo se
  // carga uno por página. Pero `torneoActual` está declarada en las tres, así
  // que se acepta a propósito (y se avisa).
  if (PERMITIDOS[nombre]) avisos.push(`${nombre} → ${lista.join(', ')}  (${PERMITIDOS[nombre]})`);
  else problemas.push(`${nombre} → ${lista.join(', ')}`);
}

console.log('\n=== NOMBRES REPETIDOS EN FICHEROS DISTINTOS ===');

if (avisos.length) {
  console.log('\n  Aceptados a propósito:');
  avisos.forEach(a => console.log('   · ' + a));
}

if (problemas.length) {
  console.log('\n❌ CHOQUES PELIGROSOS (el fichero que carga después anula al otro):');
  problemas.forEach(p => console.log('   · ' + p));
  console.log('\n   Renombra uno de los dos y vuelve a pasar la comprobación.\n');
  process.exit(1);
}

console.log(`\n✅ SIN CHOQUES: ${Object.keys(donde).length} nombres revisados en ${ficheros.length} ficheros\n`);
