/* ==========================================================================
   SONIDO DE LA WEB (Web Audio: no hace falta ningún archivo de audio)
   --------------------------------------------------------------------------
   Todo el sonido de la web sale de aquí. Se usa desde la ruleta (tics y
   fanfarria) y desde "Ajustes de la web" (el botón de probar).

   - El volumen y el silencio los manda js/preferencias.js.
   - Todo pasa por una ganancia general, así el volumen cambia en caliente.
   - El navegador solo deja sonar después de que el usuario toque algo: el
     primer sonido siempre va detrás de un clic, así que no hay problema.
   ========================================================================== */
/* ==========================================================================
   SONIDO (Web Audio: no hace falta ningún archivo de audio)
   --------------------------------------------------------------------------
   - Tics mientras gira: se calculan mirando el ángulo REAL de la rueda en cada
     fotograma, así suenan clavados con lo que se ve y desaceleran solos.
   - Fanfarria corta (do·mi·sol·do) cuando sale el jugador.
   El navegador solo deja sonar después de que toques algo: el primer sonido
   siempre va detrás del botón GIRAR, así que no hay problema.
   ========================================================================== */
let ctxAudio = null;
let gananciaMaster = null;   // el volumen general de la web (se cambia en Ajustes de la web)

function contextoAudio() {
  if (!sonidoActivo()) return null;      // preferencia de la web (Ajustes de la web)
  try {
    if (!ctxAudio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxAudio = new AC();
      /* Todo el sonido pasa por esta ganancia: así el volumen se puede cambiar
         en caliente desde los ajustes, sin tocar cada sonido. */
      gananciaMaster = ctxAudio.createGain();
      gananciaMaster.connect(ctxAudio.destination);
    }
    if (ctxAudio.state === 'suspended') ctxAudio.resume();
    if (gananciaMaster) gananciaMaster.gain.value = volumenWeb();
    return ctxAudio;
  } catch (e) { return null; }
}

/* A dónde se conecta cada sonido: a la ganancia general (donde manda el volumen) */
function salidaAudio(ctx) {
  return gananciaMaster || ctx.destination;
}

/* Un "tac" cortito, como el de una ruleta de feria */
function sonarTic(intensidad) {
  const ctx = contextoAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const vol = Math.max(0.05, Math.min(0.28, 0.3 * (intensidad || 1)));

  const osc = ctx.createOscillator();
  const filtro = ctx.createBiquadFilter();
  const gana = ctx.createGain();

  filtro.type = 'bandpass';
  filtro.frequency.value = 2300;
  filtro.Q.value = 1.1;

  osc.type = 'square';
  osc.frequency.setValueAtTime(2500, t);
  osc.frequency.exponentialRampToValueAtTime(1000, t + 0.045);

  gana.gain.setValueAtTime(0.0001, t);
  gana.gain.exponentialRampToValueAtTime(vol, t + 0.003);
  gana.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

  osc.connect(filtro).connect(gana).connect(salidaAudio(ctx));
  osc.start(t);
  osc.stop(t + 0.075);
}

/* Fanfarria de cuatro notas al salir un jugador */
function sonarElegido() {
  const ctx = contextoAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {     // do · mi · sol · do
    const t = t0 + i * 0.075;
    const ultima = i === 3;
    const osc = ctx.createOscillator();
    const gana = ctx.createGain();
    osc.type = ultima ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(f, t);
    gana.gain.setValueAtTime(0.0001, t);
    gana.gain.exponentialRampToValueAtTime(ultima ? 0.26 : 0.18, t + 0.02);
    gana.gain.exponentialRampToValueAtTime(0.0001, t + (ultima ? 0.55 : 0.28));
    osc.connect(gana).connect(salidaAudio(ctx));
    osc.start(t);
    osc.stop(t + 0.6);
  });
}
