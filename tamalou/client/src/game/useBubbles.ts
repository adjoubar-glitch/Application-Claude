import { useEffect, useState } from 'react';
import { onChat } from '../net/store';

/** Réactions rapides affichées quelques secondes au-dessus de l'avatar. */
export function useBubbles() {
  const [bubbles, setBubbles] = useState<Record<string, { emoji: string; id: number }>>({});
  useEffect(
    () =>
      onChat((m) => {
        if (m.kind !== 'reaction') return;
        setBubbles((b) => ({ ...b, [m.playerId]: { emoji: m.emoji, id: m.id } }));
        setTimeout(
          () =>
            setBubbles((b) => {
              if (b[m.playerId]?.id !== m.id) return b;
              const { [m.playerId]: _, ...rest } = b;
              return rest;
            }),
          3000,
        );
      }),
    [],
  );
  return bubbles;
}
