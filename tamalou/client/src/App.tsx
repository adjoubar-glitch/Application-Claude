import { useApp } from './net/store';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Game } from './screens/Game';
import { Admin } from './screens/Admin';
import { EffectLayer } from './fx/EffectLayer';

function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ bottom: 'calc(var(--safe-bottom) + 64px)' }} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pop-in max-w-sm rounded-2xl border-[3px] border-ink bg-ink px-4 py-2 text-center text-sm font-bold text-cream shadow-toy">
          {t.text}
        </div>
      ))}
    </div>
  );
}

function ConnectionBadge() {
  const connected = useApp((s) => s.connected);
  const inGame = useApp((s) => !!s.session);
  if (connected || !inGame) return null;
  return (
    <div className="fixed left-1/2 z-[70] -translate-x-1/2 rounded-full border-2 border-ink bg-banana px-3 py-1 text-xs font-black text-ink shadow-toy-sm" style={{ top: 'calc(var(--safe-top) + 6px)' }}>
      🐒 Reconnexion…
    </div>
  );
}

export function App() {
  const view = useApp((s) => s.view);
  const session = useApp((s) => s.session);
  const resuming = useApp((s) => s.resuming);

  if (location.pathname.startsWith('/admin')) {
    return (
      <>
        <Admin />
        <Toasts />
      </>
    );
  }

  let screen;
  if (session && view && view.roomCode === session.roomCode) screen = view.phase === 'lobby' ? <Lobby view={view} /> : <Game view={view} />;
  else if (session && resuming) screen = <Splash />;
  else screen = <Home />;

  return (
    <>
      {screen}
      <EffectLayer />
      <Toasts />
      <ConnectionBadge />
    </>
  );
}

function Splash() {
  return (
    <main className="felt flex h-full flex-col items-center justify-center gap-3">
      <p className="animate-bounce font-display text-5xl text-banana [text-shadow:0_4px_0_#1B2A21]">Tamalou</p>
      <p className="font-bold text-cream/70">Retour dans la jungle…</p>
    </main>
  );
}
