import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClientView, SlotIndex } from '@tamalou/shared';
import { cardPoints } from '@tamalou/shared';
import { isMuted, onMuteChange, setMuted } from '../audio/sound';
import { leaveRoom, play, useApp } from '../net/store';
import { Avatar, DealerChip } from '../ui/Avatar';
import { Card } from '../ui/Card';
import { ChatDrawer } from '../game/ChatDrawer';
import { Opponents, rowsOf } from '../game/Opponents';
import { Picker } from '../game/Picker';
import { RoundResult } from '../game/RoundResult';
import { RulesModal } from '../game/Rules';
import { useBubbles } from '../game/useBubbles';

const POWER_TEXT = {
  peekOwn: '👁️ 7/8 : touche une de tes cartes pour la regarder.',
  peekOther: '🔭 9/10 : choisis une carte adverse à espionner.',
  blindSwap: "🔄 Valet/Dame : touche une de tes cartes, puis une carte adverse.",
  peekAndSwap: '👑 Roi noir : choisis une carte adverse à regarder.',
} as const;

export function Game({ view }: { view: ClientView }) {
  const bubbles = useBubbles();
  const skew = useApp((s) => s.clockSkew);
  const [selected, setSelected] = useState<SlotIndex | null>(null);
  const [picker, setPicker] = useState<null | 'peekOther' | 'blindSwap' | 'peekAndSwap'>(null);
  const [confirmTamalou, setConfirmTamalou] = useState(false);
  const [rules, setRules] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  useEffect(() => onMuteChange(() => setMutedState(isMuted())), []);

  const me = view.players.find((p) => p.id === view.you)!;
  const myHeld = view.held?.playerId === view.you ? view.held : null;
  const myPower = view.pendingPower?.playerId === view.you ? view.pendingPower : null;
  const playing = view.phase === 'playing';
  const iCalled = view.tamalou?.callerId === view.you;

  // Remise à zéro de la sélection quand la situation change.
  const situation = `${view.phase}|${myHeld?.source}|${myPower?.power}|${myPower?.stage}`;
  useEffect(() => {
    setSelected(null);
    setPicker(null);
  }, [situation]);

  // Pouvoir sur carte adverse : on ouvre directement le choix.
  const powerKey = myPower ? `${myPower.power}-${myPower.stage}` : '';
  const opened = useRef('');
  useEffect(() => {
    if (!myPower || opened.current === powerKey) return;
    opened.current = powerKey;
    if (myPower.stage === 'choose' && (myPower.power === 'peekOther' || myPower.power === 'peekAndSwap')) setPicker(myPower.power);
  }, [powerKey, myPower]);

  // Cartes adverses actuellement visibles pour moi (9/10, Roi noir, faux doublon).
  const peeks = useMemo(
    () =>
      view.players
        .filter((p) => p.id !== view.you)
        .flatMap((p) => p.slots.filter((s) => s.card).map((s) => ({ player: p, slot: s }))),
    [view.players, view.you],
  );

  const tapOwn = (slot: SlotIndex) => {
    if (!playing) return;
    if (myPower) {
      if (myPower.power === 'peekOwn' && myPower.stage === 'choose') return play({ type: 'usePower', power: { kind: 'peekOwn', slot } });
      if (myPower.power === 'blindSwap') {
        setSelected(slot);
        return setPicker('blindSwap');
      }
      if (myPower.power === 'peekAndSwap' && myPower.stage === 'decide') return play({ type: 'kingSwap', ownSlot: slot });
      return;
    }
    if (myHeld) return play({ type: 'swapHeld', slot });
    setSelected((s) => (s === slot ? null : slot));
  };

  const tapDeck = () => playing && play({ type: 'drawFromDeck' });
  const tapDiscard = () => {
    if (!playing) return;
    if (myHeld?.source === 'deck') return play({ type: 'discardHeld' });
    play({ type: 'takeDiscard' });
  };

  const pick = (target: string, slot: SlotIndex) => {
    const kind = picker;
    setPicker(null);
    if (kind === 'peekOther') play({ type: 'usePower', power: { kind: 'peekOther', target, slot } });
    else if (kind === 'peekAndSwap') play({ type: 'usePower', power: { kind: 'peekAndSwap', target, slot } });
    else if (kind === 'blindSwap' && selected !== null) play({ type: 'usePower', power: { kind: 'blindSwap', ownSlot: selected, target, slot } });
    setSelected(null);
  };

  const myRows = rowsOf(me.slots);
  const hint = (() => {
    if (view.phase === 'initialPeek') return '👀 Mémorise tes 2 cartes du bas !';
    if (!playing) return '';
    if (iCalled) return '🤞 Tu as annoncé Tamalou : les autres jouent leur dernier tour.';
    if (myPower) {
      if (myPower.stage === 'decide') return '👑 Touche une de tes cartes pour échanger, ou garde tes cartes.';
      if (myPower.power === 'blindSwap' && selected !== null) return 'Maintenant, choisis la carte adverse.';
      return POWER_TEXT[myPower.power];
    }
    if (myHeld) return myHeld.source === 'deck' ? 'Touche une de tes cartes pour échanger, ou la défausse pour jeter.' : 'Touche une de tes cartes pour échanger.';
    if (selected !== null) return 'Doublon ? Confirme avec le bouton.';
    return '';
  })();

  const lastLog = view.log.at(-1);
  const peekCountdown = view.phase === 'initialPeek' ? me.slots.find((s) => s.revealUntil)?.revealUntil : undefined;

  return (
    <div className="felt flex h-full flex-col overflow-hidden" style={{ paddingTop: 'var(--safe-top)' }}>
      {/* En-tête */}
      <header className="flex h-12 shrink-0 items-center gap-2 px-2">
        <button className="btn btn-ghost px-2.5 py-1.5 text-sm" onClick={() => setMenu((m) => !m)} aria-label="Menu">
          ☰ <span className="tracking-widest">{view.roomCode}</span>
        </button>
        <span className="text-xs font-bold text-cream/70">Manche {view.round}</span>
        <div className="flex-1" />
        <button className="btn btn-ghost px-2.5 py-1.5 text-sm" onClick={() => setRules(true)}>
          📜 Règles
        </button>
        <button className="btn btn-ghost h-9 w-10 px-0 text-lg" onClick={() => setMuted(!muted)} aria-label={muted ? 'Activer le son' : 'Couper le son'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </header>
      {menu && (
        <div className="absolute left-2 top-[calc(var(--safe-top)+48px)] z-30 flex flex-col gap-2 rounded-2xl border-[3px] border-ink bg-cream p-2 shadow-toy">
          <button
            className="btn btn-red text-base"
            onClick={() => {
              setMenu(false);
              leaveRoom();
            }}
          >
            Quitter la partie
          </button>
          <button className="btn btn-cream text-base" onClick={() => setMenu(false)}>
            Annuler
          </button>
        </div>
      )}

      {/* Adversaires */}
      <section className="shrink-0 pt-1">
        <Opponents view={view} bubbles={bubbles} />
      </section>

      {/* Centre : pioche, défausse, carte en main */}
      <section className="flex shrink-0 flex-col items-center gap-1 py-1">
        <div className="flex items-end justify-center gap-3">
          <div className="flex flex-col items-center gap-0.5">
            <Card back onClick={tapDeck} style={{ width: 'min(17vw, 84px)' }} label={`Pioche, ${view.deckCount} cartes`} />
            <span className="text-[11px] font-bold text-cream/70">Pioche · {view.deckCount}</span>
          </div>
          <div className="relative flex flex-col items-center gap-0.5">
            {view.discardTop ? (
              <Card key={view.discardTop.id} card={view.discardTop} flip onClick={tapDiscard} style={{ width: 'min(17vw, 84px)' }} label="Défausse" target={myHeld?.source === 'deck'} />
            ) : (
              <div className="slot-empty" style={{ width: 'min(17vw, 84px)' }} />
            )}
            <span className="text-[11px] font-bold text-cream/70">Défausse</span>
            {view.duplicatePending && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 animate-pulse whitespace-nowrap rounded-full border-2 border-ink bg-banana px-2 text-[11px] font-black text-ink">
                Tentative en cours…
              </span>
            )}
          </div>
          {view.held && (
            <div className="pop-in flex flex-col items-center gap-0.5">
              <Card card={view.held.card} back={!view.held.card} style={{ width: 'min(20vw, 98px)' }} className={myHeld ? 'selected' : ''} />
              <span className="max-w-[100px] truncate text-[11px] font-bold text-banana">
                {myHeld ? 'Ta carte' : `${view.players.find((p) => p.id === view.held!.playerId)?.name} joue`}
              </span>
            </div>
          )}
          {peeks.length > 0 && !view.held && (
            <div className="pop-in flex flex-col items-center gap-0.5">
              <Card card={peeks[0]!.slot.card} revealUntil={peeks[0]!.slot.revealUntil} style={{ width: 'min(20vw, 98px)' }} />
              <span className="max-w-[100px] truncate text-[11px] font-bold text-banana">Carte de {peeks[0]!.player.name}</span>
            </div>
          )}
        </div>
        {myPower?.stage === 'decide' && myPower.peeked?.card && (
          <p className="text-center text-sm font-bold text-banana">
            Carte de {view.players.find((p) => p.id === myPower.peeked!.target)?.name} : {cardPoints(myPower.peeked.card)} pt
          </p>
        )}
      </section>

      {/* Consigne + boutons d'action */}
      <section className="flex min-h-[44px] shrink-0 flex-wrap items-center justify-center gap-2 px-3">
        {peekCountdown && <Countdown until={peekCountdown} skew={skew} />}
        {hint && <p className="text-center text-sm font-black text-cream [text-wrap:balance]">{hint}</p>}
        {myPower && (
          <>
            {myPower.stage === 'choose' && (myPower.power === 'peekOther' || myPower.power === 'peekAndSwap') && (
              <button className="btn btn-lagoon px-3 py-1.5 text-base" onClick={() => setPicker(myPower.power as 'peekOther' | 'peekAndSwap')}>
                Choisir
              </button>
            )}
            <button className="btn btn-cream px-3 py-1.5 text-base" onClick={() => play({ type: 'skipPower' })}>
              {myPower.stage === 'decide' ? 'Garder mes cartes' : 'Passer'}
            </button>
          </>
        )}
        {selected !== null && !myPower && !myHeld && playing && (
          <button
            className="btn btn-red pop-in px-5 text-2xl"
            onClick={() => {
              play({ type: 'duplicate', slot: selected });
              setSelected(null);
            }}
          >
            Doublon !
          </button>
        )}
      </section>

      {/* Ma grille */}
      <section className="flex min-h-0 flex-1 flex-col items-center gap-1 px-2 pb-1">
        <div className="flex w-full max-w-md items-center gap-2">
          <div className="relative">
            <Avatar index={me.avatar} size={34} />
            {bubbles[me.id] && (
              <span key={bubbles[me.id]!.id} className="bubble absolute -top-7 left-1/2 rounded-full border-2 border-ink bg-cream px-1.5 text-xl">
                {bubbles[me.id]!.emoji}
              </span>
            )}
          </div>
          <span className="truncate font-display text-lg">{me.name}</span>
          {view.dealerId === me.id && <DealerChip size={24} />}
          {view.activePlayerId === me.id && <span className="rounded-md bg-banana px-1.5 text-xs font-black text-ink">À toi !</span>}
          <div className="flex-1" />
          {playing && !view.tamalou && (
            <button className="btn btn-red px-3 py-1.5 text-base" onClick={() => setConfirmTamalou(true)}>
              Tamalou !
            </button>
          )}
        </div>
        <div
          className="grid min-h-0 w-full flex-1 justify-center gap-2"
          style={{ gridTemplateRows: `repeat(${myRows.length}, minmax(0, 1fr))` }}
        >
          {myRows.map((row, r) => (
            <div key={r} className="flex h-full min-h-0 justify-center gap-2">
              {row.map((s) =>
                s.occupied ? (
                  <Card
                    key={s.index}
                    card={s.card}
                    back={!s.card}
                    revealUntil={s.revealUntil}
                    selected={selected === s.index || s.pendingDuplicate}
                    target={!!myHeld || (myPower?.power === 'peekOwn' && myPower.stage === 'choose') || myPower?.stage === 'decide' || myPower?.power === 'blindSwap'}
                    onClick={() => tapOwn(s.index)}
                    style={{ height: '100%', maxWidth: '31vw' }}
                    label={`Ta carte ${s.index + 1}`}
                  />
                ) : (
                  <div key={s.index} className="slot-empty h-full" />
                ),
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Journal discret */}
      {lastLog && (
        <button className="shrink-0 truncate px-3 pb-1 text-center text-xs font-bold text-cream/60" onClick={() => setShowLog(true)}>
          {lastLog.text}
        </button>
      )}

      <ChatDrawer view={view} />

      {picker && (
        <Picker
          view={view}
          title={picker === 'peekOther' ? 'Quelle carte espionner ?' : picker === 'peekAndSwap' ? 'Quelle carte regarder ?' : 'Avec quelle carte échanger ?'}
          excludeCaller={picker === 'blindSwap'}
          onPick={pick}
          onClose={() => setPicker(null)}
        />
      )}
      {confirmTamalou && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-950/70 p-4" onClick={() => setConfirmTamalou(false)}>
          <div className="panel pop-in w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Annoncer Tamalou">
            <p className="font-display text-3xl text-hibiscus">Tamalou ?</p>
            <p className="my-2 font-bold text-ink/70">
              À annoncer au tout début de ton tour. Gagné si tu as {view.options.tamalouThreshold} points ou moins et moins que tout le monde.
            </p>
            <div className="flex gap-2">
              <button className="btn btn-cream flex-1" onClick={() => setConfirmTamalou(false)}>
                Non
              </button>
              <button
                className="btn btn-red flex-1"
                onClick={() => {
                  setConfirmTamalou(false);
                  play({ type: 'callTamalou' });
                }}
              >
                J'annonce !
              </button>
            </div>
          </div>
        </div>
      )}
      {showLog && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-jungle-950/60" onClick={() => setShowLog(false)}>
          <div className="panel slide-up max-h-[50dvh] w-full max-w-lg overflow-y-auto rounded-b-none p-4" role="dialog" aria-label="Journal">
            <h2 className="mb-2 font-display text-2xl">Journal</h2>
            <ul className="flex flex-col gap-1 text-sm font-bold">
              {[...view.log].reverse().map((l) => (
                <li key={l.id}>{l.text}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {(view.phase === 'roundReveal' || view.phase === 'roundOver' || view.phase === 'gameOver') && <RoundResult view={view} />}
      {rules && <RulesModal onClose={() => setRules(false)} />}
    </div>
  );
}

function Countdown({ until, skew }: { until: number; skew: number }) {
  const [left, setLeft] = useState(() => Math.ceil((until - Date.now() - skew) / 1000));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((until - Date.now() - skew) / 1000))), 200);
    return () => clearInterval(t);
  }, [until, skew]);
  return <span className="grid h-9 w-9 place-items-center rounded-full border-[3px] border-ink bg-banana font-display text-xl text-ink">{left}</span>;
}
