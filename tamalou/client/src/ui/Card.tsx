import { memo, useEffect, useState } from 'react';
import type { Card as CardT } from '@tamalou/shared';
import { cardBackSvg, cardFaceSvg, cardImageKey, rankText, SUITS } from '../art/art';
import { fileUrl, useApp } from '../net/store';

interface Props {
  card?: CardT | null;
  /** Face cachée. */
  back?: boolean;
  className?: string;
  selected?: boolean;
  target?: boolean;
  flip?: boolean;
  revealUntil?: number;
  onClick?: () => void;
  label?: string;
  style?: React.CSSProperties;
}

const Svg = memo(function Svg({ html }: { html: string }) {
  return <div className="svg-fill h-full w-full" dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Une carte : dessin SVG intégré, ou image chargée dans l'Admin si elle existe. */
export function Card({ card, back, className = '', selected, target, flip, revealUntil, onClick, label, style }: Props) {
  const custom = useApp((s) => s.assets.cards);
  const skew = useApp((s) => s.clockSkew);
  const faceUp = !!card && !back;
  const key = faceUp ? cardImageKey(card) : 'back';
  const img = fileUrl(custom[key as keyof typeof custom]);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!revealUntil) return;
    setRemaining(Math.max(0, revealUntil - (Date.now() + skew)));
  }, [revealUntil, skew]);

  const name = faceUp ? `${rankText(card.rank)} de ${SUITS[card.suit].name}` : 'carte face cachée';
  const content = img ? <img src={img} alt="" draggable={false} /> : <Svg html={faceUp ? cardFaceSvg(card) : cardBackSvg()} />;
  const cls = `card ${selected ? 'selected' : ''} ${target ? 'target' : ''} ${flip ? 'flip-in' : ''} ${className}`;
  const bar = revealUntil && remaining > 0 ? <span className="reveal-bar" style={{ animationDuration: `${remaining}ms` }} /> : null;
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label ?? name} style={style}>
        {content}
        {bar}
      </button>
    );
  }
  return (
    <div className={cls} aria-label={label ?? name} role="img" style={style}>
      {content}
      {bar}
    </div>
  );
}
