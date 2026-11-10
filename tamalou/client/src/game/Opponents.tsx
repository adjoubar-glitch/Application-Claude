import type { ClientView, PlayerView } from '@tamalou/shared';
import { Avatar, BotBadge, DealerChip } from '../ui/Avatar';
import { Card } from '../ui/Card';

/** Lignes de la grille, de haut en bas : les rangées de pénalité au-dessus. */
export function rowsOf<T extends { index: number }>(slots: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < slots.length; i += 2) rows.push(slots.slice(i, i + 2));
  // index 0-1 = rangée haute de départ, 2-3 = basse, 4+ = pénalités au-dessus
  const base = [rows[0], rows[1]].filter(Boolean) as T[][];
  const penalties = rows.slice(2).reverse();
  return [...penalties, ...base];
}

export function MiniGrid({ player, size = 15 }: { player: PlayerView; size?: number }) {
  return (
    <div className="flex flex-col gap-[2px]">
      {rowsOf(player.slots).map((row, r) => (
        <div key={r} className="flex gap-[2px]">
          {row.map((s) =>
            s.occupied ? (
              <Card key={s.index} card={s.card} back={!s.card} style={{ width: size }} />
            ) : (
              <div key={s.index} className="slot-empty" style={{ width: size, borderWidth: 1.5 }} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

export function Opponents({ view, bubbles }: { view: ClientView; bubbles: Record<string, { emoji: string; id: number }> }) {
  // Ordre de table en partant du joueur après moi (sens horaire).
  const i = view.players.findIndex((p) => p.id === view.you);
  const others = [...view.players.slice(i + 1), ...view.players.slice(0, Math.max(0, i))];
  return (
    <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-1 px-2">
      {others.map((p) => {
        const active = view.activePlayerId === p.id;
        const caller = view.tamalou?.callerId === p.id;
        const holding = view.held?.playerId === p.id;
        return (
          <div
            key={p.id}
            className={`relative flex min-w-[64px] max-w-[110px] flex-col items-center gap-0.5 rounded-2xl px-1.5 py-1 ${active ? 'bg-banana/25 ring-2 ring-banana' : ''}`}
          >
            <div className="relative">
              <Avatar index={p.avatar} size={38} dim={!p.connected && !p.isBot} />
              {view.dealerId === p.id && (
                <span className="absolute -bottom-1 -left-2">
                  <DealerChip size={20} />
                </span>
              )}
              {bubbles[p.id] && (
                <span key={bubbles[p.id]!.id} className="bubble absolute -top-7 left-1/2 rounded-full border-2 border-ink bg-cream px-1.5 text-xl">
                  {bubbles[p.id]!.emoji}
                </span>
              )}
              {holding && <span className="absolute -right-2 -top-1 text-base" title="a une carte en main">🃏</span>}
            </div>
            <span className="flex max-w-full items-center gap-1 truncate text-xs font-black">
              <span className="truncate">{p.name}</span>
              {p.isBot && <BotBadge />}
              {p.controller === 'standIn' && <span title="Un bot joue à sa place">🤖</span>}
            </span>
            {caller && <span className="rounded-md bg-hibiscus px-1 text-[10px] font-black text-cream">TAMALOU</span>}
            <MiniGrid player={p} />
            <span className="text-[10px] font-bold text-cream/70">{p.cardCount} carte{p.cardCount > 1 ? 's' : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
