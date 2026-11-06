import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ClientView, GameFx, ServerToClientEvents, SessionInfo } from '@tamalou/shared';
import { createApp } from '../src/index.js';

type C = Socket<ServerToClientEvents, ClientToServerEvents>;
let url = '';
const server = createApp();

beforeAll(async () => {
  await new Promise<void>((r) => server.http.listen(0, r));
  url = `http://localhost:${(server.http.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.rooms.stop();
  server.io.close();
});

const client = () => {
  const s: C = connect(url, { transports: ['websocket'], forceNew: true });
  const states: ClientView[] = [];
  const fx: GameFx[] = [];
  const toasts: string[] = [];
  s.on('state', (v) => states.push(v));
  s.on('fx', (f) => fx.push(f));
  s.on('toast', (t) => toasts.push(t.text));
  return { s, states, fx, toasts, last: () => states.at(-1)! };
};
const until = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
};
type R = ({ ok: true } & SessionInfo) | { ok: false; error: string };

describe('serveur Socket.IO (de bout en bout)', () => {
  it('créer, rejoindre, se reconnecter par jeton, lancer, jouer hors tour', async () => {
    const host = client();
    const created = (await host.s.emitWithAck('room:create', { name: 'Sami' })) as R;
    if (!created.ok) throw new Error(created.error);
    expect(created.roomCode).toMatch(/^[A-Z]{4}$/);

    const bad = (await client().s.emitWithAck('room:join', { code: 'ZZZZ', name: 'X' })) as R;
    expect(bad.ok).toBe(false);

    const guest = client();
    const joined = (await guest.s.emitWithAck('room:join', { code: created.roomCode.toLowerCase(), name: 'Lina' })) as R;
    if (!joined.ok) throw new Error(joined.error);
    await until(() => host.last()?.players.length === 2);

    // Veille du téléphone : nouvelle connexion avec le jeton.
    guest.s.disconnect();
    await until(() => host.last().players.find((p) => p.id === joined.playerId)?.connected === false);
    const again = client();
    const resumed = (await again.s.emitWithAck('room:resume', { code: created.roomCode, token: joined.token })) as R;
    expect(resumed.ok && resumed.playerId).toBe(joined.playerId);
    await until(() => host.last().players.every((p) => p.connected));
    const forged = (await client().s.emitWithAck('room:resume', { code: created.roomCode, token: 'nope' })) as R;
    expect(forged.ok).toBe(false);

    expect(((await again.s.emitWithAck('lobby:start')) as R).ok).toBe(false); // pas l'hôte
    expect(((await host.s.emitWithAck('lobby:start')) as R).ok).toBe(true);
    await until(() => again.last()?.phase === 'initialPeek');

    // Pendant la vue initiale : refus avec un toast, sans pénalité.
    await again.s.emitWithAck('game:action', { type: 'drawFromDeck' });
    await until(() => again.toasts.length > 0);

    // Action mal formée : refusée.
    const junk = (await host.s.emitWithAck('game:action', { type: 'hack', slot: -1 } as never)) as R;
    expect(junk.ok).toBe(false);

    // Après 5 s, la partie commence : celui dont ce n'est pas le tour est pénalisé.
    await until(() => host.last().phase === 'playing', 7000);
    const room = server.rooms.get(created.roomCode)!;
    const turn = room.engine!.state.round!.turnPlayerId;
    const wrong = turn === created.playerId ? again : host;
    const wrongId = turn === created.playerId ? joined.playerId : created.playerId;
    await wrong.s.emitWithAck('game:action', { type: 'drawFromDeck' });
    await until(() => host.fx.some((f) => f.type === 'penalty'));
    expect(host.fx).toContainEqual({ type: 'penalty', kind: 'wrongTurn', playerId: wrongId });
    await until(() => wrong.last().players.find((p) => p.id === wrongId)!.cardCount === 5);

    for (const c of [host, again, wrong]) c.s.disconnect();
  }, 15_000);
});
