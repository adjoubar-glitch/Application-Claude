// Cartes : jeu standard de 52 cartes, sans joker.

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/** 1 = As, 11 = Valet, 12 = Dame, 13 = Roi. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export interface Card {
  /** Identifiant opaque, tiré au hasard à chaque manche. Ne révèle rien de la valeur. */
  id: string;
  rank: Rank;
  suit: Suit;
}

export const isRedSuit = (suit: Suit): boolean => suit === 'hearts' || suit === 'diamonds';

/** Valeur en points : As=1, 2-10 faciale, Valet/Dame=10, Roi rouge=0, Roi noir=15. */
export function cardPoints(card: Pick<Card, 'rank' | 'suit'>): number {
  if (card.rank === 13) return isRedSuit(card.suit) ? 0 : 15;
  if (card.rank >= 11) return 10;
  return card.rank;
}

/**
 * Pouvoirs, utilisables uniquement quand la carte est piochée puis défaussée directement.
 * - peekOwn     : 7 ou 8, regarder une de ses cartes
 * - peekOther   : 9 ou 10, regarder une carte d'un adversaire
 * - blindSwap   : Valet ou Dame, échanger à l'aveugle une de ses cartes avec une carte adverse
 * - peekAndSwap : Roi noir, regarder une carte adverse puis décider d'échanger ou non
 * Le Roi rouge n'a pas de pouvoir (il vaut 0, c'est déjà bien assez).
 */
export type PowerKind = 'peekOwn' | 'peekOther' | 'blindSwap' | 'peekAndSwap';

export function cardPower(card: Pick<Card, 'rank' | 'suit'>): PowerKind | null {
  switch (card.rank) {
    case 7:
    case 8:
      return 'peekOwn';
    case 9:
    case 10:
      return 'peekOther';
    case 11:
    case 12:
      return 'blindSwap';
    case 13:
      return isRedSuit(card.suit) ? null : 'peekAndSwap';
    default:
      return null;
  }
}

export function rankLabel(rank: Rank): string {
  switch (rank) {
    case 1:
      return 'A';
    case 11:
      return 'V';
    case 12:
      return 'D';
    case 13:
      return 'R';
    default:
      return String(rank);
  }
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export function cardLabel(card: Pick<Card, 'rank' | 'suit'>): string {
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}
