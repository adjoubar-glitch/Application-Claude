import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { AssetManifest } from '@tamalou/shared';
import { createApp } from '../src/index.js';
import { AssetStore } from '../src/assets/store.js';
import type { DriveBridge } from '../src/assets/drive.js';

/** Faux Drive en mémoire : le dossier "Tamaloo". */
function memoryDrive() {
  const files = new Map<string, Buffer>();
  const bridge: DriveBridge = {
    async list() {
      return [...files].map(([name, b]) => ({ name, size: b.length }));
    },
    async get(name) {
      const b = files.get(name);
      if (!b) throw new Error('introuvable');
      return b;
    },
    async put(name, _m, body) {
      files.set(name, body);
    },
    async remove(name) {
      files.delete(name);
    },
  };
  return { files, bridge };
}

const drive = memoryDrive();
process.env.ADMIN_PASSWORD = 'bananes-pourries';
const server = createApp({ assetsDir: mkdtempSync(path.join(tmpdir(), 'tam-')), drive: drive.bridge, clientDist: '/nonexistent' });
let base = '';
let token = '';

beforeAll(async () => {
  await new Promise<void>((r) => server.http.listen(0, r));
  base = `http://localhost:${(server.http.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.rooms.stop();
  server.io.close();
});

const json = (method: string, url: string, body?: unknown, auth = true) =>
  fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, data: (await r.json()) as Record<string, unknown> & { manifest?: AssetManifest } }));

const upload = (kind: string, name: string, body: Buffer) =>
  fetch(base + '/api/admin/files', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'x-asset-kind': kind, 'x-file-name': encodeURIComponent(name), 'content-type': 'application/octet-stream' },
    body: new Uint8Array(body),
  }).then(async (r) => ({ status: r.status, data: (await r.json()) as { ok: boolean; error?: string; file?: { id: string; url: string } } }));

describe('espace Admin', () => {
  it('refuse sans mot de passe, accepte le bon', async () => {
    expect((await json('POST', '/api/admin/login', { password: 'non' }, false)).status).toBe(401);
    const ok = await json('POST', '/api/admin/login', { password: 'bananes-pourries' }, false);
    expect(ok.status).toBe(200);
    token = ok.data.token as string;
    const anon = await fetch(base + '/api/admin/effects', { method: 'PUT', body: '{}', headers: { 'content-type': 'application/json' } });
    expect(anon.status).toBe(401);
  });

  it('charge un son, remplace un son intégré, le sert aux téléphones et le range dans Drive', async () => {
    const up = await upload('sound', 'Mon rire de singe.mp3', Buffer.from('ID3fake-mp3'));
    expect(up.data.ok).toBe(true);
    const id = up.data.file!.id;
    const set = await json('PUT', '/api/admin/sounds', { name: 'monkey-laugh', fileId: id });
    expect(set.data.manifest!.soundOverrides['monkey-laugh']).toBe(id);
    const served = await fetch(base + up.data.file!.url);
    expect(served.headers.get('content-type')).toContain('audio/mpeg');
    expect(Buffer.from(await served.arrayBuffer()).toString()).toBe('ID3fake-mp3');
    await new Promise((r) => setTimeout(r, 900));
    expect([...drive.files.keys()].some((k) => k.startsWith(id))).toBe(true);
    expect(drive.files.has('manifest.json')).toBe(true);
  });

  it('refuse les mauvais formats et les fichiers trop lourds', async () => {
    expect((await upload('sound', 'virus.exe', Buffer.from('x'))).data.ok).toBe(false);
    expect((await upload('cardImage', 'big.png', Buffer.alloc(3 * 1024 * 1024))).data.ok).toBe(false);
    expect((await upload('animation', 'anim.json', Buffer.from('pas du json'))).data.ok).toBe(false);
  });

  it('associe une image à une carte et au dos', async () => {
    const up = await upload('cardImage', 'spades-13.png', Buffer.from('png'));
    const id = up.data.file!.id;
    expect((await json('PUT', '/api/admin/cards', { key: 'spades-13', fileId: id })).data.ok).toBe(true);
    expect((await json('PUT', '/api/admin/cards', { key: 'back', fileId: id })).data.ok).toBe(true);
    expect((await json('PUT', '/api/admin/cards', { key: 'spades-14', fileId: id })).data.ok).toBe(false);
    const m = (await (await fetch(base + '/api/assets')).json()) as AssetManifest;
    expect(m.cards['spades-13']).toBe(id);
  });

  it('paramètre les effets : animation chargée pour la victime, valeurs folles corrigées', async () => {
    const anim = await upload('animation', 'gorille.gif', Buffer.from('GIF89a'));
    const id = anim.data.file!.id;
    const res = await json('PUT', '/api/admin/effects', {
      effects: {
        blindSwap: { victim: { animation: { kind: 'file', fileId: id }, text: 'Volé par [PSEUDO] !', durationMs: 999999, vibrate: [100, -5, 200] } },
        wrongTurn: { victim: { sound: { kind: 'builtin', id: 'nexistepas' } } },
      },
    });
    const e = res.data.manifest!.effects;
    expect(e.blindSwap.victim!.animation).toEqual({ kind: 'file', fileId: id });
    expect(e.blindSwap.victim!.durationMs).toBe(8000);
    expect(e.blindSwap.victim!.vibrate).toEqual([100, 200]);
    expect(e.wrongTurn.victim!.sound).toEqual({ kind: 'builtin', id: 'monkey-laugh' });
    // Supprimer le fichier remet l'animation par défaut.
    await json('DELETE', `/api/admin/files/${id}`);
    const m = (await (await fetch(base + '/api/assets')).json()) as AssetManifest;
    expect(m.effects.blindSwap.victim!.animation).toEqual({ kind: 'builtin', id: 'robbed-victim' });
  });

  it('au redémarrage, tout est rechargé depuis Drive (disque local vide)', async () => {
    await new Promise((r) => setTimeout(r, 900));
    const fresh = new AssetStore(mkdtempSync(path.join(tmpdir(), 'tam2-')), drive.bridge);
    await fresh.init();
    const m = fresh.manifest();
    expect(m.soundOverrides['monkey-laugh']).toBeDefined();
    expect(m.cards['spades-13']).toBeDefined();
    expect(m.files.length).toBeGreaterThanOrEqual(2);
  });
});
