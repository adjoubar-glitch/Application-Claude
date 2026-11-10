import { useMemo, useState } from 'react';
import { createRoom, joinRoom, savedName } from '../net/store';
import { Avatar } from '../ui/Avatar';
import { RulesModal } from '../game/Rules';
import { banana } from '../art/art';

export function Home() {
  const invited = useMemo(() => new URLSearchParams(location.search).get('salon')?.toUpperCase().slice(0, 4) ?? '', []);
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(invited);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rules, setRules] = useState(false);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError('');
    if (!name.trim()) return setError('Choisis un pseudo, petit singe !');
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Oups');
    else if (invited) history.replaceState(null, '', '/');
  };

  return (
    <main className="felt flex min-h-full flex-col items-center justify-center gap-6 px-4 pb-8" style={{ paddingTop: 'calc(var(--safe-top) + 24px)' }}>
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-end gap-1">
          <Avatar index={0} size={74} mood="grin" />
          <Avatar index={1} size={58} />
          <Avatar index={2} size={66} />
        </div>
        <h1 className="relative font-display text-6xl text-banana [text-shadow:0_5px_0_#1B2A21]">
          Tamalou
          <svg className="absolute -right-10 -top-3 w-14 rotate-12" viewBox="-10 -25 80 60" dangerouslySetInnerHTML={{ __html: banana(true) }} />
        </h1>
        <p className="max-w-xs text-center font-bold text-cream/80">Le jeu de cartes où le plus malin des singes finit avec le moins de points.</p>
      </div>

      <div className="panel flex w-full max-w-sm flex-col gap-4 p-5">
        <label className="flex flex-col gap-1.5">
          <span className="font-display text-lg">Ton pseudo</span>
          <input
            id="pseudo"
            className="field"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Sami"
            autoComplete="nickname"
            autoFocus={!!invited}
          />
        </label>

        {invited ? (
          <button className="btn btn-red w-full py-3.5 text-2xl" disabled={busy} onClick={() => run(() => joinRoom(code, name.trim()))}>
            Rejoindre le salon {code}
          </button>
        ) : (
          <>
            <button className="btn btn-banana w-full py-3.5 text-2xl" disabled={busy} onClick={() => run(() => createRoom(name.trim()))}>
              Créer une partie
            </button>
            <div className="flex items-center gap-2 text-sm font-bold text-ink/50">
              <span className="h-[2px] flex-1 bg-ink/15" /> ou rejoins des amis <span className="h-[2px] flex-1 bg-ink/15" />
            </div>
            <div className="flex gap-2">
              <input
                id="code"
                className="field w-0 flex-1 text-center font-display text-2xl uppercase tracking-[0.3em]"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                placeholder="CODE"
                inputMode="text"
                autoCapitalize="characters"
              />
              <button className="btn btn-green" disabled={busy || code.length !== 4} onClick={() => run(() => joinRoom(code, name.trim()))}>
                Rejoindre
              </button>
            </div>
          </>
        )}
        {error && <p className="rounded-xl bg-hibiscus/15 px-3 py-2 text-center font-bold text-hibiscus">{error}</p>}
      </div>

      <button className="btn btn-ghost" onClick={() => setRules(true)}>
        📜 Les règles
      </button>
      {rules && <RulesModal onClose={() => setRules(false)} />}
    </main>
  );
}
