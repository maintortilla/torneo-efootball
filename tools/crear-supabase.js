/* ==========================================================================
   CREAR EL PROYECTO DE SUPABASE + TABLAS + CLAVES (lo ejecuta Hermes)
   --------------------------------------------------------------------------
   Uso:  node tools/crear-supabase.js <slug-de-la-organizacion>

   Qué hace, en orden:
     1. Lee el token de TOKEN-SUPABASE.txt
     2. Crea el proyecto "Torneo-Efootball" en Europa
     3. Espera a que la base de datos esté lista (probando el propio SQL)
     4. Crea las 6 tablas con docs/supabase-esquema.sql
     5. Saca la URL y la clave pública y las escribe en js/config-nube.js

   Nota: no usa /organizations (el token de Leo no tiene ese permiso), así que
   el slug de la organización se le pasa como argumento.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const API = 'https://api.supabase.com/v1';
const NOMBRE_PROYECTO = 'Torneo-Efootball';
const REGION_PREFERIDA = 'eu-west-1';   // West EU (Ireland)

const ARCHIVO_DBPASS = path.join(RAIZ, '.supabase-dbpass');
const ARCHIVO_REF = path.join(RAIZ, '.supabase-ref');

function leerToken() {
  const candidatos = [
    path.join(RAIZ, 'TOKEN-SUPABASE.txt'),
    path.join(RAIZ, '.supabase-token')
  ];
  const archivo = candidatos.find(a => fs.existsSync(a));
  if (!archivo) throw new Error('No encuentro TOKEN-SUPABASE.txt en la carpeta del proyecto.');

  const token = fs.readFileSync(archivo, 'utf8').trim();
  if (!token.startsWith('sbp_')) {
    throw new Error('El archivo ' + path.basename(archivo) + ' no contiene un token válido (debe empezar por "sbp_").');
  }
  return token;
}

function passwordSegura() {
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minus = 'abcdefghijkmnpqrstuvwxyz';
  const nums = '23456789';
  const simbolos = '!@#$%&*';
  const todos = mayus + minus + nums + simbolos;
  const elige = (s) => s[Math.floor(Math.random() * s.length)];
  let p = elige(mayus) + elige(minus) + elige(nums) + elige(simbolos);
  for (let i = 0; i < 20; i++) p += elige(todos);
  return p.split('').sort(() => Math.random() - 0.5).join('');
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
    const error = new Error(`[${res.status}] ${ruta}: ${detalle}`);
    error.estado = res.status;
    error.datos = datos;
    throw error;
  }
  return datos;
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const token = leerToken();
  const slug = process.argv[2] || process.env.SUPABASE_ORG_SLUG;
  if (!slug) throw new Error('Falta el slug de la organización: node tools/crear-supabase.js <slug>');
  console.log('✅ Token leído · organización: ' + slug);

  // --- Regiones disponibles (informativo) ------------------------------------
  let region = REGION_PREFERIDA;
  try {
    const regs = await api('/projects/available-regions?organization_slug=' + slug, {}, token);
    const lista = Array.isArray(regs) ? regs : (regs && (regs.all || regs.regions)) || [];
    const codigos = lista.map(r => (typeof r === 'string' ? r : r.code || r.id)).filter(Boolean);
    if (codigos.length) {
      console.log('   Regiones disponibles: ' + codigos.join(', '));
      if (!codigos.includes(region)) region = codigos[0];
    }
  } catch (e) {
    console.log('   (no pude consultar regiones: ' + e.message.split(':')[0] + ') → uso ' + region);
  }

  // --- Crear el proyecto -----------------------------------------------------
  const dbPass = passwordSegura();
  fs.writeFileSync(ARCHIVO_DBPASS, dbPass, 'utf8');

  console.log('🚀 Creando el proyecto "' + NOMBRE_PROYECTO + '" en ' + region + '...');
  const proyecto = await api('/projects', {
    method: 'POST',
    body: JSON.stringify({
      organization_slug: slug,
      name: NOMBRE_PROYECTO,
      region: region,
      db_pass: dbPass
    })
  }, token);

  const ref = proyecto.id;
  fs.writeFileSync(ARCHIVO_REF, ref, 'utf8');
  console.log('✅ Proyecto creado: ' + ref);

  // --- Esperar a que la base de datos responda -------------------------------
  const sql = fs.readFileSync(path.join(RAIZ, 'docs', 'supabase-esquema.sql'), 'utf8');
  let listo = false;

  console.log('⏳ Esperando a que la base de datos esté lista (suele tardar 1-3 minutos)...');
  for (let intento = 1; intento <= 40; intento++) {
    await dormir(15000);
    try {
      await api('/projects/' + ref + '/database/query', {
        method: 'POST',
        body: JSON.stringify({ query: sql })
      }, token);
      listo = true;
      console.log('✅ Base de datos lista y tablas creadas (intento ' + intento + ')');
      break;
    } catch (e) {
      const pista = e.estado === 404 || e.estado === 503 || /not.*ready|still|provision/i.test(e.message)
        ? 'aún arrancando'
        : 'error: ' + e.message.slice(0, 160);
      console.log('   ...' + (intento * 15) + 's → ' + pista);
      if (e.estado === 403) throw e;   // sin permisos: no tiene sentido insistir
    }
  }
  if (!listo) throw new Error('La base de datos no llegó a estar lista a tiempo');

  // --- Comprobar que las tablas están ----------------------------------------
  const tablas = await api('/projects/' + ref + '/database/query', {
    method: 'POST',
    body: JSON.stringify({
      query: "select table_name from information_schema.tables where table_schema='public' and table_name in ('torneos','jugadores','partidos','futbolistas','goles','perfiles') order by 1"
    })
  }, token);
  const nombres = (tablas || []).map(t => t.table_name).join(', ');
  console.log('📋 Tablas creadas: ' + nombres);
  if ((tablas || []).length !== 6) throw new Error('No se crearon las 6 tablas (hay ' + (tablas || []).length + ')');

  // --- Claves públicas -------------------------------------------------------
  const claves = await api('/projects/' + ref + '/api-keys?reveal=true', {}, token);
  const urlProyecto = 'https://' + ref + '.supabase.co';

  const listaClaves = claves.map(k => k.name + '/' + k.type).join(', ');
  const clavePublica =
    (claves.find(k => k.type === 'publishable') || {}).api_key ||
    (claves.find(k => k.name === 'anon') || {}).api_key ||
    (claves.find(k => String(k.api_key || '').startsWith('sb_publishable')) || {}).api_key;

  if (!clavePublica) {
    console.log('Claves disponibles: ' + listaClaves);
    throw new Error('No encontré la clave pública entre las claves del proyecto');
  }

  // --- Escribir la configuración de la web -----------------------------------
  const archivoConfig = path.join(RAIZ, 'js', 'config-nube.js');
  let config = fs.readFileSync(archivoConfig, 'utf8');
  config = config.replace(/url:\s*''/, "url: '" + urlProyecto + "'");
  config = config.replace(/anonKey:\s*''/, "anonKey: '" + clavePublica + "'");
  fs.writeFileSync(archivoConfig, config, 'utf8');

  console.log('');
  console.log('🎉 TODO LISTO');
  console.log('   Proyecto:  ' + ref);
  console.log('   URL:       ' + urlProyecto);
  console.log('   Clave:     ' + clavePublica.slice(0, 12) + '... (' + clavePublica.length + ' caracteres) escrita en js/config-nube.js');
  console.log('   Claves disponibles en el proyecto: ' + listaClaves);
  console.log('   Contraseña de la base de datos guardada en .supabase-dbpass');
}

main().catch(e => {
  console.error('❌ ' + e.message);
  process.exit(1);
});
