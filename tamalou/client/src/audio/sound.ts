// Sons : fichiers de /sounds/<nom>.mp3 (remplaçables), ou fichiers chargés dans l'Admin.
// Web Audio, déverrouillé au premier tap (contrainte iOS/Android).

import { BUILTIN_SOUNDS, type BuiltinSound, type MediaRef } from '@tamalou/shared';
import { fileUrl, getState } from '../net/store';

const MUTE_KEY = 'tamalou.muted';
let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
const muteListeners = new Set<() => void>();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* rien */
  }
  for (const l of muteListeners) l();
}
export function onMuteChange(cb: () => void): () => void {
  muteListeners.add(cb);
  return () => {
    muteListeners.delete(cb);
  };
}

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** À appeler sur le premier geste de l'utilisateur. */
export function unlockAudio() {
  const c = context();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const b = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = b;
  src.connect(c.destination);
  src.start(0);
  // Préchargement des sons intégrés en arrière-plan.
  for (const name of BUILTIN_SOUNDS) void load(urlFor({ kind: 'builtin', id: name }));
}

function urlFor(ref: MediaRef): string | null {
  if (!ref) return null;
  if (ref.kind === 'file') return fileUrl(ref.fileId) ?? null;
  const override = getState().assets.soundOverrides[ref.id as BuiltinSound];
  return fileUrl(override) ?? `/sounds/${ref.id}.mp3`;
}

function load(url: string | null): Promise<AudioBuffer | null> {
  if (!url) return Promise.resolve(null);
  const c = context();
  if (!c) return Promise.resolve(null);
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => c.decodeAudioData(ab))
      .catch(() => null);
    buffers.set(url, p);
  }
  return p;
}

/** Vider le cache après une modification dans l'Admin. */
export function resetSounds() {
  buffers.clear();
}

export async function playSound(ref: MediaRef | BuiltinSound, volume = 0.9) {
  if (muted) return;
  const r: MediaRef = typeof ref === 'string' ? { kind: 'builtin', id: ref } : ref;
  const c = context();
  if (!c || !r) return;
  if (c.state === 'suspended') await c.resume().catch(() => {});
  const buf = await load(urlFor(r));
  if (!buf) return;
  const src = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(gain).connect(c.destination);
  src.start();
}

export function vibrate(pattern: number[] | null) {
  if (!pattern || muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supporté */
  }
}
