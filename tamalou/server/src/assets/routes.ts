// API publique des ressources + API Admin (mot de passe ADMIN_PASSWORD).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { AssetKind } from '@tamalou/shared';
import type { AssetStore } from './store.js';

const TOKEN_TTL_MS = 12 * 3600_000;
const secret = process.env.ADMIN_SECRET ?? randomBytes(32).toString('hex');

const sign = (exp: number) => createHmac('sha256', secret).update(`admin:${exp}`).digest('base64url');
export const makeToken = (now = Date.now()) => {
  const exp = now + TOKEN_TTL_MS;
  return `${exp}.${sign(exp)}`;
};
export function checkToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp < now) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

function samePassword(given: string, expected: string): boolean {
  const a = createHmac('sha256', secret).update(given).digest();
  const b = createHmac('sha256', secret).update(expected).digest();
  return timingSafeEqual(a, b);
}

const attempts = new Map<string, { count: number; since: number }>();

export function assetRoutes(store: AssetStore) {
  const r = express.Router();

  r.get('/api/assets', (_req, res) => {
    res.set('Cache-Control', 'no-store').json(store.manifest());
  });

  r.get('/assets/files/:name', (req, res) => {
    const p = store.filePath(req.params.name);
    if (!p) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=31536000, immutable').type(store.mimeOf(req.params.name)).sendFile(p);
  });

  // --- Admin ---------------------------------------------------------------

  r.post('/api/admin/login', express.json({ limit: '4kb' }), (req, res) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return res.status(503).json({ ok: false, error: "L'Admin n'est pas activé : définis ADMIN_PASSWORD sur le serveur." });
    const ip = req.ip ?? 'x';
    const a = attempts.get(ip);
    const now = Date.now();
    if (a && now - a.since < 60_000 && a.count >= 5) return res.status(429).json({ ok: false, error: 'Trop de tentatives, réessaie dans une minute.' });
    const given = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!samePassword(given, expected)) {
      attempts.set(ip, a && now - a.since < 60_000 ? { count: a.count + 1, since: a.since } : { count: 1, since: now });
      return res.status(401).json({ ok: false, error: 'Mot de passe incorrect' });
    }
    attempts.delete(ip);
    res.json({ ok: true, token: makeToken() });
  });

  const auth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.get('authorization')?.replace(/^Bearer /, '');
    if (!checkToken(token)) return res.status(401).json({ ok: false, error: 'Session Admin expirée, reconnecte-toi.' });
    next();
  };
  const handle = (fn: (req: Request) => unknown) => (req: Request, res: Response) => {
    try {
      res.json({ ok: true, ...((fn(req) as object) ?? {}), manifest: store.manifest() });
    } catch (e) {
      res.status(400).json({ ok: false, error: (e as Error).message });
    }
  };

  // Envoi d'un fichier brut : nom et type dans les en-têtes (pas de multipart).
  r.post(
    '/api/admin/files',
    auth,
    express.raw({ type: () => true, limit: '6mb' }),
    handle((req) => {
      const kind = req.get('x-asset-kind') as AssetKind;
      const name = decodeURIComponent(req.get('x-file-name') ?? '');
      return { file: store.add(kind, name, req.body as Buffer) };
    }),
  );
  r.delete('/api/admin/files/:id', auth, handle((req) => store.remove(String(req.params.id))));
  r.put('/api/admin/cards', auth, express.json(), handle((req) => store.setCard(req.body?.key, req.body?.fileId ?? null)));
  r.put('/api/admin/sounds', auth, express.json(), handle((req) => store.setSound(req.body?.name, req.body?.fileId ?? null)));
  r.put('/api/admin/effects', auth, express.json({ limit: '200kb' }), handle((req) => ({ effects: store.setEffects(req.body?.effects) })));

  return r;
}
