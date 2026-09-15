/* ==========================================================================
   CONFIGURAR UN PROYECTO DE SUPABASE YA CREADO (lo ejecuta Hermes)
   --------------------------------------------------------------------------
   Uso:  node tools/configurar-proyecto.js <ref-del-proyecto>

   Qué hace:
     1. Comprueba que el token puede ver el proyecto
     2. Espera a que la base de datos arranque, si hace falta
     3. Crea las 6 tablas con docs/supabase-esquema.sql
     4. Saca la URL y la clave pública y las escribe en js/config-nube.js
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const API = 'https://api.supabase.com/v1';

function leerToken() {
  const archivo = [
    path.join(RAIZ, 'TOKEN-SUPABASE.txt'),
    path.join(RAIZ, '.supabase-token')
  ].find(a => fs.existsSync(a));
  if (!archivo) throw new Error('No encuentro TOKEN-SUPABASE.txt');
  const token = fs.readFileSync(archivo, 'utf8').trim();
  if (!token.startsWith('sbp_')) throw new Error('El token no empieza por sbp_');
  return token;
}

async function api(ruta, opciones = {}, token) {
  const res = await fetch(API + ruta, {
    ...opciones,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(opciones.headers || {})
    }
  });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch (e) { datos = texto; }
  if (!res.ok) {
    const detalle = typeof datos === 'string' ? datos
      : (datos && (datos.message || datos.error)) || JSON.stringify(datos);
    const error = new Error(`[${res.status}] ${detalle}`);
    error.estado = res.status;
    throw error;
  }
  return datos;
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const token = leerToken();
  const ref = process.argv[2];
  if (!ref) throw new Error('Falta la referencia del proyecto');
  console.log('✅ Token leído · proyecto: ' + ref);

  // --- 1. ¿Tenemos acceso al proyecto? ---------------------------------------
  let acceso = 'sí';
  try {
    const p = await api('/projects/' + ref, {}, token);
    console.log('✅ Proyecto: ' + p.name + ' (' + (p.region || '?') + ', ' + (p.status || '?') + ')');
    fs.writeFileSync(path.join(RAIZ, '.supabase-ref'), ref, 'utf8');
  } catch (e) {
    acceso = 'no';
    console.log('⚠️  No puedo LEER el proyecto (' + e.estado + '): ' + e.message.slice(0, 120));
    console.log('   Sigo adelante: puede que sí pueda ejecutar SQL y leer claves.');
  }

  // --- 2. Crear las tablas (con reintentos por si aún arranca) ---------------
  const sql = fs.readFileSync(path.join(RAIZ, 'docs', 'supabase-esquema.sql'), 'utf8');
  let tablasCreadas = false;

  console.log('📦 Creando las tablas...');
  for (let intento = 1; intento <= 24; intento++) {
    try {
      await api('/projects/' + ref + '/database/query', {
        method: 'POST',
        body: JSON.stringify({ query: sql })
      }, token);
      tablasCreadas = true;
      console.log('✅ SQL ejecutado correctamente (intento ' + intento + ')');
      break;
    } catch (e) {
      console.log('   intento ' + intento + ' → ' + e.estado + ': ' + e.message.slice(0, 120));
      if (e.estado === 403) {
        console.log('   ❌ El token NO tiene permiso para ejecutar SQL en el proyecto.');
        break;
      }
      await dormir(15000);
    }
  }
  if (!tablasCreadas) throw new Error('No se pudieron crear las tablas por API');

  // --- 3. Comprobar las tablas ----------------------------------------------
  const tablas = await api('/projects/' + ref + '/database/query', {
    method: 'POST',
    body: JSON.stringify({
      query: "select table_name from information_schema.tables where table_schema='public' and table_name in ('torneos','jugadores','partidos','futbolistas','goles','perfiles') order by 1"
    })
  }, token);
  const nombres = (tablas || []).map(t => t.table_name);
  console.log('📋 Tablas en el proyecto: ' + nombres.join(', '));
  if (nombres.length !== 6) throw new Error('Faltan tablas (hay ' + nombres.length + ')');

  // --- 4. Claves públicas ----------------------------------------------------
  const claves = await api('/projects/' + ref + '/api-keys?reveal=true', {}, token);
  const urlProyecto = 'https://' + ref + '.supabase.co';
  const listaClaves = claves.map(k => k.name + '/' + k.type).join(', ');

  const clavePublica =
    (claves.find(k => k.type === 'publishable') || {}).api_key ||
    (claves.find(k => k.name === 'anon') || {}).api_key ||
    (claves.find(k => String(k.api_key || '').startsWith('sb_publishable')) || {}).api_key;

  if (!clavePublica) {
    console.log('Claves disponibles: ' + listaClaves);
    throw new Error('No encontré la clave pública');
  }

  // --- 5. Escribir la configuración de la web --------------------------------
  const archivoConfig = path.join(RAIZ, 'js', 'config-nube.js');
  let config = fs.readFileSync(archivoConfig, 'utf8');
  config = config.replace(/url:\s*''/, "url: '" + urlProyecto + "'");
  config = config.replace(/anonKey:\s*''/, "anonKey: '" + clavePublica + "'");
  fs.writeFileSync(archivoConfig, config, 'utf8');

  console.log('');
  console.log('🎉 PROYECTO CONFIGURADO');
  console.log('   URL:   ' + urlProyecto);
  console.log('   Clave: ' + clavePublica.slice(0, 14) + '... (' + clavePublica.length + ' caracteres) → escrita en js/config-nube.js');
  console.log('   Claves del proyecto: ' + listaClaves);
  console.log('   ¿Podía leer el proyecto?: ' + acceso);
}

main().catch(e => {
  console.error('❌ ' + e.message);
  process.exit(1);
});
