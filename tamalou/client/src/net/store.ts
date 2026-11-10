// Connexion Socket.IO + état de l'appli, partagés par tous les écrans.
// Reconnexion automatique : le jeton du joueur est gardé en localStorage.

import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  DEFAULT_EFFECTS,
  type AssetManifest,
  type ChatMessage,
  type ClientToServerEvents,
  type ClientView,
  type GameAction,
  type GameFx,
  type GameOptions,
  type QuickReaction,
  type ServerToClientEvents,
  type SessionInfo,
} from '@tamalou/shared';

type S = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface AppState {
  connected: boolean;
  /** Une reprise de session est en cours (au démarrage ou après une coupure). */
  resuming: boolean;
  session: SessionInfo | null;
  view: ClientView | null;
  chat: ChatMessage[];
  unread: number;
  chatOpen: boolean;
  toasts: { id: number; text: string }[];
  assets: AssetManifest;
  /** Décalage horloge serveur - horloge locale (ms). */
  clockSkew: number;
}

const SESSION_KEY = 'tamalou.session';
const NAME_KEY = 'tamalou.name';

const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* stockage indisponible : la reconnexion auto ne marchera pas, le jeu oui */
    }
  },
};

export const emptyManifest: AssetManifest = { version: 0, files: [], cards: {}, soundOverrides: {}, effects: DEFAULT_EFFECTS };

let state: AppState = {
  connected: false,
  resuming: !!store.get<SessionInfo>(SESSION_KEY),
  session: store.get<SessionInfo>(SESSION_KEY),
  view: null,
  chat: [],
  unread: 0,
  chatOpen: false,
  toasts: [],
  assets: emptyManifest,
  clockSkew: 0,
};

const listeners = new Set<() => void>();
const fxListeners = new Set<(fx: GameFx) => void>();
const chatListeners = new Set<(m: ChatMessage) => void>();

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useApp<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => select(state),
  );
}
export const getState = () => state;

export function onFx(cb: (fx: GameFx) => void): () => void {
  fxListeners.add(cb);
  return () => {
    fxListeners.delete(cb);
  };
}
export function onChat(cb: (m: ChatMessage) => void): () => void {
  chatListeners.add(cb);
  return () => {
    chatListeners.delete(cb);
  };
}

// ---------------------------------------------------------------------------
// Socket
// ---------------------------------------------------------------------------

export const socket: S = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 3000 });

function resume() {
  const s = state.session;
  if (!s) return set({ resuming: false });
  set({ resuming: true });
  socket.emit('room:resume', { code: s.roomCode, token: s.token }, (res) => {
    if (res.ok) set({ resuming: false });
    else {
      store.set(SESSION_KEY, null);
      set({ session: null, view: null, chat: [], resuming: false });
    }
  });
}

socket.on('connect', () => {
  set({ connected: true });
  resume();
  void loadAssets();
});
socket.on('disconnect', () => set({ connected: false }));
socket.on('state', (view) => set({ view, clockSkew: view.serverNow - Date.now() }));
socket.on('fx', (fx) => {
  for (const l of fxListeners) l(fx);
});
socket.on('chatHistory', (msgs) => set({ chat: msgs }));
socket.on('chat', (m) => {
  set({ chat: [...state.chat.slice(-99), m], unread: state.chatOpen ? 0 : state.unread + (m.kind === 'reaction' ? 0 : 1) });
  for (const l of chatListeners) l(m);
});
socket.on('toast', ({ text }) => toast(text));
socket.on('assets', () => void loadAssets());

// Retour de veille / changement de réseau : on relance la connexion tout de suite.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
  });
  window.addEventListener('online', () => {
    if (!socket.connected) socket.connect();
  });
}

let toastId = 0;
export function toast(text: string) {
  const id = ++toastId;
  set({ toasts: [...state.toasts, { id, text }] });
  setTimeout(() => set({ toasts: state.toasts.filter((t) => t.id !== id) }), 2800);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Res = { ok: true } | { ok: false; error: string };

function remember(s: SessionInfo) {
  store.set(SESSION_KEY, s);
  set({ session: s });
}

export const savedName = () => store.get<string>(NAME_KEY) ?? '';

export function createRoom(name: string): Promise<Res> {
  store.set(NAME_KEY, name);
  return new Promise((resolve) =>
    socket.emit('room:create', { name }, (res) => {
      if (res.ok) remember(res);
      resolve(res);
    }),
  );
}

export function joinRoom(code: string, name: string): Promise<Res> {
  store.set(NAME_KEY, name);
  return new Promise((resolve) =>
    socket.emit('room:join', { code, name }, (res) => {
      if (res.ok) remember(res);
      resolve(res);
    }),
  );
}

export function leaveRoom() {
  socket.emit('room:leave');
  store.set(SESSION_KEY, null);
  set({ session: null, view: null, chat: [], unread: 0 });
}

type Level = 'easy' | 'medium' | 'expert';

/** Envoie un événement avec accusé de réception ; affiche l'erreur éventuelle. */
function ack(emit: (cb: (r: Res) => void) => void): Promise<Res> {
  return new Promise((resolve) =>
    emit((r) => {
      if (!r.ok) toast(r.error);
      resolve(r);
    }),
  );
}

export const api = {
  addBot: (p: { level: Level }) => ack((cb) => socket.emit('lobby:addBot', p, cb)),
  removeBot: (p: { playerId: string }) => ack((cb) => socket.emit('lobby:removeBot', p, cb)),
  setBotLevel: (p: { playerId: string; level: Level }) => ack((cb) => socket.emit('lobby:setBotLevel', p, cb)),
  setOptions: (p: { options: GameOptions }) => ack((cb) => socket.emit('lobby:setOptions', p, cb)),
  start: () => ack((cb) => socket.emit('lobby:start', cb)),
  nextRound: () => ack((cb) => socket.emit('game:nextRound', cb)),
  backToLobby: () => ack((cb) => socket.emit('game:backToLobby', cb)),
  chat: (p: { text: string }) => ack((cb) => socket.emit('chat:send', p, cb)),
  react: (p: { emoji: QuickReaction }) => ack((cb) => socket.emit('chat:react', p, cb)),
};

/** Action de jeu : pas de toast ici, le serveur envoie le sien si besoin. */
export function play(action: GameAction) {
  socket.emit('game:action', action);
}

export function setChatOpen(open: boolean) {
  set({ chatOpen: open, unread: open ? 0 : state.unread });
}

// ---------------------------------------------------------------------------
// Personnalisation (Admin) : sons, cartes, animations, effets
// ---------------------------------------------------------------------------

export async function loadAssets() {
  try {
    const res = await fetch('/api/assets', { cache: 'no-store' });
    if (!res.ok) return;
    const m = (await res.json()) as AssetManifest;
    set({ assets: { ...m, effects: { ...DEFAULT_EFFECTS, ...m.effects } } });
  } catch {
    /* hors ligne : on garde les ressources intégrées */
  }
}

export const fileUrl = (id: string | undefined) => (id ? state.assets.files.find((f) => f.id === id)?.url : undefined);
