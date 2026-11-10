// Branche les bots sur un salon : un cerveau par bot (et par humain absent depuis 60 s).
// Les bots reçoivent exactement ce qu'un téléphone recevrait, via room.taps.

import type { BotLevel, PlayerId } from '@tamalou/shared';
import type { Member, Room } from '../rooms/room.js';
import { BotBrain } from './brain.js';

export class BotHost {
  readonly brains = new Map<PlayerId, BotBrain>();

  constructor(
    private room: Room,
    private random: () => number = Math.random,
  ) {
    room.taps.push((id, event, payload) => this.brains.get(id)?.receive(event, payload));
    const prev = room.hooks;
    room.hooks = {
      onUpdate: (r) => {
        prev.onUpdate?.(r);
        this.sync();
      },
      onStandInDue: (r, m) => {
        prev.onStandInDue?.(r, m);
        this.takeOver(m);
      },
      onReturn: (r, m) => {
        prev.onReturn?.(r, m);
        this.release(m.id);
      },
    };
  }

  /** Crée les cerveaux des bots quand une partie tourne ; les retire au retour au lobby. */
  sync(): void {
    if (this.room.inLobby) {
      for (const id of [...this.brains.keys()]) this.release(id);
      return;
    }
    for (const m of this.room.members) {
      if (m.isBot && !this.brains.has(m.id)) this.spawn(m.id, m.botLevel ?? 'medium');
    }
  }

  /** Un bot Moyen prend la place d'un humain absent. */
  takeOver(m: Member): void {
    if (this.brains.has(m.id) || this.room.inLobby) return;
    this.spawn(m.id, 'medium');
  }

  release(id: PlayerId): void {
    this.brains.get(id)?.dispose();
    this.brains.delete(id);
  }

  dispose(): void {
    for (const id of [...this.brains.keys()]) this.release(id);
  }

  private spawn(id: PlayerId, level: BotLevel): void {
    const room = this.room;
    const brain = new BotBrain(
      id,
      level,
      {
        act: (action) => room.act(id, action),
        react: (emoji) => void room.react(id, emoji),
        turnOf: () => {
          const r = room.engine?.state.round;
          return r && r.phase === 'playing' ? r.turnPlayerId : null;
        },
      },
      this.random,
    );
    this.brains.set(id, brain);
    // Il a raté la diffusion en cours : on lui donne sa vue tout de suite.
    queueMicrotask(() => brain.receive('state', room.viewFor(id)));
  }
}
