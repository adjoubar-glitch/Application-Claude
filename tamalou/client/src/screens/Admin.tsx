// Espace Admin (/admin) : sons, images de cartes, animations et paramétrage des effets.
// Tout est rangé dans le dossier "Tamaloo" de Google Drive par le serveur.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ASSET_RULES,
  BUILTIN_ANIMATIONS,
  BUILTIN_SOUNDS,
  DEFAULT_EFFECTS,
  EFFECT_EVENTS,
  RANKS,
  SUITS,
  type AssetKind,
  type AssetManifest,
  type BuiltinSound,
  type EffectCell,
  type EffectEvent,
  type EffectRole,
  type EffectsConfig,
  type MediaRef,
  type Card as CardT,
  type Rank,
  type Suit,
} from '@tamalou/shared';
import { playSound, resetSounds, unlockAudio, vibrate } from '../audio/sound';
import { loadAssets, toast, useApp } from '../net/store';
import { Card } from '../ui/Card';
import { Media, shakeScreen } from '../fx/EffectLayer';

const TOKEN_KEY = 'tamalou.admin';
const SOUND_HINT: Record<BuiltinSound, string> = {
  'monkey-laugh': 'Singe moqueur (mauvais tour, pour le pénalisé)',
  'jungle-yell': 'Cri de jungle (mauvais tour, pour les autres)',
  'fail-jingle': 'Jingle d’échec (mauvais doublon)',
  'gorilla-slow': 'Gorille (doublon trop lent)',
  'duplicate-win': 'Doublon réussi',
  'spy-whistle': 'Sifflet d’espion (regarder une carte)',
  'swap-swoosh': 'Échange de cartes',
  'king-roar': 'Rugissement du Roi noir',
  draw: 'Piocher',
  discard: 'Défausser',
  tamalou: 'Annonce Tamalou',
  'round-win': 'Fin de manche',
};
const ROLE_LABEL: Record<EffectRole, string> = { actor: 'Celui qui joue', victim: 'La victime', others: 'Les autres' };
const VIBRATIONS: { label: string; value: number[] | null }[] = [
  { label: 'Aucune', value: null },
  { label: 'Courte', value: [150] },
  { label: 'Double', value: [200, 80, 200] },
  { label: 'Longue', value: [400, 100, 400] },
];
const SUIT_FR = { hearts: 'Cœur', diamonds: 'Carreau', clubs: 'Trèfle', spades: 'Pique' } as const;

type Tab = 'effects' | 'sounds' | 'cards' | 'animations';

function useToken() {
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const save = (t: string) => {
    setToken(t);
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* rien */
    }
  };
  return [token, save] as const;
}

export function Admin() {
  const [token, setToken] = useToken();
  const [tab, setTab] = useState<Tab>('effects');
  const manifest = useApp((s) => s.assets);

  useEffect(() => {
    void loadAssets();
  }, []);

  const call = async (method: string, url: string, body?: unknown): Promise<AssetManifest | null> => {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({ ok: false, error: 'Erreur serveur' }))) as { ok: boolean; error?: string; manifest?: AssetManifest };
    if (res.status === 401) setToken('');
    if (!data.ok) {
      toast(data.error ?? 'Erreur');
      return null;
    }
    resetSounds();
    await loadAssets();
    return data.manifest ?? null;
  };

  const upload = async (kind: AssetKind, file: File): Promise<string | null> => {
    const res = await fetch('/api/admin/files', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-asset-kind': kind, 'x-file-name': encodeURIComponent(file.name), 'content-type': 'application/octet-stream' },
      body: file,
    });
    const data = (await res.json().catch(() => ({ ok: false, error: 'Erreur serveur' }))) as { ok: boolean; error?: string; file?: { id: string } };
    if (res.status === 401) setToken('');
    if (!data.ok) {
      toast(`${file.name} : ${data.error}`);
      return null;
    }
    await loadAssets();
    return data.file!.id;
  };

  if (!token) return <Login onToken={setToken} />;

  return (
    <main className="felt min-h-full px-3 pb-16" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }} onPointerDown={unlockAudio}>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-4xl text-banana [text-shadow:0_4px_0_#1B2A21]">Admin Tamalou</h1>
          <div className="flex gap-2">
            <a className="btn btn-ghost px-3 py-1.5 text-base" href="/">
              ← Jeu
            </a>
            <button className="btn btn-ghost px-3 py-1.5 text-base" onClick={() => setToken('')}>
              Déconnexion
            </button>
          </div>
        </header>
        <p className="text-sm font-bold text-cream/70">Tout ce que tu charges ici est rangé dans le dossier « Tamaloo » de ton Google Drive, et appliqué tout de suite sur les téléphones.</p>
        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ['effects', '🎬 Effets'],
              ['sounds', '🔊 Sons'],
              ['cards', '🃏 Cartes'],
              ['animations', '🐒 Animations'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} className={`btn px-2 text-base ${tab === t ? 'btn-banana' : 'btn-cream'}`} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === 'effects' && <EffectsTab manifest={manifest} call={call} />}
        {tab === 'sounds' && <SoundsTab manifest={manifest} call={call} upload={upload} />}
        {tab === 'cards' && <CardsTab manifest={manifest} call={call} upload={upload} />}
        {tab === 'animations' && <AnimationsTab manifest={manifest} call={call} upload={upload} />}
      </div>
    </main>
  );
}

type Call = (method: string, url: string, body?: unknown) => Promise<AssetManifest | null>;
type Upload = (kind: AssetKind, file: File) => Promise<string | null>;

function Login({ onToken }: { onToken: (t: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    const data = (await res.json().catch(() => ({ ok: false, error: 'Serveur injoignable' }))) as { ok: boolean; token?: string; error?: string };
    if (data.ok && data.token) onToken(data.token);
    else setError(data.error ?? 'Erreur');
  };
  return (
    <main className="felt flex min-h-full items-center justify-center p-4">
      <form className="panel flex w-full max-w-sm flex-col gap-3 p-5" onSubmit={submit}>
        <h1 className="font-display text-3xl">Admin Tamalou</h1>
        <label className="flex flex-col gap-1 font-bold">
          Mot de passe
          <input id="admin-password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
        </label>
        {error && <p className="font-bold text-hibiscus">{error}</p>}
        <button className="btn btn-banana" type="submit">
          Entrer
        </button>
        <a className="text-center text-sm font-bold text-ink/60 underline" href="/">
          Retour au jeu
        </a>
      </form>
    </main>
  );
}

function FileButton({ accept, multiple, onFiles, children, className = 'btn-lagoon' }: { accept: string; multiple?: boolean; onFiles: (f: File[]) => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={`btn px-3 py-1.5 text-base ${className}`} onClick={() => ref.current?.click()}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

const accept = (k: AssetKind) => ASSET_RULES[k].extensions.map((e) => `.${e}`).join(',');

// ---------------------------------------------------------------------------
// Sons
// ---------------------------------------------------------------------------
function SoundsTab({ manifest, call, upload }: { manifest: AssetManifest; call: Call; upload: Upload }) {
  return (
    <section className="panel flex flex-col gap-2 p-4">
      <h2 className="font-display text-2xl">Sons</h2>
      <p className="text-sm font-bold text-ink/60">mp3, ogg, wav ou m4a, 3 Mo maximum. Le son chargé remplace le son d'origine partout où il est utilisé.</p>
      <ul className="flex flex-col gap-2">
        {BUILTIN_SOUNDS.map((name) => {
          const override = manifest.soundOverrides[name];
          const file = manifest.files.find((f) => f.id === override);
          return (
            <li key={name} className="flex flex-wrap items-center gap-2 rounded-2xl bg-ink/5 p-2">
              <button className="btn btn-banana h-10 w-10 px-0" onClick={() => void playSound(name)} aria-label={`Écouter ${name}`}>
                ▶
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-display">{name}</p>
                <p className="text-xs font-bold text-ink/60">{SOUND_HINT[name]}</p>
                {file && <p className="truncate text-xs font-black text-jungle-500">Personnalisé : {file.name}</p>}
              </div>
              <FileButton
                accept={accept('sound')}
                onFiles={async ([f]) => {
                  const id = await upload('sound', f!);
                  if (id) await call('PUT', '/api/admin/sounds', { name, fileId: id });
                }}
              >
                Remplacer
              </FileButton>
              {override && (
                <button className="btn btn-cream px-3 py-1.5 text-base" onClick={() => void call('PUT', '/api/admin/sounds', { name, fileId: null })}>
                  D'origine
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cartes
// ---------------------------------------------------------------------------
const CARD_RE = /^(?:(hearts|diamonds|clubs|spades)-(1[0-3]|[1-9])|back)\.[a-z]+$/i;

function CardsTab({ manifest, call, upload }: { manifest: AssetManifest; call: Call; upload: Upload }) {
  const [busy, setBusy] = useState(false);
  const bulk = async (files: File[]) => {
    setBusy(true);
    let done = 0;
    for (const f of files) {
      if (!CARD_RE.test(f.name)) {
        toast(`${f.name} : nom non reconnu (ex. hearts-1.png, spades-13.png, back.png)`);
        continue;
      }
      const key = f.name.replace(/\.[a-z]+$/i, '').toLowerCase();
      const id = await upload('cardImage', f);
      if (id && (await call('PUT', '/api/admin/cards', { key, fileId: id }))) done++;
    }
    setBusy(false);
    toast(`${done} carte(s) mise(s) à jour`);
  };
  const keys = useMemo(() => ['back', ...SUITS.flatMap((s) => RANKS.map((r) => `${s}-${r}`))], []);
  return (
    <section className="panel flex flex-col gap-3 p-4">
      <h2 className="font-display text-2xl">Cartes</h2>
      <p className="text-sm font-bold text-ink/60">
        png, jpg, webp ou svg, 2 Mo maximum, format portrait 5×7 conseillé. Touche une carte pour la remplacer. Pour en charger plusieurs d'un coup, nomme les fichiers
        <code className="mx-1 rounded bg-ink/10 px-1">hearts-1.png</code>…<code className="mx-1 rounded bg-ink/10 px-1">spades-13.png</code>et
        <code className="mx-1 rounded bg-ink/10 px-1">back.png</code>(1 = As, 11 = Valet, 12 = Dame, 13 = Roi).
      </p>
      <div>
        <FileButton accept={accept('cardImage')} multiple onFiles={bulk}>
          {busy ? 'Envoi…' : 'Charger plusieurs cartes'}
        </FileButton>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {keys.map((key) => {
          const [suit, rank] = key.split('-') as [keyof typeof SUIT_FR, string];
          const custom = manifest.cards[key as keyof typeof manifest.cards];
          return (
            <CardSlot
              key={key}
              label={key === 'back' ? 'Dos' : `${rank === '1' ? 'A' : rank === '11' ? 'V' : rank === '12' ? 'D' : rank === '13' ? 'R' : rank} ${SUIT_FR[suit]}`}
              card={key === 'back' ? null : { id: key, suit: suit as Suit, rank: Number(rank) as Rank }}
              custom={!!custom}
              onFile={async (f) => {
                const id = await upload('cardImage', f);
                if (id) await call('PUT', '/api/admin/cards', { key, fileId: id });
              }}
              onReset={() => void call('PUT', '/api/admin/cards', { key, fileId: null })}
            />
          );
        })}
      </div>
    </section>
  );
}

function CardSlot({ label, card, custom, onFile, onReset }: { label: string; card: CardT | null; custom: boolean; onFile: (f: File) => void; onReset: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-1">
      <Card card={card} back={!card} onClick={() => ref.current?.click()} style={{ width: '100%' }} label={`Remplacer ${label}`} />
      <span className="text-center text-[11px] font-black leading-tight">{label}</span>
      {custom && (
        <button className="text-[11px] font-bold text-hibiscus underline" onClick={onReset}>
          d'origine
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept('cardImage')}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------
function AnimationsTab({ manifest, call, upload }: { manifest: AssetManifest; call: Call; upload: Upload }) {
  const mine = manifest.files.filter((f) => f.kind === 'animation');
  return (
    <section className="panel flex flex-col gap-3 p-4">
      <h2 className="font-display text-2xl">Animations</h2>
      <p className="text-sm font-bold text-ink/60">
        GIF, WebP ou PNG animé, vidéo courte WebM (fond transparent) ou MP4, ou animation Lottie (.json). 5 Mo maximum. Une fois chargée, choisis-la dans l'onglet Effets.
      </p>
      <div>
        <FileButton accept={accept('animation')} multiple onFiles={async (files) => {
          for (const f of files) await upload('animation', f);
        }}>
          Charger des animations
        </FileButton>
      </div>
      {mine.length > 0 && (
        <>
          <h3 className="font-display text-xl">Tes animations</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {mine.map((f) => (
              <div key={f.id} className="flex flex-col items-center gap-1 rounded-2xl bg-jungle-900 p-2">
                <Media refm={{ kind: 'file', fileId: f.id }} className="aspect-[10/9] w-full" />
                <span className="w-full truncate text-center text-xs font-bold text-cream">{f.name}</span>
                <button className="text-xs font-bold text-hibiscus underline" onClick={() => void call('DELETE', `/api/admin/files/${f.id}`)}>
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <h3 className="font-display text-xl">Animations intégrées</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(BUILTIN_ANIMATIONS)
          .filter(([id]) => id !== 'none')
          .map(([id, label]) => (
            <div key={id} className="flex flex-col items-center gap-1 rounded-2xl bg-jungle-900 p-2">
              <Media refm={{ kind: 'builtin', id }} className="aspect-[10/9] w-full" />
              <span className="text-center text-xs font-bold text-cream">{label}</span>
            </div>
          ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Effets
// ---------------------------------------------------------------------------
const refKey = (r: MediaRef) => (!r ? 'none:' : r.kind === 'builtin' ? `builtin:${r.id}` : `file:${r.fileId}`);
const parseRef = (k: string): MediaRef => {
  const [kind, id] = k.split(':') as [string, string];
  if (kind === 'builtin') return { kind: 'builtin', id };
  if (kind === 'file') return { kind: 'file', fileId: id };
  return null;
};

function EffectsTab({ manifest, call }: { manifest: AssetManifest; call: Call }) {
  const [draft, setDraft] = useState<EffectsConfig>(manifest.effects);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<{ cell: EffectCell; key: number } | null>(null);
  useEffect(() => {
    if (!dirty) setDraft(manifest.effects);
  }, [manifest.effects, dirty]);

  const sounds = manifest.files.filter((f) => f.kind === 'sound');
  const anims = manifest.files.filter((f) => f.kind === 'animation');
  const update = (event: EffectEvent, role: EffectRole, patch: Partial<EffectCell>) => {
    setDirty(true);
    setDraft((d) => ({ ...d, [event]: { ...d[event], [role]: { ...d[event][role]!, ...patch } } }));
  };
  const test = (cell: EffectCell) => {
    void playSound(cell.sound);
    vibrate(cell.vibrate);
    if (cell.shake) shakeScreen();
    setPreview({ cell, key: Date.now() });
  };
  const save = async () => {
    if (await call('PUT', '/api/admin/effects', { effects: draft })) {
      setDirty(false);
      toast('Effets enregistrés 🍌');
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="panel sticky z-10 flex flex-wrap items-center gap-2 p-3" style={{ top: 'calc(var(--safe-top) + 8px)' }}>
        <p className="min-w-0 flex-1 text-sm font-bold">Pour chaque situation et chaque rôle : son, animation, texte. [PSEUDO] = celui qui agit, [CIBLE] = la victime.</p>
        <button className="btn btn-banana" disabled={!dirty} onClick={save}>
          Enregistrer
        </button>
      </div>
      {(Object.keys(EFFECT_EVENTS) as EffectEvent[]).map((event) => (
        <details key={event} className="panel p-3" open={event === 'wrongTurn'}>
          <summary className="cursor-pointer font-display text-xl">{EFFECT_EVENTS[event].label}</summary>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {(EFFECT_EVENTS[event].roles as readonly EffectRole[]).map((role) => {
              const cell = draft[event][role]!;
              return (
                <div key={role} className="flex flex-col gap-2 rounded-2xl bg-ink/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg">{ROLE_LABEL[role]}</span>
                    <div className="flex gap-1">
                      <button className="btn btn-lagoon px-2 py-1 text-sm" onClick={() => test(cell)}>
                        Tester
                      </button>
                      <button
                        className="btn btn-cream px-2 py-1 text-sm"
                        onClick={() => {
                          setDirty(true);
                          setDraft((d) => ({ ...d, [event]: { ...d[event], [role]: DEFAULT_EFFECTS[event][role] } }));
                        }}
                      >
                        Par défaut
                      </button>
                    </div>
                  </div>
                  <label className="flex flex-col gap-0.5 text-sm font-bold">
                    Son
                    <select className="field py-1.5 text-base" value={refKey(cell.sound)} onChange={(e) => update(event, role, { sound: parseRef(e.target.value) })}>
                      <option value="none:">Aucun</option>
                      <optgroup label="Sons intégrés">
                        {BUILTIN_SOUNDS.map((s) => (
                          <option key={s} value={`builtin:${s}`}>
                            {s}
                          </option>
                        ))}
                      </optgroup>
                      {sounds.length > 0 && (
                        <optgroup label="Tes sons">
                          {sounds.map((f) => (
                            <option key={f.id} value={`file:${f.id}`}>
                              {f.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5 text-sm font-bold">
                    Animation
                    <select className="field py-1.5 text-base" value={refKey(cell.animation)} onChange={(e) => update(event, role, { animation: parseRef(e.target.value) })}>
                      <optgroup label="Animations intégrées">
                        {Object.entries(BUILTIN_ANIMATIONS).map(([id, label]) => (
                          <option key={id} value={`builtin:${id}`}>
                            {label}
                          </option>
                        ))}
                      </optgroup>
                      {anims.length > 0 && (
                        <optgroup label="Tes animations">
                          {anims.map((f) => (
                            <option key={f.id} value={`file:${f.id}`}>
                              {f.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5 text-sm font-bold">
                    Texte
                    <input className="field py-1.5 text-base" maxLength={140} value={cell.text} onChange={(e) => update(event, role, { text: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-0.5 text-sm font-bold">
                      Durée (s)
                      <input
                        type="number"
                        min={0.8}
                        max={8}
                        step={0.5}
                        className="field py-1.5 text-base"
                        value={cell.durationMs / 1000}
                        onChange={(e) => update(event, role, { durationMs: Math.round(Number(e.target.value) * 1000) || 2500 })}
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-sm font-bold">
                      Vibration
                      <select
                        className="field py-1.5 text-base"
                        value={VIBRATIONS.findIndex((v) => JSON.stringify(v.value) === JSON.stringify(cell.vibrate))}
                        onChange={(e) => update(event, role, { vibrate: VIBRATIONS[Number(e.target.value)]?.value ?? null })}
                      >
                        {VIBRATIONS.map((v, i) => (
                          <option key={v.label} value={i}>
                            {v.label}
                          </option>
                        ))}
                        {VIBRATIONS.every((v) => JSON.stringify(v.value) !== JSON.stringify(cell.vibrate)) && <option value={-1}>Personnalisée</option>}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm font-bold">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="h-5 w-5 accent-jungle-500" checked={cell.fullscreen} onChange={(e) => update(event, role, { fullscreen: e.target.checked })} />
                      Plein écran
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="h-5 w-5 accent-jungle-500" checked={cell.shake} onChange={(e) => update(event, role, { shake: e.target.checked })} />
                      Secousse
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-jungle-950/80 p-6" onClick={() => setPreview(null)} key={preview.key}>
          <div className="pop-in flex w-full max-w-sm flex-col items-center gap-3">
            <Media refm={preview.cell.animation} className="aspect-[10/9] w-full" />
            <p className="text-center font-display text-3xl text-banana [text-shadow:0_3px_0_#1B2A21]">
              {preview.cell.text.replaceAll('[PSEUDO]', 'Sami').replaceAll('[CIBLE]', 'Lina')}
            </p>
            <span className="text-xs font-bold text-cream/60">Aperçu — touche pour fermer</span>
          </div>
        </div>
      )}
    </section>
  );
}
