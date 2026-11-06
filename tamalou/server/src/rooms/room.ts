// Un salon : membres, lobby, partie en cours, diffusion des vues filtrées.
// Indépendant de Socket.IO : il parle à un `RoomTransport`, ce qui permet de le
// tester sans réseau et de brancher les bots comme des destinataires ordinaires.

import { randomBytes } from 'node:crypto';
import {
  DEFAULT_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TIMINGS,
  type BotLevel,
  type ChatMessage,
  type ClientView,
  type Controller,
  type GameAction,
  type GameOptions,
  type LogEntry,
  type PlayerId,
  type ServerToClientEvents,
} from '@tamalou/shared';
import { TamalouEngine, type ApplyResult } from '../engine/engine.js';
import type { EngineOutput } from '../engine/state.js';
import { buildView } from '../engine/view.js';

export interface RoomTransport {
  deliver<E extends keyof ServerToClientEvents>(
    code: string,
    playerId: PlayerId,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void;
}

export interface Member {
  id: PlayerId;
  /** Secret de reconnexion, jamais diffusé aux autres. */
  token: string;
  name: string;
  avatar: number;
  isBot: boolean;
  botLevel?: BotLevel;
  /** Nombre de connexions ouvertes (plusieurs onglets possibles). */
  sockets: number;
  disconnectedAt: number | null;
  /** Humain absent depuis plus de 60 s, remplacé par un bot Moyen. */
  standIn: boolean;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface RoomHooks {
  /** Appelé après chaque changement d'état (les bots s'y branchent à l'étape 4). */
  onUpdate?(room: Room): void;
  /** Humain déconnecté depuis 60 s, en pleine partie. */
  onStandInDue?(room: Room, member: Member): void;
  /** Humain revenu : le remplaçant rend la main. */
  onReturn?(room: Room, member: Member): void;
}

const AVATARS = 12;
const LOG_KEEP = 30;
const CHAT_KEEP = 100;

export const newToken = () => randomBytes(18).toString('base64url');
const newId = () => 'p_' + randomBytes(5).toString('hex');

export class Room {
  readonly members: Member[] = [];
  hostId: PlayerId | null = null;
  options: GameOptions = structuredClone(DEFAULT_OPTIONS);
  engine: TamalouEngine | null = null;
  lastActivity: number;
  readonly chat: ChatMessage[] = [];
  hooks: RoomHooks = {};

  private logs = new Map<PlayerId, LogEntry[]>();
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private standInTimers = new Map<PlayerId, ReturnType<typeof setTimeout>>();

  constructor(
    readonly code: string,
    private transport: RoomTransport,
    private random: () => number = Math.random,
  ) {
    this.lastActivity = Date.now();
  }

  // -------------------------------------------------------------------------
  // Membres
  // -------------------------------------------------------------------------

  get inLobby(): boolean {
    return this.engine === null;
  }

  member(id: PlayerId): Member | undefined {
    return this.members.find((m) => m.id === id);
  }

  humans(): Member[] {
    return this.members.filter((m) => !m.isBot);
  }

  addHuman(rawName: string): Result<{ member: Member }> {
    if (!this.inLobby) return { ok: false, error: 'La partie a déjà commencé' };
    if (this.members.length >= MAX_PLAYERS) return { ok: false, error: 'La table est pleine (6 joueurs maximum)' };
    const member: Member = {
      id: newId(),
      token: newToken(),
      name: this.uniqueName(rawName),
      avatar: this.freeAvatar(),
      isBot: false,
      sockets: 0,
      disconnectedAt: null,
      standIn: false,
    };
    this.members.push(member);
    this.hostId ??= member.id;
    this.touch();
    this.broadcast();
    return { ok: true, member };
  }

  addBot(name: string, level: BotLevel): Result<{ member: Member }> {
    if (!this.inLobby) return { ok: false, error: 'La partie a déjà commencé' };
    if (this.members.length >= MAX_PLAYERS) return { ok: false, error: 'La table est pleine (6 joueurs maximum)' };
    const member: Member = {
      id: newId(),
      token: newToken(),
      name: this.uniqueName(name),
      avatar: this.freeAvatar(),
      isBot: true,
      botLevel: level,
      sockets: 0,
      disconnectedAt: null,
      standIn: false,
    };
    this.members.push(member);
    this.broadcast();
    return { ok: true, member };
  }

  removeMember(id: PlayerId): void {
    const i = this.members.findIndex((m) => m.id === id);
    if (i < 0) return;
    this.members.splice(i, 1);
    this.logs.delete(id);
    if (this.hostId === id) this.hostId = this.humans()[0]?.id ?? null;
    this.broadcast();
  }

  byToken(token: string): Member | undefined {
    return this.members.find((m) => !m.isBot && m.token === token);
  }

  /** Un onglet/téléphone se connecte pour ce joueur. */
  attach(id: PlayerId): void {
    const m = this.member(id);
    if (!m) return;
    m.sockets++;
    const wasAway = m.disconnectedAt !== null;
    m.disconnectedAt = null;
    const t = this.standInTimers.get(id);
    if (t) clearTimeout(t);
    this.standInTimers.delete(id);
    if (m.standIn) {
      m.standIn = false;
      this.hooks.onReturn?.(this, m);
      this.system(`🐒 ${m.name} est de retour et reprend sa place !`);
    } else if (wasAway && !this.inLobby) {
      this.system(`${m.name} est de retour.`);
    }
    this.touch();
    this.sendTo(id);
    this.transport.deliver(this.code, id, 'chatHistory', this.chat.slice(-50));
    this.broadcast();
  }

  /** Un onglet/téléphone se déconnecte (veille, réseau…). */
  detach(id: PlayerId): void {
    const m = this.member(id);
    if (!m) return;
    m.sockets = Math.max(0, m.sockets - 1);
    if (m.sockets > 0) return;
    m.disconnectedAt = Date.now();
    if (!this.inLobby && !m.isBot) {
      this.standInTimers.set(
        id,
        setTimeout(() => {
          this.standInTimers.delete(id);
          if (m.sockets > 0 || this.inLobby) return;
          m.standIn = true;
          this.system(`🤖 ${m.name} a disparu dans la jungle : un bot Moyen tient sa place en attendant.`);
          this.hooks.onStandInDue?.(this, m);
          this.broadcast();
        }, TIMINGS.botStandInAfterMs),
      );
    }
    this.broadcast();
  }

  /** Quitter volontairement : retiré du lobby ; en partie, il devient simplement absent. */
  leave(id: PlayerId): void {
    if (this.inLobby) this.removeMember(id);
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  setOptions(by: PlayerId, options: GameOptions): Result {
    if (by !== this.hostId) return { ok: false, error: "Seul l'hôte peut changer les options" };
    if (!this.inLobby) return { ok: false, error: 'La partie a déjà commencé' };
    this.options = options;
    this.broadcast();
    return { ok: true };
  }

  start(by: PlayerId): Result {
    if (by !== this.hostId) return { ok: false, error: "Seul l'hôte peut lancer la partie" };
    if (!this.inLobby) return { ok: false, error: 'La partie a déjà commencé' };
    if (this.members.length < MIN_PLAYERS) return { ok: false, error: 'Il faut au moins 2 joueurs (ajoute des bots !)' };
    if (this.humans().length < 1) return { ok: false, error: 'Il faut au moins un humain' };
    this.engine = new TamalouEngine(
      this.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, isBot: m.isBot, ...(m.botLevel ? { botLevel: m.botLevel } : {}) })),
      this.options,
      { random: this.random },
    );
    this.logs.clear();
    this.emitOutput(this.engine.startRound(Date.now()));
    this.afterChange();
    return { ok: true };
  }

  nextRound(by: PlayerId): Result {
    const e = this.engine;
    if (by !== this.hostId) return { ok: false, error: "Seul l'hôte lance la manche suivante" };
    if (!e || e.state.round?.phase !== 'over' || e.state.gameOver) return { ok: false, error: 'Pas de manche suivante' };
    this.emitOutput(e.startRound(Date.now()));
    this.afterChange();
    return { ok: true };
  }

  backToLobby(by: PlayerId): Result {
    if (by !== this.hostId) return { ok: false, error: "Seul l'hôte peut revenir au lobby" };
    if (!this.engine?.state.gameOver) return { ok: false, error: "La partie n'est pas terminée" };
    this.stopTimer();
    this.engine = null;
    for (const m of this.members) m.standIn = false;
    this.broadcast();
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Jeu
  // -------------------------------------------------------------------------

  /** Le serveur horodate ICI : c'est lui qui juge qui est le plus rapide. */
  act(playerId: PlayerId, action: GameAction, now = Date.now()): ApplyResult | { ok: false; code: 'notPlaying'; error: string } {
    const e = this.engine;
    if (!e || !this.member(playerId)) return { ok: false, code: 'notPlaying', error: "Aucune partie en cours" };
    const res = e.apply(playerId, action, now);
    this.emitOutput(res.out);
    this.touch();
    this.afterChange();
    return res;
  }

  private tick(): void {
    const e = this.engine;
    if (!e) return;
    this.emitOutput(e.tick(Date.now()));
    this.afterChange();
  }

  private afterChange(): void {
    this.schedule();
    this.broadcast();
    this.hooks.onUpdate?.(this);
  }

  /** Un seul timer, posé sur la prochaine échéance du moteur. */
  private schedule(): void {
    this.stopTimer();
    const at = this.engine?.nextDeadline();
    if (at === null || at === undefined) return;
    this.timer = setTimeout(() => this.tick(), Math.max(0, at - Date.now()));
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.stopTimer();
    for (const t of this.standInTimers.values()) clearTimeout(t);
    this.standInTimers.clear();
  }

  // -------------------------------------------------------------------------
  // Diffusion
  // -------------------------------------------------------------------------

  private emitOutput(out: EngineOutput): void {
    for (const l of out.logs) {
      const entry: LogEntry = { id: ++this.seq, at: Date.now(), text: l.text };
      const targets = l.to === 'all' ? this.members.map((m) => m.id) : l.to;
      for (const id of targets) {
        const list = this.logs.get(id) ?? [];
        list.push(entry);
        if (list.length > LOG_KEEP) list.splice(0, list.length - LOG_KEEP);
        this.logs.set(id, list);
      }
    }
    for (const fx of out.fx) for (const m of this.members) this.transport.deliver(this.code, m.id, 'fx', fx);
    for (const text of out.system) this.system(text, false);
  }

  system(text: string, broadcastState = true): void {
    const msg: ChatMessage = { id: ++this.seq, at: Date.now(), kind: 'system', text };
    this.pushChat(msg);
    if (broadcastState) this.broadcast();
  }

  pushChat(msg: ChatMessage): void {
    this.chat.push(msg);
    if (this.chat.length > CHAT_KEEP) this.chat.splice(0, this.chat.length - CHAT_KEEP);
    for (const m of this.members) this.transport.deliver(this.code, m.id, 'chat', msg);
  }

  nextSeq(): number {
    return ++this.seq;
  }

  broadcast(): void {
    for (const m of this.members) this.sendTo(m.id);
  }

  sendTo(id: PlayerId): void {
    this.transport.deliver(this.code, id, 'state', this.viewFor(id));
  }

  toast(id: PlayerId, text: string): void {
    this.transport.deliver(this.code, id, 'toast', { text });
  }

  viewFor(id: PlayerId, now = Date.now()): ClientView {
    const controllers: Record<PlayerId, Controller> = {};
    const connected: Record<PlayerId, boolean> = {};
    for (const m of this.members) {
      controllers[m.id] = m.isBot ? 'bot' : m.standIn ? 'standIn' : 'human';
      connected[m.id] = m.isBot || m.sockets > 0;
    }
    const log = this.logs.get(id) ?? [];
    if (this.engine) {
      return buildView(this.engine, id, now, { roomCode: this.code, hostId: this.hostId ?? '', controllers, connected, log });
    }
    return {
      roomCode: this.code,
      you: id,
      phase: 'lobby',
      options: this.options,
      players: this.members.map((m) => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        isBot: m.isBot,
        ...(m.botLevel ? { botLevel: m.botLevel } : {}),
        controller: controllers[m.id]!,
        connected: connected[m.id]!,
        isHost: m.id === this.hostId,
        slots: [],
        cardCount: 0,
        totalScore: 0,
      })),
      dealerId: null,
      activePlayerId: null,
      round: 0,
      deckCount: 0,
      discardTop: null,
      discardCount: 0,
      held: null,
      pendingPower: null,
      duplicatePending: null,
      tamalou: null,
      lastRound: null,
      log,
      serverNow: now,
    };
  }

  // -------------------------------------------------------------------------
  // Utilitaires
  // -------------------------------------------------------------------------

  touch(): void {
    this.lastActivity = Date.now();
  }

  /** Personne de connecté (humain) : candidat au ménage. */
  isIdle(): boolean {
    return this.humans().every((m) => m.sockets === 0);
  }

  private uniqueName(raw: string): string {
    const taken = new Set(this.members.map((m) => m.name.toLowerCase()));
    if (!taken.has(raw.toLowerCase())) return raw;
    for (let i = 2; ; i++) {
      const candidate = `${raw.slice(0, 13)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  private freeAvatar(): number {
    const used = new Set(this.members.map((m) => m.avatar));
    const free = Array.from({ length: AVATARS }, (_, i) => i).filter((i) => !used.has(i));
    return free[Math.floor(this.random() * free.length)] ?? 0;
  }
}
