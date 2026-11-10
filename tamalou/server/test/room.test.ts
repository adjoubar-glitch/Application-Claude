import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientView, GameFx } from '@tamalou/shared';
import { Room, type RoomTransport } from '../src/rooms/room.js';
import { RoomManager } from '../src/rooms/manager.js';
import { seededRandom } from '../src/engine/deck.js';

function fakeTransport() {
  const sent: { to: string; event: string; payload: unknown }[] = [];
  const transport: RoomTransport = {
    deliver(_code, to, event, ...args) {
      sent.push({ to, event, payload: args[0] });
    },
  };
  const lastState = (to: string) =>
    sent.filter((s) => s.to === to && s.event === 'state').at(-1)?.payload as ClientView;
  const fx = (to: string) => sent.filter((s) => s.to === to && s.event === 'fx').map((s) => s.payload as GameFx);
  const toasts = (to: string) => sent.filter((s) => s.to === to && s.event === 'toast');
  return { transport, sent, lastState, fx, toasts };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

const twoPlayers = () => {
  const t = fakeTransport();
  const room = new Room('ABCD', t.transport, seededRandom(7));
  const a = (room.addHuman('Sami') as { member: { id: string } }).member;
  const b = (room.addHuman('Lina') as { member: { id: string } }).member;
  room.attach(a.id);
  room.attach(b.id);
  return { t, room, a: a.id, b: b.id };
};

describe('lobby', () => {
  it("le premier arrivé est l'hôte ; pseudos dédoublonnés ; 6 joueurs maximum", () => {
    const t = fakeTransport();
    const room = new Room('ABCD', t.transport);
    const first = room.addHuman('Sami');
    expect(first.ok && room.hostId === first.member.id).toBe(true);
    const dup = room.addHuman('sami');
    expect(dup.ok && dup.member.name).toBe('sami 2');
    for (let i = 0; i < 4; i++) room.addHuman(`J${i}`);
    expect(room.addHuman('Septième').ok).toBe(false);
  });

  it("seul l'hôte lance, il faut 2 joueurs, et on ne rejoint plus une partie lancée", () => {
    const t = fakeTransport();
    const room = new Room('ABCD', t.transport);
    const a = room.addHuman('Sami');
    if (!a.ok) throw new Error();
    expect(room.start(a.member.id).ok).toBe(false);
    const b = room.addHuman('Lina');
    if (!b.ok) throw new Error();
    expect(room.start(b.member.id).ok).toBe(false);
    expect(room.start(a.member.id).ok).toBe(true);
    expect(room.addHuman('Tard').ok).toBe(false);
  });

  it("si l'hôte quitte le lobby, l'hôte passe au joueur suivant", () => {
    const { room, a, b } = twoPlayers();
    room.leave(a);
    expect(room.hostId).toBe(b);
    expect(room.members).toHaveLength(1);
  });

  it("seul l'hôte change les options", () => {
    const { room, a, b } = twoPlayers();
    const opts = { tamalouThreshold: 7, showActivePlayer: true, endCondition: { kind: 'points' as const, limit: 100 } };
    expect(room.setOptions(b, opts).ok).toBe(false);
    expect(room.setOptions(a, opts).ok).toBe(true);
    expect(room.viewFor(b).options.tamalouThreshold).toBe(7);
  });
});

describe('partie', () => {
  it('chaque joueur reçoit sa propre vue ; la vue initiale se retourne après 5 s grâce au timer', () => {
    const { t, room, a, b } = twoPlayers();
    room.start(a);
    const va = t.lastState(a);
    expect(va.phase).toBe('initialPeek');
    expect(va.players.find((p) => p.id === a)!.slots.filter((s) => s.card)).toHaveLength(2);
    expect(va.players.find((p) => p.id === b)!.slots.some((s) => s.card)).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(t.lastState(b).phase).toBe('playing');
    expect(t.lastState(a).players.flatMap((p) => p.slots).some((s) => s.card)).toBe(false);
  });

  it('jeu hors tour : pénalité diffusée à tous, journal personnalisé', () => {
    const { t, room, a, b } = twoPlayers();
    room.start(a);
    vi.advanceTimersByTime(5000);
    const turn = room.engine!.state.round!.turnPlayerId;
    const other = turn === a ? b : a;
    const res = room.act(other, { type: 'drawFromDeck' });
    expect(res.ok).toBe(false);
    for (const id of [a, b]) expect(t.fx(id)).toContainEqual({ type: 'penalty', kind: 'wrongTurn', playerId: other });
    expect(t.lastState(other).players.find((p) => p.id === other)!.cardCount).toBe(5);
    expect(room.chat.some((m) => m.kind === 'system' && m.text.includes('hors de son tour'))).toBe(true);
  });

  it('la fenêtre de doublon se résout toute seule au bout de 1,5 s', () => {
    const { t, room, a, b } = twoPlayers();
    room.start(a);
    vi.advanceTimersByTime(5000);
    room.act(b, { type: 'duplicate', slot: 0 });
    expect(t.lastState(a).duplicatePending).not.toBeNull();
    vi.advanceTimersByTime(1500);
    expect(t.lastState(a).duplicatePending).toBeNull();
    const got = t.fx(a).some((f) => f.type === 'duplicateSuccess' || (f.type === 'penalty' && f.kind === 'wrongDuplicate'));
    expect(got).toBe(true);
  });

  it('déconnexion de plus de 60 s en partie : remplaçant ; retour : il reprend la main', () => {
    const { t, room, a, b } = twoPlayers();
    const due = vi.fn();
    const back = vi.fn();
    room.hooks = { onStandInDue: due, onReturn: back };
    room.start(a);
    room.detach(b);
    vi.advanceTimersByTime(59_000);
    expect(due).not.toHaveBeenCalled();
    room.attach(b);
    room.detach(b);
    vi.advanceTimersByTime(60_000);
    expect(due).toHaveBeenCalledTimes(1);
    expect(t.lastState(a).players.find((p) => p.id === b)!.controller).toBe('standIn');
    room.attach(b);
    expect(back).toHaveBeenCalledTimes(1);
    expect(t.lastState(a).players.find((p) => p.id === b)!.controller).toBe('human');
  });

  it("la reconnexion se fait par jeton secret, qui n'apparaît dans aucune vue", () => {
    const { t, room, a } = twoPlayers();
    const token = room.member(a)!.token;
    expect(room.byToken(token)?.id).toBe(a);
    expect(room.byToken('faux')).toBeUndefined();
    expect(JSON.stringify(t.sent)).not.toContain(token);
  });
});

describe('gestionnaire de salons', () => {
  it('codes de 4 lettres uniques, sans I ni O, insensibles à la casse', () => {
    const m = new RoomManager(fakeTransport().transport, seededRandom(3));
    const codes = new Set<string>();
    for (let i = 0; i < 300; i++) codes.add(m.create().code);
    expect(codes.size).toBe(300);
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z]{4}$/);
    const one = [...codes][0]!;
    expect(m.get(one.toLowerCase())?.code).toBe(one);
  });

  it('fait le ménage des salons vides depuis 30 min', () => {
    const m = new RoomManager(fakeTransport().transport);
    const r = m.create();
    m.sweep(Date.now() + 29 * 60_000);
    expect(m.rooms.size).toBe(1);
    m.sweep(Date.now() + 31 * 60_000);
    expect(m.rooms.size).toBe(0);
    expect(r.code).toHaveLength(4);
  });
});

describe('tchat', () => {
  it('200 caractères maximum, 1 message par seconde, réactions rapides uniquement', () => {
    const { room, a } = twoPlayers();
    expect(room.sendChat(a, 'x'.repeat(201)).ok).toBe(false);
    expect(room.sendChat(a, '   ').ok).toBe(false);
    expect(room.sendChat(a, 'Salut la jungle').ok).toBe(true);
    expect(room.sendChat(a, 'Encore').ok).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(room.react(a, '🐒').ok).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(room.react(a, '💩').ok).toBe(false);
    expect(room.chat.filter((m) => m.kind !== 'system')).toHaveLength(2);
  });

  it('les messages arrivent chez tout le monde, les messages système aussi', () => {
    const { t, room, a, b } = twoPlayers();
    room.sendChat(a, 'Coucou');
    expect(t.sent.some((s) => s.to === b && s.event === 'chat')).toBe(true);
    room.start(a);
    vi.advanceTimersByTime(5000);
    const turn = room.engine!.state.round!.turnPlayerId;
    room.act(turn === a ? b : a, { type: 'drawFromDeck' });
    expect(room.chat.at(-1)).toMatchObject({ kind: 'system' });
  });
});
