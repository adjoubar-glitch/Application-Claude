// État COMPLET d'une partie, détenu uniquement par le serveur.
// Le moteur est pur : il ne connaît ni Socket.IO, ni setTimeout, ni Date.now().
// Il reçoit l'heure (`now`) et un générateur aléatoire injectés, ce qui le rend
// testable et rejouable à l'identique (tests, simulation de 200 parties).

import type {
  BotLevel,
  Card,
  GameFx,
  GameOptions,
  PlayerId,
  PowerKind,
  SlotIndex,
} from '@tamalou/shared';

export interface EnginePlayer {
  id: PlayerId;
  name: string;
  avatar: number;
  isBot: boolean;
  botLevel?: BotLevel;
  /** Grille : null = place vide. Voir la disposition dans shared/game.ts. */
  slots: (Card | null)[];
  totalScore: number;
}

export type TurnStep =
  /** Le joueur doit choisir : piocher, prendre la défausse, ou annoncer Tamalou. */
  | { kind: 'start' }
  /** Il tient une carte (piochée ou prise de la défausse). */
  | { kind: 'holding'; card: Card; source: 'deck' | 'discard' }
  /** Il vient de défausser une carte à pouvoir piochée : activer ou passer. */
  | { kind: 'power'; power: PowerKind }
  /** Roi noir, après avoir regardé : échanger ou non. */
  | { kind: 'kingDecide'; target: PlayerId; slot: SlotIndex };

export interface DuplicateAttempt {
  playerId: PlayerId;
  slot: SlotIndex;
  /** Horodatage serveur à la réception. */
  at: number;
  /** Numéro d'ordre global : départage deux tentatives à la même milliseconde. */
  seq: number;
}

export interface DuplicateWindow {
  /** Carte du dessus de défausse visée par toutes les tentatives de cette fenêtre. */
  targetCardId: string;
  openedAt: number;
  closesAt: number;
  attempts: DuplicateAttempt[];
}

/** Carte affichée temporairement à certains joueurs (ou à tous). */
export interface Reveal {
  playerId: PlayerId;
  slot: SlotIndex;
  audience: 'all' | PlayerId[];
  until: number;
  reason: 'initialPeek' | 'peekOwn' | 'peekOther' | 'king' | 'wrongDuplicate';
}

export interface RoundState {
  number: number;
  phase: 'initialPeek' | 'playing' | 'reveal' | 'over';
  deck: Card[];
  /** Dernier élément = dessus de la défausse. */
  discard: Card[];
  /** Joueur dont c'est RÉELLEMENT le tour (jamais affiché sauf option). */
  turnPlayerId: PlayerId;
  step: TurnStep;
  tamalou: { callerId: PlayerId; remaining: PlayerId[] } | null;
  duplicateWindow: DuplicateWindow | null;
  reveals: Reveal[];
  /** Fin de la phase en cours (vue initiale 5 s, révélation finale). */
  phaseEndsAt: number | null;
  /** Dernier tour terminé alors qu'une fenêtre de doublon était ouverte : on finit après sa résolution. */
  endPending: boolean;
  result: RoundResult | null;
}

export interface RoundResult {
  round: number;
  callerId: PlayerId | null;
  scores: Record<PlayerId, number>;
  hands: Record<PlayerId, (Card | null)[]>;
  winnerIds: PlayerId[];
  callerWon: boolean;
  totals: Record<PlayerId, number>;
}

export interface EngineState {
  options: GameOptions;
  /** Ordre des sièges, sens horaire. */
  players: EnginePlayer[];
  dealerIndex: number;
  round: RoundState | null;
  roundsPlayed: number;
  gameOver: boolean;
  gameWinnerIds: PlayerId[];
  seq: number;
}

/** Sortie de chaque appel au moteur : ce que le serveur doit diffuser. */
export interface EngineOutput {
  fx: GameFx[];
  /** Entrées de journal, déjà filtrées par destinataire. */
  logs: { to: 'all' | PlayerId[]; text: string }[];
  /** Messages système à publier dans le tchat. */
  system: string[];
}

/** Horloge et hasard injectés. */
export interface EngineDeps {
  random: () => number;
}
