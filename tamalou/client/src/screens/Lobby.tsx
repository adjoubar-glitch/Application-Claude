import { useState } from 'react';
import { MAX_PLAYERS, type BotLevel, type ClientView, type GameOptions } from '@tamalou/shared';
import { api, leaveRoom, toast } from '../net/store';
import { Avatar, BotBadge } from '../ui/Avatar';
import { RulesModal } from '../game/Rules';

const LEVEL_LABEL: Record<BotLevel, string> = { easy: 'Facile', medium: 'Moyen', expert: 'Expert' };

export function Lobby({ view }: { view: ClientView }) {
  const me = view.players.find((p) => p.id === view.you);
  const isHost = !!me?.isHost;
  const humans = view.players.filter((p) => !p.isBot).length;
  const full = view.players.length >= MAX_PLAYERS;
  const [askBots, setAskBots] = useState(false);
  const [rules, setRules] = useState(false);
  const [botLevel, setBotLevel] = useState<BotLevel>('medium');

  const link = `${location.origin}/?salon=${view.roomCode}`;
  const share = async () => {
    const data = { title: 'Tamalou', text: `Viens jouer au Tamalou ! Salon ${view.roomCode} 🐒🍌`, url: link };
    try {
      if (navigator.share) return await navigator.share(data);
    } catch {
      return; // partage annulé
    }
    try {
      await navigator.clipboard.writeText(link);
      toast('Lien copié : colle-le à tes amis !');
    } catch {
      toast(link);
    }
  };

  const start = async () => {
    if (humans < 4 && !full && !askBots) return setAskBots(true);
    setAskBots(false);
    await api.start();
  };

  const fillWithBots = async () => {
    const missing = Math.max(1, 4 - view.players.length);
    for (let i = 0; i < missing; i++) await api.addBot({ level: botLevel });
    setAskBots(false);
  };

  const setOpt = (patch: Partial<GameOptions>) => void api.setOptions({ options: { ...view.options, ...patch } });
  const o = view.options;

  return (
    <main className="felt flex min-h-full flex-col items-center gap-5 px-4 pb-10" style={{ paddingTop: 'calc(var(--safe-top) + 16px)' }}>
      <header className="flex w-full max-w-md items-center justify-between">
        <button className="btn btn-ghost px-3 py-1.5 text-base" onClick={leaveRoom}>
          ← Quitter
        </button>
        <button className="btn btn-ghost px-3 py-1.5 text-base" onClick={() => setRules(true)}>
          📜 Règles
        </button>
      </header>

      <section className="flex flex-col items-center gap-2">
        <span className="text-sm font-bold uppercase tracking-widest text-cream/70">Code du salon</span>
        <div className="flex gap-2">
          {view.roomCode.split('').map((ch, i) => (
            <span key={i} className="grid h-16 w-14 place-items-center rounded-2xl border-[3px] border-ink bg-banana font-display text-4xl text-ink shadow-toy">
              {ch}
            </span>
          ))}
        </div>
        <button className="btn btn-red mt-2" onClick={share}>
          📣 Inviter des amis
        </button>
      </section>

      <section className="panel w-full max-w-md p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-2xl">La tribu</h2>
          <span className="font-bold text-ink/60">
            {view.players.length}/{MAX_PLAYERS} joueurs
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {view.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-ink/5 px-2 py-1.5">
              <Avatar index={p.avatar} size={42} dim={!p.connected} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 truncate font-display text-lg">
                  {p.name}
                  {p.isHost && <span title="Hôte">👑</span>}
                  {p.isBot && <BotBadge />}
                  {p.id === view.you && <span className="text-sm font-bold text-ink/50">(toi)</span>}
                </span>
                {!p.connected && !p.isBot && <span className="text-xs font-bold text-hibiscus">déconnecté</span>}
              </div>
              {p.isBot &&
                (isHost ? (
                  <>
                    <select
                      className="rounded-xl border-2 border-ink bg-cream px-2 py-1 font-bold"
                      value={p.botLevel}
                      onChange={(e) => void api.setBotLevel({ playerId: p.id, level: e.target.value as BotLevel })}
                      aria-label={`Niveau de ${p.name}`}
                    >
                      {(['easy', 'medium', 'expert'] as const).map((l) => (
                        <option key={l} value={l}>
                          {LEVEL_LABEL[l]}
                        </option>
                      ))}
                    </select>
                    <button className="grid h-9 w-9 place-items-center rounded-xl border-2 border-ink bg-hibiscus font-black text-cream" onClick={() => void api.removeBot({ playerId: p.id })} aria-label={`Retirer ${p.name}`}>
                      ✕
                    </button>
                  </>
                ) : (
                  <span className="text-sm font-bold text-ink/60">{LEVEL_LABEL[p.botLevel ?? 'medium']}</span>
                ))}
            </li>
          ))}
        </ul>
        {isHost && !full && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-bold">Ajouter un bot :</span>
            {(['easy', 'medium', 'expert'] as const).map((l) => (
              <button key={l} className="btn btn-lagoon px-3 py-1.5 text-base" onClick={() => void api.addBot({ level: l })}>
                + {LEVEL_LABEL[l]}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel w-full max-w-md p-4">
        <h2 className="mb-3 font-display text-2xl">Options {isHost ? '' : <span className="text-base text-ink/50">(choisies par l'hôte)</span>}</h2>
        <fieldset disabled={!isHost} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-bold">Seuil pour gagner son Tamalou</span>
            <div className="flex gap-2">
              {[
                [5, 'Classique (5)'],
                [7, 'Gabo (7)'],
              ].map(([v, label]) => (
                <button key={v} className={`btn flex-1 px-2 text-base ${o.tamalouThreshold === v ? 'btn-banana' : 'btn-cream'}`} onClick={() => setOpt({ tamalouThreshold: v as number })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-bold">Durée de la partie</span>
            <div className="grid grid-cols-3 gap-2">
              <button className={`btn px-2 text-base ${o.endCondition.kind === 'single' ? 'btn-banana' : 'btn-cream'}`} onClick={() => setOpt({ endCondition: { kind: 'single' } })}>
                1 manche
              </button>
              <button className={`btn px-2 text-base ${o.endCondition.kind === 'points' ? 'btn-banana' : 'btn-cream'}`} onClick={() => setOpt({ endCondition: { kind: 'points', limit: 100 } })}>
                En points
              </button>
              <button className={`btn px-2 text-base ${o.endCondition.kind === 'rounds' ? 'btn-banana' : 'btn-cream'}`} onClick={() => setOpt({ endCondition: { kind: 'rounds', count: 5 } })}>
                En manches
              </button>
            </div>
            {o.endCondition.kind === 'points' && (
              <label className="flex items-center gap-2 font-bold">
                Fin à
                <input
                  id="limit"
                  type="number"
                  min={10}
                  max={1000}
                  step={10}
                  className="field w-24 py-1.5"
                  value={o.endCondition.limit}
                  onChange={(e) => setOpt({ endCondition: { kind: 'points', limit: Math.max(10, Math.min(1000, Number(e.target.value) || 100)) } })}
                />
                points (le plus bas total gagne)
              </label>
            )}
            {o.endCondition.kind === 'rounds' && (
              <label className="flex items-center gap-2 font-bold">
                <input
                  id="rounds"
                  type="number"
                  min={1}
                  max={50}
                  className="field w-20 py-1.5"
                  value={o.endCondition.count}
                  onChange={(e) => setOpt({ endCondition: { kind: 'rounds', count: Math.max(1, Math.min(50, Number(e.target.value) || 5)) } })}
                />
                manches, score cumulé
              </label>
            )}
          </div>
          <label className="flex items-center justify-between gap-3 font-bold">
            Afficher à qui c'est le tour
            <input id="active" type="checkbox" className="h-6 w-6 accent-jungle-500" checked={o.showActivePlayer} onChange={(e) => setOpt({ showActivePlayer: e.target.checked })} />
          </label>
        </fieldset>
      </section>

      {isHost ? (
        <button className="btn btn-banana w-full max-w-md py-4 text-3xl" onClick={start}>
          🐒 Lancer la partie
        </button>
      ) : (
        <p className="font-display text-xl text-cream/80">En attente de l'hôte…</p>
      )}

      {askBots && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-jungle-950/70 p-3 sm:items-center" onClick={() => setAskBots(false)}>
          <div className="panel pop-in w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ajouter des bots">
            <h2 className="font-display text-3xl">Ajouter des bots ?</h2>
            <p className="mt-1 font-bold text-ink/70">
              Vous êtes {humans} humain{humans > 1 ? 's' : ''}. Le Tamalou est plus drôle à 4 et plus : des singes IA peuvent compléter la table.
            </p>
            <div className="my-3 flex gap-2">
              {(['easy', 'medium', 'expert'] as const).map((l) => (
                <button key={l} className={`btn flex-1 px-2 text-base ${botLevel === l ? 'btn-lagoon' : 'btn-cream'}`} onClick={() => setBotLevel(l)}>
                  {LEVEL_LABEL[l]}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <button className="btn btn-banana" onClick={fillWithBots}>
                {view.players.length < 4 ? "Compléter jusqu'à 4 joueurs" : 'Ajouter un bot de plus'}
              </button>
              <button className="btn btn-cream" onClick={start} disabled={view.players.length < 2}>
                {view.players.length < 2 ? 'Il faut au moins 2 joueurs' : 'Lancer quand même'}
              </button>
            </div>
          </div>
        </div>
      )}
      {rules && <RulesModal onClose={() => setRules(false)} />}
    </main>
  );
}
