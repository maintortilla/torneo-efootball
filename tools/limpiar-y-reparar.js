/* ==========================================================================
   LIMPIAR Y REPARAR (lo ejecuta Hermes)
   --------------------------------------------------------------------------
   Qué hace:
     1. Borra todos los torneos de prueba que dejaron los tests descontrolados
     2. Deja SOLO el torneo de verdad (el que se le indique)
     3. Le regenera el calendario (30 partidos, ida y vuelta) con sus jugadores

   Uso:  node tools/limpiar-y-reparar.js <id-del-torneo-bueno>
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

/* --- Cargar el código real de la web (config + modelo) para usar el mismo
       generador de calendario que la web: nada de duplicar lógica --- */
const fuente = ['js/config.js', 'js/modelo.js']
  .map(f => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n');
vm.runInThisContext(fuente + `;globalThis.__api = { CONFIG_DEFECTO, generarCalendario };`);
const { CONFIG_DEFECTO, generarCalendario } = globalThis.__api;

/* --- Leer la configuración de la nube --- */
const configTexto = fs.readFileSync(path.join(RAIZ, 'js', 'config-nube.js'), 'utf8');
const URL = /url:\s*'([^']+)'/.exec(configTexto)[1];
const CLAVE = /anonKey:\s*'([^']+)'/.exec(configTexto)[1];

const cab = {
  apikey: CLAVE,
  Authorization: 'Bearer ' + CLAVE,
  'Content-Type': 'application/json'
};

async function api(ruta, opciones = {}) {
  const res = await fetch(URL + '/rest/v1' + ruta, { ...opciones, headers: { ...cab, ...(opciones.headers || {}) } });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch (e) { datos = texto; }
  if (!res.ok) throw new Error(`[${res.status}] ${ruta}: ${typeof datos === 'string' ? datos : JSON.stringify(datos)}`);
  return datos;
}

async function main() {
  const bueno = process.argv[2];
  if (!bueno) throw new Error('Falta el id del torneo que hay que conservar');

  // 1. Ver el torneo bueno
  const [torneo] = await api(`/torneos?id=eq.${bueno}&select=*`);
  if (!torneo) throw new Error('No encuentro el torneo ' + bueno);
  console.log('✅ Torneo a conservar: "' + torneo.nombre + '"');

  const jugadores = await api(`/jugadores?torneo_id=eq.${bueno}&select=*`);
  console.log('   Jugadores: ' + jugadores.map(j => j.emoji + ' ' + j.nombre).join(' · '));

  // 2. Borrar todos los demás torneos (partidos, jugadores y futbolistas caen en cascada)
  const otros = await api(`/torneos?id=not.eq.${bueno}&select=id,nombre`);
  console.log('🧹 Torneos basura a borrar: ' + otros.length);
  if (otros.length) {
    await api(`/torneos?id=not.eq.${bueno}`, { method: 'DELETE' });
    console.log('   Borrados ✅');
  }

  // 3. Regenerar el calendario del torneo bueno
  const config = (torneo.config && Object.keys(torneo.config).length)
    ? torneo.config
    : JSON.parse(JSON.stringify(CONFIG_DEFECTO));

  // Los partidos que le quedasen (por si acaso) se tiran
  await api(`/partidos?torneo_id=eq.${bueno}`, { method: 'DELETE' });

  const jugadoresLigeros = jugadores.map(j => ({ id: j.id, nombre: j.nombre, emoji: j.emoji, color: j.color }));
  const partidos = generarCalendario(jugadoresLigeros, config);

  const filas = partidos.map(p => ({
    id: p.id,
    torneo_id: bueno,
    fase: p.fase,
    jornada: p.jornada,
    local_id: p.localId,
    visitante_id: p.visitanteId,
    goles_local: 0,
    goles_visitante: 0,
    jugado: false,
    fecha: null
  }));

  await api('/partidos', { method: 'POST', body: JSON.stringify(filas) });
  console.log('🗓️  Calendario regenerado: ' + filas.length + ' partidos (' + config.vueltas + ' vueltas)');

  // 4. Comprobar el resultado final
  const torneosFinal = await api('/torneos?select=id,nombre');
  const partidosFinal = await api(`/partidos?torneo_id=eq.${bueno}&select=id`);
  const jugadoresFinal = await api(`/jugadores?torneo_id=eq.${bueno}&select=id`);

  console.log('');
  console.log('🎉 REPARADO');
  console.log('   Torneos en la nube: ' + torneosFinal.length + ' → ' + torneosFinal.map(t => '"' + t.nombre + '"').join(', '));
  console.log('   Jugadores: ' + jugadoresFinal.length);
  console.log('   Partidos: ' + partidosFinal.length);
}

main().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
