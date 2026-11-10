// Cerveau d'un bot. Il ne lit QUE ce qu'un téléphone reçoit : sa vue filtrée (`state`)
// et les effets publics (`fx`). Sa mémoire se construit uniquement à partir de ce qu'il a vu.

import {
  QUICK_REACTIONS,
  cardPoints,
  type BotLevel,
  type Card,
  type ClientView,
  type GameAction,
  type GameFx,
  type PlayerId,
  type QuickReaction,
  type SlotIndex,
} from '@tamalou/shared';

interface LevelProfile {
  /** Probabilité d'oublier chaque carte mémorisée, à chacun de ses tours. */
  forget: number;
  /** Probabilité de mémoriser une de ses cartes à la mauvaise place. */
  confuse: number;
  /** Temps de réaction aux doublons (ms). */
  reaction: [number, number];
  /** Probabilité de tenter un faux doublon à chaque défausse. */
  falseDuplicate: number;
  /** Probabilité de jouer hors tour quand le tour passe à un autre. */
  outOfTurn: number;
  /** Suit les échanges entre adversaires. */
  trackOthers: boolean;
  /** Probabilité de faire un coup au hasard. */
  sloppy: number;
}

export const LEVELS: Record<BotLevel, LevelProfile> = {
  easy: { forget: 0.2, confuse: 0.15, reaction: [2000, 4000], falseDuplicate: 0.05, outOfTurn: 0.03, trackOthers: false, sloppy: 0.15 },
  medium: { forget: 0.05, confuse: 0, reaction: [1000, 2000], falseDuplicate: 0, outOfTurn: 0, trackOthers: false, sloppy: 0.03 },
  expert: { forget: 0, confuse: 0, reaction: [400, 900], falseDuplicate: 0, outOfTurn: 0, trackOthers: true, sloppy: 0 },
};

/** Valeur moyenne d'une carte inconnue (330 points / 52 cartes). */
const UNKNOWN = 6.35;
const THINK: [number, number] = [1500, 3000];
const MAX_OWN_TURNS = 18;

export interface BotIO {
  act(action: GameAction): { ok: boolean };
  react(emoji: QuickReaction): void;
  /** Joueur dont c'est le tour : information publique à table (on voit qui joue). */
  turnOf(): PlayerId | null;
}

type Mem = Map<string, Card>;
const key = (p: PlayerId, s: SlotIndex) => `${p}:${s}`;

export class BotBrain {
  private profile: LevelProfile;
  private mem: Mem = new Map();
  private view: ClientView | null = null;
  private myHeld: Card | null = null;
  private publicHeld = new Map<PlayerId, Card>();
  private ownTurns = 0;
  private failures = 0;
  private lastTurn: PlayerId | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private dupTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    readonly id: PlayerId,
    readonly level: BotLevel,
    private io: BotIO,
    private random: () => number = Math.random,
  ) {
    this.profile = LEVELS[level];
  }

  // -------------------------------------------------------------------------
  // Réception (comme un téléphone)
  // -------------------------------------------------------------------------

  receive(event: string, payload: unknown): void {
    if (this.disposed) return;
    if (event === 'state') this.onState(payload as ClientView);
    else if (event === 'fx') this.onFx(payload as GameFx);
  }

  private onState(view: ClientView): void {
    this.view = view;
    if (view.phase === 'lobby' || view.phase === 'gameOver' || view.phase === 'roundOver') {
      this.clearTimers();
      return;
    }
    // Tout ce qui est visible pour lui est mémorisé ; les places vides sont oubliées.
    for (const p of view.players) {
      for (const s of p.slots) {
        if (!s.occupied) this.mem.delete(key(p.id, s.index));
        else if (s.card) this.see(p.id, s.index, s.card);
      }
    }
    if (view.held?.card) {
      if (view.held.playerId === this.id) this.myHeld = view.held.card;
      if (view.held.source === 'discard') this.publicHeld.set(view.held.playerId, view.held.card);
    }
    if (view.phase !== 'playing') return;

    const turn = this.io.turnOf();
    if (turn !== this.lastTurn) {
      this.lastTurn = turn;
      if (turn === this.id) {
        this.ownTurns++;
        this.forgetSome();
      } else if (turn && this.random() < this.profile.outOfTurn) {
        // Le singe distrait joue alors que ce n'est pas son tour.
        this.later(this.between(800, 2500), () => this.io.act({ type: 'drawFromDeck' }));
      }
    }
    if (turn === this.id && !this.turnTimer) this.scheduleTurn(this.between(...THINK));
  }

  private onFx(fx: GameFx): void {
    switch (fx.type) {
      case 'roundStart':
        this.mem.clear();
        this.publicHeld.clear();
        this.myHeld = null;
        this.ownTurns = 0;
        this.lastTurn = null;
        this.clearTimers();
        return;
      case 'discard': {
        if (fx.slot !== undefined) {
          // Échange : on sait ce qui arrive à cette place si la carte en main était connue.
          const incoming = fx.playerId === this.id ? this.myHeld : this.publicHeld.get(fx.playerId);
          if (incoming && (fx.playerId === this.id || this.level !== 'easy')) this.see(fx.playerId, fx.slot, incoming);
          else this.mem.delete(key(fx.playerId, fx.slot));
        }
        if (fx.playerId === this.id) this.myHeld = null;
        this.publicHeld.delete(fx.playerId);
        this.considerDuplicate(fx.card);
        return;
      }
      case 'duplicateSuccess':
        this.mem.delete(key(fx.playerId, fx.slot));
        this.considerDuplicate(fx.card);
        return;
      case 'swap': {
        const a = key(fx.a.playerId, fx.a.slot);
        const b = key(fx.b.playerId, fx.b.slot);
        const involvesMe = fx.a.playerId === this.id || fx.b.playerId === this.id;
        if (this.profile.trackOthers || involvesMe) {
          const ca = this.mem.get(a);
          const cb = this.mem.get(b);
          this.mem.delete(a);
          this.mem.delete(b);
          if (ca) this.mem.set(b, ca);
          if (cb) this.mem.set(a, cb);
        } else if (this.level !== 'easy') {
          this.mem.delete(a);
          this.mem.delete(b);
        }
        if (fx.b.playerId === this.id && this.random() < 0.5) this.sayLater('😱');
        return;
      }
      case 'penalty': {
        const victims = fx.kind === 'wrongTurn' ? [fx.playerId] : fx.playerIds;
        if (!victims.includes(this.id) && this.random() < 0.3) this.sayLater('🐒');
        return;
      }
      case 'roundEnd':
        if (fx.result.winnerIds.includes(this.id) && this.random() < 0.4) this.sayLater('🍌');
        else if (this.random() < 0.15) this.sayLater('👏');
        return;
      default:
        return;
    }
  }

  // -------------------------------------------------------------------------
  // Mémoire
  // -------------------------------------------------------------------------

  private see(p: PlayerId, slot: SlotIndex, card: Card): void {
    let s = slot;
    if (p === this.id && this.random() < this.profile.confuse) {
      const neighbour = slot ^ 1;
      if (this.mySlots().includes(neighbour)) s = neighbour; // le Facile se trompe de place
    }
    this.mem.set(key(p, s), card);
  }

  private forgetSome(): void {
    if (this.profile.forget <= 0) return;
    for (const k of [...this.mem.keys()]) if (this.random() < this.profile.forget) this.mem.delete(k);
  }

  private me() {
    return this.view?.players.find((p) => p.id === this.id);
  }

  private mySlots(): SlotIndex[] {
    return this.me()?.slots.filter((s) => s.occupied).map((s) => s.index) ?? [];
  }

  private known(p: PlayerId, s: SlotIndex): Card | undefined {
    return this.mem.get(key(p, s));
  }

  /** Sa pire carte connue (la plus chère). */
  private worstKnown(): { slot: SlotIndex; points: number } | null {
    let best: { slot: SlotIndex; points: number } | null = null;
    for (const s of this.mySlots()) {
      const c = this.known(this.id, s);
      if (c && (!best || cardPoints(c) > best.points)) best = { slot: s, points: cardPoints(c) };
    }
    return best;
  }

  private unknownSlots(): SlotIndex[] {
    return this.mySlots().filter((s) => !this.known(this.id, s));
  }

  private estimate(): { known: number; unknown: number; total: number } {
    let known = 0;
    let unknown = 0;
    for (const s of this.mySlots()) {
      const c = this.known(this.id, s);
      if (c) known += cardPoints(c);
      else unknown++;
    }
    return { known, unknown, total: known + unknown * UNKNOWN };
  }

  private opponents() {
    const caller = this.view?.tamalou?.callerId;
    return (this.view?.players ?? []).filter((p) => p.id !== this.id && p.cardCount > 0 && p.id !== caller);
  }

  // -------------------------------------------------------------------------
  // Doublons
  // -------------------------------------------------------------------------

  private considerDuplicate(top: Card): void {
    const v = this.view;
    if (!v || v.phase !== 'playing') return;
    let slot = this.mySlots().find((s) => this.known(this.id, s)?.rank === top.rank);
    if (slot === undefined && this.random() < this.profile.falseDuplicate) {
      const all = this.mySlots();
      slot = all[Math.floor(this.random() * all.length)];
    }
    if (slot === undefined) return;
    if (this.dupTimer) clearTimeout(this.dupTimer);
    const target = top.id;
    const chosen = slot;
    this.dupTimer = this.later(this.between(...this.profile.reaction), () => {
      this.dupTimer = null;
      // Trop tard si la défausse a changé entre-temps.
      if (this.view?.discardTop?.id !== target || this.view.phase !== 'playing') return;
      if (!this.mySlots().includes(chosen)) return;
      this.io.act({ type: 'duplicate', slot: chosen });
    });
  }

  // -------------------------------------------------------------------------
  // Son tour
  // -------------------------------------------------------------------------

  private scheduleTurn(delay: number): void {
    this.turnTimer = this.later(delay, () => {
      this.turnTimer = null;
      if (this.io.turnOf() !== this.id || this.view?.phase !== 'playing') return;
      const action = this.failures >= 2 ? this.fallback() : this.decide();
      if (!action) return;
      const res = this.io.act(action);
      this.failures = res.ok ? 0 : this.failures + 1;
      // Refus (fenêtre de doublon en cours…) : on réessaie un peu plus tard.
      if (!res.ok && this.io.turnOf() === this.id && !this.turnTimer) this.scheduleTurn(this.between(400, 800));
    });
  }

  /** Coup de secours après deux refus d'affilée : le plus simple possible. */
  private fallback(): GameAction {
    const v = this.view!;
    if (v.pendingPower?.playerId === this.id) return { type: 'skipPower' };
    if (v.held?.playerId === this.id) {
      const first = this.mySlots()[0];
      if (v.held.source === 'discard' && first !== undefined) return { type: 'swapHeld', slot: first };
      return { type: 'discardHeld' };
    }
    return this.failures % 2 === 0 ? { type: 'drawFromDeck' } : { type: 'takeDiscard' };
  }

  /** Décision pure à partir de la vue et de la mémoire. Public pour les tests. */
  decide(): GameAction | null {
    const v = this.view;
    if (!v) return null;
    const sloppy = this.random() < this.profile.sloppy;

    // 1. Pouvoir en cours
    if (v.pendingPower?.playerId === this.id) return this.decidePower(sloppy);

    // 2. Carte en main
    if (v.held?.playerId === this.id) {
      const card = v.held.card ?? this.myHeld;
      const slots = this.mySlots();
      if (!card || !slots.length) return { type: 'discardHeld' };
      if (sloppy) {
        if (v.held.source === 'deck' && this.random() < 0.5) return { type: 'discardHeld' };
        return { type: 'swapHeld', slot: slots[Math.floor(this.random() * slots.length)]! };
      }
      const pts = cardPoints(card);
      const worst = this.worstKnown();
      const unknown = this.unknownSlots();
      if (worst && pts < worst.points) return { type: 'swapHeld', slot: worst.slot };
      if (pts <= 4 && unknown.length) return { type: 'swapHeld', slot: unknown[Math.floor(this.random() * unknown.length)]! };
      if (v.held.source === 'discard') return { type: 'swapHeld', slot: worst?.slot ?? unknown[0] ?? slots[0]! };
      return { type: 'discardHeld' };
    }

    // 3. Début de tour
    if (!v.tamalou && this.shouldCallTamalou()) return { type: 'callTamalou' };
    const top = v.discardTop;
    const worst = this.worstKnown();
    const canDraw = v.deckCount > 0 || v.discardCount > 1;
    if (top && this.mySlots().length) {
      const p = cardPoints(top);
      if (!canDraw || p <= 2 || (worst && p <= worst.points - 4)) return { type: 'takeDiscard' };
    }
    return { type: 'drawFromDeck' };
  }

  private decidePower(sloppy: boolean): GameAction {
    const v = this.view!;
    const pp = v.pendingPower!;
    const opponents = this.opponents();
    const pickOpponentSlot = (preferUnknown: boolean) => {
      const options: { target: PlayerId; slot: SlotIndex; known?: Card }[] = [];
      for (const o of opponents) for (const s of o.slots) if (s.occupied) options.push({ target: o.id, slot: s.index, known: this.known(o.id, s.index) });
      if (!options.length) return null;
      const pool = preferUnknown ? options.filter((x) => !x.known) : options;
      const list = pool.length ? pool : options;
      return list[Math.floor(this.random() * list.length)]!;
    };

    if (pp.stage === 'decide') {
      const peeked = pp.peeked?.card;
      const worst = this.worstKnown();
      if (peeked && worst && cardPoints(peeked) < worst.points - 1 && pp.peeked!.target !== v.tamalou?.callerId) {
        return { type: 'kingSwap', ownSlot: worst.slot };
      }
      return { type: 'skipPower' };
    }
    if (sloppy && this.random() < 0.5) return { type: 'skipPower' };

    switch (pp.power) {
      case 'peekOwn': {
        const unknown = this.unknownSlots();
        if (!unknown.length) return { type: 'skipPower' };
        return { type: 'usePower', power: { kind: 'peekOwn', slot: unknown[Math.floor(this.random() * unknown.length)]! } };
      }
      case 'peekOther': {
        const t = pickOpponentSlot(true);
        return t ? { type: 'usePower', power: { kind: 'peekOther', target: t.target, slot: t.slot } } : { type: 'skipPower' };
      }
      case 'blindSwap': {
        const worst = this.worstKnown();
        if (!worst || worst.points < 8) return { type: 'skipPower' };
        // L'Expert vise une carte adverse qu'il sait basse.
        let target: { target: PlayerId; slot: SlotIndex } | null = null;
        if (this.level === 'expert') {
          for (const o of opponents)
            for (const s of o.slots) {
              const c = this.known(o.id, s.index);
              if (s.occupied && c && cardPoints(c) <= 3) target = { target: o.id, slot: s.index };
            }
        }
        target ??= pickOpponentSlot(true);
        return target
          ? { type: 'usePower', power: { kind: 'blindSwap', ownSlot: worst.slot, target: target.target, slot: target.slot } }
          : { type: 'skipPower' };
      }
      case 'peekAndSwap': {
        // Roi noir : regarder une carte (de préférence inconnue) pour piquer une carte basse.
        const t = pickOpponentSlot(true);
        return t ? { type: 'usePower', power: { kind: 'peekAndSwap', target: t.target, slot: t.slot } } : { type: 'skipPower' };
      }
    }
  }

  private shouldCallTamalou(): boolean {
    const v = this.view!;
    const thr = v.options.tamalouThreshold;
    const e = this.estimate();
    if (this.ownTurns >= MAX_OWN_TURNS) return true; // il faut bien finir la manche
    switch (this.level) {
      case 'easy': // parfois trop tôt
        return e.total <= thr + 3 || (this.ownTurns > 4 && this.random() < 0.05);
      case 'medium':
        return e.unknown <= 1 && e.total <= thr;
      case 'expert': // prudent : ne joue qu'avec des cartes connues
        return e.unknown === 0 && e.known <= Math.max(0, thr - 1);
    }
  }

  // -------------------------------------------------------------------------
  // Utilitaires
  // -------------------------------------------------------------------------

  private sayLater(emoji: QuickReaction): void {
    if (!QUICK_REACTIONS.includes(emoji)) return;
    this.later(this.between(600, 1800), () => this.io.react(emoji));
  }

  private between(min: number, max: number): number {
    return Math.round(min + this.random() * (max - min));
  }

  private later(ms: number, fn: () => void): ReturnType<typeof setTimeout> {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.disposed) fn();
    }, ms);
    this.timers.add(t);
    return t;
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.turnTimer = null;
    this.dupTimer = null;
  }

  /** Pour les tests : ce que le bot croit savoir. */
  memory(): ReadonlyMap<string, Card> {
    return this.mem;
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }
}
