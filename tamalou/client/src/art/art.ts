// Tous les dessins du jeu, en SVG généré dans le code (aucune image externe).
// Cartes : 250×350. Singes : boîte 200×240.

import type { Card, Rank, Suit } from '@tamalou/shared';

export const INK = '#1B2A21';
export const CREAM = '#FFF6E0';
export const BANANA = '#FFD23F';
export const GOLD = '#F5B700';

export const SUITS: Record<Suit, { color: string; tint: string; name: string }> = {
  hearts: { color: '#E63946', tint: '#FFDCDF', name: 'cœur' },
  diamonds: { color: '#F77F00', tint: '#FFE6C9', name: 'carreau' },
  clubs: { color: '#2A9D3F', tint: '#D6F2D8', name: 'trèfle' },
  spades: { color: '#0E7C86', tint: '#CFEFF1', name: 'pique' },
};

const RANK_LABEL: Partial<Record<Rank, string>> = { 1: 'A', 11: 'V', 12: 'D', 13: 'R' };
export const rankText = (r: Rank) => RANK_LABEL[r] ?? String(r);

let uid = 0;
const nextId = (p: string) => `${p}${++uid}`;

const suitPath: Record<Suit, string> = {
  hearts: '<path d="M50 90C20 66 5 49 5 31 5 16 17 6 30 6c10 0 17 6 20 13 3-7 10-13 20-13 13 0 25 10 25 25 0 18-15 35-45 59Z"/>',
  diamonds: '<path d="M50 4 88 50 50 96 12 50Z" stroke-linejoin="round"/>',
  clubs: '<circle cx="50" cy="28" r="20"/><circle cx="27" cy="56" r="20"/><circle cx="73" cy="56" r="20"/><path d="M45 55 39 94h22l-6-39Z"/>',
  spades: '<path d="M50 5C36 28 8 42 8 62c0 16 14 24 26 22 6-1 11-5 13-9l-5 20h16l-5-20c2 4 7 8 13 9 12 2 26-6 26-22C92 42 64 28 50 5Z"/>',
};

export const suitSvg = (s: Suit, x: number, y: number, size: number, outline = true, opacity = 1) =>
  `<g transform="translate(${x} ${y}) scale(${size / 100})" fill="${SUITS[s].color}" opacity="${opacity}"
     ${outline ? `stroke="${INK}" stroke-width="${600 / size}" paint-order="stroke"` : ''}>${suitPath[s]}</g>`;

// ---------------------------------------------------------------------------
// Pictogrammes de pouvoir (centrés sur 0,0)
// ---------------------------------------------------------------------------
const SWAP_ARROWS = (sw: number) => `<g fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
  <path d="M-13-5Q0-17 13-5"/><path d="M8-9 13-5 8-1"/><path d="M13 5Q0 17-13 5"/><path d="M-8 9-13 5-8 1"/></g>`;

export const ICONS = {
  eye: `<path d="M-17 0Q0-15 17 0Q0 15-17 0Z" fill="${CREAM}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle r="6.5" fill="#2A9D3F" stroke="${INK}" stroke-width="2.5"/><circle r="2.6" fill="${INK}"/><circle cx="2" cy="-2.5" r="1.4" fill="#fff"/>`,
  binoculars: `<rect x="-5" y="-9" width="10" height="9" rx="2" fill="${INK}"/>
    <circle cx="-9" cy="4" r="8" fill="#0E7C86" stroke="${INK}" stroke-width="3"/><circle cx="9" cy="4" r="8" fill="#0E7C86" stroke="${INK}" stroke-width="3"/>
    <circle cx="-11" cy="2" r="2.2" fill="#fff"/><circle cx="7" cy="2" r="2.2" fill="#fff"/>`,
  swap: SWAP_ARROWS(3.5),
  kingEye: `<g transform="translate(-6 -4) scale(.75)"><path d="M-17 0Q0-15 17 0Q0 15-17 0Z" fill="${CREAM}" stroke="${INK}" stroke-width="3.5"/>
    <circle r="6.5" fill="#E63946" stroke="${INK}" stroke-width="3"/><circle r="2.6" fill="${INK}"/></g>
    <g transform="translate(8 8) scale(.55)">${SWAP_ARROWS(5)}</g>`,
} as const;
export type IconKey = keyof typeof ICONS;

export function powerOf(rank: Rank, suit: Suit): { icon: IconKey; label: string } | null {
  if (rank === 7 || rank === 8) return { icon: 'eye', label: 'Regarde ta carte' };
  if (rank === 9 || rank === 10) return { icon: 'binoculars', label: 'Espionne une carte' };
  if (rank === 11 || rank === 12) return { icon: 'swap', label: "Échange à l'aveugle" };
  if (rank === 13 && (suit === 'clubs' || suit === 'spades')) return { icon: 'kingEye', label: 'Regarde puis échange' };
  return null;
}

export const iconBadge = (icon: IconKey, r = 27) =>
  `<circle r="${r}" fill="${BANANA}" stroke="${INK}" stroke-width="4"/><g transform="scale(${r / 27})">${ICONS[icon]}</g>`;

export const leaf = (x: number, y: number, rot: number, sc: number, color: string) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc})">
    <path d="M0 0Q22-20 46 0Q22 20 0 0Z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M4 0H40" stroke="${INK}" stroke-width="2" opacity=".55"/></g>`;

// ---------------------------------------------------------------------------
// Singes
// ---------------------------------------------------------------------------

export function banana(golden: boolean): string {
  const fill = golden ? BANANA : '#8A5A2B';
  const spots = golden ? '' : `<circle cx="20" cy="17" r="3" fill="${INK}"/><circle cx="36" cy="15" r="2.4" fill="${INK}"/><circle cx="48" cy="9" r="2.6" fill="${INK}"/>`;
  const extra = golden
    ? `<g fill="${CREAM}" stroke="${GOLD}" stroke-width="1.5"><path d="M-8-14l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/><path d="M64-18l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5Z"/></g>`
    : `<g fill="none" stroke="#5E7D2E" stroke-width="2.5" stroke-linecap="round"><path d="M10-6q4-8 0-14q-4-6 2-12"/><path d="M30-8q4-8 0-14q-4-6 2-12"/></g>
       <g fill="${INK}"><circle cx="54" cy="-16" r="2.5"/><circle cx="62" cy="-8" r="2"/></g>
       <path d="M51-17l-4-3M51-17l-1-5M60-9l-3-4M60-9l1-5" stroke="${INK}" stroke-width="1.4"/>`;
  return `<g>${extra}<path d="M2 18Q32 36 62 6Q64 0 60-1Q36 20 6 10Q-2 12 2 18Z" fill="${fill}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M60-1 66-9" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>${spots}</g>`;
}

export type Mood = 'smile' | 'wink' | 'grin' | 'grumpy' | 'lashes' | 'laugh' | 'sad' | 'shock' | 'sly';

export interface MonkeyOpts {
  fur: string;
  face: string;
  mood?: Mood;
  hat?: string;
  hold?: string;
  necklace?: boolean;
  tail?: boolean;
  /** Bras levés (célébration). */
  armsUp?: boolean;
}

export function monkey(o: MonkeyOpts): string {
  const { fur, face } = o;
  const mood = o.mood ?? 'smile';
  const mask = (sw: number) => `<g ${sw ? `stroke="${INK}" stroke-width="${sw}"` : ''} fill="${face}">
    <circle cx="83" cy="96" r="22"/><circle cx="117" cy="96" r="22"/><ellipse cx="100" cy="122" rx="34" ry="24"/></g>`;
  const openEyes = (dx = 2, dy = 2) => `<ellipse cx="83" cy="94" rx="9" ry="11" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="117" cy="94" rx="9" ry="11" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="${83 + dx}" cy="${94 + dy}" r="5" fill="${INK}"/><circle cx="${117 + dx}" cy="${94 + dy}" r="5" fill="${INK}"/>
    <circle cx="${85 + dx}" cy="${91 + dy}" r="1.8" fill="#fff"/><circle cx="${119 + dx}" cy="${91 + dy}" r="1.8" fill="#fff"/>`;
  const closed = `<path d="M75 96q9-9 18 0M107 96q9-9 18 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  const eyes =
    mood === 'wink'
      ? `<ellipse cx="117" cy="94" rx="9" ry="11" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="119" cy="96" r="5" fill="${INK}"/><circle cx="121" cy="93" r="1.8" fill="#fff"/>
         <path d="M75 96q9-8 18 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
      : mood === 'laugh'
        ? closed
        : mood === 'shock'
          ? `<ellipse cx="83" cy="92" rx="11" ry="13" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="117" cy="92" rx="11" ry="13" fill="#fff" stroke="${INK}" stroke-width="3"/>
             <circle cx="83" cy="92" r="3.5" fill="${INK}"/><circle cx="117" cy="92" r="3.5" fill="${INK}"/>`
          : mood === 'sly'
            ? `${openEyes(4, 2)}<path d="M73 86h20M107 86h20" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
            : openEyes();
  const brows =
    mood === 'grumpy'
      ? `<path d="M70 78 94 86M130 78 106 86" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
      : mood === 'lashes'
        ? `<path d="M74 84l-5-5M79 81l-2-6M121 81l2-6M126 84l5-5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
        : mood === 'sad'
          ? `<path d="M72 84 92 78M128 84 108 78" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
          : '';
  const mouth =
    mood === 'grumpy' || mood === 'sad'
      ? `<path d="M86 134q14-10 28 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
      : mood === 'grin'
        ? `<path d="M82 126q18 20 36 0Z" fill="#7A1F2B" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><path d="M86 127h28l-2 4H88Z" fill="#fff"/>`
        : mood === 'laugh'
          ? `<path d="M78 122q22 30 44 0Z" fill="#7A1F2B" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><path d="M82 123h36l-3 5H85Z" fill="#fff"/><ellipse cx="100" cy="136" rx="8" ry="4" fill="#FF6B81"/>`
          : mood === 'shock'
            ? `<ellipse cx="100" cy="131" rx="8" ry="10" fill="#7A1F2B" stroke="${INK}" stroke-width="3.5"/>`
            : mood === 'sly'
              ? `<path d="M86 130q16 6 30-6" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
              : `<path d="M85 128q15 13 30 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  const tears = mood === 'sad' ? `<path d="M78 106q-4 10 0 14q4-4 0-14Z M122 106q-4 10 0 14q4-4 0-14Z" fill="#7FD3FF" stroke="${INK}" stroke-width="2"/>` : '';
  const cheeks = mood === 'lashes' || mood === 'laugh' ? `<circle cx="70" cy="118" r="6" fill="#FF8FA3" opacity=".8"/><circle cx="130" cy="118" r="6" fill="#FF8FA3" opacity=".8"/>` : '';
  const arm = (d: string) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${fur}" stroke-width="13" stroke-linecap="round"/>`;
  const arms = o.armsUp ? arm('M52 200Q22 160 30 120') + arm('M148 200Q178 160 170 120') : '';
  return `<g>
    ${o.tail !== false ? `<path d="M150 218q40-10 38-50q-2-24 14-30" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
    <path d="M150 218q40-10 38-50q-2-24 14-30" fill="none" stroke="${fur}" stroke-width="8" stroke-linecap="round"/>` : ''}
    ${arms}
    <ellipse cx="100" cy="215" rx="62" ry="44" fill="${fur}" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="100" cy="222" rx="36" ry="30" fill="${face}" stroke="${INK}" stroke-width="3.5"/>
    ${o.necklace ? `<g fill="#fff" stroke="${INK}" stroke-width="2">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${70 + i * 10}" cy="${182 - Math.abs(3 - i) * 2}" r="5"/>`).join('')}</g>` : ''}
    <circle cx="44" cy="98" r="22" fill="${fur}" stroke="${INK}" stroke-width="5"/><circle cx="44" cy="98" r="11" fill="${face}"/>
    <circle cx="156" cy="98" r="22" fill="${fur}" stroke="${INK}" stroke-width="5"/><circle cx="156" cy="98" r="11" fill="${face}"/>
    <circle cx="100" cy="98" r="55" fill="${fur}" stroke="${INK}" stroke-width="5"/>
    ${mask(9)}${mask(0)}${cheeks}${eyes}${brows}${tears}
    <ellipse cx="94" cy="117" rx="2.8" ry="3.8" fill="${INK}"/><ellipse cx="106" cy="117" rx="2.8" ry="3.8" fill="${INK}"/>
    ${mouth}${o.hat ?? ''}
    ${o.hold ? `<g transform="translate(58 178) rotate(-12) scale(1.35)">${o.hold}</g><circle cx="146" cy="172" r="14" fill="${fur}" stroke="${INK}" stroke-width="4.5"/>` : ''}
  </g>`;
}

export const HATS = {
  cap: (c: string) => `<path d="M50 70Q100 18 150 70Z" fill="${c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M128 68q34-4 44 6q-20 6-46 2Z" fill="${c}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
    <circle cx="100" cy="44" r="6" fill="${BANANA}" stroke="${INK}" stroke-width="3"/>`,
  flower: (c: string) => `<g transform="translate(62 50)">${[0, 72, 144, 216, 288]
    .map((a) => `<ellipse rx="10" ry="15" transform="rotate(${a}) translate(0 -13)" fill="${c}" stroke="${INK}" stroke-width="3.5"/>`)
    .join('')}<circle r="8" fill="${BANANA}" stroke="${INK}" stroke-width="3"/></g>`,
  crown: `<path d="M60 56 66 14 84 38 100 6 116 38 134 14 140 56Z" fill="${GOLD}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="100" cy="44" r="6" fill="#E63946" stroke="${INK}" stroke-width="2.5"/><circle cx="78" cy="47" r="4" fill="#0E7C86" stroke="${INK}" stroke-width="2"/>
    <circle cx="122" cy="47" r="4" fill="#0E7C86" stroke="${INK}" stroke-width="2"/>`,
  headband: (c: string) => `<path d="M48 72Q100 40 152 72L150 84Q100 54 50 84Z" fill="${c}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M150 76l18-8-4 14 12 6-22 2Z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  shades: `<g stroke="${INK}" stroke-width="4"><rect x="66" y="84" width="30" height="20" rx="8" fill="${INK}"/><rect x="104" y="84" width="30" height="20" rx="8" fill="${INK}"/><path d="M96 92h8"/></g>
    <path d="M72 89l8 0M110 89l8 0" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  bow: (c: string) => `<g transform="translate(100 46)"><path d="M0 0-26-14-26 14Z M0 0 26-14 26 14Z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <circle r="7" fill="${c}" stroke="${INK}" stroke-width="3.5"/></g>`,
  leafHat: `<g transform="translate(100 44)">${leaf(-46, 4, -25, 1, '#43B05C')}${leaf(0, -12, 25, 1, '#2A9D3F')}</g>`,
  explorer: `<path d="M40 70Q100 50 160 70Q150 80 100 78Q50 80 40 70Z" fill="#C8A165" stroke="${INK}" stroke-width="4.5"/>
    <path d="M62 66Q66 24 100 22Q134 24 138 66Z" fill="#D9B577" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M64 58Q100 50 136 58" stroke="#8A5A2B" stroke-width="7" fill="none"/>`,
};

// ---------------------------------------------------------------------------
// Avatars : 12 singes distincts (pelage, accessoire, humeur)
// ---------------------------------------------------------------------------
const AVATARS: MonkeyOpts[] = [
  { fur: '#9C5B2E', face: '#F3C99A', mood: 'wink', hat: HATS.cap('#E63946') },
  { fur: '#C9762F', face: '#F8D7AE', mood: 'lashes', hat: HATS.flower('#FF6B9A') },
  { fur: '#4E4A52', face: '#D9C3A5', mood: 'sly', hat: HATS.shades },
  { fur: '#B8863B', face: '#F6DDB0', mood: 'grin', hat: HATS.crown },
  { fur: '#6E3B1F', face: '#E8B98A', mood: 'smile', hat: HATS.headband('#0E7C86') },
  { fur: '#D99A4E', face: '#FBE3C0', mood: 'laugh', hat: HATS.bow('#F77F00') },
  { fur: '#7A5C44', face: '#EED2AE', mood: 'smile', hat: HATS.leafHat },
  { fur: '#A4472B', face: '#F2C39B', mood: 'grin', hat: HATS.explorer },
  { fur: '#5B6E73', face: '#E3CFB4', mood: 'wink', hat: HATS.headband('#FFD23F') },
  { fur: '#8C6A3F', face: '#F5D9B5', mood: 'shock', hat: HATS.cap('#2EC4B6') },
  { fur: '#3E3A3F', face: '#CDB79A', mood: 'grumpy', hat: HATS.bow('#2A9D3F') },
  { fur: '#C48A3A', face: '#FBE6C4', mood: 'lashes', hat: HATS.flower('#2EC4B6') },
];
export const AVATAR_COUNT = AVATARS.length;

export function avatarSvg(index: number, mood?: Mood): string {
  const a = AVATARS[((index % AVATARS.length) + AVATARS.length) % AVATARS.length]!;
  return `<svg viewBox="20 8 160 150" xmlns="http://www.w3.org/2000/svg">${monkey({ ...a, ...(mood ? { mood } : {}), tail: false })}</svg>`;
}

export const avatarOpts = (index: number) => AVATARS[((index % AVATARS.length) + AVATARS.length) % AVATARS.length]!;

// ---------------------------------------------------------------------------
// Cartes
// ---------------------------------------------------------------------------
const W = 250;
const H = 350;
const FONT = `Lilita One, Arial Rounded MT Bold, sans-serif`;

function corners(rank: Rank, s: Suit): string {
  const one = `<g><rect x="10" y="10" width="46" height="82" rx="12" fill="${CREAM}" stroke="${INK}" stroke-width="3.5"/>
    <text x="33" y="52" text-anchor="middle" font-family="${FONT}" font-size="${rank === 10 ? 34 : 42}"
      fill="${SUITS[s].color}" stroke="${INK}" stroke-width="2" paint-order="stroke">${rankText(rank)}</text>
    ${suitSvg(s, 19, 58, 28, false)}</g>`;
  return one + `<g transform="rotate(180 ${W / 2} ${H / 2})">${one}</g>`;
}

const badge = (rank: Rank, s: Suit) => {
  const p = powerOf(rank, s);
  return p ? `<g transform="translate(212 40)">${iconBadge(p.icon)}</g>` : '';
};

const frame = (inner: string) => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="24" fill="${CREAM}" stroke="${INK}" stroke-width="6"/>${inner}</svg>`;

function figureArt(rank: Rank, s: Suit): string {
  const red = s === 'hearts' || s === 'diamonds';
  if (rank === 11) return monkey({ fur: '#9C5B2E', face: '#F3C99A', mood: 'wink', hat: HATS.cap(SUITS[s].color) });
  if (rank === 12) return monkey({ fur: '#C9762F', face: '#F8D7AE', mood: 'lashes', hat: HATS.flower(SUITS[s].color), necklace: true });
  return red
    ? monkey({ fur: '#B8863B', face: '#F6DDB0', mood: 'grin', hat: HATS.crown, hold: banana(true) })
    : monkey({ fur: '#4E4A52', face: '#D9C3A5', mood: 'grumpy', hat: HATS.crown, hold: banana(false) });
}

function faceCard(rank: Rank, s: Suit): string {
  const id = nextId('clip');
  const S = SUITS[s];
  const name = rank === 11 ? 'VALET' : rank === 12 ? 'DAME' : 'ROI';
  const red = s === 'hearts' || s === 'diamonds';
  const pts = rank === 13 ? (red ? '0 pt' : '15 pts') : '10 pts';
  const win = 'M40 268V120Q40 34 125 34Q210 34 210 120V268Z';
  return frame(`
    <defs><clipPath id="${id}"><path d="${win}"/></clipPath></defs>
    <path d="${win}" fill="${S.tint}" stroke="${INK}" stroke-width="5"/>
    <g clip-path="url(#${id})">
      ${leaf(34, 250, -60, 1.2, '#43B05C')}${leaf(214, 250, -120, 1.2, '#2A9D3F')}${leaf(30, 150, -20, 0.9, '#7BCB6B')}
      ${suitSvg(s, 150, 70, 54, false, 0.22)}
      <g transform="translate(32 40) scale(.93)">${figureArt(rank, s)}</g>
    </g>
    <path d="${win}" fill="none" stroke="${INK}" stroke-width="5"/>
    <path d="M22 270h168l-10 16 10 16H22l10-16Z" fill="${S.color}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
    <text x="106" y="294" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${CREAM}"
      stroke="${INK}" stroke-width="3" paint-order="stroke" letter-spacing="1">${name} · ${pts}</text>
    ${corners(rank, s)}${badge(rank, s)}`);
}

function pipCard(rank: Rank, s: Suit): string {
  const S = SUITS[s];
  const p = powerOf(rank, s);
  return frame(`
    <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="18" fill="${S.tint}"/>
    ${leaf(22, 330, -45, 1, '#7BCB6B')}${leaf(228, 22, 135, 1, '#43B05C')}
    <circle cx="125" cy="168" r="78" fill="${CREAM}" stroke="${INK}" stroke-width="5"/>
    ${
      rank === 1
        ? suitSvg(s, 70, 110, 110)
        : `<text x="125" y="205" text-anchor="middle" font-family="${FONT}" font-size="${rank === 10 ? 92 : 108}"
            fill="${S.color}" stroke="${INK}" stroke-width="6" paint-order="stroke">${rankText(rank)}</text>${suitSvg(s, 107, 212, 36)}`
    }
    ${
      p
        ? `<g transform="translate(108 292)"><rect x="-76" y="-17" width="152" height="34" rx="17" fill="${INK}"/>
           <text x="0" y="6" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="13.5" fill="${BANANA}">${p.label}</text></g>`
        : ''
    }
    ${corners(rank, s)}${badge(rank, s)}`);
}

export function cardFaceSvg(card: Pick<Card, 'rank' | 'suit'>): string {
  return card.rank >= 11 ? faceCard(card.rank, card.suit) : pipCard(card.rank, card.suit);
}

let backCache: string | null = null;
export function cardBackSvg(): string {
  if (backCache) return backCache;
  const leaves: string[] = [];
  const palette = ['#2A9D3F', '#43B05C', '#7BCB6B', '#1F7A35'];
  let k = 0;
  for (let y = 10; y < H + 20; y += 34)
    for (let x = (y / 34) % 2 ? 0 : 20; x < W + 20; x += 42) {
      leaves.push(leaf(x, y, (k * 47) % 360, 0.62, palette[k % 4]!));
      k++;
    }
  backCache = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="backclip"><rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="16"/></clipPath></defs>
    <rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="24" fill="${CREAM}" stroke="${INK}" stroke-width="6"/>
    <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="16" fill="#145234"/>
    <g clip-path="url(#backclip)">${leaves.join('')}</g>
    <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="16" fill="none" stroke="${INK}" stroke-width="4"/>
    <g transform="translate(125 182)">
      <g transform="translate(-58 -116) scale(.58)">${monkey({ fur: '#9C5B2E', face: '#F3C99A', mood: 'grin' })}</g>
      <ellipse rx="96" ry="44" fill="${BANANA}" stroke="${INK}" stroke-width="6"/>
      <ellipse rx="84" ry="33" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 6" opacity=".5"/>
      <text y="13" text-anchor="middle" font-family="${FONT}" font-size="40" fill="#E63946" stroke="${INK}" stroke-width="5" paint-order="stroke" letter-spacing="1">Tamalou</text>
      <g transform="translate(58 18) rotate(-25) scale(.55)">${banana(true)}</g>
    </g></svg>`;
  return backCache;
}

/** Clé d'image personnalisée (Admin) pour une carte. */
export const cardImageKey = (c: Pick<Card, 'rank' | 'suit'>) => `${c.suit}-${c.rank}` as const;
