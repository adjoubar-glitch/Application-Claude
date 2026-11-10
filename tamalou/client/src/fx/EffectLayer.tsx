// Pop-ups, animations, sons et vibrations déclenchés par les effets de jeu.
// Le rôle (auteur / victime / les autres) et le paramétrage viennent de l'Admin (effects).

import { useEffect, useRef, useState } from 'react';
import { effectFor, type EffectCell, type GameFx, type MediaRef, type PlayerView } from '@tamalou/shared';
import { playSound, vibrate } from '../audio/sound';
import { getState, onFx, useApp } from '../net/store';
import { sceneSvg } from './scenes';

interface Popup {
  id: number;
  cell: EffectCell;
  text: string;
  /** Joueur mis en avant, pour l'avatar du bandeau. */
}

let popupId = 0;
const BLOCKING_MS = 2500;

function names(players: PlayerView[], ids: string[]): string {
  const n = ids.map((id) => players.find((p) => p.id === id)?.name ?? '?');
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} et ${n.at(-1)}`;
}

/** Sons de base, indépendants du paramétrage. */
function baseSound(fx: GameFx) {
  if (fx.type === 'draw') void playSound('draw', 0.7);
  else if (fx.type === 'discard') void playSound('discard', 0.8);
  else if (fx.type === 'reshuffle') void playSound('swap-swoosh', 0.7);
}

export function shakeScreen() {
  const el = document.getElementById('root');
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 650);
}

export function EffectLayer() {
  const [popups, setPopups] = useState<Popup[]>([]);

  useEffect(
    () =>
      onFx((fx) => {
        const { view, assets } = getState();
        if (!view) return;
        baseSound(fx);
        const e = effectFor(fx, view.you);
        if (!e) return;
        const cell = assets.effects[e.event]?.[e.role];
        if (!cell) return;
        const text = cell.text
          .replaceAll('[PSEUDO]', names(view.players, e.actorIds ?? [e.actorId]))
          .replaceAll('[CIBLE]', e.targetId ? names(view.players, [e.targetId]) : '');
        void playSound(cell.sound);
        vibrate(cell.vibrate);
        if (cell.shake) shakeScreen();
        if (!text && (!cell.animation || (cell.animation.kind === 'builtin' && cell.animation.id === 'none'))) return;
        const p: Popup = { id: ++popupId, cell, text };
        // Une seule pop-up plein écran à la fois : la nouvelle remplace l'ancienne.
        setPopups((list) => [...list.filter((x) => !(x.cell.fullscreen && cell.fullscreen)).slice(-2), p]);
        setTimeout(() => setPopups((list) => list.filter((x) => x.id !== p.id)), Math.max(1200, cell.durationMs));
      }),
    [],
  );

  const close = (id: number) => setPopups((list) => list.filter((x) => x.id !== id));
  const full = popups.filter((p) => p.cell.fullscreen);
  const banners = popups.filter((p) => !p.cell.fullscreen);

  return (
    <>
      {full.map((p) => (
        <FullPopup key={p.id} popup={p} onClose={() => close(p.id)} />
      ))}
      <div className="pointer-events-none fixed inset-x-0 z-40 flex flex-col items-center gap-2 px-3" style={{ top: 'calc(var(--safe-top) + 56px)' }}>
        {banners.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => close(p.id)}
            className="slide-down pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border-[3px] border-ink bg-cream px-3 py-2 text-left text-ink shadow-toy"
          >
            <Media refm={p.cell.animation} className="h-12 w-14 shrink-0" />
            <span className="font-display text-base leading-tight">{p.text}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function FullPopup({ popup, onClose }: { popup: Popup; onClose: () => void }) {
  // Bloquante 2,5 s au plus, puis elle laisse passer les taps ; fermable d'un tap à tout moment.
  const [blocking, setBlocking] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBlocking(false), BLOCKING_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-jungle-950/75 px-6 backdrop-blur-[2px] ${blocking ? '' : 'pointer-events-none'}`}
      onClick={onClose}
      role="alert"
    >
      <div className="pop-in pointer-events-auto flex w-full max-w-sm flex-col items-center gap-3" onClick={onClose}>
        <Media refm={popup.cell.animation} className="aspect-[10/9] w-full" />
        {popup.text && (
          <p className="text-center font-display text-3xl leading-tight text-banana [text-shadow:0_3px_0_#1B2A21] [text-wrap:balance]">{popup.text}</p>
        )}
        <span className="text-xs font-bold text-cream/60">Touche pour fermer</span>
      </div>
    </div>
  );
}

/** Animation intégrée (SVG) ou fichier de l'Admin : image animée, vidéo ou Lottie. */
export function Media({ refm, className = '' }: { refm: MediaRef; className?: string }) {
  const files = useApp((s) => s.assets.files);
  if (!refm) return null;
  if (refm.kind === 'builtin') {
    const svg = sceneSvg(refm.id);
    return svg ? <div className={`scene svg-fill ${className}`} dangerouslySetInnerHTML={{ __html: svg }} /> : null;
  }
  const f = files.find((x) => x.id === refm.fileId);
  if (!f) return null;
  if (f.mime.startsWith('video/')) return <video className={`${className} object-contain`} src={f.url} autoPlay muted loop playsInline />;
  if (f.mime === 'application/json' || f.name.endsWith('.json')) return <Lottie url={f.url} className={className} />;
  return <img className={`${className} object-contain`} src={f.url} alt="" />;
}

function Lottie({ url, className }: { url: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let anim: { destroy(): void } | null = null;
    let cancelled = false;
    void import('lottie-web').then(({ default: lottie }) => {
      if (cancelled || !ref.current) return;
      anim = lottie.loadAnimation({ container: ref.current, renderer: 'svg', loop: true, autoplay: true, path: url });
    });
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [url]);
  return <div ref={ref} className={className} />;
}
