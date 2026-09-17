/* ==========================================================================
   PANTALLA: ELIMINATORIAS
   El cuadro final: semifinales, final (y 3º y 4º puesto si está activado).
   Cuando acaba la liguilla, desde aquí se generan las rondas.
   El motor (generarEliminatorias, estadoDeFases, generarSiguienteRonda) ya
   existía: esta pantalla solo lo enseña y le pone botones.
   ========================================================================== */

let torneoActual = null;

const ORDEN_FASES = ['cuartos', 'semifinal', 'final', 'tercer_puesto'];
const TITULO_FASE = {
  cuartos: 'Cuartos de final',
  semifinal: 'Semifinales',
  final: 'Final',
  tercer_puesto: '3º y 4º puesto'
};

async function arrancarEliminatorias() {
  let torneos;
  try {
    await arrancarCandado();
    torneos = await Store.iniciar();
  } catch (e) {
    console.error(e);
    avisar('No se pudo conectar con la nube: ' + e.message, true);
    window.__listo = true;
    return;
  }

  try {
    const idInicial = elegirTorneoInicial(torneos);
    if (!idInicial) { window.location.href = 'index.html'; return; }

    torneoActual = Store.torneo(idInicial);
    recordarTorneo(torneoActual.id);

    configurarComun(torneoActual, () => pintarPantallaEliminatorias());
    pintarModoDatos();
    pintarNombreTorneo(torneoActual);
    enlacesConTorneo(torneoActual.id);
    pintarPantallaEliminatorias();
    engancharEliminatorias();

    engancharActualizar(() => {
      torneoActual = Store.torneo(torneoActual.id);
      configurarComun(torneoActual, () => pintarPantallaEliminatorias());
      pintarNombreTorneo(torneoActual);
      pintarPantallaEliminatorias();
    });
  } catch (e) {
    console.error('Fallo al dibujar las eliminatorias:', e);
    avisar('La página ha fallado al dibujarse: ' + e.message, true, 6000);
  }
  window.__listo = true;
}

/* ------------------------------------------------------------- pintado */
function pintarPantallaEliminatorias() {
  pintarResumenFases();
  pintarCuadro();
  pintarAccion();
}

function partidosDeFase(fase) {
  return torneoActual.partidos.filter(p => p.fase === fase);
}

function pintarResumenFases() {
  const caja = $('#resumen');
  caja.innerHTML = '';

  const liga = partidosDeFase('liga');
  const jugadosLiga = liga.filter(p => p.jugado).length;
  const finales = torneoActual.partidos.filter(p => ORDEN_FASES.includes(p.fase));
  const jugadosFinales = finales.filter(p => p.jugado).length;
  const clasificados = torneoActual.config.clasificados;

  const estado = estadoDeFases(torneoActual);
  const textos = {
    sin_calendario: 'Falta el calendario',
    liga: liga.filter(p => !p.jugado).length + ' partidos de liguilla por jugar',
    generar_semis: 'Liguilla terminada: ¡toca generar las eliminatorias!',
    semis: 'Semifinales en juego',
    generar_final: 'Semifinales hechas: toca generar la final',
    final: 'La final está en juego',
    terminado: 'Torneo terminado 🏆'
  };

  [
    { etiqueta: 'Liguilla', valor: jugadosLiga + '/' + liga.length, extra: 'partidos jugados', color: 1 },
    { etiqueta: 'Eliminatorias', valor: jugadosFinales + '/' + finales.length, extra: finales.length ? 'partidos jugados' : 'aún sin generar', color: 2 },
    { etiqueta: 'Pasan al cuadro', valor: String(clasificados), extra: 'los mejores de la liguilla', color: 3 },
    { etiqueta: 'Estado', valor: '', extra: textos[estado.paso] || '—', textoLargo: true, color: 4 }
  ].forEach(d => {
    caja.appendChild(el('div', 'dato dato-col-' + d.color,
      `<span class="etiqueta">${d.etiqueta}</span>
       ${d.textoLargo
          ? `<small style="font-size:15px;color:var(--texto);white-space:normal">${d.extra}</small>`
          : `<span class="valor">${d.valor}</span><small>${d.extra}</small>`}`));
  });
}

/* El cuadro: una columna por ronda, con sus partidos */
function pintarCuadro() {
  const caja = $('#cuadro');
  caja.innerHTML = '';
  const etiqueta = $('#etiqueta-cuadro');

  const generadas = torneoActual.partidos.filter(p => ORDEN_FASES.includes(p.fase));
  const clasificacion = calcularClasificacion(torneoActual);

  // --- Todavía no se ha generado nada: se enseñan los cruces que tocarían ---
  if (!generadas.length) {
    const cruces = generarEliminatorias(clasificacion, torneoActual.config);
    const pendientes = partidosDeFase('liga').filter(p => !p.jugado).length;

    if (!cruces.length) {
      etiqueta.textContent = '—';
      caja.appendChild(el('div', 'vacio',
        'Cuando haya jugadores en la liguilla aparecerán aquí los cruces.'));
      return;
    }

    etiqueta.textContent = pendientes ? 'si acabara hoy' : 'listas para generar';

    if (pendientes) {
      caja.appendChild(el('div', 'aviso',
        `<span>ℹ️</span><span>Quedan <b>${pendientes}</b> ${pendientes === 1 ? 'partido' : 'partidos'} de liguilla: estos son los cruces <b>si acabara hoy</b>.</span>`));
    }

    const col = el('div', 'ronda');
    col.appendChild(el('p', 'ronda-titulo', TITULO_FASE[cruces[0].fase] || 'Eliminatorias'));
    cruces.forEach(c => col.appendChild(llaveDeCruces(c)));
    caja.appendChild(el('div', 'cuadro', ''));
    caja.querySelector('.cuadro').appendChild(col);
    return;
  }

  // --- Ya hay eliminatorias: el cuadro de verdad ---
  const final = generadas.find(p => p.fase === 'final');
  if (final && final.jugado) {
    const campeon = jugador(torneoActual, ganadorDe(torneoActual, final, clasificacion));
    etiqueta.textContent = 'terminado';
    caja.appendChild(el('div', 'campeon',
      `<span class="campeon-trofeo">🏆</span>
       <span class="campeon-texto">Campeón del torneo</span>
       <span class="campeon-nombre">${campeon.emoji} ${campeon.nombre}</span>`));
  } else {
    etiqueta.textContent = 'en juego';
  }

  const cuadro = el('div', 'cuadro');
  ORDEN_FASES.forEach(fase => {
    const partidos = partidosDeFase(fase);
    if (!partidos.length) return;

    const col = el('div', 'ronda');
    col.appendChild(el('p', 'ronda-titulo', TITULO_FASE[fase]));
    partidos.forEach(p => col.appendChild(llaveDePartido(p)));
    cuadro.appendChild(col);
  });
  caja.appendChild(cuadro);
}

/* Una llave con un partido ya generado (se puede apuntar/editar) */
function llaveDePartido(p) {
  const clasificacion = calcularClasificacion(torneoActual);
  const ganaId = p.jugado ? ganadorDe(torneoActual, p, clasificacion) : null;

  const llave = el('div', 'llave ' + (p.jugado ? 'jugado' : 'pendiente'));
  [[p.localId, p.golesLocal], [p.visitanteId, p.golesVisitante]].forEach(([id, goles]) => {
    const j = jugador(torneoActual, id);
    const gana = ganaId === id ? ' gana' : '';
    llave.appendChild(el('div', 'llave-equipo' + gana,
      `<span class="llave-nombre">${j.emoji} ${j.nombre}</span>
       <span class="llave-goles">${p.jugado ? goles : '–'}</span>`));
  });

  const boton = el('button', 'btn-mini-ir', p.jugado ? 'Editar' : 'Apuntar');
  if (dentroDelCandado()) {
    boton.onclick = () => abrirModal(p.id);
  } else {
    boton.textContent = '🔑';
    boton.title = 'Entra con la contraseña del grupo para apuntar';
    boton.classList.add('btn-candado');
    boton.onclick = pedirEntrarParaEscribir;
  }
  llave.appendChild(boton);
  return llave;
}

/* Una llave de cruce que todavía no existe (solo se enseña) */
function llaveDeCruces(c) {
  const local = jugador(torneoActual, c.localId);
  const visit = jugador(torneoActual, c.visitanteId);
  const llave = el('div', 'llave pendiente');
  llave.appendChild(el('div', 'llave-equipo',
    `<span class="llave-nombre">${local.emoji} ${local.nombre}</span><span class="llave-goles">–</span>`));
  llave.appendChild(el('div', 'llave-equipo',
    `<span class="llave-nombre">${visit.emoji} ${visit.nombre}</span><span class="llave-goles">–</span>`));
  return llave;
}

/* Qué toca ahora: el botón de generar la ronda, o el aviso que corresponda */
function pintarAccion() {
  const caja = $('#accion');
  caja.innerHTML = '';

  const estado = estadoDeFases(torneoActual);
  const pendientesLiga = partidosDeFase('liga').filter(p => !p.jugado).length;

  const aviso = (texto, tipo) => caja.appendChild(el('div', tipo || 'nota', texto));

  if (estado.paso === 'sin_calendario') {
    aviso('Este torneo no tiene calendario. Genéralo desde <b>Ajustes</b> o monta los partidos con la ruleta.', 'aviso');
    return;
  }

  if (estado.paso === 'liga') {
    aviso(`<span>📅</span><span>${pendientesLiga === 1 ? 'Falta' : 'Faltan'} <b>${pendientesLiga}</b> ${pendientesLiga === 1 ? 'partido' : 'partidos'} para acabar la liguilla. Cuando estén todos apuntados, aquí podrás generar las eliminatorias.</span>`, 'aviso');
    caja.appendChild(botonIr('Ir a Partidos', 'partidos.html'));
    return;
  }

  if (estado.paso === 'generar_semis' || estado.paso === 'generar_final') {
    const esSemis = estado.paso === 'generar_semis';
    aviso(esSemis
      ? `<span>🏟️</span><span>La liguilla ha terminado. Ya se pueden generar las <b>semifinales</b> con los ${torneoActual.config.clasificados} primeros.</span>`
      : '<span>🏟️</span><span>Las semifinales están resueltas. Ya se puede generar la <b>final</b> (y el 3º y 4º puesto si está activado).</span>', 'aviso');

    const boton = el('button', 'btn btn-gol btn-ancho', esSemis ? 'Generar las semifinales 🏟️' : 'Generar la final 🏆');
    boton.onclick = generarRondaEliminatorias;
    caja.appendChild(boton);
    return;
  }

  if (estado.paso === 'semis' || estado.paso === 'final') {
    aviso(`<span>⚽</span><span>Quedan <b>${estado.pendientes}</b> ${estado.pendientes === 1 ? 'partido' : 'partidos'} de eliminatorias por apuntar. Se apuntan aquí mismo, con el botón <b>Apuntar</b> de cada cruce.</span>`, 'aviso');
    caja.appendChild(botonIr('Ir a Partidos', 'partidos.html'));
    return;
  }

  // terminado
  const final = partidosDeFase('final')[0];
  const clasificacion = calcularClasificacion(torneoActual);
  const campeon = final ? jugador(torneoActual, ganadorDe(torneoActual, final, clasificacion)) : null;
  aviso(campeon
    ? `<span>🏆</span><span>¡Torneo terminado! Campeón: <b>${campeon.emoji} ${campeon.nombre}</b></span>`
    : '<span>🏆</span><span>¡Torneo terminado!</span>', 'aviso');
}

function botonIr(texto, pagina) {
  const a = el('a', 'btn btn-ghost btn-ancho', texto);
  a.href = pagina + '?torneo=' + encodeURIComponent(torneoActual.id);
  a.style.display = 'block';
  a.style.textAlign = 'center';
  a.style.textDecoration = 'none';
  return a;
}

/* Genera la ronda que toque (el motor ya sabe cuál) */
async function generarRondaEliminatorias() {
  const resultado = generarSiguienteRonda(torneoActual);
  if (!resultado.nuevos.length) { avisar(resultado.mensaje, true); return; }

  torneoActual.partidos = torneoActual.partidos.concat(resultado.nuevos);
  try {
    await Store.guardarTorneo(torneoActual);
    pintarPantallaEliminatorias();
    avisar(resultado.mensaje + ' · apúntalos aquí mismo');
  } catch (e) {
    console.error(e);
    avisar('No se pudo guardar: ' + e.message, true);
  }
}

/* ------------------------------------------------------------- eventos */
function engancharEliminatorias() {
  engancharModal();
}

document.addEventListener('DOMContentLoaded', arrancarEliminatorias);
