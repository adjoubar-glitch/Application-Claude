// Les 14 animations jungle intégrées : scènes SVG (viewBox 0 0 400 360) animées en CSS (styles.css).
// Chaque scène est originale ; l'Admin peut remplacer n'importe laquelle par un fichier.

import type { BuiltinAnimation } from '@tamalou/shared';
import { BANANA, CREAM, GOLD, HATS, INK, banana, cardBackSvg, leaf, monkey, type MonkeyOpts } from '../art/art';

const g = (cls: string, inner: string, style = '') => `<g class="${cls}" ${style ? `style="${style}"` : ''}>${inner}</g>`;
const at = (x: number, y: number, s: number, inner: string) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;

const JUNGLE_LEAVES = [
  leaf(-10, 30, 20, 2.2, '#2A9D3F'),
  leaf(330, 20, 160, 2.2, '#43B05C'),
  leaf(-20, 300, -30, 2.4, '#1F7A35'),
  leaf(340, 320, -150, 2.4, '#2A9D3F'),
].join('');

const MONKEY: MonkeyOpts = { fur: '#9C5B2E', face: '#F3C99A' };
const GORILLA: MonkeyOpts = { fur: '#2E2B30', face: '#9E8E7E' };

const smallCard = (x: number, y: number, s: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})">${cardBackSvg().replace(/<svg[^>]*>|<\/svg>/g, '').replace(/backclip/g, 'bc' + Math.round(x + y))}</g>`;

const text = (x: number, y: number, t: string, size: number, fill: string, cls = '', style = '') =>
  `<text x="${x}" y="${y}" class="${cls}" style="${style}" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="${size}"
    fill="${fill}" stroke="${INK}" stroke-width="${size / 9}" paint-order="stroke">${t}</text>`;

const sparkle = (x: number, y: number, s: number, d: number) =>
  g('a-twinkle', `<path transform="translate(${x} ${y}) scale(${s})" d="M0-14 3-3 14 0 3 3 0 14-3 3-14 0-3-3Z" fill="${BANANA}" stroke="${INK}" stroke-width="2"/>`, `--d:${d}s`);

const SCENES: Record<Exclude<BuiltinAnimation, 'none'>, () => string> = {
  // Singe hilare qui se moque.
  'monkey-mock': () =>
    JUNGLE_LEAVES +
    g('a-bounce', at(90, 60, 1.1, monkey({ ...MONKEY, mood: 'laugh', armsUp: true }))) +
    ['HA', 'HA', 'HI', 'HA'].map((t, i) => text(60 + i * 95, 70 + (i % 2) * 40, t, 44, BANANA, 'a-pop', `--d:${i * 0.18}s`)).join(''),

  // Trois singes qui applaudissent sur une liane.
  'jungle-cheer': () =>
    `<path d="M-10 70Q200 170 410 70" fill="none" stroke="#6B4423" stroke-width="10" stroke-linecap="round"/>` +
    [0, 1, 2]
      .map((i) => g('a-bounce', at(10 + i * 130, 120, 0.6, monkey({ ...MONKEY, fur: ['#9C5B2E', '#C9762F', '#6E3B1F'][i]!, mood: i === 1 ? 'grin' : 'laugh', armsUp: true })), `--d:${i * 0.15}s`))
      .join('') +
    [20, 90, 170, 250, 330].map((x, i) => g('a-fall', leaf(x, -20, 30 * i, 0.8, '#7BCB6B'), `--d:${i * 0.25}s`)).join(''),

  // Boule noire qui tombe, singe effaré.
  'black-ball': () =>
    JUNGLE_LEAVES +
    at(110, 130, 0.9, monkey({ ...MONKEY, fur: '#C9762F', mood: 'shock' })) +
    g(
      'a-drop',
      `<circle cx="200" cy="80" r="62" fill="${INK}" stroke="#000" stroke-width="5"/><ellipse cx="178" cy="56" rx="18" ry="11" fill="#fff" opacity=".55"/>
       <circle cx="200" cy="84" r="22" fill="${CREAM}"/><text x="200" y="96" text-anchor="middle" font-family="Lilita One" font-size="32" fill="${INK}">✗</text>`,
    ),

  // Gorille avec le drapeau de la Jungle.
  'gorilla-flag': () =>
    JUNGLE_LEAVES +
    `<path d="M300 330V40" stroke="#6B4423" stroke-width="9" stroke-linecap="round"/>` +
    g(
      'a-wave',
      `<path d="M304 44h86q-14 34 0 70h-86Z" fill="#2A9D3F" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
       <g transform="translate(320 70) scale(.75)">${banana(true)}</g>`,
    ) +
    g('a-breathe', at(60, 110, 1.05, monkey({ ...GORILLA, mood: 'smile', tail: false }))) +
    `<circle cx="285" cy="270" r="18" fill="${GORILLA.fur}" stroke="${INK}" stroke-width="5"/>`,

  // Pluie de bananes dorées.
  'banana-rain': () =>
    Array.from({ length: 14 }, (_, i) => g('a-fall', at(((i * 61) % 380) - 10, -60, 0.9 + (i % 3) * 0.2, banana(true)), `--d:${(i * 0.13) % 1.2}s`)).join(''),

  // Singe espion aux jumelles, qui surgit des feuillages.
  'spy-binoculars': () =>
    g(
      'a-peek',
      at(100, 70, 1, monkey({ ...MONKEY, mood: 'sly', hat: HATS.explorer })) +
        `<g transform="translate(200 165) scale(2.6)"><rect x="-5" y="-9" width="10" height="9" rx="2" fill="${INK}"/>
          <circle cx="-9" cy="4" r="8" fill="#0E7C86" stroke="${INK}" stroke-width="3"/><circle cx="9" cy="4" r="8" fill="#0E7C86" stroke="${INK}" stroke-width="3"/>
          <circle cx="-11" cy="2" r="2.2" fill="#fff"/><circle cx="7" cy="2" r="2.2" fill="#fff"/></g>`,
    ) +
    [0, 1, 2, 3, 4, 5].map((i) => leaf(-20 + i * 75, 300 - (i % 2) * 25, -70 + (i % 3) * 25, 2, ['#2A9D3F', '#43B05C', '#1F7A35'][i % 3]!)).join(''),

  // Œil géant dans les feuillages.
  'peeked-victim': () =>
    `<rect width="400" height="360" fill="#0B2E1E" rx="30"/>` +
    g(
      'a-blink',
      `<path d="M40 180Q200 40 360 180Q200 320 40 180Z" fill="${CREAM}" stroke="${INK}" stroke-width="8"/>` +
        g('a-look', `<circle cx="200" cy="180" r="58" fill="#2A9D3F" stroke="${INK}" stroke-width="6"/><circle cx="200" cy="180" r="26" fill="${INK}"/><circle cx="214" cy="164" r="10" fill="#fff"/>`),
    ) +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => g('a-rustle', leaf((i % 4) * 110 - 20, i < 4 ? 20 : 330, i < 4 ? 30 : -30, 2, ['#2A9D3F', '#43B05C', '#1F7A35', '#7BCB6B'][i % 4]!), `--d:${i * 0.1}s`)).join(''),

  // Singe voleur qui file avec la carte.
  'banana-heist': () =>
    g(
      'a-run',
      at(0, 90, 0.9, monkey({ ...MONKEY, mood: 'sly', hat: HATS.headband(INK) })) +
        smallCard(140, 200, 0.32) +
        `<path d="M-30 210h-50M-20 240h-70M-30 270h-40" stroke="${CREAM}" stroke-width="7" stroke-linecap="round" opacity=".8"/>`,
    ),

  // Singe en larmes, poches vides.
  'robbed-victim': () =>
    JUNGLE_LEAVES +
    at(100, 80, 1, monkey({ ...MONKEY, fur: '#C9762F', mood: 'sad' })) +
    `<path d="M120 300q-14 26 8 30q16-2 12-30Z M280 300q14 26-8 30q-16-2-12-30Z" fill="#fff" stroke="${INK}" stroke-width="4"/>` +
    g('a-flyaway', smallCard(270, 120, 0.3)),

  // Singe roi sur son trône.
  'king-throne': () =>
    `<path d="M70 360V90Q200 10 330 90V360Z" fill="#B3262F" stroke="${INK}" stroke-width="7"/>
     <path d="M100 360V120Q200 60 300 120V360Z" fill="#E63946" stroke="${INK}" stroke-width="5"/>
     <circle cx="200" cy="58" r="18" fill="${GOLD}" stroke="${INK}" stroke-width="5"/>` +
    g('a-breathe', at(100, 100, 1, monkey({ fur: '#4E4A52', face: '#D9C3A5', mood: 'grin', hat: HATS.crown }))) +
    [
      [60, 80],
      [340, 70],
      [40, 220],
      [360, 230],
      [200, 30],
    ]
      .map(([x, y], i) => sparkle(x!, y!, 1.4, i * 0.2))
      .join(''),

  // Pied de gorille géant qui écrase la carte.
  'king-stomp': () =>
    `<ellipse cx="200" cy="330" rx="170" ry="20" fill="#000" opacity=".25"/>` +
    g('a-squash', smallCard(140, 230, 0.48)) +
    g(
      'a-stomp',
      `<path d="M110 -40H290V170Q290 250 200 250Q110 250 110 170Z" fill="${GORILLA.fur}" stroke="${INK}" stroke-width="8"/>
       <path d="M130 180Q200 225 270 180Q270 235 200 238Q130 235 130 180Z" fill="${GORILLA.face}" stroke="${INK}" stroke-width="5"/>
       ${[0, 1, 2, 3].map((i) => `<ellipse cx="${135 + i * 43}" cy="248" rx="20" ry="15" fill="${GORILLA.fur}" stroke="${INK}" stroke-width="6"/>`).join('')}`,
    ) +
    [0, 1, 2, 3].map((i) => g('a-dust', `<circle cx="${70 + i * 85}" cy="315" r="${22 + (i % 2) * 8}" fill="${CREAM}" stroke="${INK}" stroke-width="3" opacity=".9"/>`, `--d:${0.45 + i * 0.03}s`)).join(''),

  // Singe héros qui traverse l'écran sur une liane.
  'liana-hero': () =>
    `<path d="M0 8Q200 30 400 8" stroke="#6B4423" stroke-width="9" fill="none"/>` +
    g('a-swing', `<path d="M200 10V170" stroke="#6B4423" stroke-width="7"/>${at(130, 120, 0.7, monkey({ ...MONKEY, mood: 'grin', armsUp: true, hat: HATS.headband('#E63946') }))}`) +
    [0, 1, 2].map((i) => sparkle(80 + i * 120, 330 - (i % 2) * 30, 1.2, i * 0.25)).join(''),

  // Tambours de la jungle, TAMALOU qui rebondit.
  'tamalou-drums': () => {
    const drumSvg = (x: number) =>
      `<g transform="translate(${x} 250)"><rect x="-55" y="-30" width="110" height="90" rx="12" fill="#B3262F" stroke="${INK}" stroke-width="6"/>
       <ellipse cx="0" cy="-30" rx="55" ry="16" fill="${CREAM}" stroke="${INK}" stroke-width="6"/>
       <path d="M-55 0 55 40M-55 40 55 0" stroke="${GOLD}" stroke-width="5"/></g>`;
    return (
      drumSvg(110) +
      drumSvg(290) +
      g('a-hit', `<path d="M60 160 120 214" stroke="#6B4423" stroke-width="10" stroke-linecap="round"/><circle cx="58" cy="158" r="11" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>`) +
      g('a-hit', `<path d="M340 160 280 214" stroke="#6B4423" stroke-width="10" stroke-linecap="round"/><circle cx="342" cy="158" r="11" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>`, '--d:.2s') +
      'TAMALOU'
        .split('')
        .map((ch, i) => text(56 + i * 48, 120, ch, 62, i % 2 ? BANANA : '#E63946', 'a-letter', `--d:${i * 0.08}s`))
        .join('')
    );
  },

  // Volcan qui crache des confettis bananes.
  'volcano-win': () =>
    `<path d="M40 360 160 160H240L360 360Z" fill="#6B4423" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
     <path d="M160 160Q200 200 240 160L225 190Q200 210 175 190Z" fill="#F77F00" stroke="${INK}" stroke-width="4"/>` +
    Array.from({ length: 12 }, (_, i) =>
      g('a-erupt', at(185, 150, 0.6, i % 3 ? `<rect x="-8" y="-8" width="16" height="16" rx="3" fill="${['#E63946', '#FFD23F', '#2EC4B6', '#2A9D3F'][i % 4]}" stroke="${INK}" stroke-width="3"/>` : banana(true)), `--d:${(i * 0.09) % 0.8}s;--x:${(i % 2 ? 1 : -1) * (40 + ((i * 37) % 140))}px`),
    ).join(''),
};

export function sceneSvg(id: string): string | null {
  const make = SCENES[id as Exclude<BuiltinAnimation, 'none'>];
  if (!make) return null;
  return `<svg viewBox="0 0 400 360" xmlns="http://www.w3.org/2000/svg" overflow="visible">${make()}</svg>`;
}
