import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotLevel, Card, GameFx, Rank, Suit } from '@tamalou/shared';
import { Room, type RoomTransport } from '../src/rooms/room.js';
import { BotHost } from '../src/bots/host.js';
import { BotBrain } from '../src/bots/brain.js';
import { pickBotName, BOT_NAMES } from '../src/bots/names.js';
import { seededRandom } from '../src/engine/deck.js';

const silent: RoomTransport = { deliver() {} };
let n = 0;
const c = (rank: Rank, suit: Suit = 'clubs'): Card => ({ id: `k${++n}`, rank, suit });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

/** Salon avec un humain (l'hôte) et des bots ; l'humain peut être remplacé par un bot. */
function table(levels: BotLevel[], seed = 1) {
  const random = seededRandom(seed);
  const room = new Room('TEST', silent, random);
  const host = new BotHost(room, random);
  const human = room.addHuman('Humain');
  if (!human.ok) throw new Error();
  levels.forEach((l, i) => room.addBot(`Bot${i}`, l));
  return { room, host, humanId: human.member.id, random };
}

describe('noms des bots', () => {
  it('Erika, Erdal et Pascal P. sont dans la liste, tirés sans doublon', () => {
    expect(BOT_NAMES.slice(0, 3)).toEqual(['Erika', 'Erdal', 'Pascal P.']);
    const taken: string[] = [];
    for (let i = 0; i < BOT_NAMES.length + 3; i++) taken.push(pickBotName(taken, Math.random));
    expect(new Set(taken.map((t) => t.toLowerCase())).size).toBe(taken.length);
  });
});

describe('décisions des bots (Expert, sans hasard parasite)', () => {
  const setup = () => {
    const t = table(['expert']);
    t.room.start(t.humanId);
    const bot = t.room.members.find((m) => m.isBot)!.id;
    const brain = t.host.brains.get(bot)!;
    return { ...t, bot, brain };
  };

  it('mémorise ses 2 cartes du bas pendant la vue initiale, et rien d’autre', async () => {
    const { brain, room, bot } = setup();
    await vi.advanceTimersByTimeAsync(10);
    const mem = brain.memory();
    expect([...mem.keys()].sort()).toEqual([`${bot}:2`, `${bot}:3`]);
    const real = room.engine!.player(bot).slots;
    expect(mem.get(`${bot}:2`)!.id).toBe(real[2]!.id);
  });

  it('respecte son tour : ne joue que quand c’est à lui, après 1,5 à 3 s de réflexion', async () => {
    const { room, bot, humanId } = setup();
    await vi.advanceTimersByTimeAsync(5000);
    const r = room.engine!.state.round!;
    r.turnPlayerId = humanId;
    room.broadcast();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(r.turnPlayerId).toBe(humanId);
    expect(room.engine!.player(bot).slots.filter(Boolean)).toHaveLength(4); // pas de pénalité
    r.turnPlayerId = bot;
    room.broadcast();
    await vi.advanceTimersByTimeAsync(1400);
    expect(r.step.kind).toBe('start');
    await vi.advanceTimersByTimeAsync(1700);
    expect(r.step.kind !== 'start' || r.turnPlayerId !== bot).toBe(true);
  });

  it('prend la défausse quand elle améliore son jeu (Roi rouge à 0)', async () => {
    const { room, bot } = setup();
    await vi.advanceTimersByTimeAsync(5000);
    const r = room.engine!.state.round!;
    r.discard.push(c(13, 'hearts'));
    r.turnPlayerId = bot;
    room.broadcast();
    await vi.advanceTimersByTimeAsync(3100);
    expect(r.step.kind === 'holding' && r.step.source).toBe('discard');
  });

  it('doublon Expert : réagit en 0,4 à 0,9 s sur une carte qu’il connaît', async () => {
    const { room, bot, humanId } = setup();
    await vi.advanceTimersByTimeAsync(5000);
    const r = room.engine!.state.round!;
    const p = room.engine!.player(bot);
    const known = p.slots[2]!;
    // L'humain défausse une carte de même valeur.
    r.turnPlayerId = humanId;
    r.step = { kind: 'holding', card: c(known.rank, known.suit === 'clubs' ? 'hearts' : 'clubs'), source: 'deck' };
    room.act(humanId, { type: 'discardHeld' });
    if ((r.step as { kind: string }).kind === 'power') room.act(humanId, { type: 'skipPower' });
    expect(r.duplicateWindow).toBeNull();
    await vi.advanceTimersByTimeAsync(950);
    expect(r.duplicateWindow?.attempts[0]).toMatchObject({ playerId: bot, slot: 2 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(p.slots[2]).toBeNull();
  });

  it('ne voit jamais les cartes adverses sans pouvoir : sa mémoire ne contient que ce qu’il a vu', async () => {
    const { brain, bot } = setup();
    await vi.advanceTimersByTimeAsync(5000);
    for (const k of brain.memory().keys()) expect(k.startsWith(bot)).toBe(true);
  });
});

describe('réactions dans le tchat', () => {
  it('😱 quand on lui prend une carte (de temps en temps)', async () => {
    const reacted: string[] = [];
    let i = 0;
    const brain = new BotBrain('b', 'medium', { act: () => ({ ok: true }), react: (e) => reacted.push(e), turnOf: () => null }, () => (i++ % 2 ? 0.1 : 0.9));
    const swap: GameFx = { type: 'swap', power: 'blindSwap', a: { playerId: 'x', slot: 0 }, b: { playerId: 'b', slot: 1 }, blind: true };
    for (let k = 0; k < 4; k++) brain.receive('fx', swap);
    await vi.advanceTimersByTimeAsync(3000);
    expect(reacted).toContain('😱');
  });
});

describe('remplaçant', () => {
  it('un humain absent 60 s est remplacé par un bot Moyen, qui rend la main à son retour', async () => {
    const t = table(['easy']);
    t.room.start(t.humanId);
    t.room.attach(t.humanId);
    t.room.detach(t.humanId);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.host.brains.get(t.humanId)?.level).toBe('medium');
    t.room.attach(t.humanId);
    expect(t.host.brains.has(t.humanId)).toBe(false);
  });
});

describe('simulation : 200 parties 100 % bots', () => {
  it('se terminent toutes sans erreur, tous niveaux mélangés', async () => {
    const levels: BotLevel[] = ['easy', 'medium', 'expert'];
    let penalties = 0;
    let duplicates = 0;
    let callerWins = 0;
    for (let g = 0; g < 200; g++) {
      vi.setSystemTime(0);
      const random = seededRandom(5000 + g);
      const count = 1 + (g % 5); // 2 à 6 joueurs au total
      const bots = Array.from({ length: count }, (_, i) => levels[(g + i) % 3]!);
      const t = table(bots, 5000 + g);
      expect(t.room.start(t.humanId).ok).toBe(true);
      // L'humain "part" : un bot Moyen joue pour lui, la table est 100 % bots.
      t.host.takeOver(t.room.member(t.humanId)!);
      t.room.taps.push((_id, event, payload) => {
        if (event !== 'fx' || _id !== t.humanId) return;
        const fx = payload as GameFx;
        if (fx.type === 'penalty') penalties++;
        if (fx.type === 'duplicateSuccess') duplicates++;
        if (fx.type === 'roundEnd' && fx.result.callerWon) callerWins++;
      });
      let elapsed = 0;
      while (!t.room.engine!.state.gameOver) {
        await vi.advanceTimersByTimeAsync(1000);
        elapsed += 1000;
        expect(elapsed, `partie ${g} bloquée`).toBeLessThan(60 * 60_000);
      }
      const e = t.room.engine!;
      const r = e.state.round!;
      const total = r.deck.length + r.discard.length + e.state.players.reduce((s, p) => s + p.slots.filter(Boolean).length, 0);
      expect(total).toBe(52);
      t.host.dispose();
      t.room.dispose();
      void random;
    }
    // Les bots jouent vraiment : doublons, pénalités et victoires d'annonceur arrivent.
    expect(duplicates).toBeGreaterThan(50);
    expect(penalties).toBeGreaterThan(0);
    expect(callerWins).toBeGreaterThan(0);
    console.log(`200 parties : ${duplicates} doublons réussis, ${penalties} pénalités, ${callerWins} Tamalou gagnés`);
  }, 300_000);
});
