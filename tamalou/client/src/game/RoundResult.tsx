import type { ClientView } from '@tamalou/shared';
import { api } from '../net/store';
import { Avatar } from '../ui/Avatar';
import { Card } from '../ui/Card';
import { rowsOf } from './Opponents';

/** Révélation animée de toutes les cartes, puis scores. */
export function RoundResult({ view }: { view: ClientView }) {
  const r = view.lastRound;
  if (!r) return null;
  const revealing = view.phase === 'roundReveal';
  const isHost = view.players.find((p) => p.id === view.you)?.isHost;
  const multi = view.options.endCondition.kind !== 'single';
  const caller = view.players.find((p) => p.id === r.callerId);
  const ranking = [...view.players].sort((a, b) => (multi ? (r.totals[a.id] ?? 0) - (r.totals[b.id] ?? 0) : (r.scores[a.id] ?? 0) - (r.scores[b.id] ?? 0)));
  const over = view.phase === 'gameOver';
  const best = Math.min(...view.players.map((p) => r.totals[p.id] ?? 0));
  const gameWinners = view.players.filter((p) => (r.totals[p.id] ?? 0) === best);

  let delay = 0;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-jungle-950/70 p-2 sm:items-center">
      <div className="panel pop-in max-h-[92dvh] w-full max-w-lg overflow-y-auto p-4">
        <h2 className="text-center font-display text-3xl text-hibiscus">{over ? '👑 Fin de partie !' : `Manche ${r.round}`}</h2>
        {caller && (
          <p className="mb-2 text-center font-bold">
            {caller.name} a annoncé Tamalou… {revealing ? 'suspense 🥁' : r.callerWon ? 'et gagne ! 🍌' : 'et se plante ! 🙈'}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {ranking.map((p) => {
            const hand = r.hands[p.id] ?? [];
            const win = r.winnerIds.includes(p.id);
            const slots = hand.map((c, index) => ({ index, c }));
            return (
              <li key={p.id} className={`flex items-center gap-2 rounded-2xl p-2 ${win && !revealing ? 'bg-banana/40 ring-2 ring-banana' : 'bg-ink/5'}`}>
                <div className="flex w-16 shrink-0 flex-col items-center">
                  <Avatar index={p.avatar} size={36} mood={!revealing && win ? 'grin' : undefined} />
                  <span className="w-full truncate text-center text-xs font-black">{p.name}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  {rowsOf(slots).map((row, i) => (
                    <div key={i} className="flex gap-1">
                      {row.map((s) =>
                        s.c ? (
                          <Card key={s.index} card={s.c} flip style={{ width: 34, animationDelay: `${(delay += 0.12)}s` }} />
                        ) : (
                          <div key={s.index} className="slot-empty border-ink/20" style={{ width: 34 }} />
                        ),
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex w-16 shrink-0 flex-col items-end">
                  <span className={`font-display text-3xl ${revealing ? 'opacity-0' : 'pop-in'}`}>{r.scores[p.id]}</span>
                  {multi && !revealing && <span className="text-xs font-bold text-ink/60">total {r.totals[p.id]}</span>}
                  {win && !revealing && <span className="text-xs font-black text-jungle-500">GAGNE</span>}
                </div>
              </li>
            );
          })}
        </ul>
        {over && multi && !revealing && (
          <p className="mt-3 text-center font-display text-2xl">Roi de la jungle : {gameWinners.map((p) => p.name).join(' et ')} 👑</p>
        )}
        {!revealing && (
          <div className="mt-4 flex justify-center">
            {isHost ? (
              over ? (
                <button className="btn btn-banana text-xl" onClick={() => void api.backToLobby()}>
                  Rejouer
                </button>
              ) : (
                <button className="btn btn-banana text-xl" onClick={() => void api.nextRound()}>
                  Manche suivante
                </button>
              )
            ) : (
              <p className="font-bold text-ink/60">{over ? "L'hôte peut relancer une partie." : "En attente de l'hôte pour la manche suivante…"}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
