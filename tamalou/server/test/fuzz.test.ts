import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, type GameAction } from '@tamalou/shared';
import { TamalouEngine } from '../src/engine/engine.js';
import { seededRandom } from '../src/engine/deck.js';
import { buildView } from '../src/engine/view.js';

const totalCards = (e: TamalouEngine) => {
  const r = e.state.round!;
  const held = r.step.kind === 'holding' ? 1 : 0;
  return r.deck.length + r.discard.length + held + e.state.players.reduce((n, p) => n + p.slots.filter(Boolean).length, 0);
};

describe('robustesse : 300 parties au hasard (y compris hors tour et faux doublons)', () => {
  it('ne plante jamais, ne crée ni ne perd aucune carte, et chaque partie se termine', () => {
    for (let game = 0; game < 300; game++) {
      const rnd = seededRandom(1000 + game);
      const n = 2 + (game % 5);
      const seats = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `J${i}`, avatar: i, isBot: true }));
      const e = new TamalouEngine(seats, { ...DEFAULT_OPTIONS, endCondition: { kind: 'rounds', count: 2 } }, { random: rnd });
      let now = 0;
      e.startRound(now);
      let steps = 0;
      while (!e.state.gameOver) {
        expect(steps++).toBeLessThan(5000);
        now += 50 + Math.floor(rnd() * 400);
        e.tick(now);
        const r = e.state.round!;
        if (r.phase === 'over') {
          e.startRound(now);
          continue;
        }
        if (r.phase !== 'playing') continue;
        expect(totalCards(e)).toBe(52);

        const turn = r.turnPlayerId;
        const roll = rnd();
        const actor = roll < 0.08 ? `p${Math.floor(rnd() * n)}` : turn; // parfois hors tour
        const me = e.player(actor);
        const slots = me.slots.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
        const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
        const opp = e.state.players.filter((p) => p.id !== actor && p.slots.some(Boolean) && p.id !== r.tamalou?.callerId);
        let action: GameAction;
        if (roll > 0.9 && slots.length) action = { type: 'duplicate', slot: pick(slots) };
        else if (r.step.kind === 'start')
          action = steps > 60 && rnd() < 0.3 ? { type: 'callTamalou' } : rnd() < 0.3 ? { type: 'takeDiscard' } : { type: 'drawFromDeck' };
        else if (r.step.kind === 'holding')
          action = r.step.source === 'discard' || (rnd() < 0.5 && slots.length) ? { type: 'swapHeld', slot: pick(slots.length ? slots : [0]) } : { type: 'discardHeld' };
        else if (r.step.kind === 'kingDecide')
          action = rnd() < 0.5 && slots.length ? { type: 'kingSwap', ownSlot: pick(slots) } : { type: 'skipPower' };
        else {
          const o = opp.length ? pick(opp) : null;
          const os = o ? pick(o.slots.map((c, i) => (c ? i : -1)).filter((i) => i >= 0)) : 0;
          const p = r.step.power;
          action =
            rnd() < 0.2 || (!o && p !== 'peekOwn') || !slots.length
              ? { type: 'skipPower' }
              : p === 'peekOwn'
                ? { type: 'usePower', power: { kind: p, slot: pick(slots) } }
                : p === 'blindSwap'
                  ? { type: 'usePower', power: { kind: p, ownSlot: pick(slots), target: o!.id, slot: os } }
                  : { type: 'usePower', power: { kind: p, target: o!.id, slot: os } };
        }
        e.apply(actor, action, now);
        if (e.state.round!.phase === 'playing') expect(totalCards(e)).toBe(52);
        buildView(e, actor, now, { roomCode: 'X', hostId: 'p0', controllers: {}, connected: {}, log: [] });
      }
      expect(e.state.roundsPlayed).toBe(2);
    }
  });
});
