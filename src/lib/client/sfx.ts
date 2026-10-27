/**
 * Bruitages du Battle Royale, fabriqués par le navigateur (Web Audio) : aucun fichier à télécharger, donc
 * disponibles hors ligne. Chaque son prend un volume (0 à 1, déjà atténué par la distance) et une position
 * gauche-droite (−1 à 1). Le contexte audio ne démarre qu'après un geste du joueur (règle des navigateurs).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let volume = 0.7;
/** Sons en cours : au-delà de MAX_VOICES, les nouveaux sons sont ignorés (50 participants peuvent tirer ensemble). */
let voices = 0;
const MAX_VOICES = 18;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    // Bruit blanc d'une seconde, réutilisé par tous les sons de tir, d'impact et de bois.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Volume des bruitages (0 à 100, réglage du joueur). */
export function setSfxVolume(percent: number): void {
  volume = Math.max(0, Math.min(1, percent / 100));
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
}

/** À appeler lors d'un geste du joueur (clic sur « Lancer la partie ») pour autoriser le son. */
export function unlockAudio(): void {
  audio();
}

interface Voice {
  c: AudioContext;
  out: AudioNode;
  t: number;
  end(seconds: number): void;
}

/** Une « voix » : gain (volume × réglage) et position gauche-droite ; null si le son est inaudible ou de trop. */
function voice(gain: number, pan: number): Voice | null {
  const c = audio();
  if (!c || !master || volume <= 0 || gain < 0.02 || voices >= MAX_VOICES) return null;
  voices++;
  const g = c.createGain();
  g.gain.value = Math.min(1, gain);
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    p.connect(master);
  } else g.connect(master);
  return {
    c,
    out: g,
    t: c.currentTime,
    end(seconds) {
      setTimeout(() => {
        voices--;
        g.disconnect();
      }, seconds * 1000 + 50);
    },
  };
}

/** Bruit filtré avec une enveloppe (attaque immédiate, décroissance exponentielle). */
function burst(v: Voice, opts: { type: BiquadFilterType; freq: number; to?: number; q?: number; gain: number; decay: number; delay?: number }) {
  if (!noise) return;
  const src = v.c.createBufferSource();
  src.buffer = noise;
  const f = v.c.createBiquadFilter();
  f.type = opts.type;
  f.Q.value = opts.q ?? 0.8;
  const t = v.t + (opts.delay ?? 0);
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + opts.decay);
  const g = v.c.createGain();
  g.gain.setValueAtTime(opts.gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + opts.decay);
  src.connect(f);
  f.connect(g);
  g.connect(v.out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + opts.decay + 0.02);
}

/** Oscillateur dont la fréquence glisse de `from` à `to`. */
function tone(v: Voice, opts: { type: OscillatorType; from: number; to: number; gain: number; decay: number; delay?: number; attack?: number }) {
  const o = v.c.createOscillator();
  o.type = opts.type;
  const t = v.t + (opts.delay ?? 0);
  o.frequency.setValueAtTime(opts.from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t + opts.decay);
  const g = v.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.001, t + opts.decay);
  o.connect(g);
  g.connect(v.out);
  o.start(t);
  o.stop(t + opts.decay + 0.02);
}

/** Tirs : pistolet (0), fusil à pompe (1), mitraillette (2), fusil de précision (3), projectile de brûlure (4). */
export function playShot(weapon: number, gain = 1, pan = 0): void {
  const v = voice(gain, pan);
  if (!v) return;
  if (weapon === 1) {
    burst(v, { type: "lowpass", freq: 1400, to: 300, gain: 0.9, decay: 0.32 });
    tone(v, { type: "sine", from: 110, to: 40, gain: 0.8, decay: 0.22 });
    v.end(0.35);
  } else if (weapon === 2) {
    burst(v, { type: "bandpass", freq: 2200, to: 900, q: 1.2, gain: 0.55, decay: 0.07 });
    tone(v, { type: "square", from: 180, to: 80, gain: 0.12, decay: 0.05 });
    v.end(0.1);
  } else if (weapon === 3) {
    burst(v, { type: "highpass", freq: 3000, gain: 0.7, decay: 0.05 });
    burst(v, { type: "lowpass", freq: 900, to: 120, gain: 0.8, decay: 0.55 });
    tone(v, { type: "sine", from: 90, to: 30, gain: 0.9, decay: 0.4 });
    v.end(0.6);
  } else if (weapon === 4) {
    tone(v, { type: "sawtooth", from: 220, to: 900, gain: 0.25, decay: 0.25 });
    burst(v, { type: "bandpass", freq: 800, to: 2400, gain: 0.35, decay: 0.25 });
    v.end(0.3);
  } else {
    burst(v, { type: "bandpass", freq: 1800, to: 700, q: 1, gain: 0.7, decay: 0.13 });
    tone(v, { type: "sine", from: 160, to: 55, gain: 0.55, decay: 0.09 });
    v.end(0.16);
  }
}

/** Coup de couteau : un souffle qui monte. */
export function playKnife(gain = 1, pan = 0): void {
  const v = voice(gain, pan);
  if (!v) return;
  burst(v, { type: "bandpass", freq: 500, to: 3200, q: 2, gain: 0.5, decay: 0.16 });
  v.end(0.2);
}

/** Impact sur un personnage (plus sec quand c'est le joueur qui touche). */
export function playHit(gain = 1, pan = 0, mine = false): void {
  const v = voice(gain, pan);
  if (!v) return;
  tone(v, { type: "square", from: mine ? 520 : 260, to: mine ? 300 : 120, gain: 0.25, decay: 0.07 });
  burst(v, { type: "lowpass", freq: 1200, gain: 0.3, decay: 0.05 });
  v.end(0.1);
}

/** Le joueur est touché : un coup sourd. */
export function playHurt(gain = 1): void {
  const v = voice(gain, 0);
  if (!v) return;
  tone(v, { type: "sine", from: 140, to: 50, gain: 0.7, decay: 0.18 });
  burst(v, { type: "lowpass", freq: 600, gain: 0.4, decay: 0.1 });
  v.end(0.2);
}

/** Bois : caisse touchée (`broken` : la caisse éclate). */
export function playCrate(broken: boolean, gain = 1, pan = 0): void {
  const v = voice(gain, pan);
  if (!v) return;
  burst(v, { type: "lowpass", freq: 700, to: 200, gain: 0.6, decay: 0.08 });
  if (broken) {
    for (let k = 0; k < 4; k++) burst(v, { type: "bandpass", freq: 900 + k * 350, q: 3, gain: 0.45, decay: 0.09, delay: 0.03 + k * 0.045 });
    tone(v, { type: "triangle", from: 180, to: 70, gain: 0.4, decay: 0.2 });
  }
  v.end(broken ? 0.32 : 0.1);
}

/** Objet ramassé : deux notes qui montent. */
export function playPickup(gain = 1): void {
  const v = voice(gain, 0);
  if (!v) return;
  tone(v, { type: "triangle", from: 660, to: 660, gain: 0.35, decay: 0.08 });
  tone(v, { type: "triangle", from: 990, to: 990, gain: 0.35, decay: 0.12, delay: 0.07 });
  v.end(0.22);
}

/** Soin : un petit carillon. */
export function playHeal(gain = 1): void {
  const v = voice(gain, 0);
  if (!v) return;
  [523, 659, 784].forEach((f, k) => tone(v, { type: "sine", from: f, to: f, gain: 0.3, decay: 0.3, delay: k * 0.07 }));
  v.end(0.5);
}

/** Rechargement : deux déclics. */
export function playReload(gain = 1): void {
  const v = voice(gain, 0);
  if (!v) return;
  burst(v, { type: "highpass", freq: 2500, gain: 0.4, decay: 0.03 });
  burst(v, { type: "highpass", freq: 1800, gain: 0.45, decay: 0.04, delay: 0.18 });
  v.end(0.25);
}

/** Capacité activée : une montée électrique. */
export function playAbility(gain = 1, pan = 0): void {
  const v = voice(gain, pan);
  if (!v) return;
  tone(v, { type: "sawtooth", from: 200, to: 1200, gain: 0.25, decay: 0.3 });
  tone(v, { type: "sine", from: 400, to: 1600, gain: 0.25, decay: 0.3, delay: 0.04 });
  v.end(0.38);
}

/** Capacité de nouveau prête (pour le joueur). */
export function playAbilityReady(gain = 1): void {
  const v = voice(gain, 0);
  if (!v) return;
  tone(v, { type: "sine", from: 880, to: 880, gain: 0.22, decay: 0.12 });
  tone(v, { type: "sine", from: 1320, to: 1320, gain: 0.22, decay: 0.2, delay: 0.1 });
  v.end(0.35);
}

/** Élimination (plus marquée quand le joueur en est l'auteur). */
export function playElimination(mine: boolean, gain = 1): void {
  const v = voice(gain, 0);
  if (!v) return;
  if (mine) {
    [523, 659, 784, 1047].forEach((f, k) => tone(v, { type: "square", from: f, to: f, gain: 0.16, decay: 0.12, delay: k * 0.06 }));
    v.end(0.4);
  } else {
    tone(v, { type: "triangle", from: 440, to: 220, gain: 0.2, decay: 0.25 });
    v.end(0.3);
  }
}

/** La Zone commence à avancer, ou le joueur est dehors : une alerte grave. */
export function playZoneWarning(gain = 1): void {
  const v = voice(gain, 0);
  if (!v) return;
  tone(v, { type: "sine", from: 220, to: 220, gain: 0.4, decay: 0.35 });
  tone(v, { type: "sine", from: 165, to: 165, gain: 0.4, decay: 0.45, delay: 0.3 });
  v.end(0.8);
}

/** Petit son d'essai (Réglages → Écouter). */
export function playTest(): void {
  playShot(0, 0.9);
  setTimeout(() => playPickup(0.9), 220);
}
