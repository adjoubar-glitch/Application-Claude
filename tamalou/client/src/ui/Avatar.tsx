import { memo } from 'react';
import { avatarSvg, type Mood } from '../art/art';

export const Avatar = memo(function Avatar({ index, size = 44, mood, dim }: { index: number; size?: number; mood?: Mood; dim?: boolean }) {
  return (
    <div
      className={`svg-fill shrink-0 overflow-hidden rounded-full border-[3px] border-ink bg-jungle-300 ${dim ? 'opacity-50 grayscale' : ''}`}
      style={{ width: size, height: size, padding: size * 0.02 }}
      dangerouslySetInnerHTML={{ __html: avatarSvg(index, mood) }}
    />
  );
});

/** Jeton DEALER façon bouton de poker. */
export function DealerChip({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size} role="img" aria-label="Dealer">
      <circle r="18.5" fill="#FFF6E0" stroke="#1B2A21" strokeWidth="3" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="-2.5" y="-18" width="5" height="6" fill="#E63946" transform={`rotate(${i * 45})`} />
      ))}
      <circle r="11" fill="#FFD23F" stroke="#1B2A21" strokeWidth="2" />
      <text y="3.5" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="9" fill="#1B2A21">D</text>
    </svg>
  );
}

export function BotBadge() {
  return <span className="rounded-md border-2 border-ink bg-lagoon px-1 text-[10px] font-black leading-tight text-cream">IA</span>;
}
