import type { ClientView, SlotIndex } from '@tamalou/shared';
import { Avatar } from '../ui/Avatar';
import { Card } from '../ui/Card';
import { rowsOf } from './Opponents';

/** Choisir une carte adverse (9/10, Valet/Dame, Roi noir). */
export function Picker({
  view,
  title,
  excludeCaller,
  onPick,
  onClose,
}: {
  view: ClientView;
  title: string;
  excludeCaller: boolean;
  onPick: (target: string, slot: SlotIndex) => void;
  onClose: () => void;
}) {
  const others = view.players.filter((p) => p.id !== view.you && p.cardCount > 0);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-jungle-950/60" onClick={onClose}>
      <div className="panel slide-up max-h-[75dvh] w-full max-w-lg overflow-y-auto rounded-b-none p-4 pb-8" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl leading-tight">{title}</h2>
          <button className="btn btn-cream px-3 py-1.5 text-base" onClick={onClose}>
            Retour
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {others.map((p) => {
            const locked = excludeCaller && view.tamalou?.callerId === p.id;
            return (
              <div key={p.id} className={`flex flex-col items-center gap-1.5 rounded-2xl bg-ink/5 p-2 ${locked ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <Avatar index={p.avatar} size={30} />
                  <span className="truncate font-display">{p.name}</span>
                </div>
                {locked && <span className="text-xs font-bold text-hibiscus">Tamalou : intouchable</span>}
                <div className="flex flex-col gap-1">
                  {rowsOf(p.slots).map((row, r) => (
                    <div key={r} className="flex gap-1">
                      {row.map((s) =>
                        s.occupied ? (
                          <Card
                            key={s.index}
                            back
                            target={!locked}
                            style={{ width: 46 }}
                            onClick={locked ? undefined : () => onPick(p.id, s.index)}
                            label={`Carte ${s.index + 1} de ${p.name}`}
                          />
                        ) : (
                          <div key={s.index} className="slot-empty border-ink/20" style={{ width: 46 }} />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
