// Point d'entrée : Express sert le client (build Vite), l'API et les ressources ; Socket.IO gère le jeu.

import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { assetRoutes } from './assets/routes.js';
import { driveBridgeFromEnv, type DriveBridge } from './assets/drive.js';
import { AssetStore } from './assets/store.js';
import { RoomManager } from './rooms/manager.js';
import { registerSocketHandlers, socketTransport, type IO } from './socket.js';

export interface AppOptions {
  assetsDir?: string;
  drive?: DriveBridge | null;
  clientDist?: string;
}

export function createApp(opts: AppOptions = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  const http = createServer(app);
  const io: IO = new Server(http, {
    cors: process.env.NODE_ENV === 'production' ? undefined : { origin: true },
    // Téléphones en veille : on tolère des coupures, la reconnexion fait le reste.
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });
  const rooms = new RoomManager(socketTransport(io));
  rooms.startSweeper();
  registerSocketHandlers(io, rooms);

  const assets = new AssetStore(
    opts.assetsDir ?? process.env.ASSETS_DIR ?? path.resolve(process.cwd(), 'data/assets'),
    opts.drive === undefined ? driveBridgeFromEnv() : opts.drive,
  );
  assets.onChange((version) => io.emit('assets', { version }));
  app.use(assetRoutes(assets));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.rooms.size });
  });

  // Client React construit (dist), avec repli SPA.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = opts.clientDist ?? process.env.CLIENT_DIST ?? path.resolve(here, '../../client/dist');
  if (existsSync(clientDist)) {
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders: (res, file) => {
          // Fichiers versionnés par Vite : cache long. Le reste (sw.js, manifeste) : toujours frais.
          if (file.includes(`${path.sep}static${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return { app, http, io, rooms, assets };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  const { http, assets } = createApp();
  void assets.init().finally(() => {
    http.listen(port, () => console.log(`🐒 Tamalou écoute sur le port ${port}`));
  });
}
