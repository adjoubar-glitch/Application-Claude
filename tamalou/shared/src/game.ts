// Modèle commun client/serveur : options, actions, vues filtrées, effets.
// Le serveur garde l'état complet ; le client ne reçoit QUE ClientView + GameFx.

import type { Card, PowerKind } from './cards.js';

export type PlayerId = string;
export type BotLevel = 'easy' | 'medium' | 'expert';

// ---------------------------------------------------------------------------
// Grille de cartes
// ---------------------------------------------------------------------------
// Positions fixes, 2 cartes par rangée. Index 0-3 = grille de départ 2x2 :
//
//        [4] [5]   <- 1re rangée de pénalité (ouverte au besoin)
//        [0] [1]   <- rangée haute de départ
//        [2] [3]   <- rangée basse de départ (vue 5 s au début)
//
// Les pénalités remplissent la première place libre d'index >= 4,
// sinon ouvrent une nouvelle rangée au-dessus (6-7, 8-9...).
// Une place vidée (doublon réussi) reste vide : les positions ne bougent jamais.
export type SlotIndex = number;
export const BASE_SLOTS = 4;
export const BOTTOM_SLOTS: readonly SlotIndex[] = [2, 3];
export const SLOTS_PER_ROW = 2;

// ---------------------------------------------------------------------------
// Options de l'hôte
// ---------------------------------------------------------------------------
export interface GameOptions {
  /** Seuil d'annonce Tamalou : 5 par défaut, 7 = variante Gabo. */
  tamalouThreshold: number;
  /** Fin de partie : manche unique, au premier qui atteint X points cumulés, ou après N manches. */
  endCondition: { kind: 'single' } | { kind: 'points'; limit: number } | { kind: 'rounds'; count: number };
  /** Afficher le joueur actif (désactivé par défaut : comme à une vraie table). */
  showActivePlayer: boolean;
}

export const DEFAULT_OPTIONS: GameOptions = {
  tamalouThreshold: 5,
  endCondition: { kind: 'single' },
  showActivePlayer: false,
};

export const TIMINGS = {
  initialPeekMs: 5000,
  peekOwnMs: 3000,
  peekOtherMs: 3000,
  duplicateWindowMs: 1500,
  wrongDuplicateRevealMs: 2000,
  finalRevealMs: 4000,
  popupMinMs: 2500,
  botStandInAfterMs: 60_000,
} as const;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

// ---------------------------------------------------------------------------
// Actions envoyées par un joueur (humain ou bot) : le serveur les horodate.
// ---------------------------------------------------------------------------
export type GameAction =
  /** Piocher : la carte arrive en main, visible par le joueur seul. */
  | { type: 'drawFromDeck' }
  /** Prendre la carte du dessus de la défausse (elle devra être échangée). */
  | { type: 'takeDiscard' }
  /** Échanger la carte en main avec une de ses cartes ; l'ancienne part en défausse face visible. */
  | { type: 'swapHeld'; slot: SlotIndex }
  /** Défausser directement la carte piochée (option 3) ; ouvre éventuellement un pouvoir. */
  | { type: 'discardHeld' }
  /** Activer le pouvoir de la carte qui vient d'être défaussée. */
  | { type: 'usePower'; power: PowerUse }
  /** Ne pas utiliser le pouvoir (ou, pour le Roi noir, ne pas échanger après avoir regardé). */
  | { type: 'skipPower' }
  /** Roi noir, 2e temps : échanger la carte regardée avec une de ses cartes. */
  | { type: 'kingSwap'; ownSlot: SlotIndex }
  /** Annonce, en début de son tour. */
  | { type: 'callTamalou' }
  /** Défausse rapide d'un doublon : jouable à tout moment, par tout le monde. */
  | { type: 'duplicate'; slot: SlotIndex };

export type PowerUse =
  | { kind: 'peekOwn'; slot: SlotIndex }
  | { kind: 'peekOther'; target: PlayerId; slot: SlotIndex }
  | { kind: 'blindSwap'; ownSlot: SlotIndex; target: PlayerId; slot: SlotIndex }
  | { kind: 'peekAndSwap'; target: PlayerId; slot: SlotIndex };

// ---------------------------------------------------------------------------
// Vue filtrée envoyée à CHAQUE joueur
// ---------------------------------------------------------------------------
// Règle d'or : une valeur de carte n'apparaît que si ce joueur a le droit de la voir
// à cet instant (défausse, sa carte piochée, révélation temporaire en cours, fin de manche).
// Les cartes en grille ne portent aucun identifiant : impossible de les suivre ou de les deviner.

export interface SlotView {
  index: SlotIndex;
  /** false = place vide (doublon réussi), la position reste dessinée en pointillé. */
  occupied: boolean;
  /** Présent uniquement pendant une révélation autorisée pour ce joueur. */
  card?: Card;
  /** Fin de la révélation (horloge serveur), pour le compte-à-rebours visuel. */
  revealUntil?: number;
  /** Carte en cours de tentative de doublon (indicateur, sans valeur). */
  pendingDuplicate?: boolean;
}

export type Controller = 'human' | 'bot' | 'standIn';

export interface PlayerView {
  id: PlayerId;
  name: string;
  /** Index de l'avatar singe (0..N), distinct par joueur. */
  avatar: number;
  isBot: boolean;
  botLevel?: BotLevel;
  /** 'standIn' = humain déconnecté depuis plus de 60 s, remplacé par un bot Moyen. */
  controller: Controller;
  connected: boolean;
  isHost: boolean;
  slots: SlotView[];
  cardCount: number;
  /** Score cumulé sur les manches précédentes. */
  totalScore: number;
}

export type RoomPhase = 'lobby' | 'initialPeek' | 'playing' | 'roundReveal' | 'roundOver' | 'gameOver';

export interface HeldView {
  playerId: PlayerId;
  source: 'deck' | 'discard';
  /** Visible par le détenteur ; visible par tous si elle vient de la défausse (tout le monde l'a vue). */
  card?: Card;
}

export interface PendingPowerView {
  playerId: PlayerId;
  power: PowerKind;
  /** Roi noir : 'decide' après avoir regardé la carte adverse. */
  stage: 'choose' | 'decide';
  /** Roi noir, carte regardée (pour le joueur concerné uniquement). */
  peeked?: { target: PlayerId; slot: SlotIndex; card?: Card };
}

export interface RoundResultView {
  round: number;
  callerId: PlayerId | null;
  /** Points de la manche par joueur, et toutes les cartes révélées. */
  scores: Record<PlayerId, number>;
  hands: Record<PlayerId, (Card | null)[]>;
  winnerIds: PlayerId[];
  callerWon: boolean;
  totals: Record<PlayerId, number>;
}

export interface LogEntry {
  id: number;
  at: number;
  /** Texte déjà personnalisé pour CE joueur ("Sami a regardé une de tes cartes"). */
  text: string;
}

export interface ClientView {
  roomCode: string;
  you: PlayerId;
  phase: RoomPhase;
  options: GameOptions;
  /** Ordre des sièges (sens horaire). */
  players: PlayerView[];
  dealerId: PlayerId | null;
  /** null sauf si l'option showActivePlayer est activée. */
  activePlayerId: PlayerId | null;
  round: number;
  deckCount: number;
  discardTop: Card | null;
  discardCount: number;
  held: HeldView | null;
  pendingPower: PendingPowerView | null;
  /** Une fenêtre de doublon est ouverte : "Tentative en cours…" pour tous. */
  duplicatePending: { closesAt: number } | null;
  tamalou: { callerId: PlayerId; remainingTurns: number } | null;
  lastRound: RoundResultView | null;
  log: LogEntry[];
  /** Horloge serveur, pour caler les compte-à-rebours côté client. */
  serverNow: number;
}

// ---------------------------------------------------------------------------
// Effets ponctuels (pop-ups, sons, animations) : envoyés en plus de la vue.
// ---------------------------------------------------------------------------
export type PenaltyKind = 'wrongTurn' | 'wrongDuplicate';

export type GameFx =
  | { type: 'penalty'; kind: 'wrongTurn'; playerId: PlayerId }
  | { type: 'penalty'; kind: 'wrongDuplicate'; playerIds: PlayerId[] }
  | { type: 'duplicateSuccess'; playerId: PlayerId; slot: SlotIndex; card: Card }
  /** Vrais doublons mais pas les plus rapides : pop-up Gorille "Tu feras mieux la prochaine fois", pour eux seuls. */
  | { type: 'duplicateTooSlow'; playerIds: PlayerId[]; winnerId: PlayerId }
  | { type: 'draw'; playerId: PlayerId; source: 'deck' | 'discard' }
  /** slot présent quand la carte vient de la grille (échange) : tout le monde voit d'où elle part. */
  | { type: 'discard'; playerId: PlayerId; card: Card; slot?: SlotIndex }
  /** Échange par pouvoir : a = celui qui joue le pouvoir, b = la victime. */
  | { type: 'swap'; power: 'blindSwap' | 'peekAndSwap'; a: { playerId: PlayerId; slot: SlotIndex }; b: { playerId: PlayerId; slot: SlotIndex }; blind: boolean }
  | { type: 'peek'; power: PowerKind; byPlayerId: PlayerId; target: { playerId: PlayerId; slot: SlotIndex } }
  | { type: 'tamalou'; playerId: PlayerId }
  | { type: 'reshuffle' }
  | { type: 'roundStart'; round: number; dealerId: PlayerId }
  | { type: 'roundEnd'; result: RoundResultView }
  | { type: 'gameOver'; winnerIds: PlayerId[] };

// ---------------------------------------------------------------------------
// Tchat
// ---------------------------------------------------------------------------
export const QUICK_REACTIONS = ['😂', '🐒', '🍌', '😱', '👏'] as const;
export type QuickReaction = (typeof QUICK_REACTIONS)[number];
export const CHAT_MAX_LENGTH = 200;
export const CHAT_MIN_INTERVAL_MS = 1000;

export type ChatMessage =
  | { id: number; at: number; kind: 'user'; playerId: PlayerId; text: string }
  | { id: number; at: number; kind: 'reaction'; playerId: PlayerId; emoji: QuickReaction }
  | { id: number; at: number; kind: 'system'; text: string };
