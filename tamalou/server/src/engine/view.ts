// Construit la vue d'UN joueur à partir de l'état complet.
// C'est le seul chemin par lequel une valeur de carte quitte le serveur.

import type { ClientView, Controller, LogEntry, PlayerId, PlayerView, RoomPhase, SlotView } from '@tamalou/shared';
import type { TamalouEngine } from './engine.js';

export interface ViewMeta {
  roomCode: string;
  hostId: PlayerId;
  controllers: Record<PlayerId, Controller>;
  connected: Record<PlayerId, boolean>;
  log: LogEntry[];
}

export function buildView(engine: TamalouEngine, viewer: PlayerId, now: number, meta: ViewMeta): ClientView {
  const s = engine.state;
  const r = s.round;
  const showAll = r?.phase === 'reveal' || r?.phase === 'over';

  const phase: RoomPhase = !r
    ? 'lobby'
    : r.phase === 'initialPeek'
      ? 'initialPeek'
      : r.phase === 'playing'
        ? 'playing'
        : r.phase === 'reveal'
          ? 'roundReveal'
          : s.gameOver
            ? 'gameOver'
            : 'roundOver';

  const players: PlayerView[] = s.players.map((p) => {
    const slots: SlotView[] = p.slots.map((card, index) => {
      const v: SlotView = { index, occupied: card !== null };
      if (!card || !r) return v;
      if (showAll) {
        v.card = card;
        return v;
      }
      const reveal = r.reveals.find(
        (x) =>
          x.playerId === p.id &&
          x.slot === index &&
          x.until > now &&
          (x.audience === 'all' || x.audience.includes(viewer)),
      );
      if (reveal) {
        v.card = card;
        if (Number.isFinite(reveal.until)) v.revealUntil = reveal.until;
      }
      // Seul l'auteur voit quelle carte il a tentée ; les autres voient "Tentative en cours…".
      if (p.id === viewer && r.duplicateWindow?.attempts.some((a) => a.playerId === viewer && a.slot === index)) {
        v.pendingDuplicate = true;
      }
      return v;
    });
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      ...(p.botLevel ? { botLevel: p.botLevel } : {}),
      controller: meta.controllers[p.id] ?? (p.isBot ? 'bot' : 'human'),
      connected: meta.connected[p.id] ?? p.isBot,
      isHost: p.id === meta.hostId,
      slots,
      cardCount: engine.cardCount(p),
      totalScore: p.totalScore,
    };
  });

  let held: ClientView['held'] = null;
  let pendingPower: ClientView['pendingPower'] = null;
  if (r && r.phase === 'playing') {
    const step = r.step;
    if (step.kind === 'holding') {
      held = { playerId: r.turnPlayerId, source: step.source };
      if (r.turnPlayerId === viewer || step.source === 'discard') held.card = step.card;
    } else if (step.kind === 'power') {
      pendingPower = { playerId: r.turnPlayerId, power: step.power, stage: 'choose' };
    } else if (step.kind === 'kingDecide') {
      pendingPower = { playerId: r.turnPlayerId, power: 'peekAndSwap', stage: 'decide' };
      if (r.turnPlayerId === viewer) {
        const card = engine.player(step.target).slots[step.slot] ?? undefined;
        pendingPower.peeked = { target: step.target, slot: step.slot, ...(card ? { card } : {}) };
      }
    }
  }

  const top = r?.discard[r.discard.length - 1] ?? null;

  return {
    roomCode: meta.roomCode,
    you: viewer,
    phase,
    options: s.options,
    players,
    dealerId: s.players[s.dealerIndex]?.id ?? null,
    activePlayerId: r && r.phase === 'playing' && s.options.showActivePlayer ? r.turnPlayerId : null,
    round: r?.number ?? 0,
    deckCount: r?.deck.length ?? 0,
    discardTop: top,
    discardCount: r?.discard.length ?? 0,
    held,
    pendingPower,
    duplicatePending: r?.duplicateWindow ? { closesAt: r.duplicateWindow.closesAt } : null,
    tamalou: r?.tamalou ? { callerId: r.tamalou.callerId, remainingTurns: r.tamalou.remaining.length } : null,
    lastRound: r?.result ?? null,
    log: meta.log,
    serverNow: now,
  };
}
