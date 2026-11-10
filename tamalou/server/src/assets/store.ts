// Ressources personnalisées (Admin) : sons, images de cartes, animations, paramétrage des effets.
// Copie locale sur disque (servie aux téléphones) + sauvegarde dans Google Drive, dossier "Tamaloo".

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ASSET_RULES,
  BUILTIN_ANIMATIONS,
  BUILTIN_SOUNDS,
  DEFAULT_EFFECTS,
  EFFECT_EVENTS,
  type AssetFile,
  type AssetKind,
  type AssetManifest,
  type BuiltinSound,
  type CardImageKey,
  type EffectCell,
  type EffectEvent,
  type EffectRole,
  type EffectsConfig,
  type MediaRef,
} from '@tamalou/shared';
import type { DriveBridge } from './drive.js';

type StoredFile = Omit<AssetFile, 'url'> & { ext: string };

interface Stored {
  version: number;
  files: StoredFile[];
  cards: Partial<Record<CardImageKey, string>>;
  soundOverrides: Partial<Record<BuiltinSound, string>>;
  effects: EffectsConfig;
}

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  png: 'image/png',
  apng: 'image/apng',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  webm: 'video/webm',
  mp4: 'video/mp4',
  json: 'application/json',
};

export const CARD_KEY = /^(?:(hearts|diamonds|clubs|spades)-(1[0-3]|[1-9])|back)$/;

export class AssetStore {
  private data: Stored;
  private readonly filesDir: string;
  private readonly manifestPath: string;
  private listeners = new Set<(version: number) => void>();

  constructor(
    readonly dir: string,
    private drive: DriveBridge | null = null,
  ) {
    this.filesDir = path.join(dir, 'files');
    this.manifestPath = path.join(dir, 'manifest.json');
    mkdirSync(this.filesDir, { recursive: true });
    this.data = this.readLocal();
  }

  /** Au démarrage : récupère depuis Drive tout ce qui manque localement. */
  async init(): Promise<void> {
    if (!this.drive) return;
    try {
      const remote = await this.drive.list();
      const manifest = remote.find((f) => f.name === 'manifest.json');
      if (manifest) {
        const raw = JSON.parse((await this.drive.get('manifest.json')).toString('utf8')) as Stored;
        if (raw.version >= this.data.version) this.data = this.normalize(raw);
      }
      for (const f of this.data.files) {
        const local = path.join(this.filesDir, `${f.id}.${f.ext}`);
        if (!existsSync(local) && remote.some((r) => r.name === `${f.id}.${f.ext}`)) {
          writeFileSync(local, await this.drive.get(`${f.id}.${f.ext}`));
        }
      }
      // Fichiers introuvables partout : on les retire du manifeste.
      this.data.files = this.data.files.filter((f) => existsSync(path.join(this.filesDir, `${f.id}.${f.ext}`)));
      this.writeLocal();
      console.log(`☁️  Drive "Tamaloo" : ${this.data.files.length} fichier(s) chargé(s)`);
    } catch (e) {
      console.warn('⚠️  Drive indisponible, on continue avec la copie locale :', (e as Error).message);
    }
  }

  onChange(cb: (version: number) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  manifest(): AssetManifest {
    const v = this.data.version;
    return {
      version: v,
      files: this.data.files.map(({ ext, ...f }) => ({ ...f, url: `/assets/files/${f.id}.${ext}?v=${v}` })),
      cards: this.data.cards,
      soundOverrides: this.data.soundOverrides,
      effects: this.data.effects,
    };
  }

  filePath(name: string): string | null {
    const m = /^([a-z0-9]+)\.([a-z0-9]+)$/.exec(name);
    if (!m) return null;
    const f = this.data.files.find((x) => x.id === m[1] && x.ext === m[2]);
    return f ? path.join(this.filesDir, `${f.id}.${f.ext}`) : null;
  }

  mimeOf(name: string): string {
    return MIME[name.split('.').pop() ?? ''] ?? 'application/octet-stream';
  }

  // -------------------------------------------------------------------------
  // Modifications (Admin)
  // -------------------------------------------------------------------------

  add(kind: AssetKind, originalName: string, body: Buffer): AssetFile {
    const rules = ASSET_RULES[kind];
    if (!rules) throw new Error('Type de fichier inconnu');
    const ext = (originalName.split('.').pop() ?? '').toLowerCase();
    if (!rules.extensions.includes(ext)) throw new Error(`Format refusé : ${rules.extensions.join(', ')}`);
    if (body.length === 0) throw new Error('Fichier vide');
    if (body.length > rules.maxBytes) throw new Error(`Fichier trop lourd (${Math.round(rules.maxBytes / 1024 / 1024)} Mo maximum)`);
    if (ext === 'json') {
      try {
        JSON.parse(body.toString('utf8'));
      } catch {
        throw new Error("Ce .json n'est pas une animation Lottie valide");
      }
    }
    const id = randomBytes(8).toString('hex');
    const name = originalName.replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 80) || `fichier.${ext}`;
    const file: StoredFile = { id, kind, name, mime: MIME[ext] ?? 'application/octet-stream', size: body.length, ext };
    writeFileSync(path.join(this.filesDir, `${id}.${ext}`), body);
    this.data.files.push(file);
    this.commit();
    void this.drive?.put(`${id}.${ext}`, file.mime, body).catch((e) => console.warn('Drive put:', (e as Error).message));
    return this.manifest().files.find((f) => f.id === id)!;
  }

  remove(id: string): void {
    const f = this.data.files.find((x) => x.id === id);
    if (!f) throw new Error('Fichier introuvable');
    this.data.files = this.data.files.filter((x) => x.id !== id);
    for (const [k, v] of Object.entries(this.data.cards)) if (v === id) delete this.data.cards[k as CardImageKey];
    for (const [k, v] of Object.entries(this.data.soundOverrides)) if (v === id) delete this.data.soundOverrides[k as BuiltinSound];
    this.data.effects = this.sanitizeEffects(this.data.effects);
    rmSync(path.join(this.filesDir, `${f.id}.${f.ext}`), { force: true });
    this.commit();
    void this.drive?.remove(`${f.id}.${f.ext}`).catch((e) => console.warn('Drive delete:', (e as Error).message));
  }

  setCard(key: string, fileId: string | null): void {
    if (!CARD_KEY.test(key)) throw new Error('Carte inconnue');
    if (fileId === null) delete this.data.cards[key as CardImageKey];
    else {
      this.requireFile(fileId, 'cardImage');
      this.data.cards[key as CardImageKey] = fileId;
    }
    this.commit();
  }

  setSound(name: string, fileId: string | null): void {
    if (!BUILTIN_SOUNDS.includes(name as BuiltinSound)) throw new Error('Son inconnu');
    if (fileId === null) delete this.data.soundOverrides[name as BuiltinSound];
    else {
      this.requireFile(fileId, 'sound');
      this.data.soundOverrides[name as BuiltinSound] = fileId;
    }
    this.commit();
  }

  setEffects(raw: unknown): EffectsConfig {
    this.data.effects = this.sanitizeEffects(raw);
    this.commit();
    return this.data.effects;
  }

  // -------------------------------------------------------------------------
  // Validation du paramétrage
  // -------------------------------------------------------------------------

  sanitizeEffects(raw: unknown): EffectsConfig {
    const out = structuredClone(DEFAULT_EFFECTS);
    if (typeof raw !== 'object' || raw === null) return out;
    const src = raw as Record<string, Record<string, unknown>>;
    for (const [event, def] of Object.entries(EFFECT_EVENTS) as [EffectEvent, (typeof EFFECT_EVENTS)[EffectEvent]][]) {
      for (const role of def.roles as readonly EffectRole[]) {
        const c = src[event]?.[role] as Partial<EffectCell> | undefined;
        const base = out[event][role]!;
        if (!c || typeof c !== 'object') continue;
        out[event][role] = {
          sound: this.ref(c.sound, 'sound') ?? base.sound,
          animation: this.ref(c.animation, 'animation') ?? base.animation,
          text: typeof c.text === 'string' ? c.text.slice(0, 140) : base.text,
          durationMs: Number.isFinite(c.durationMs) ? Math.max(800, Math.min(8000, Math.round(c.durationMs as number))) : base.durationMs,
          vibrate: Array.isArray(c.vibrate) ? c.vibrate.filter((n) => Number.isFinite(n) && n >= 0 && n <= 2000).slice(0, 8).map(Math.round) : c.vibrate === null ? null : base.vibrate,
          fullscreen: typeof c.fullscreen === 'boolean' ? c.fullscreen : base.fullscreen,
          shake: typeof c.shake === 'boolean' ? c.shake : base.shake,
        };
      }
    }
    return out;
  }

  /** Une référence valide, null explicite (aucun), ou undefined (garder la valeur par défaut). */
  private ref(r: unknown, kind: 'sound' | 'animation'): MediaRef | undefined {
    if (r === null) return null;
    if (typeof r !== 'object') return undefined;
    const m = r as { kind?: string; id?: string; fileId?: string };
    if (m.kind === 'builtin' && typeof m.id === 'string') {
      const ok = kind === 'sound' ? BUILTIN_SOUNDS.includes(m.id as BuiltinSound) : m.id in BUILTIN_ANIMATIONS;
      return ok ? { kind: 'builtin', id: m.id } : undefined;
    }
    if (m.kind === 'file' && typeof m.fileId === 'string') {
      const f = this.data.files.find((x) => x.id === m.fileId && x.kind === kind);
      return f ? { kind: 'file', fileId: f.id } : undefined;
    }
    return undefined;
  }

  private requireFile(id: string, kind: AssetKind) {
    if (!this.data.files.some((f) => f.id === id && f.kind === kind)) throw new Error('Fichier introuvable');
  }

  // -------------------------------------------------------------------------
  // Persistance
  // -------------------------------------------------------------------------

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private commit() {
    this.data.version++;
    this.writeLocal();
    for (const l of this.listeners) l(this.data.version);
    if (this.drive) {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        void this.drive!.put('manifest.json', 'application/json', Buffer.from(JSON.stringify(this.data, null, 1))).catch((e) =>
          console.warn('Drive manifest:', (e as Error).message),
        );
      }, 800);
      this.saveTimer.unref?.();
    }
  }

  private readLocal(): Stored {
    try {
      return this.normalize(JSON.parse(readFileSync(this.manifestPath, 'utf8')) as Stored);
    } catch {
      return { version: 0, files: [], cards: {}, soundOverrides: {}, effects: structuredClone(DEFAULT_EFFECTS) };
    }
  }

  private normalize(raw: Partial<Stored>): Stored {
    const files = Array.isArray(raw.files) ? raw.files.filter((f) => f && typeof f.id === 'string' && typeof f.ext === 'string') : [];
    this.data = { version: Number(raw.version) || 0, files, cards: raw.cards ?? {}, soundOverrides: raw.soundOverrides ?? {}, effects: DEFAULT_EFFECTS };
    this.data.effects = this.sanitizeEffects(raw.effects);
    return this.data;
  }

  private writeLocal() {
    writeFileSync(this.manifestPath, JSON.stringify(this.data, null, 1));
  }
}
