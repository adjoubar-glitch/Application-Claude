import { describe, expect, it } from 'vitest';
import { TamalouEngine } from '../src/engine/engine.js';
import { seededRandom } from '../src/engine/deck.js';
import { DEFAULT_OPTIONS, cardPoints } from '@tamalou/shared';
import { c, hand, rig, setup, view } from './helpers.js';

const T = 5000;

describe('mise en place', () => {
  it('distribue 4 cartes, retourne une défausse, montre les 2 cartes du bas 5 s au seul propriétaire', () => {
    const e = new TamalouEngine(
      [0, 1, 2].map((i) => ({ id: `p${i}`, name: `J${i}`, avatar: i, isBot: false })),
      DEFAULT_OPTIONS,
      { random: seededRandom(1) },
    );
    e.startRound(0);
    const r = e.state.round!;
    expect(e.state.players.every((p) => p.slots.length === 4)).toBe(true);
    expect(r.discard).toHaveLength(1);
    expect(r.deck).toHaveLength(52 - 12 - 1);

    const v0 = view(e, 'p0', 1000);
    expect(v0.phase).toBe('initialPeek');
    const mine = v0.players.find((p) => p.id === 'p0')!;
    expect(mine.slots.map((s) => !!s.card)).toEqual([false, false, true, true]);
    for (const other of v0.players.filter((p) => p.id !== 'p0')) {
      expect(other.slots.every((s) => !s.card)).toBe(true);
    }

    // Pendant la vue initiale, on ne joue pas.
    expect(e.apply(e.state.round!.turnPlayerId, { type: 'drawFromDeck' }, 1000).ok).toBe(false);

    e.tick(5000);
    const after = view(e, 'p0', 5000);
    expect(after.phase).toBe('playing');
    expect(after.players.flatMap((p) => p.slots).every((s) => !s.card)).toBe(true);
  });

  it('le Dealer commence, et le jeton passe au suivant à chaque manche', () => {
    const e = setup(3, { endCondition: { kind: 'rounds', count: 5 } });
    expect(e.state.round!.turnPlayerId).toBe('p0');
    e.state.round!.phase = 'over';
    e.startRound(10_000);
    expect(e.state.dealerIndex).toBe(1);
    expect(e.state.round!.turnPlayerId).toBe('p1');
  });
});

describe('vue filtrée (anti-triche)', () => {
  it("ne contient jamais la valeur d'une carte cachée ni un identifiant de carte en grille", () => {
    const e = setup(4);
    const json = JSON.stringify(view(e, 'p1'));
    for (const p of e.state.players) for (const card of p.slots) expect(json).not.toContain(card!.id);
  });

  it('la carte piochée est visible par le seul détenteur ; la carte prise à la défausse par tous', () => {
    const e = setup(3);
    rig(e, [hand(1, 2, 3, 4), hand(1, 2, 3, 4), hand(1, 2, 3, 4)], [c(9, 'spades')], [c(6, 'clubs')]);
    e.apply('p0', { type: 'drawFromDeck' }, T);
    expect(view(e, 'p0').held?.card?.rank).toBe(6);
    expect(view(e, 'p1').held?.card).toBeUndefined();
    expect(view(e, 'p1').held?.playerId).toBe('p0');

    const e2 = setup(3);
    rig(e2, [hand(1, 2, 3, 4), hand(1, 2, 3, 4), hand(1, 2, 3, 4)], [c(9, 'spades')]);
    e2.apply('p0', { type: 'takeDiscard' }, T);
    expect(view(e2, 'p2').held?.card?.rank).toBe(9);
  });
});

describe('tour de jeu', () => {
  it('option 1 : prendre la défausse et échanger', () => {
    const e = setup(3);
    rig(e, [hand(10, 2, 3, 4), hand(1, 1, 1, 1), hand(1, 1, 1, 1)], [c(1, 'spades')]);
    e.apply('p0', { type: 'takeDiscard' }, T);
    expect(e.apply('p0', { type: 'discardHeld' }, T).ok).toBe(false); // doit échanger
    expect(e.apply('p0', { type: 'swapHeld', slot: 0 }, T).ok).toBe(true);
    expect(e.state.players[0]!.slots[0]!.rank).toBe(1);
    expect(e.state.round!.discard.at(-1)!.rank).toBe(10);
    expect(e.state.round!.turnPlayerId).toBe('p1');
  });

  it("option 2 : piocher et échanger (pas de pouvoir sur la carte défaussée par l'échange)", () => {
    const e = setup(3);
    rig(e, [hand(7, 2, 3, 4), hand(1, 1, 1, 1), hand(1, 1, 1, 1)], [c(1, 'spades')], [c(2, 'clubs')]);
    e.apply('p0', { type: 'drawFromDeck' }, T);
    e.apply('p0', { type: 'swapHeld', slot: 0 }, T);
    expect(e.state.round!.discard.at(-1)!.rank).toBe(7);
    expect(e.state.round!.step.kind).toBe('start');
    expect(e.state.round!.turnPlayerId).toBe('p1');
  });

  it('option 3 : piocher et défausser une carte sans pouvoir termine le tour', () => {
    const e = setup(3);
    rig(e, [hand(1, 2, 3, 4), hand(1, 1, 1, 1), hand(1, 1, 1, 1)], [c(1, 'spades')], [c(5, 'clubs')]);
    e.apply('p0', { type: 'drawFromDeck' }, T);
    e.apply('p0', { type: 'discardHeld' }, T);
    expect(e.state.round!.turnPlayerId).toBe('p1');
  });

  it("piocher deux fois pendant son propre tour : refus simple, sans pénalité", () => {
    const e = setup(3);
    rig(e, [hand(1, 2, 3, 4), hand(1, 1, 1, 1), hand(1, 1, 1, 1)]);
    e.apply('p0', { type: 'drawFromDeck' }, T);
    const res = e.apply('p0', { type: 'drawFromDeck' }, T);
    expect(res.ok === false && res.code).toBe('invalid');
    expect(e.state.players[0]!.slots).toHaveLength(4);
  });
});

describe('pouvoirs', () => {
  const drawAndDiscard = (e: TamalouEngine, power: Parameters<typeof c>) => {
    rig(
      e,
      [hand(1, 2, 3, 4), [c(9), c(10), c(11), c(12)], hand(5, 6, 7, 8)],
      [c(1, 'spades')],
      [c(...power)],
    );
    e.apply('p0', { type: 'drawFromDeck' }, T);
    e.apply('p0', { type: 'discardHeld' }, T);
  };

  it('7 / 8 : regarder une de ses cartes 3 s, visible par lui seul', () => {
    for (const rank of [7, 8] as const) {
      const e = setup(3);
      drawAndDiscard(e, [rank, 'clubs']);
      expect(view(e, 'p0').pendingPower?.power).toBe('peekOwn');
      expect(e.apply('p0', { type: 'usePower', power: { kind: 'peekOwn', slot: 1 } }, T).ok).toBe(true);
      expect(view(e, 'p0', T + 100).players[0]!.slots[1]!.card?.rank).toBe(2);
      expect(view(e, 'p1', T + 100).players[0]!.slots[1]!.card).toBeUndefined();
      e.tick(T + 3000);
      expect(view(e, 'p0', T + 3000).players[0]!.slots[1]!.card).toBeUndefined();
      expect(e.state.round!.turnPlayerId).toBe('p1');
    }
  });

  it("9 / 10 : regarder une carte d'un adversaire (et pas la sienne)", () => {
    for (const rank of [9, 10] as const) {
      const e = setup(3);
      drawAndDiscard(e, [rank, 'clubs']);
      expect(e.apply('p0', { type: 'usePower', power: { kind: 'peekOther', target: 'p0', slot: 0 } }, T).ok).toBe(false);
      const res = e.apply('p0', { type: 'usePower', power: { kind: 'peekOther', target: 'p2', slot: 3 } }, T);
      expect(res.ok).toBe(true);
      expect(view(e, 'p0').players[2]!.slots[3]!.card?.rank).toBe(8);
      expect(view(e, 'p2').players[2]!.slots[3]!.card).toBeUndefined();
      expect(res.out.logs.find((l) => l.to !== 'all' && l.to.includes('p2'))?.text).toContain('a regardé une de tes cartes');
    }
  });

  it("Valet / Dame : échange à l'aveugle, rien n'est révélé", () => {
    for (const rank of [11, 12] as const) {
      const e = setup(3);
      drawAndDiscard(e, [rank, 'clubs']);
      const res = e.apply('p0', { type: 'usePower', power: { kind: 'blindSwap', ownSlot: 0, target: 'p2', slot: 1 } }, T);
      expect(res.ok).toBe(true);
      expect(e.state.players[0]!.slots[0]!.rank).toBe(6);
      expect(e.state.players[2]!.slots[1]!.rank).toBe(1);
      expect(e.state.round!.reveals).toHaveLength(0);
    }
  });

  it('Roi noir : regarder une carte adverse puis échanger', () => {
    const e = setup(3);
    drawAndDiscard(e, [13, 'spades']);
    e.apply('p0', { type: 'usePower', power: { kind: 'peekAndSwap', target: 'p1', slot: 0 } }, T);
    const v = view(e, 'p0');
    expect(v.pendingPower?.stage).toBe('decide');
    expect(v.pendingPower?.peeked?.card?.rank).toBe(9);
    expect(view(e, 'p1').pendingPower?.peeked).toBeUndefined();
    e.apply('p0', { type: 'kingSwap', ownSlot: 3 }, T);
    expect(e.state.players[0]!.slots[3]!.rank).toBe(9);
    expect(e.state.players[1]!.slots[0]!.rank).toBe(4);
    expect(e.state.round!.reveals).toHaveLength(0);
    expect(e.state.round!.turnPlayerId).toBe('p1');
  });

  it("Roi noir : regarder puis décider de ne pas échanger", () => {
    const e = setup(3);
    drawAndDiscard(e, [13, 'clubs']);
    e.apply('p0', { type: 'usePower', power: { kind: 'peekAndSwap', target: 'p1', slot: 0 } }, T);
    e.apply('p0', { type: 'skipPower' }, T);
    expect(e.state.players[1]!.slots[0]!.rank).toBe(9);
    expect(e.state.round!.reveals).toHaveLength(0);
    expect(e.state.round!.turnPlayerId).toBe('p1');
  });

  it("Roi rouge : aucun pouvoir ; on peut toujours passer un pouvoir", () => {
    const e = setup(3);
    drawAndDiscard(e, [13, 'hearts']);
    expect(e.state.round!.turnPlayerId).toBe('p1');

    const e2 = setup(3);
    drawAndDiscard(e2, [9, 'clubs']);
    e2.apply('p0', { type: 'skipPower' }, T);
    expect(e2.state.round!.turnPlayerId).toBe('p1');
  });

  it("le mauvais pouvoir pour la carte est refusé", () => {
    const e = setup(3);
    drawAndDiscard(e, [7, 'clubs']);
    const res = e.apply('p0', { type: 'usePower', power: { kind: 'peekOther', target: 'p1', slot: 0 } }, T);
    expect(res.ok).toBe(false);
  });
});

describe('jeu hors tour (MAUVAIS TOUR)', () => {
  it("annule l'action, pénalise d'une carte au-dessus de la grille, le tour reste au bon joueur", () => {
    const e = setup(3);
    rig(e, [hand(1, 2, 3, 4), hand(1, 2, 3, 4), hand(1, 2, 3, 4)], [c(9, 'spades')], [c(6, 'clubs'), c(8, 'clubs')]);
    const res = e.apply('p1', { type: 'takeDiscard' }, T);
    expect(res.ok === false && res.code).toBe('wrongTurn');
    expect(res.out.fx).toContainEqual({ type: 'penalty', kind: 'wrongTurn', playerId: 'p1' });
    expect(e.state.round!.discard.at(-1)!.rank).toBe(9); // action annulée
    const p1 = e.state.players[1]!;
    expect(p1.slots).toHaveLength(6);
    expect(p1.slots[4]!.rank).toBe(8);
    expect(p1.slots[5]).toBeNull();
    expect(e.state.round!.turnPlayerId).toBe('p0');
    expect(e.state.round!.step.kind).toBe('start');
    // La carte de pénalité n'est pas montrée au pénalisé.
    expect(view(e, 'p1').players[1]!.slots[4]!.card).toBeUndefined();
  });

  it('pendant un pouvoir en cours, un autre joueur qui agit est aussi pénalisé', () => {
    const e = setup(3);
    rig(e, [hand(1, 2, 3, 4), hand(1, 2, 3, 4), hand(1, 2, 3, 4)], [c(1, 'spades')], [c(5), c(5), c(7, 'clubs')]);
    e.apply('p0', { type: 'drawFromDeck' }, T);
    e.apply('p0', { type: 'discardHeld' }, T);
    const res = e.apply('p2', { type: 'drawFromDeck' }, T);
    expect(res.ok === false && res.code).toBe('wrongTurn');
    expect(e.state.round!.step.kind).toBe('power');
  });
});

describe('placement des cartes de pénalité', () => {
  it('remplit la rangée au-dessus, puis ouvre une nouvelle rangée', () => {
    const e = setup(2);
    rig(e, [hand(1, 2, 3, 4), hand(1, 2, 3, 4)], [c(9)], Array.from({ length: 10 }, (_, i) => c(((i % 9) + 1) as 1)));
    for (let i = 0; i < 3; i++) e.apply('p1', { type: 'drawFromDeck' }, T);
    const slots = e.state.players[1]!.slots;
    expect(slots).toHaveLength(8);
    expect(slots.slice(4).map((s) => s !== null)).toEqual([true, true, true, false]);
  });

  it("une place vide au-dessus (doublon réussi) est réutilisée ; une place vide du bas jamais", () => {
    const e = setup(2);
    const p = e.state.players[0]!;
    p.slots = [null, c(2), c(3), c(4), c(5), null];
    e.placePenaltyCard(p, c(9));
    expect(p.slots[0]).toBeNull();
    expect(p.slots[5]!.rank).toBe(9);
  });
});

describe('doublons : fenêtre de 1,5 s', () => {
  const base = () => {
    const e = setup(4);
    rig(
      e,
      [hand(6, 2, 3, 4), hand(6, 9, 9, 9), hand(6, 9, 9, 9), hand(2, 3, 9, 9)],
      [c(6, 'spades')],
      Array.from({ length: 10 }, () => c(10, 'clubs')),
    );
    return e;
  };

  it("aucune résolution ni révélation avant la fin de la fenêtre", () => {
    const e = base();
    e.apply('p3', { type: 'duplicate', slot: 0 }, T); // faux
    expect(view(e, 'p1', T + 100).duplicatePending).not.toBeNull();
    expect(view(e, 'p1', T + 100).players[3]!.slots[0]!.card).toBeUndefined();
    expect(view(e, 'p3', T + 100).players[3]!.slots[0]!.pendingDuplicate).toBe(true);
    expect(view(e, 'p1', T + 100).players[3]!.slots[0]!.pendingDuplicate).toBeUndefined();
    expect(e.tick(T + 1499).fx).toHaveLength(0);
    expect(e.state.players[3]!.slots).toHaveLength(4);
  });

  it('plusieurs vrais doublons : seul le plus rapide se débarrasse, les autres voient le Gorille, sans pénalité', () => {
    const e = base();
    e.apply('p2', { type: 'duplicate', slot: 0 }, T + 10);
    e.apply('p1', { type: 'duplicate', slot: 0 }, T + 300);
    e.apply('p0', { type: 'duplicate', slot: 0 }, T + 1200);
    const out = e.tick(T + 10 + 1500);
    expect(out.fx).toContainEqual(expect.objectContaining({ type: 'duplicateSuccess', playerId: 'p2' }));
    expect(out.fx).toContainEqual({ type: 'duplicateTooSlow', playerIds: ['p1', 'p0'], winnerId: 'p2' });
    expect(out.fx.some((f) => f.type === 'penalty')).toBe(false);
    expect(e.state.players[2]!.slots[0]).toBeNull();
    expect(e.state.players[1]!.slots[0]!.rank).toBe(6);
    expect(e.state.players[0]!.slots[0]!.rank).toBe(6);
    expect(e.state.players.every((p) => p.slots.length === 4)).toBe(true);
    expect(e.state.round!.discard.at(-1)!.rank).toBe(6);
  });

  it("à la même milliseconde, l'ordre d'arrivée au serveur départage", () => {
    const e = base();
    e.apply('p1', { type: 'duplicate', slot: 0 }, T);
    e.apply('p2', { type: 'duplicate', slot: 0 }, T);
    const out = e.tick(T + 1500);
    expect(out.fx).toContainEqual(expect.objectContaining({ type: 'duplicateSuccess', playerId: 'p1' }));
  });

  it("une tentative après la fermeture de la fenêtre ouvre une nouvelle fenêtre", () => {
    const e = base();
    e.apply('p1', { type: 'duplicate', slot: 0 }, T);
    e.tick(T + 1500);
    e.apply('p2', { type: 'duplicate', slot: 0 }, T + 1600); // 6 sur un 6 : nouvelle fenêtre, réussit
    const out = e.tick(T + 3100);
    expect(out.fx).toContainEqual(expect.objectContaining({ type: 'duplicateSuccess', playerId: 'p2' }));
  });

  it('plusieurs faux doublons : une pénalité chacun, une seule pop-up qui les liste, cartes montrées à tous 2 s', () => {
    const e = base();
    e.apply('p1', { type: 'duplicate', slot: 1 }, T);
    e.apply('p3', { type: 'duplicate', slot: 0 }, T + 50);
    const out = e.tick(T + 1500);
    const penalties = out.fx.filter((f) => f.type === 'penalty');
    expect(penalties).toEqual([{ type: 'penalty', kind: 'wrongDuplicate', playerIds: ['p1', 'p3'] }]);
    expect(e.state.players[1]!.slots).toHaveLength(6);
    expect(e.state.players[3]!.slots).toHaveLength(6);
    expect(view(e, 'p0', T + 1600).players[1]!.slots[1]!.card?.rank).toBe(9);
    expect(view(e, 'p2', T + 1600).players[3]!.slots[0]!.card?.rank).toBe(2);
    e.tick(T + 3500);
    expect(view(e, 'p0', T + 3500).players[1]!.slots[1]!.card).toBeUndefined();
    expect(e.state.players[1]!.slots[1]!.rank).toBe(9); // remise en place
  });

  it('mélange de vrais et faux : le plus rapide des vrais gagne, les faux sont pénalisés, les vrais lents voient le Gorille', () => {
    const e = base();
    e.apply('p3', { type: 'duplicate', slot: 0 }, T); // faux, le plus rapide de tous
    e.apply('p1', { type: 'duplicate', slot: 0 }, T + 100); // vrai, gagnant
    e.apply('p0', { type: 'duplicate', slot: 1 }, T + 200); // faux
    e.apply('p2', { type: 'duplicate', slot: 0 }, T + 300); // vrai, trop lent
    const out = e.tick(T + 1500);
    expect(out.fx).toContainEqual(expect.objectContaining({ type: 'duplicateSuccess', playerId: 'p1' }));
    expect(out.fx).toContainEqual({ type: 'duplicateTooSlow', playerIds: ['p2'], winnerId: 'p1' });
    expect(out.fx).toContainEqual({ type: 'penalty', kind: 'wrongDuplicate', playerIds: ['p3', 'p0'] });
    expect(e.state.players[1]!.slots[0]).toBeNull();
    expect(e.state.players[2]!.slots).toHaveLength(4);
    expect(e.state.players[3]!.slots).toHaveLength(6);
    expect(e.state.players[0]!.slots).toHaveLength(6);
  });

  it("le doublon se joue à tout moment, même hors de son tour, sans pénalité MAUVAIS TOUR", () => {
    const e = base();
    expect(e.state.round!.turnPlayerId).toBe('p0');
    expect(e.apply('p3', { type: 'duplicate', slot: 2 }, T).ok).toBe(true);
  });

  it("une seule tentative par joueur et par fenêtre ; uniquement ses propres cartes", () => {
    const e = base();
    e.apply('p1', { type: 'duplicate', slot: 0 }, T);
    expect(e.apply('p1', { type: 'duplicate', slot: 1 }, T + 10).ok).toBe(false);
    expect(e.apply('p0', { type: 'duplicate', slot: 9 }, T + 10).ok).toBe(false);
  });

  it("pendant la fenêtre, défausser est mis en attente (sans pénalité), piocher reste possible", () => {
    const e = base();
    e.apply('p1', { type: 'duplicate', slot: 0 }, T);
    expect(e.apply('p0', { type: 'drawFromDeck' }, T + 100).ok).toBe(true);
    const res = e.apply('p0', { type: 'discardHeld' }, T + 200);
    expect(res.ok === false && res.code).toBe('locked');
    e.tick(T + 1500);
    expect(e.apply('p0', { type: 'discardHeld' }, T + 1600).ok).toBe(true);
  });

  it('doublon réussi : la place reste vide, la carte devient le dessus de défausse et peut être enchaînée', () => {
    const e = base();
    e.apply('p1', { type: 'duplicate', slot: 0 }, T);
    e.tick(T + 1500);
    e.apply('p2', { type: 'duplicate', slot: 0 }, T + 1600);
    e.tick(T + 3100);
    expect(e.state.players[1]!.slots[0]).toBeNull();
    expect(e.state.players[2]!.slots[0]).toBeNull();
    expect(e.state.round!.discard.slice(-3).map((x) => x.rank)).toEqual([6, 6, 6]);
  });
});

describe('Tamalou et fin de manche', () => {
  const playTurn = (e: TamalouEngine, id: string, now = T) => {
    e.apply(id, { type: 'drawFromDeck' }, now);
    e.apply(id, { type: 'discardHeld' }, now);
    if (e.state.round!.step.kind === 'power') e.apply(id, { type: 'skipPower' }, now);
  };

  it("chaque autre joueur joue un dernier tour, l'annonceur ne joue plus, puis révélation et score", () => {
    const e = setup(3);
    rig(e, [hand(1, 1, 1, 1), hand(5, 5, 5, 5), hand(6, 6, 6, 6)]);
    expect(e.apply('p0', { type: 'callTamalou' }, T).ok).toBe(true);
    expect(e.state.round!.turnPlayerId).toBe('p1');
    playTurn(e, 'p1');
    expect(e.state.round!.turnPlayerId).toBe('p2');
    playTurn(e, 'p2');
    const v = view(e, 'p1');
    expect(v.phase).toBe('roundReveal');
    expect(v.players[2]!.slots.every((s) => s.card)).toBe(true);
    expect(v.lastRound).toMatchObject({ callerId: 'p0', callerWon: true, winnerIds: ['p0'] });
    expect(v.lastRound!.scores).toEqual({ p0: 4, p1: 20, p2: 24 });
    e.tick(T + 4000);
    expect(view(e, 'p0', T + 4000).phase).toBe('gameOver');
  });

  it("Tamalou seulement en début de tour, par le joueur dont c'est le tour (sinon MAUVAIS TOUR)", () => {
    const e = setup(3);
    rig(e, [hand(1, 1, 1, 1), hand(1, 1, 1, 1), hand(1, 1, 1, 1)]);
    const res = e.apply('p2', { type: 'callTamalou' }, T);
    expect(res.ok === false && res.code).toBe('wrongTurn');
    e.apply('p0', { type: 'drawFromDeck' }, T);
    expect(e.apply('p0', { type: 'callTamalou' }, T).ok).toBe(false);
  });

  it("l'annonceur qui rejoue est pénalisé MAUVAIS TOUR ; ses cartes ne peuvent plus être échangées", () => {
    const e = setup(3);
    rig(e, [hand(1, 1, 1, 1), hand(5, 5, 5, 5), hand(6, 6, 6, 6)], [c(1, 'spades')], [c(11, 'clubs'), c(5)]);
    e.apply('p0', { type: 'callTamalou' }, T);
    expect(e.apply('p0', { type: 'drawFromDeck' }, T).ok).toBe(false);
    expect(e.state.players[0]!.slots).toHaveLength(6);
    e.apply('p1', { type: 'drawFromDeck' }, T);
    e.apply('p1', { type: 'discardHeld' }, T);
    const res = e.apply('p1', { type: 'usePower', power: { kind: 'blindSwap', ownSlot: 0, target: 'p0', slot: 0 } }, T);
    expect(res.ok).toBe(false);
    expect(e.apply('p1', { type: 'usePower', power: { kind: 'blindSwap', ownSlot: 0, target: 'p2', slot: 0 } }, T).ok).toBe(true);
  });

  it("l'annonceur peut encore faire un doublon", () => {
    const e = setup(3);
    rig(e, [hand(4, 1, 1, 2), hand(5, 5, 5, 5), hand(6, 6, 6, 6)], [c(4, 'clubs')]);
    e.apply('p0', { type: 'callTamalou' }, T);
    expect(e.apply('p0', { type: 'duplicate', slot: 0 }, T + 10).ok).toBe(true);
    const out = e.tick(T + 1510);
    expect(out.fx).toContainEqual(expect.objectContaining({ type: 'duplicateSuccess', playerId: 'p0' }));
  });

  it("la fin de manche attend la résolution d'une fenêtre de doublon ouverte", () => {
    const e = setup(2);
    rig(e, [hand(1, 1, 1, 1), hand(9, 9, 9, 9)], [c(1, 'spades')], [c(9, 'clubs')]);
    e.apply('p0', { type: 'callTamalou' }, T);
    e.apply('p1', { type: 'drawFromDeck' }, T);
    e.apply('p0', { type: 'duplicate', slot: 0 }, T + 10); // As sur As : vrai doublon de l'annonceur
    expect(e.state.round!.duplicateWindow).not.toBeNull();
    e.tick(T + 1510);
    e.apply('p1', { type: 'discardHeld' }, T + 1600); // 9 : pouvoir en attente
    e.apply('p1', { type: 'duplicate', slot: 0 }, T + 1610); // 9 sur 9, fenêtre ouverte
    e.apply('p1', { type: 'skipPower' }, T + 1620); // dernier tour fini, mais la fenêtre est ouverte
    expect(e.state.round!.phase).toBe('playing');
    e.tick(T + 3110);
    expect(e.state.round!.phase).toBe('reveal');
    expect(e.state.round!.result!.scores.p1).toBe(27);
  });

  it("joueur sans carte : Tamalou annoncé automatiquement au début de son tour", () => {
    const e = setup(3);
    rig(e, [hand(1, 2, 3, 4), [null, null, null, null], hand(6, 6, 6, 6)], [c(9, 'spades')], [c(5, 'clubs')]);
    e.apply('p0', { type: 'drawFromDeck' }, T);
    const out = e.apply('p0', { type: 'discardHeld' }, T);
    expect(out.out.fx).toContainEqual({ type: 'tamalou', playerId: 'p1' });
    expect(e.state.round!.tamalou?.callerId).toBe('p1');
    expect(e.state.round!.turnPlayerId).toBe('p2');
  });

  describe('victoire et égalités', () => {
    const finish = (hands: number[][], threshold = 5, players = 3) => {
      const e = setup(players, { tamalouThreshold: threshold });
      rig(
        e,
        hands.map((h) => h.map((r) => (r === 0 ? c(13, 'hearts') : r === 15 ? c(13, 'spades') : c(r as 1, 'clubs')))),
      );
      e.apply('p0', { type: 'callTamalou' }, T);
      for (let i = 1; i < players; i++) playTurn(e, `p${i}`);
      return e.state.round!.result!;
    };

    it("l'annonceur gagne s'il est sous le seuil et strictement le plus bas", () => {
      const r = finish([[1, 1, 1, 2], [2, 2, 2, 2], [3, 3, 3, 3]]);
      expect(r.callerWon).toBe(true);
      expect(r.winnerIds).toEqual(['p0']);
    });

    it("égalité avec l'annonceur : l'annonceur perd", () => {
      const r = finish([[1, 1, 1, 1], [1, 1, 1, 1], [3, 3, 3, 3]]);
      expect(r.callerWon).toBe(false);
      expect(r.winnerIds).toEqual(['p1']);
    });

    it("au-dessus du seuil : l'annonceur perd même s'il est le plus bas", () => {
      const r = finish([[2, 2, 1, 1], [5, 5, 5, 5], [9, 9, 9, 9]]);
      expect(r.callerWon).toBe(false);
      expect(r.winnerIds).toEqual(['p1']);
    });

    it("variante Gabo (seuil 7) : 6 points suffisent", () => {
      expect(finish([[2, 2, 1, 1], [5, 5, 5, 5], [9, 9, 9, 9]], 7).callerWon).toBe(true);
    });

    it('égalité entre les autres pour le plus petit score : ils gagnent ensemble', () => {
      const r = finish([[9, 9, 9, 9], [2, 2, 0, 15], [4, 4, 4, 7]]);
      expect(r.scores).toMatchObject({ p1: 19, p2: 19 });
      expect(r.winnerIds).toEqual(['p1', 'p2']);
    });

    it('valeurs : Roi rouge 0, Roi noir 15, figures 10', () => {
      expect(cardPoints(c(13, 'diamonds'))).toBe(0);
      expect(cardPoints(c(13, 'clubs'))).toBe(15);
      expect(cardPoints(c(12, 'spades'))).toBe(10);
      expect(cardPoints(c(11, 'hearts'))).toBe(10);
      expect(cardPoints(c(1, 'hearts'))).toBe(1);
    });
  });
});

describe('pioche vide', () => {
  it('remélange la défausse sauf sa carte du dessus', () => {
    const e = setup(3);
    const discard = [c(2), c(3), c(4), c(8, 'spades')];
    rig(e, [hand(1, 2, 3, 4), hand(1, 2, 3, 4), hand(1, 2, 3, 4)], discard, []);
    const res = e.apply('p0', { type: 'drawFromDeck' }, T);
    expect(res.ok).toBe(true);
    expect(res.out.fx).toContainEqual({ type: 'reshuffle' });
    const r = e.state.round!;
    expect(r.discard.map((x) => x.id)).toEqual([discard[3]!.id]);
    expect(r.deck).toHaveLength(2);
  });

  it("une pénalité avec pioche vide utilise aussi le remélange", () => {
    const e = setup(3);
    rig(e, [hand(1, 2, 3, 4), hand(1, 2, 3, 4), hand(1, 2, 3, 4)], [c(2), c(8)], []);
    e.apply('p1', { type: 'drawFromDeck' }, T);
    expect(e.state.players[1]!.slots[4]!.rank).toBe(2);
    expect(e.state.round!.discard.map((x) => x.rank)).toEqual([8]);
  });

  it('plus aucune carte nulle part : la pioche refuse, sans planter', () => {
    const e = setup(3);
    rig(e, [hand(1, 2, 3, 4), hand(1, 2, 3, 4), hand(1, 2, 3, 4)], [c(8)], []);
    expect(e.apply('p0', { type: 'drawFromDeck' }, T).ok).toBe(false);
    expect(e.apply('p1', { type: 'drawFromDeck' }, T).ok).toBe(false); // pénalité sans carte
    expect(e.state.players[1]!.slots).toHaveLength(4);
  });
});

describe('multi-manches', () => {
  it('fin à X points : la partie s’arrête à la manche où quelqu’un atteint X, plus petit total gagnant', () => {
    const e = setup(2, { endCondition: { kind: 'points', limit: 30 } });
    rig(e, [hand(1, 1, 1, 1), [c(10), c(10), c(10), c(13, 'spades')]]);
    e.apply('p0', { type: 'callTamalou' }, T);
    e.apply('p1', { type: 'drawFromDeck' }, T);
    const out = e.apply('p1', { type: 'discardHeld' }, T);
    expect(e.state.gameOver).toBe(true);
    expect(e.state.gameWinnerIds).toEqual(['p0']);
    expect(out.out.fx).toContainEqual({ type: 'gameOver', winnerIds: ['p0'] });
  });

  it('N manches : continue jusqu’à N puis s’arrête', () => {
    const e = setup(2, { endCondition: { kind: 'rounds', count: 2 } });
    for (let round = 0; round < 2; round++) {
      const r = e.state.round!;
      rig(e, [hand(1, 1, 1, 1), hand(2, 2, 2, 2)]);
      const first = r.turnPlayerId;
      const other = first === 'p0' ? 'p1' : 'p0';
      e.apply(first, { type: 'callTamalou' }, T);
      e.apply(other, { type: 'drawFromDeck' }, T);
      e.apply(other, { type: 'discardHeld' }, T);
      expect(e.state.gameOver).toBe(round === 1);
      e.tick(T + 5000);
      if (round === 0) {
        e.startRound(T);
        e.tick(T + 5000);
      }
    }
    expect(e.state.roundsPlayed).toBe(2);
    expect(e.state.players.map((p) => p.totalScore)).toEqual([8, 16]);
  });
});
