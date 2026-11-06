import { RANKS, SUITS, type Card } from '@tamalou/shared';

/** Générateur pseudo-aléatoire reproductible (tests, simulations). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** 52 cartes mélangées, avec des identifiants opaques tirés au hasard. */
export function createDeck(random: () => number): Card[] {
  const cards: Card[] = [];
  const used = new Set<string>();
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      let id: string;
      do id = Math.floor(random() * 2 ** 40).toString(36);
      while (used.has(id));
      used.add(id);
      cards.push({ id, rank, suit });
    }
  }
  return shuffle(cards, random);
}
