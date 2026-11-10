import { useEffect, useRef, useState } from 'react';
import { CHAT_MAX_LENGTH, QUICK_REACTIONS, type ChatMessage, type ClientView } from '@tamalou/shared';
import { api, setChatOpen, useApp } from '../net/store';

function describe(m: ChatMessage, view: ClientView) {
  const who = m.kind === 'system' ? '' : (view.players.find((p) => p.id === m.playerId)?.name ?? '?');
  if (m.kind === 'system') return { who: '', text: m.text, system: true };
  if (m.kind === 'reaction') return { who, text: m.emoji, system: false };
  return { who, text: m.text, system: false };
}

/** Tiroir de tchat : barre fine fermée, 30 % de la hauteur ouvert. */
export function ChatDrawer({ view }: { view: ClientView }) {
  const chat = useApp((s) => s.chat);
  const open = useApp((s) => s.chatOpen);
  const unread = useApp((s) => s.unread);
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const last = [...chat].reverse().find((m) => m.kind !== 'reaction');

  useEffect(() => {
    if (open) list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, chat.length]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const r = await api.chat({ text: t });
    if (r.ok) setText('');
  };

  return (
    // La barre fermée reste dans la mise en page ; ouvert, le tiroir passe PAR-DESSUS la partie (30 % max).
    <div className="relative z-20 h-11 shrink-0 border-t-[3px] border-ink bg-jungle-950/95" style={{ boxSizing: 'content-box', paddingBottom: 'var(--safe-bottom)' }}>
      {!open ? (
        <div className="flex h-11 items-center gap-2 px-2">
          <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setChatOpen(true)} aria-label="Ouvrir le tchat">
            <span className="text-lg">💬</span>
            <span className="truncate text-sm font-bold text-cream/80">
              {last ? (() => {
                const d = describe(last, view);
                return d.system ? d.text : `${d.who} : ${d.text}`;
              })() : 'Tchat de la jungle'}
            </span>
            {unread > 0 && <span className="rounded-full bg-hibiscus px-2 text-xs font-black text-cream">{unread}</span>}
          </button>
          <div className="flex gap-0.5">
            {QUICK_REACTIONS.map((e) => (
              <button key={e} className="h-9 w-8 rounded-lg text-xl active:scale-90" onClick={() => void api.react({ emoji: e })} aria-label={`Réagir ${e}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="slide-up absolute inset-x-0 bottom-0 flex max-h-[30dvh] flex-col rounded-t-2xl border-t-[3px] border-ink bg-jungle-950/95 shadow-[0_-6px_20px_rgba(0,0,0,.35)]"
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          <div className="flex items-center justify-between px-3 pt-1.5">
            <span className="font-display text-cream">Tchat</span>
            <button className="px-2 py-1 font-black text-cream/80" onClick={() => setChatOpen(false)} aria-label="Fermer le tchat">
              ▾ Fermer
            </button>
          </div>
          <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-3 text-sm">
            {chat.map((m) => {
              const d = describe(m, view);
              return d.system ? (
                <p key={m.id} className="my-0.5 text-center text-xs font-bold text-banana/90">
                  {d.text}
                </p>
              ) : (
                <p key={m.id} className="my-0.5 break-words">
                  <b className="text-turquoise">{d.who}</b> <span className={m.kind === 'reaction' ? 'text-lg' : ''}>{d.text}</span>
                </p>
              );
            })}
          </div>
          <div className="flex gap-1 px-2 py-1">
            {QUICK_REACTIONS.map((e) => (
              <button key={e} className="h-9 flex-1 rounded-lg bg-cream/10 text-xl active:scale-90" onClick={() => void api.react({ emoji: e })}>
                {e}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 px-2 pb-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              id="chat-input"
              className="field min-w-0 flex-1 py-2 text-base"
              value={text}
              maxLength={CHAT_MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              placeholder="Chambre tes amis…"
              enterKeyHint="send"
            />
            <button type="submit" className="btn btn-banana px-3 text-base">
              Envoyer
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
