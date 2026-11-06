// Moteur de règles Tamalou : pur, synchrone, sans réseau ni horloge.
// - apply(playerId, action, now) : traite une action horodatée par le serveur
// - tick(now)                    : fait avancer les échéances (vue initiale, fenêtre de doublon, révélations)
// - nextDeadline()               : prochaine échéance, pour que la salle pose un seul timer

import {
  BASE_SLOTS,
  BOTTOM_SLOTS,
  SLOTS_PER_ROW,
  TIMINGS,
  cardLabel,
  cardPoints,
  cardPower,
  type BotLevel,
  type Card,
  type GameAction,
  type GameOptions,
  type PlayerId,
  type PowerUse,
  type SlotIndex,
} from '@tamalou/shared';
import { createDeck, shuffle } from './deck.js';
import type {
  EngineDeps,
  EngineOutput,
  EnginePlayer,
  EngineState,
  Reveal,
  RoundResult,
  RoundState,
} from './state.js';

export interface PlayerSeat {
  id: PlayerId;
  name: string;
  avatar: number;
  isBot: boolean;
  botLevel?: BotLevel;
}

export type ApplyResult =
  | { ok: true; out: EngineOutput }
  /** code 'wrongTurn' : action annulée ET pénalité appliquée (voir out). */
  | { ok: false; code: ErrorCode; error: string; out: EngineOutput };

export type ErrorCode = 'wrongTurn' | 'invalid' | 'locked' | 'notPlaying';

const TURN_ACTIONS = new Set<GameAction['type']>([
  'drawFromDeck',
  'takeDiscard',
  'swapHeld',
  'discardHeld',
  'usePower',
  'skipPower',
  'kingSwap',
  'callTamalou',
]);

class RuleError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const emptyOut = (): EngineOutput => ({ fx: [], logs: [], system: [] });

export class TamalouEngine {
  readonly state: EngineState;
  private out: EngineOutput = emptyOut();

  constructor(
    seats: PlayerSeat[],
    options: GameOptions,
    private deps: EngineDeps,
  ) {
    if (seats.length < 2 || seats.length > 6) throw new Error('Il faut 2 à 6 joueurs');
    this.state = {
      options,
      players: seats.map((s) => ({ ...s, slots: [], totalScore: 0 })),
      dealerIndex: Math.floor(deps.random() * seats.length),
      round: null,
      roundsPlayed: 0,
      gameOver: false,
      gameWinnerIds: [],
      seq: 0,
    };
  }

  // -------------------------------------------------------------------------
  // API publique
  // -------------------------------------------------------------------------

  /** Démarre une manche (la première, ou la suivante après roundOver). */
  startRound(now: number): EngineOutput {
    return this.run(() => {
      const s = this.state;
      if (s.gameOver) throw new RuleError('invalid', 'La partie est terminée');
      if (s.round && s.round.phase !== 'over') throw new RuleError('invalid', 'Manche en cours');
      if (s.round) s.dealerIndex = (s.dealerIndex + 1) % s.players.length;

      const deck = createDeck(this.deps.random);
      for (const p of s.players) p.slots = deck.splice(0, BASE_SLOTS);
      const first = deck.pop()!;
      const dealer = s.players[s.dealerIndex]!;
      const round: RoundState = {
        number: s.roundsPlayed + 1,
        phase: 'initialPeek',
        deck,
        discard: [first],
        turnPlayerId: dealer.id,
        step: { kind: 'start' },
        tamalou: null,
        duplicateWindow: null,
        reveals: [],
        phaseEndsAt: now + TIMINGS.initialPeekMs,
        endPending: false,
        result: null,
      };
      for (const p of s.players) {
        for (const slot of BOTTOM_SLOTS) {
          round.reveals.push({ playerId: p.id, slot, audience: [p.id], until: now + TIMINGS.initialPeekMs, reason: 'initialPeek' });
        }
      }
      s.round = round;
      this.fx({ type: 'roundStart', round: round.number, dealerId: dealer.id });
      this.log('all', `Manche ${round.number} : ${dealer.name} a le jeton Dealer et commence.`);
    });
  }

  apply(playerId: PlayerId, action: GameAction, now: number): ApplyResult {
    this.out = emptyOut();
    const seq = ++this.state.seq;
    try {
      this.handle(playerId, action, now, seq);
      return { ok: true, out: this.flush() };
    } catch (e) {
      if (e instanceof RuleError) return { ok: false, code: e.code, error: e.message, out: this.flush() };
      throw e;
    }
  }

  /** Fait avancer toutes les échéances atteintes. */
  tick(now: number): EngineOutput {
    return this.run(() => {
      const r = this.state.round;
      if (!r) return;
      // Plusieurs échéances peuvent tomber dans le même tick : on boucle.
      for (let guard = 0; guard < 10; guard++) {
        let changed = false;
        if (r.phase === 'initialPeek' && r.phaseEndsAt !== null && now >= r.phaseEndsAt) {
          r.phase = 'playing';
          r.phaseEndsAt = null;
          this.autoTamalouIfEmpty(now);
          changed = true;
        }
        if (r.duplicateWindow && now >= r.duplicateWindow.closesAt) {
          this.resolveDuplicates(now);
          changed = true;
        }
        if (r.phase === 'reveal' && r.phaseEndsAt !== null && now >= r.phaseEndsAt) {
          r.phase = 'over';
          r.phaseEndsAt = null;
          changed = true;
        }
        const before = r.reveals.length;
        r.reveals = r.reveals.filter((x) => x.until > now);
        if (r.reveals.length !== before) changed = true;
        if (!changed) break;
      }
    });
  }

  nextDeadline(): number | null {
    const r = this.state.round;
    if (!r) return null;
    const times: number[] = r.reveals.filter((x) => Number.isFinite(x.until)).map((x) => x.until);
    if (r.phaseEndsAt !== null) times.push(r.phaseEndsAt);
    if (r.duplicateWindow) times.push(r.duplicateWindow.closesAt);
    return times.length ? Math.min(...times) : null;
  }

  player(id: PlayerId): EnginePlayer {
    const p = this.state.players.find((x) => x.id === id);
    if (!p) throw new RuleError('invalid', 'Joueur inconnu');
    return p;
  }

  /** Pour l'affichage d'un pseudo en cours de partie (remplaçant, etc.). */
  renamePlayer(id: PlayerId, name: string): void {
    this.player(id).name = name;
  }

  // -------------------------------------------------------------------------
  // Traitement des actions
  // -------------------------------------------------------------------------

  private handle(playerId: PlayerId, action: GameAction, now: number, seq: number): void {
    const r = this.state.round;
    this.player(playerId);
    if (!r || r.phase !== 'playing') throw new RuleError('notPlaying', "Ce n'est pas le moment de jouer");

    if (action.type === 'duplicate') return this.attemptDuplicate(playerId, action.slot, now, seq);

    if (!TURN_ACTIONS.has(action.type)) throw new RuleError('invalid', 'Action inconnue');
    if (r.endPending) throw new RuleError('locked', 'La manche se termine…');

    // Jeu hors tour : action annulée, pénalité, le tour ne bouge pas.
    if (playerId !== r.turnPlayerId) {
      this.penalize([playerId], 'wrongTurn', now);
      throw new RuleError('wrongTurn', "Ce n'était pas ton tour !");
    }

    const step = r.step;
    switch (action.type) {
      case 'callTamalou': {
        if (step.kind !== 'start') throw new RuleError('invalid', "Tamalou s'annonce en tout début de tour");
        if (r.tamalou) throw new RuleError('invalid', 'Tamalou a déjà été annoncé');
        this.callTamalou(playerId, now);
        return;
      }
      case 'drawFromDeck': {
        if (step.kind !== 'start') throw new RuleError('invalid', 'Tu as déjà une carte en main');
        const card = this.drawCard();
        if (!card) throw new RuleError('invalid', 'La pioche est vide');
        r.step = { kind: 'holding', card, source: 'deck' };
        this.fx({ type: 'draw', playerId, source: 'deck' });
        return;
      }
      case 'takeDiscard': {
        if (step.kind !== 'start') throw new RuleError('invalid', 'Tu as déjà une carte en main');
        this.assertUnlocked();
        const card = r.discard.pop();
        if (!card) throw new RuleError('invalid', 'La défausse est vide');
        r.step = { kind: 'holding', card, source: 'discard' };
        this.fx({ type: 'draw', playerId, source: 'discard' });
        this.log('all', `${this.name(playerId)} prend le ${cardLabel(card)} de la défausse.`);
        return;
      }
      case 'swapHeld': {
        if (step.kind !== 'holding') throw new RuleError('invalid', "Tu n'as pas de carte en main");
        this.assertUnlocked();
        const p = this.player(playerId);
        const old = this.ownCard(p, action.slot);
        p.slots[action.slot] = step.card;
        r.discard.push(old);
        this.fx({ type: 'discard', playerId, card: old });
        this.log('all', `${p.name} échange une carte et défausse un ${cardLabel(old)}.`);
        this.endTurn(now);
        return;
      }
      case 'discardHeld': {
        if (step.kind !== 'holding') throw new RuleError('invalid', "Tu n'as pas de carte en main");
        if (step.source === 'discard') throw new RuleError('invalid', 'Une carte prise à la défausse doit être échangée');
        this.assertUnlocked();
        r.discard.push(step.card);
        this.fx({ type: 'discard', playerId, card: step.card });
        this.log('all', `${this.name(playerId)} défausse un ${cardLabel(step.card)}.`);
        const power = cardPower(step.card);
        if (power) r.step = { kind: 'power', power };
        else this.endTurn(now);
        return;
      }
      case 'usePower': {
        if (step.kind !== 'power') throw new RuleError('invalid', 'Aucun pouvoir à utiliser');
        if (action.power.kind !== step.power) throw new RuleError('invalid', "Ce n'est pas le pouvoir de cette carte");
        this.usePower(playerId, action.power, now);
        return;
      }
      case 'skipPower': {
        if (step.kind !== 'power' && step.kind !== 'kingDecide') throw new RuleError('invalid', 'Aucun pouvoir en cours');
        if (step.kind === 'kingDecide') this.clearKingReveal(playerId);
        this.endTurn(now);
        return;
      }
      case 'kingSwap': {
        if (step.kind !== 'kingDecide') throw new RuleError('invalid', 'Aucun échange de Roi en cours');
        this.assertUnlocked();
        this.assertSwappable(step.target);
        this.ownCard(this.player(playerId), action.ownSlot);
        this.swapCards(playerId, action.ownSlot, step.target, step.slot, false);
        this.clearKingReveal(playerId);
        this.endTurn(now);
        return;
      }
    }
  }

  private usePower(playerId: PlayerId, use: PowerUse, now: number): void {
    const r = this.state.round!;
    const me = this.player(playerId);
    switch (use.kind) {
      case 'peekOwn': {
        this.ownCard(me, use.slot);
        this.reveal(playerId, use.slot, [playerId], now + TIMINGS.peekOwnMs, 'peekOwn');
        this.fx({ type: 'peek', power: 'peekOwn', byPlayerId: playerId, target: { playerId, slot: use.slot } });
        this.log('all', `${me.name} regarde une de ses cartes.`);
        this.endTurn(now);
        return;
      }
      case 'peekOther': {
        this.otherCard(playerId, use.target, use.slot);
        this.reveal(use.target, use.slot, [playerId], now + TIMINGS.peekOtherMs, 'peekOther');
        this.fx({ type: 'peek', power: 'peekOther', byPlayerId: playerId, target: { playerId: use.target, slot: use.slot } });
        this.logPeek(playerId, use.target);
        this.endTurn(now);
        return;
      }
      case 'blindSwap': {
        this.assertUnlocked();
        this.ownCard(me, use.ownSlot);
        this.otherCard(playerId, use.target, use.slot);
        this.assertSwappable(use.target);
        this.swapCards(playerId, use.ownSlot, use.target, use.slot, true);
        this.endTurn(now);
        return;
      }
      case 'peekAndSwap': {
        this.otherCard(playerId, use.target, use.slot);
        // Visible jusqu'à la décision.
        this.reveal(use.target, use.slot, [playerId], Number.POSITIVE_INFINITY, 'king');
        this.fx({ type: 'peek', power: 'peekAndSwap', byPlayerId: playerId, target: { playerId: use.target, slot: use.slot } });
        this.logPeek(playerId, use.target);
        r.step = { kind: 'kingDecide', target: use.target, slot: use.slot };
        return;
      }
    }
  }

  private callTamalou(playerId: PlayerId, now: number): void {
    const r = this.state.round!;
    const players = this.state.players;
    const idx = players.findIndex((p) => p.id === playerId);
    const remaining: PlayerId[] = [];
    for (let i = 1; i < players.length; i++) remaining.push(players[(idx + i) % players.length]!.id);
    r.tamalou = { callerId: playerId, remaining };
    this.fx({ type: 'tamalou', playerId });
    const msg = `🐒 ${this.name(playerId)} annonce TAMALOU ! Dernier tour pour les autres.`;
    this.log('all', msg);
    this.out.system.push(msg);
    this.advanceTo(remaining[0]!, now);
  }

  private endTurn(now: number): void {
    const r = this.state.round!;
    r.step = { kind: 'start' };
    if (r.tamalou) {
      r.tamalou.remaining = r.tamalou.remaining.filter((id) => id !== r.turnPlayerId);
      const next = r.tamalou.remaining[0];
      if (!next) {
        r.endPending = true;
        this.maybeFinishRound(now);
        return;
      }
      this.advanceTo(next, now);
      return;
    }
    const players = this.state.players;
    const idx = players.findIndex((p) => p.id === r.turnPlayerId);
    this.advanceTo(players[(idx + 1) % players.length]!.id, now);
  }

  private advanceTo(playerId: PlayerId, now: number): void {
    const r = this.state.round!;
    r.turnPlayerId = playerId;
    r.step = { kind: 'start' };
    this.autoTamalouIfEmpty(now);
  }

  /** Tamalou obligatoire pour un joueur sans carte, au début de son tour. */
  private autoTamalouIfEmpty(now: number): void {
    const r = this.state.round!;
    if (r.phase !== 'playing' || r.tamalou || r.step.kind !== 'start' || r.endPending) return;
    if (this.cardCount(this.player(r.turnPlayerId)) === 0) this.callTamalou(r.turnPlayerId, now);
  }

  // -------------------------------------------------------------------------
  // Doublons et fenêtre de 1,5 s
  // -------------------------------------------------------------------------

  private attemptDuplicate(playerId: PlayerId, slot: SlotIndex, now: number, seq: number): void {
    const r = this.state.round!;
    const p = this.player(playerId);
    this.ownCard(p, slot);
    const top = r.discard[r.discard.length - 1];
    if (!top) throw new RuleError('invalid', 'La défausse est vide');
    let w = r.duplicateWindow;
    if (!w) {
      w = { targetCardId: top.id, openedAt: now, closesAt: now + TIMINGS.duplicateWindowMs, attempts: [] };
      r.duplicateWindow = w;
    }
    if (w.attempts.some((a) => a.playerId === playerId)) throw new RuleError('invalid', 'Une seule tentative par doublon');
    w.attempts.push({ playerId, slot, at: now, seq });
  }

  private resolveDuplicates(now: number): void {
    const r = this.state.round!;
    const w = r.duplicateWindow!;
    r.duplicateWindow = null;
    const target = r.discard.find((c) => c.id === w.targetCardId);
    if (!target) return;

    const ordered = w.attempts.slice().sort((a, b) => a.at - b.at || a.seq - b.seq);
    const right: typeof ordered = [];
    const wrong: typeof ordered = [];
    for (const a of ordered) {
      const card = this.player(a.playerId).slots[a.slot];
      if (!card) continue;
      (card.rank === target.rank ? right : wrong).push(a);
    }

    // Faux doublons : carte montrée à tous 2 s puis remise, pénalité.
    for (const a of wrong) {
      this.reveal(a.playerId, a.slot, 'all', now + TIMINGS.wrongDuplicateRevealMs, 'wrongDuplicate');
    }

    // Un seul gagnant : le plus rapide.
    const winner = right[0];
    if (winner) {
      const p = this.player(winner.playerId);
      const card = p.slots[winner.slot]!;
      p.slots[winner.slot] = null;
      this.trimEmptyPenaltyRows(p);
      r.discard.push(card);
      this.fx({ type: 'duplicateSuccess', playerId: p.id, card });
      this.log('all', `⚡ ${p.name} se débarrasse d'un ${cardLabel(card)} en doublon !`);
      const slow = right.slice(1).map((a) => a.playerId);
      if (slow.length) {
        this.fx({ type: 'duplicateTooSlow', playerIds: slow, winnerId: p.id });
        this.log(slow, `🦍 Trop lent ! ${p.name} a été plus rapide. Ta carte reste à sa place.`);
      }
    }

    if (wrong.length) this.penalize(wrong.map((a) => a.playerId), 'wrongDuplicate', now);

    this.autoTamalouIfEmpty(now);
    this.maybeFinishRound(now);
  }

  // -------------------------------------------------------------------------
  // Pénalités
  // -------------------------------------------------------------------------

  private penalize(playerIds: PlayerId[], kind: 'wrongTurn' | 'wrongDuplicate', _now: number): void {
    for (const id of playerIds) {
      const card = this.drawCard();
      if (card) this.placePenaltyCard(this.player(id), card);
    }
    const names = playerIds.map((id) => this.name(id)).join(', ');
    if (kind === 'wrongTurn') {
      this.fx({ type: 'penalty', kind, playerId: playerIds[0]! });
      const msg = `🙈 ${names} a joué hors de son tour : une carte de pénalité !`;
      this.log('all', msg);
      this.out.system.push(msg);
    } else {
      this.fx({ type: 'penalty', kind, playerIds });
      const msg = `💥 ${names} ${playerIds.length > 1 ? 'se sont plantés' : "s'est planté"} sur le doublon : carte de pénalité !`;
      this.log('all', msg);
      this.out.system.push(msg);
    }
  }

  /** Première place libre d'index >= 4, sinon nouvelle rangée au-dessus. */
  placePenaltyCard(p: EnginePlayer, card: Card): SlotIndex {
    while (p.slots.length < BASE_SLOTS) p.slots.push(null);
    for (let i = BASE_SLOTS; i < p.slots.length; i++) {
      if (p.slots[i] === null) {
        p.slots[i] = card;
        return i;
      }
    }
    const index = p.slots.length;
    p.slots.push(card);
    if (p.slots.length % SLOTS_PER_ROW !== 0) p.slots.push(null);
    return index;
  }

  /** Retire les rangées de pénalité devenues entièrement vides tout en haut. */
  private trimEmptyPenaltyRows(p: EnginePlayer): void {
    while (p.slots.length > BASE_SLOTS && p.slots.slice(-SLOTS_PER_ROW).every((c) => c === null)) {
      p.slots.splice(-SLOTS_PER_ROW, SLOTS_PER_ROW);
    }
  }

  // -------------------------------------------------------------------------
  // Pioche, fin de manche, score
  // -------------------------------------------------------------------------

  /** Pioche vide : on remélange la défausse sauf sa carte du dessus. */
  private drawCard(): Card | null {
    const r = this.state.round!;
    if (r.deck.length === 0 && r.discard.length > 1) {
      const top = r.discard.pop()!;
      r.deck = shuffle(r.discard, this.deps.random);
      r.discard = [top];
      this.fx({ type: 'reshuffle' });
      this.log('all', '🔄 Pioche vide : la défausse est remélangée.');
    }
    return r.deck.pop() ?? null;
  }

  private maybeFinishRound(now: number): void {
    const r = this.state.round!;
    if (!r.endPending || r.duplicateWindow || r.phase !== 'playing') return;
    const s = this.state;
    const callerId = r.tamalou?.callerId ?? null;
    const scores: Record<PlayerId, number> = {};
    const hands: Record<PlayerId, (Card | null)[]> = {};
    for (const p of s.players) {
      scores[p.id] = p.slots.reduce((sum, c) => sum + (c ? cardPoints(c) : 0), 0);
      hands[p.id] = p.slots.slice();
    }
    let winnerIds: PlayerId[];
    let callerWon = false;
    const others = s.players.filter((p) => p.id !== callerId);
    if (callerId !== null) {
      const cs = scores[callerId]!;
      callerWon = cs <= s.options.tamalouThreshold && others.every((p) => cs < scores[p.id]!);
    }
    if (callerWon) winnerIds = [callerId!];
    else {
      const best = Math.min(...others.map((p) => scores[p.id]!));
      winnerIds = others.filter((p) => scores[p.id] === best).map((p) => p.id);
    }
    for (const p of s.players) p.totalScore += scores[p.id]!;
    const totals = Object.fromEntries(s.players.map((p) => [p.id, p.totalScore]));
    const result: RoundResult = { round: r.number, callerId, scores, hands, winnerIds, callerWon, totals };
    r.result = result;
    r.phase = 'reveal';
    r.phaseEndsAt = now + TIMINGS.finalRevealMs;
    r.reveals = [];
    s.roundsPlayed++;
    this.fx({ type: 'roundEnd', result });
    const msg = `🏆 Manche ${r.number} : ${winnerIds.map((id) => this.name(id)).join(' et ')} ${winnerIds.length > 1 ? 'gagnent' : 'gagne'} !`;
    this.log('all', msg);
    this.out.system.push(msg);

    const end = s.options.endCondition;
    const over =
      end.kind === 'single' ||
      (end.kind === 'points' && s.players.some((p) => p.totalScore >= end.limit)) ||
      (end.kind === 'rounds' && s.roundsPlayed >= end.count);
    if (over) {
      const best = Math.min(...s.players.map((p) => p.totalScore));
      s.gameOver = true;
      s.gameWinnerIds = s.players.filter((p) => p.totalScore === best).map((p) => p.id);
      if (end.kind !== 'single') {
        this.fx({ type: 'gameOver', winnerIds: s.gameWinnerIds });
        const m = `👑 Fin de partie : ${s.gameWinnerIds.map((id) => this.name(id)).join(' et ')} roi de la jungle !`;
        this.log('all', m);
        this.out.system.push(m);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Utilitaires
  // -------------------------------------------------------------------------

  private assertUnlocked(): void {
    if (this.state.round!.duplicateWindow) throw new RuleError('locked', 'Attends la fin de la tentative de doublon…');
  }

  private assertSwappable(target: PlayerId): void {
    if (this.state.round!.tamalou?.callerId === target) {
      throw new RuleError('invalid', 'Les cartes de celui qui a annoncé Tamalou sont intouchables');
    }
  }

  private ownCard(p: EnginePlayer, slot: SlotIndex): Card {
    const c = Number.isInteger(slot) ? p.slots[slot] : undefined;
    if (!c) throw new RuleError('invalid', "Il n'y a pas de carte à cette place");
    return c;
  }

  private otherCard(me: PlayerId, target: PlayerId, slot: SlotIndex): Card {
    if (target === me) throw new RuleError('invalid', 'Choisis une carte adverse');
    return this.ownCard(this.player(target), slot);
  }

  private swapCards(actor: PlayerId, ownSlot: SlotIndex, target: PlayerId, slot: SlotIndex, blind: boolean): void {
    const me = this.player(actor);
    const other = this.player(target);
    const a = me.slots[ownSlot]!;
    me.slots[ownSlot] = other.slots[slot]!;
    other.slots[slot] = a;
    this.fx({ type: 'swap', power: blind ? 'blindSwap' : 'peekAndSwap', a: { playerId: actor, slot: ownSlot }, b: { playerId: target, slot }, blind });
    const how = blind ? 'à l’aveugle ' : '';
    this.log([target], `😱 ${me.name} a échangé ${how}une de ses cartes avec une des tiennes !`);
    this.log(this.othersExcept(actor, target), `${me.name} échange ${how}une carte avec ${other.name}.`);
    this.log([actor], `Tu échanges ${how}une carte avec ${other.name}.`);
  }

  private reveal(playerId: PlayerId, slot: SlotIndex, audience: Reveal['audience'], until: number, reason: Reveal['reason']): void {
    this.state.round!.reveals.push({ playerId, slot, audience, until, reason });
  }

  private clearKingReveal(viewer: PlayerId): void {
    const r = this.state.round!;
    r.reveals = r.reveals.filter((x) => !(x.reason === 'king' && x.audience !== 'all' && x.audience.includes(viewer)));
  }

  private logPeek(actor: PlayerId, target: PlayerId): void {
    this.log([target], `👀 ${this.name(actor)} a regardé une de tes cartes.`);
    this.log(this.othersExcept(actor, target), `${this.name(actor)} regarde une carte de ${this.name(target)}.`);
  }

  private othersExcept(...ids: PlayerId[]): PlayerId[] {
    return this.state.players.map((p) => p.id).filter((id) => !ids.includes(id));
  }

  cardCount(p: EnginePlayer): number {
    return p.slots.filter(Boolean).length;
  }

  private name(id: PlayerId): string {
    return this.player(id).name;
  }

  private fx(f: EngineOutput['fx'][number]): void {
    this.out.fx.push(f);
  }

  private log(to: 'all' | PlayerId[], text: string): void {
    if (to !== 'all' && to.length === 0) return;
    this.out.logs.push({ to, text });
  }

  private flush(): EngineOutput {
    const o = this.out;
    this.out = emptyOut();
    return o;
  }

  private run(fn: () => void): EngineOutput {
    this.out = emptyOut();
    fn();
    return this.flush();
  }
}
