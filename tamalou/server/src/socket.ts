// Branchement Socket.IO : authentification par salon + jeton, routage des événements.

import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, PlayerId, ServerToClientEvents, SessionInfo } from '@tamalou/shared';
import { RoomManager } from './rooms/manager.js';
import type { Member, Room, RoomTransport } from './rooms/room.js';
import { cleanName, parseAction, parseOptions } from './rooms/validate.js';

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type S = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export interface SocketData {
  code?: string;
  playerId?: PlayerId;
}

/** Chaque joueur a son "canal" Socket.IO : <code>:<playerId>. */
export const channel = (code: string, playerId: PlayerId) => `${code}:${playerId}`;

export function socketTransport(io: IO): RoomTransport {
  return {
    deliver(code, playerId, event, ...args) {
      (io.to(channel(code, playerId)).emit as (e: string, ...a: unknown[]) => void)(event, ...args);
    },
  };
}

type AnyAck = (res: { ok: boolean; error?: string } & Record<string, unknown>) => void;
const safeAck = (ack: unknown): AnyAck => (typeof ack === 'function' ? (ack as AnyAck) : () => {});

export function registerSocketHandlers(io: IO, rooms: RoomManager): void {
  io.on('connection', (socket: S) => {
    const session = (room: Room, m: Member): SessionInfo => ({ roomCode: room.code, playerId: m.id, token: m.token });

    const bind = (room: Room, m: Member) => {
      unbind();
      socket.data.code = room.code;
      socket.data.playerId = m.id;
      void socket.join(channel(room.code, m.id));
      room.attach(m.id);
    };

    const unbind = () => {
      const { code, playerId } = socket.data;
      if (!code || !playerId) return;
      void socket.leave(channel(code, playerId));
      rooms.get(code)?.detach(playerId);
      socket.data.code = undefined;
      socket.data.playerId = undefined;
    };

    const current = (): { room: Room; me: Member } | null => {
      const room = rooms.get(socket.data.code);
      const me = socket.data.playerId ? room?.member(socket.data.playerId) : undefined;
      return room && me ? { room, me } : null;
    };

    socket.on('room:create', (p, ack) => {
      const reply = safeAck(ack);
      const name = cleanName(p?.name);
      if (!name) return reply({ ok: false, error: 'Choisis un pseudo' });
      const room = rooms.create();
      const res = room.addHuman(name);
      if (!res.ok) return reply(res);
      bind(room, res.member);
      reply({ ok: true, ...session(room, res.member) });
    });

    socket.on('room:join', (p, ack) => {
      const reply = safeAck(ack);
      const name = cleanName(p?.name);
      if (!name) return reply({ ok: false, error: 'Choisis un pseudo' });
      const room = rooms.get(p?.code);
      if (!room) return reply({ ok: false, error: "Ce salon n'existe pas (vérifie le code)" });
      const res = room.addHuman(name);
      if (!res.ok) return reply(res);
      bind(room, res.member);
      reply({ ok: true, ...session(room, res.member) });
    });

    socket.on('room:resume', (p, ack) => {
      const reply = safeAck(ack);
      const room = rooms.get(p?.code);
      const m = room && typeof p?.token === 'string' ? room.byToken(p.token) : undefined;
      if (!room || !m) return reply({ ok: false, error: 'Session expirée' });
      bind(room, m);
      reply({ ok: true, ...session(room, m) });
    });

    socket.on('room:leave', () => {
      const c = current();
      unbind();
      c?.room.leave(c.me.id);
    });

    socket.on('lobby:setOptions', (p, ack) => {
      const reply = safeAck(ack);
      const c = current();
      const options = parseOptions(p?.options);
      if (!c || !options) return reply({ ok: false, error: 'Options invalides' });
      reply(c.room.setOptions(c.me.id, options));
    });

    socket.on('lobby:start', (ack) => {
      const reply = safeAck(ack);
      const c = current();
      if (!c) return reply({ ok: false, error: 'Pas de salon' });
      reply(c.room.start(c.me.id));
    });

    socket.on('game:nextRound', (ack) => {
      const c = current();
      safeAck(ack)(c ? c.room.nextRound(c.me.id) : { ok: false, error: 'Pas de salon' });
    });

    socket.on('game:backToLobby', (ack) => {
      const c = current();
      safeAck(ack)(c ? c.room.backToLobby(c.me.id) : { ok: false, error: 'Pas de salon' });
    });

    socket.on('game:action', (raw, ack) => {
      const reply = safeAck(ack);
      const now = Date.now(); // horodatage à la réception, avant tout traitement
      const c = current();
      const action = parseAction(raw);
      if (!c || !action) return reply({ ok: false, error: 'Action invalide' });
      const res = c.room.act(c.me.id, action, now);
      if (!res.ok && res.code !== 'wrongTurn') c.room.toast(c.me.id, res.error);
      reply(res.ok ? { ok: true } : { ok: false, error: res.error });
    });

    socket.on('disconnect', unbind);
  });
}
