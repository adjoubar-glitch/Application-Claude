// Point d'entrée : Express sert le client (build Vite) et l'API ; Socket.IO gère le jeu.

import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/manager.js';
import { registerSocketHandlers, socketTransport, type IO } from './socket.js';

export function createApp() {
  const app = express();
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

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.rooms.size });
  });

  // Client React construit (dist), avec repli SPA.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = process.env.CLIENT_DIST ?? path.resolve(here, '../../client/dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  return { app, http, io, rooms };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  const { http } = createApp();
  http.listen(port, () => console.log(`🐒 Tamalou écoute sur le port ${port}`));
}
