// Tous les salons, en mémoire (Map). Pas de base de données en V1.

import { Room, type RoomTransport } from './room.js';

/** Sans I ni O, pour éviter les confusions avec 1 et 0 quand on dicte le code. */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const IDLE_MS = 30 * 60_000;

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(
    private transport: RoomTransport,
    private random: () => number = Math.random,
    /** Appelé à chaque création de salon (branchement des bots, étape 4). */
    private onCreate?: (room: Room) => void,
  ) {}

  create(): Room {
    let code: string;
    do code = Array.from({ length: 4 }, () => LETTERS[Math.floor(this.random() * LETTERS.length)]).join('');
    while (this.rooms.has(code));
    const room = new Room(code, this.transport, this.random);
    this.rooms.set(code, room);
    this.onCreate?.(room);
    return room;
  }

  get(code: unknown): Room | undefined {
    if (typeof code !== 'string') return undefined;
    return this.rooms.get(code.trim().toUpperCase());
  }

  /** Ménage : salons sans humain connecté depuis 30 min. */
  sweep(now = Date.now()): void {
    for (const [code, room] of this.rooms) {
      if (room.isIdle() && now - room.lastActivity > IDLE_MS) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }

  startSweeper(): void {
    this.sweeper ??= setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref?.();
  }

  stop(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    for (const room of this.rooms.values()) room.dispose();
  }
}
