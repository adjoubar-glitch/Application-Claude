// Effets paramétrables depuis l'espace Admin : pour chaque événement (pénalité ou
// pouvoir subi) et chaque rôle (celui qui agit, la victime, les autres), on choisit
// le son, l'animation, le texte, la durée et la vibration.
// Fichiers rangés dans le dossier Google Drive "Tamaloo" (voir docs/ARCHITECTURE.md).

import type { GameFx, PlayerId } from './game.js';

// ---------------------------------------------------------------------------
// Événements et rôles
// ---------------------------------------------------------------------------

/** actor = celui qui joue (mis en avant, il trolle) ; victim = celui qui subit ; others = la table. */
export type EffectRole = 'actor' | 'victim' | 'others';

export const EFFECT_EVENTS = {
  wrongTurn: { label: 'Pénalité : mauvais tour', roles: ['victim', 'others'] },
  wrongDuplicate: { label: 'Pénalité : mauvais doublon', roles: ['victim', 'others'] },
  duplicateTooSlow: { label: 'Doublon correct mais trop lent', roles: ['victim'] },
  duplicateSuccess: { label: 'Doublon réussi', roles: ['actor', 'others'] },
  peekOwn: { label: 'Pouvoir 7/8 : regarder sa carte', roles: ['actor', 'others'] },
  peekOther: { label: 'Pouvoir 9/10 : regarder une carte adverse', roles: ['actor', 'victim', 'others'] },
  blindSwap: { label: "Pouvoir Valet/Dame : échange à l'aveugle", roles: ['actor', 'victim', 'others'] },
  kingPeek: { label: 'Pouvoir Roi noir : regard', roles: ['actor', 'victim', 'others'] },
  kingSwap: { label: 'Pouvoir Roi noir : échange', roles: ['actor', 'victim', 'others'] },
  tamalou: { label: 'Annonce Tamalou', roles: ['actor', 'others'] },
  roundWin: { label: 'Fin de manche', roles: ['actor', 'others'] },
} as const satisfies Record<string, { label: string; roles: readonly EffectRole[] }>;

export type EffectEvent = keyof typeof EFFECT_EVENTS;

// ---------------------------------------------------------------------------
// Sons et animations intégrés (originaux, générés dans le code)
// ---------------------------------------------------------------------------

/** Sons intégrés : client/public/sounds/<nom>.mp3, remplaçables par fichier ou depuis l'Admin. */
export const BUILTIN_SOUNDS = [
  'monkey-laugh',
  'jungle-yell',
  'fail-jingle',
  'gorilla-slow',
  'duplicate-win',
  'spy-whistle',
  'swap-swoosh',
  'king-roar',
  'draw',
  'discard',
  'tamalou',
  'round-win',
] as const;
export type BuiltinSound = (typeof BUILTIN_SOUNDS)[number];

/** Animations intégrées, dessinées en SVG + CSS. */
export const BUILTIN_ANIMATIONS = {
  'monkey-mock': 'Singe hilare qui se moque, écran qui tremble',
  'jungle-cheer': 'Singes qui applaudissent sur une liane',
  'black-ball': 'Boule noire qui tombe, singes qui se cachent les yeux',
  'gorilla-flag': 'Gorille avec le drapeau de la Jungle : « Tu feras mieux la prochaine fois »',
  'banana-rain': 'Pluie de bananes dorées',
  'spy-binoculars': 'Singe espion aux jumelles',
  'peeked-victim': 'Œil géant dans les feuillages : « On a maté ta carte ! »',
  'banana-heist': 'Singe voleur qui file avec une carte sous le bras',
  'robbed-victim': 'Singe en larmes, poches vides',
  'king-throne': 'Singe roi sur son trône, couronne qui brille',
  'king-stomp': 'Pied de gorille géant qui écrase la carte',
  'liana-hero': 'Singe héros qui traverse l’écran sur une liane',
  'tamalou-drums': 'Tambours de la jungle, texte TAMALOU qui rebondit',
  'volcano-win': 'Volcan qui crache des confettis bananes',
  none: 'Aucune animation',
} as const;
export type BuiltinAnimation = keyof typeof BUILTIN_ANIMATIONS;

/** Référence à un son ou une animation : intégré, ou fichier chargé dans l'Admin. */
export type MediaRef = { kind: 'builtin'; id: string } | { kind: 'file'; fileId: string } | null;

export interface EffectCell {
  sound: MediaRef;
  animation: MediaRef;
  /** Texte de la pop-up. [PSEUDO] = celui qui agit ou est pénalisé, [CIBLE] = la victime. */
  text: string;
  /** Durée d'affichage ; fermable d'un tap après 2,5 s quoi qu'il arrive. */
  durationMs: number;
  /** Motif de vibration (ms), ou null. */
  vibrate: number[] | null;
  /** Plein écran (gros trolling) ou bandeau (discret). */
  fullscreen: boolean;
  /** Secousse de l'écran. */
  shake: boolean;
}

export type EffectsConfig = { [E in EffectEvent]: Partial<Record<EffectRole, EffectCell>> };

const b = (id: string): MediaRef => ({ kind: 'builtin', id });
const cell = (
  sound: string,
  animation: BuiltinAnimation,
  text: string,
  o: Partial<Pick<EffectCell, 'durationMs' | 'vibrate' | 'fullscreen' | 'shake'>> = {},
): EffectCell => ({
  sound: b(sound),
  animation: b(animation),
  text,
  durationMs: o.durationMs ?? 2500,
  vibrate: o.vibrate ?? null,
  fullscreen: o.fullscreen ?? true,
  shake: o.shake ?? false,
});

export const DEFAULT_EFFECTS: EffectsConfig = {
  wrongTurn: {
    victim: cell('monkey-laugh', 'monkey-mock', "Hé [PSEUDO], c'était pas ton tour ! 🙈", { vibrate: [400, 100, 400], shake: true, durationMs: 3000 }),
    others: cell('jungle-yell', 'jungle-cheer', 'Bien joué singe [PSEUDO] ! 🐒', { fullscreen: false }),
  },
  wrongDuplicate: {
    victim: cell('fail-jingle', 'black-ball', "[PSEUDO] s'est planté ! 💥", { vibrate: [300], shake: true }),
    others: cell('fail-jingle', 'black-ball', "[PSEUDO] s'est planté ! 💥"),
  },
  duplicateTooSlow: {
    victim: cell('gorilla-slow', 'gorilla-flag', 'Tu feras mieux la prochaine fois ! [PSEUDO] était plus rapide.'),
  },
  duplicateSuccess: {
    actor: cell('duplicate-win', 'liana-hero', 'Doublon éclair ! ⚡', { fullscreen: false, durationMs: 1500 }),
    others: cell('discard', 'none', '[PSEUDO] se débarrasse d’une carte', { fullscreen: false, durationMs: 1500 }),
  },
  peekOwn: {
    actor: cell('spy-whistle', 'spy-binoculars', 'Regarde vite, ça part dans 3 s 👀', { fullscreen: false, durationMs: 1500 }),
    others: cell('spy-whistle', 'none', '[PSEUDO] regarde une de ses cartes', { fullscreen: false, durationMs: 1500 }),
  },
  peekOther: {
    actor: cell('spy-whistle', 'spy-binoculars', 'Agent [PSEUDO] en mission : la carte de [CIBLE] est à toi 🕵️'),
    victim: cell('monkey-laugh', 'peeked-victim', '[PSEUDO] a maté ta carte ! 👀', { vibrate: [200] }),
    others: cell('spy-whistle', 'none', '[PSEUDO] espionne [CIBLE]', { fullscreen: false, durationMs: 1500 }),
  },
  blindSwap: {
    actor: cell('swap-swoosh', 'banana-heist', 'Hop, une carte de [CIBLE] dans ta poche ! 🍌', { durationMs: 2500 }),
    victim: cell('monkey-laugh', 'robbed-victim', '😱 [PSEUDO] t’a piqué une carte à l’aveugle !', { vibrate: [200, 80, 200], shake: true }),
    others: cell('swap-swoosh', 'none', '[PSEUDO] échange à l’aveugle avec [CIBLE]', { fullscreen: false, durationMs: 1500 }),
  },
  kingPeek: {
    actor: cell('king-roar', 'king-throne', 'Le Roi [PSEUDO] inspecte la carte de [CIBLE] 👑', { fullscreen: false, durationMs: 1500 }),
    victim: cell('king-roar', 'peeked-victim', 'Le Roi [PSEUDO] lorgne ta carte… 👑', { fullscreen: false, vibrate: [150] }),
    others: cell('king-roar', 'none', '[PSEUDO] (Roi noir) regarde une carte de [CIBLE]', { fullscreen: false, durationMs: 1500 }),
  },
  kingSwap: {
    actor: cell('king-roar', 'king-throne', 'Le Roi [PSEUDO] se sert chez [CIBLE] ! 👑'),
    victim: cell('monkey-laugh', 'king-stomp', 'Le Roi [PSEUDO] t’a dépouillé ! 😱', { vibrate: [300, 80, 300], shake: true }),
    others: cell('king-roar', 'none', 'Le Roi [PSEUDO] vole une carte à [CIBLE]', { fullscreen: false, durationMs: 1500 }),
  },
  tamalou: {
    actor: cell('tamalou', 'tamalou-drums', 'TAMALOU ! Croise les doigts 🤞'),
    others: cell('tamalou', 'tamalou-drums', '[PSEUDO] annonce TAMALOU ! Dernier tour 🥁'),
  },
  roundWin: {
    actor: cell('round-win', 'volcano-win', 'Roi de la jungle ! 👑'),
    others: cell('round-win', 'banana-rain', '[PSEUDO] gagne la manche !'),
  },
};

// ---------------------------------------------------------------------------
// Fichiers chargés depuis l'Admin
// ---------------------------------------------------------------------------

export type AssetKind = 'sound' | 'cardImage' | 'animation';

export const ASSET_RULES: Record<AssetKind, { extensions: readonly string[]; maxBytes: number }> = {
  sound: { extensions: ['mp3', 'ogg', 'wav', 'm4a'], maxBytes: 3 * 1024 * 1024 },
  cardImage: { extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'], maxBytes: 2 * 1024 * 1024 },
  // GIF, WebP/PNG animés, vidéo courte (WebM transparent conseillé) ou Lottie (.json).
  animation: { extensions: ['gif', 'webp', 'png', 'apng', 'webm', 'mp4', 'json'], maxBytes: 5 * 1024 * 1024 },
};

/** Nom d'une face de carte : "hearts-1"… "spades-13", ou "back" pour le dos. */
export type CardImageKey = `${'hearts' | 'diamonds' | 'clubs' | 'spades'}-${number}` | 'back';

export interface AssetFile {
  id: string;
  kind: AssetKind;
  /** Nom d'origine, affiché dans l'Admin. */
  name: string;
  mime: string;
  size: number;
  /** URL servie par notre serveur (cache local du fichier Drive). */
  url: string;
}

/** GET /api/assets : tout ce que les téléphones doivent savoir sur la personnalisation. */
export interface AssetManifest {
  /** Change à chaque modification, pour casser le cache. */
  version: number;
  files: AssetFile[];
  /** Images de cartes personnalisées (sinon, cartes SVG intégrées). */
  cards: Partial<Record<CardImageKey, string>>;
  /** Remplacement d'un son intégré par un fichier (ex. 'monkey-laugh' → fileId). */
  soundOverrides: Partial<Record<BuiltinSound, string>>;
  effects: EffectsConfig;
}

// ---------------------------------------------------------------------------
// Quel effet jouer, pour qui ?
// ---------------------------------------------------------------------------

export interface ResolvedEffect {
  event: EffectEvent;
  role: EffectRole;
  /** [PSEUDO] */
  actorId: PlayerId;
  /** [CIBLE] */
  targetId?: PlayerId;
  /** Plusieurs fautifs dans la même fenêtre de doublon : une seule pop-up qui les liste. */
  actorIds?: PlayerId[];
}

/** Traduit un effet de jeu en effet visuel/sonore pour le joueur `viewer` (ou rien). */
export function effectFor(fx: GameFx, viewer: PlayerId): ResolvedEffect | null {
  const role = (actor: PlayerId, victim?: PlayerId): EffectRole =>
    viewer === actor ? 'actor' : viewer === victim ? 'victim' : 'others';
  switch (fx.type) {
    case 'penalty':
      if (fx.kind === 'wrongTurn') {
        return { event: 'wrongTurn', role: viewer === fx.playerId ? 'victim' : 'others', actorId: fx.playerId };
      }
      return {
        event: 'wrongDuplicate',
        role: fx.playerIds.includes(viewer) ? 'victim' : 'others',
        actorId: fx.playerIds[0]!,
        actorIds: fx.playerIds,
      };
    case 'duplicateTooSlow':
      return fx.playerIds.includes(viewer) ? { event: 'duplicateTooSlow', role: 'victim', actorId: fx.winnerId } : null;
    case 'duplicateSuccess':
      return { event: 'duplicateSuccess', role: role(fx.playerId), actorId: fx.playerId };
    case 'peek': {
      const event: EffectEvent = fx.power === 'peekOwn' ? 'peekOwn' : fx.power === 'peekOther' ? 'peekOther' : 'kingPeek';
      const victim = fx.power === 'peekOwn' ? undefined : fx.target.playerId;
      return { event, role: role(fx.byPlayerId, victim), actorId: fx.byPlayerId, ...(victim ? { targetId: victim } : {}) };
    }
    case 'swap':
      return {
        event: fx.power === 'blindSwap' ? 'blindSwap' : 'kingSwap',
        role: role(fx.a.playerId, fx.b.playerId),
        actorId: fx.a.playerId,
        targetId: fx.b.playerId,
      };
    case 'tamalou':
      return { event: 'tamalou', role: role(fx.playerId), actorId: fx.playerId };
    case 'roundEnd': {
      const w = fx.result.winnerIds;
      return { event: 'roundWin', role: w.includes(viewer) ? 'actor' : 'others', actorId: w[0]!, actorIds: w };
    }
    default:
      return null;
  }
}
