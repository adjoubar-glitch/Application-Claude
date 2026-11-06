import { describe, expect, it } from 'vitest';
import { DEFAULT_EFFECTS, EFFECT_EVENTS, effectFor, type EffectEvent, type GameFx } from '@tamalou/shared';

describe('effets par rôle (Admin)', () => {
  it('chaque événement a un effet par défaut pour chacun de ses rôles', () => {
    for (const [event, def] of Object.entries(EFFECT_EVENTS)) {
      for (const role of def.roles) expect(DEFAULT_EFFECTS[event as EffectEvent][role], `${event}/${role}`).toBeDefined();
    }
  });

  it("échange à l'aveugle : l'auteur trolle, la victime subit, les autres regardent", () => {
    const fx = { type: 'swap', power: 'blindSwap', a: { playerId: 'a', slot: 0 }, b: { playerId: 'v', slot: 1 }, blind: true } as const;
    expect(effectFor(fx, 'a')).toMatchObject({ event: 'blindSwap', role: 'actor', targetId: 'v' });
    expect(effectFor(fx, 'v')).toMatchObject({ event: 'blindSwap', role: 'victim', actorId: 'a' });
    expect(effectFor(fx, 'x')).toMatchObject({ role: 'others' });
  });

  it('Roi noir : regard puis échange sont deux événements distincts', () => {
    const peek = { type: 'peek', power: 'peekAndSwap', byPlayerId: 'a', target: { playerId: 'v', slot: 0 } } as const;
    expect(effectFor(peek, 'v')).toMatchObject({ event: 'kingPeek', role: 'victim' });
    const swap = { type: 'swap', power: 'peekAndSwap', a: { playerId: 'a', slot: 0 }, b: { playerId: 'v', slot: 0 }, blind: false } as const;
    expect(effectFor(swap, 'v')).toMatchObject({ event: 'kingSwap', role: 'victim' });
  });

  it('mauvais doublon : une seule pop-up qui liste tous les fautifs ; trop lent : seulement pour les lents', () => {
    const fx: GameFx = { type: 'penalty', kind: 'wrongDuplicate', playerIds: ['a', 'b'] };
    expect(effectFor(fx, 'b')).toMatchObject({ role: 'victim', actorIds: ['a', 'b'] });
    expect(effectFor(fx, 'c')).toMatchObject({ role: 'others', actorIds: ['a', 'b'] });
    const slow: GameFx = { type: 'duplicateTooSlow', playerIds: ['b'], winnerId: 'a' };
    expect(effectFor(slow, 'b')).toMatchObject({ event: 'duplicateTooSlow', actorId: 'a' });
    expect(effectFor(slow, 'a')).toBeNull();
  });
});
