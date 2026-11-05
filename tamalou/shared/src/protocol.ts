// Protocole Socket.IO typé (utilisé par le serveur ET le client).

import type {
  BotLevel,
  ChatMessage,
  ClientView,
  GameAction,
  GameFx,
  GameOptions,
  PlayerId,
  QuickReaction,
} from './game.js';

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface SessionInfo {
  roomCode: string;
  playerId: PlayerId;
  /** Jeton secret stocké en localStorage pour la reconnexion automatique. */
  token: string;
}

export interface ClientToServerEvents {
  'room:create': (p: { name: string }, ack: Ack<SessionInfo>) => void;
  'room:join': (p: { code: string; name: string }, ack: Ack<SessionInfo>) => void;
  'room:resume': (p: { code: string; token: string }, ack: Ack<SessionInfo>) => void;
  'room:leave': () => void;

  'lobby:addBot': (p: { level: BotLevel }, ack: Ack) => void;
  'lobby:removeBot': (p: { playerId: PlayerId }, ack: Ack) => void;
  'lobby:setBotLevel': (p: { playerId: PlayerId; level: BotLevel }, ack: Ack) => void;
  'lobby:setOptions': (p: { options: GameOptions }, ack: Ack) => void;
  'lobby:start': (ack: Ack) => void;
  'game:nextRound': (ack: Ack) => void;
  'game:backToLobby': (ack: Ack) => void;

  /** Action de jeu. Aucun ack métier : le résultat arrive via 'state' et 'fx'. */
  'game:action': (action: GameAction, ack?: Ack) => void;

  'chat:send': (p: { text: string }, ack: Ack) => void;
  'chat:react': (p: { emoji: QuickReaction }, ack: Ack) => void;
}

export interface ServerToClientEvents {
  /** Vue filtrée complète, renvoyée après chaque changement. */
  state: (view: ClientView) => void;
  /** Effet ponctuel : pop-up, son, animation. */
  fx: (fx: GameFx) => void;
  chat: (msg: ChatMessage) => void;
  chatHistory: (msgs: ChatMessage[]) => void;
  /** Erreur non bloquante ("Attends la fin de la tentative de doublon"). */
  toast: (p: { text: string }) => void;
}
