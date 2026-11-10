// Génère les sons ORIGINAUX du jeu par synthèse (aucun échantillon externe).
// Usage : node scripts/gen-sounds.mjs  (nécessite ffmpeg pour la conversion en mp3)
// Sortie : client/public/sounds/<nom>.mp3 — remplaçables par tes propres fichiers (mêmes noms).

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'client/public/sounds');
const tmp = path.join(root, 'scripts/.tmp-sounds');
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });

// Hasard reproductible : les sons sont identiques à chaque génération.
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
const TAU = Math.PI * 2;

/** Oscillateur à fréquence variable. */
function osc(sec, freq, { type = 'sine', amp = 1, env = (t) => 1 } = {}) {
  const b = buf(sec);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = typeof freq === 'function' ? freq(t) : freq;
    ph += f / SR;
    const p = ph % 1;
    let v;
    switch (type) {
      case 'saw': v = 2 * p - 1; break;
      case 'square': v = p < 0.5 ? 1 : -1; break;
      case 'tri': v = 4 * Math.abs(p - 0.5) - 1; break;
      default: v = Math.sin(TAU * p);
    }
    b[i] = v * amp * env(t);
  }
  return b;
}

function noise(sec, { amp = 1, env = () => 1 } = {}) {
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) b[i] = (rnd() * 2 - 1) * amp * env(i / SR);
  return b;
}

/** Filtre passe-bas une pôle, fréquence de coupure éventuellement variable. */
function lowpass(b, cutoff) {
  let y = 0;
  for (let i = 0; i < b.length; i++) {
    const c = typeof cutoff === 'function' ? cutoff(i / SR) : cutoff;
    const a = 1 - Math.exp((-TAU * c) / SR);
    y += a * (b[i] - y);
    b[i] = y;
  }
  return b;
}

function highpass(b, cutoff) {
  const low = lowpass(Float32Array.from(b), cutoff);
  for (let i = 0; i < b.length; i++) b[i] -= low[i];
  return b;
}

/** Enveloppe attaque / maintien / relâchement (secondes). */
const adsr = (a, hold, r) => (t) => (t < a ? t / a : t < a + hold ? 1 : Math.max(0, 1 - (t - a - hold) / r));
const decay = (k) => (t) => Math.exp(-t * k);

function mix(total, parts) {
  const b = buf(total);
  for (const [at, part, gain = 1] of parts) {
    const o = Math.floor(at * SR);
    for (let i = 0; i < part.length && o + i < b.length; i++) b[o + i] += part[i] * gain;
  }
  return b;
}

function normalize(b, peak = 0.89) {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i] = (b[i] / m) * peak;
  // Fondu de sortie pour éviter les clics.
  const fade = Math.min(b.length, Math.floor(0.02 * SR));
  for (let i = 0; i < fade; i++) b[b.length - 1 - i] *= i / fade;
  return b;
}

// --- Briques ---------------------------------------------------------------

/** "Hou" de singe : voix nasale, montée de hauteur puis chute. */
function hoot(sec, from, to, { amp = 1, rough = 0.15 } = {}) {
  const f = (t) => from + (to - from) * Math.sin((Math.PI / 2) * Math.min(1, t / sec)) + Math.sin(t * 38) * 12;
  const v = osc(sec, f, { type: 'saw', env: adsr(0.02, sec * 0.5, sec * 0.45) });
  const n = noise(sec, { amp: rough, env: adsr(0.01, sec * 0.4, sec * 0.5) });
  for (let i = 0; i < v.length; i++) v[i] += n[i];
  return lowpass(v, (t) => 1400 + 900 * Math.sin((Math.PI * t) / sec)).map((x) => x * amp);
}

/** Cri aigu de singe : "iiih". */
function screech(sec, base, amp = 1) {
  const f = (t) => base + 700 * Math.sin((Math.PI * t) / sec) + Math.sin(t * 90) * 60;
  const v = osc(sec, f, { type: 'square', env: adsr(0.01, sec * 0.6, sec * 0.35) });
  return lowpass(v, 3200).map((x) => x * amp);
}

function drum(sec, freq, amp = 1) {
  const body = osc(sec, (t) => freq * (1 + 1.5 * Math.exp(-t * 30)), { env: decay(9) });
  const hit = lowpass(noise(0.05, { env: decay(60) }), 2500);
  return mix(sec, [[0, body, amp], [0, hit, amp * 0.5]]);
}

function bell(sec, freq, amp = 1) {
  return mix(sec, [
    [0, osc(sec, freq, { env: decay(5) }), amp],
    [0, osc(sec, freq * 2.76, { env: decay(9) }), amp * 0.35],
    [0, osc(sec, freq * 5.4, { env: decay(14) }), amp * 0.15],
  ]);
}

function brass(sec, freq, amp = 1, slide = 0) {
  const v = osc(sec, (t) => freq * (1 + slide * (t / sec)) * (1 + 0.006 * Math.sin(t * 34)), { type: 'saw', env: adsr(0.04, sec * 0.6, sec * 0.35) });
  return lowpass(v, (t) => 900 + 1600 * Math.min(1, t * 8)).map((x) => x * amp);
}

function marimba(sec, freq, amp = 1) {
  return mix(sec, [[0, osc(sec, freq, { env: decay(14) }), amp], [0, osc(sec, freq * 4, { env: decay(40) }), amp * 0.3]]);
}

const note = (n) => 440 * 2 ** ((n - 69) / 12);

// --- Les sons ----------------------------------------------------------------

const sounds = {
  // Singe qui se moque : "hou-hou-HA-HA-HA" qui accélère.
  'monkey-laugh': () => {
    const parts = [];
    let t = 0;
    const steps = [[0.16, 380, 620], [0.16, 400, 640], [0.12, 520, 900], [0.1, 560, 980], [0.1, 600, 1050], [0.09, 620, 1100], [0.09, 640, 1150], [0.22, 700, 420]];
    for (const [d, a, b] of steps) {
      parts.push([t, hoot(d, a, b)]);
      t += d + 0.035;
    }
    parts.push([t - 0.1, screech(0.3, 1500, 0.4)]);
    return mix(t + 0.4, parts);
  },

  // Cri de jungle façon homme-singe : longue vocalise qui yodle.
  'jungle-yell': () => {
    const sec = 2.1;
    const f = (t) => {
      const yodel = Math.sin(t * TAU * 3.2) > 0 ? 1 : 0; // bascule voix de poitrine / voix de tête
      const base = 260 + 40 * Math.sin(t * 2) + yodel * 210;
      return base * (1 + 0.02 * Math.sin(t * 40)) * (t < 0.15 ? 0.85 + t : 1);
    };
    const v = osc(sec, f, { type: 'saw', env: adsr(0.08, 1.6, 0.4) });
    const breath = noise(sec, { amp: 0.08, env: adsr(0.05, 1.7, 0.3) });
    const voice = lowpass(mix(sec, [[0, v], [0, breath]]), (t) => 1500 + 700 * Math.sin(t * TAU * 3.2));
    return mix(2.4, [[0, voice], [0, drum(0.4, 70, 0.6)], [1.9, drum(0.4, 60, 0.5)]]);
  },

  // Jingle d'échec façon jeu télévisé, mêlé de cris de singe.
  'fail-jingle': () => {
    const n = [note(58), note(57), note(56)];
    return mix(2.4, [
      [0, brass(0.32, n[0])],
      [0.38, brass(0.32, n[1])],
      [0.76, brass(0.32, n[2])],
      [1.14, brass(0.95, note(55), 1, -0.06)],
      [0.2, screech(0.25, 1300, 0.35)],
      [0.95, hoot(0.2, 500, 800, { amp: 0.5 })],
      [1.4, screech(0.35, 1100, 0.3)],
      [1.14, drum(0.5, 55, 0.7)],
    ]);
  },

  // Doublon trop lent : grognements de gorille et poitrine tambourinée.
  'gorilla-slow': () => {
    const grunt = (d, f) => lowpass(osc(d, (t) => f * (1 - 0.2 * t / d), { type: 'saw', env: adsr(0.03, d * 0.4, d * 0.5) }), 600);
    const parts = [[0, grunt(0.35, 110)], [0.45, grunt(0.45, 95)]];
    for (let i = 0; i < 6; i++) parts.push([1.0 + i * 0.11, drum(0.2, 90 - i * 4, 0.8)]);
    return mix(1.9, parts);
  },

  // Doublon réussi : arpège qui monte et petit "hou" content.
  'duplicate-win': () =>
    mix(1.0, [
      [0, bell(0.5, note(76), 0.7)],
      [0.08, bell(0.5, note(79), 0.7)],
      [0.16, bell(0.6, note(84), 0.8)],
      [0.3, hoot(0.18, 600, 1000, { amp: 0.35 })],
    ]),

  // Sifflet d'espion : deux notes, la seconde qui glisse.
  'spy-whistle': () =>
    mix(1.0, [
      [0, osc(0.22, (t) => 1800 + Math.sin(t * 50) * 30, { env: adsr(0.02, 0.15, 0.05), amp: 0.8 })],
      [0.28, osc(0.5, (t) => 1500 + 900 * Math.min(1, t * 2.5) + Math.sin(t * 50) * 40, { env: adsr(0.02, 0.35, 0.13), amp: 0.8 })],
    ]),

  // Échange : souffle filtré qui balaie.
  'swap-swoosh': () => {
    const n = noise(0.55, { env: (t) => Math.sin((Math.PI * t) / 0.55) ** 2 });
    return normalize(lowpass(highpass(n, 300), (t) => 400 + 4000 * Math.sin((Math.PI * t) / 0.55)));
  },

  // Roi noir : rugissement grave puis petite fanfare.
  'king-roar': () => {
    const roar = lowpass(
      mix(1.0, [
        [0, osc(1.0, (t) => 85 + 30 * Math.sin(t * 7), { type: 'saw', env: adsr(0.1, 0.5, 0.4) })],
        [0, noise(1.0, { amp: 0.6, env: adsr(0.08, 0.5, 0.4) })],
      ]),
      700,
    );
    return mix(1.8, [[0, roar], [0.95, brass(0.18, note(60), 0.6)], [1.13, brass(0.18, note(64), 0.6)], [1.31, brass(0.45, note(67), 0.7)]]);
  },

  // Piocher : petit froissement de carte.
  draw: () => normalize(highpass(noise(0.12, { env: (t) => (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) * 35)) }), 2000), 0.6),

  // Défausser : carte claquée sur la table.
  discard: () =>
    normalize(
      mix(0.2, [
        [0, lowpass(noise(0.08, { env: decay(70) }), 3500)],
        [0, osc(0.15, (t) => 180 * (1 + Math.exp(-t * 50)), { env: decay(30), amp: 0.7 })],
      ]),
      0.7,
    ),

  // Annonce Tamalou : tambours tribaux et corne.
  tamalou: () => {
    const parts = [];
    const pattern = [0, 0.18, 0.36, 0.45, 0.54, 0.72, 0.9, 0.99, 1.08];
    pattern.forEach((t, i) => parts.push([t, drum(0.3, i % 3 === 2 ? 140 : 80, i % 3 === 2 ? 0.6 : 0.9)]));
    parts.push([1.2, brass(0.9, note(55), 0.9, 0.03)], [1.2, brass(0.9, note(62), 0.5, 0.03)]);
    return mix(2.2, parts);
  },

  // Fin de manche : fanfare + marimba en majeur.
  'round-win': () => {
    const parts = [];
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => parts.push([i * 0.09, marimba(0.5, note(n), 0.7)]));
    parts.push([0.65, brass(0.7, note(72), 0.6)], [0.65, brass(0.7, note(76), 0.4)], [0.65, brass(0.7, note(79), 0.4)]);
    parts.push([0.7, hoot(0.2, 600, 1000, { amp: 0.3 })], [0.95, hoot(0.2, 650, 1100, { amp: 0.3 })]);
    return mix(1.6, parts);
  },
};

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

for (const [name, make] of Object.entries(sounds)) {
  const samples = normalize(make());
  const w = path.join(tmp, `${name}.wav`);
  writeFileSync(w, wav(samples));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', w, '-ac', '1', '-b:a', '96k', path.join(out, `${name}.mp3`)]);
  console.log(`✓ ${name}.mp3 (${(samples.length / SR).toFixed(2)} s)`);
}
rmSync(tmp, { recursive: true, force: true });
