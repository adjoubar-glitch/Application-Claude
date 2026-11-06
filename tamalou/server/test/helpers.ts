import { DEFAULT_OPTIONS, type Card, type GameOptions, type Rank, type Suit } from '@tamalou/shared';
import { TamalouEngine } from '../src/engine/engine.js';
import { seededRandom } from '../src/engine/deck.js';
import { buildView } from '../src/engine/view.js';

let n = 0;
export const c = (rank: Rank, suit: Suit = 'hearts'): Card => ({ id: `t${++n}`, rank, suit });

export const NAMES = ['Ana', 'Ben', 'Cid', 'Dia', 'Eve', 'Fil'];

/** Partie prête à jouer (vue initiale passée), donneur = joueur 0, horloge à t=5000. */
export function setup(players = 3, options: Partial<GameOptions> = {}, seed = 42) {
  const seats = NAMES.slice(0, players).map((name, i) => ({ id: `p${i}`, name, avatar: i, isBot: false }));
  const engine = new TamalouEngine(seats, { ...DEFAULT_OPTIONS, ...options }, { random: seededRandom(seed) });
  engine.state.dealerIndex = 0;
  engine.startRound(0);
  engine.tick(5000);
  return engine;
}

/** Remplace les mains, la défausse et la pioche par des cartes connues. */
export function rig(
  engine: TamalouEngine,
  hands: (Card | null)[][],
  discard: Card[] = [c(4, 'clubs')],
  deck: Card[] = Array.from({ length: 20 }, () => c(5, 'diamonds')),
) {
  const r = engine.state.round!;
  engine.state.players.forEach((p, i) => (p.slots = hands[i]!.slice()));
  r.discard = discard.slice();
  r.deck = deck.slice();
  r.reveals = [];
}

export const view = (engine: TamalouEngine, who: string, now = 5000) =>
  buildView(engine, who, now, { roomCode: 'ABCD', hostId: 'p0', controllers: {}, connected: {}, log: [] });

export const hand = (...ranks: Rank[]) => ranks.map((r) => c(r, 'hearts'));
