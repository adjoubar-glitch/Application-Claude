// Validation de tout ce qui arrive du réseau : on ne fait confiance à aucun client.

import { MAX_PLAYERS, type GameAction, type GameOptions, type PowerUse } from '@tamalou/shared';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isSlot = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 64;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

export function parseAction(raw: unknown): GameAction | null {
  if (!isObj(raw) || typeof raw.type !== 'string') return null;
  switch (raw.type) {
    case 'drawFromDeck':
    case 'takeDiscard':
    case 'discardHeld':
    case 'skipPower':
    case 'callTamalou':
      return { type: raw.type };
    case 'swapHeld':
    case 'duplicate':
      return isSlot(raw.slot) ? { type: raw.type, slot: raw.slot } : null;
    case 'kingSwap':
      return isSlot(raw.ownSlot) ? { type: 'kingSwap', ownSlot: raw.ownSlot } : null;
    case 'usePower': {
      const power = parsePower(raw.power);
      return power ? { type: 'usePower', power } : null;
    }
    default:
      return null;
  }
}

function parsePower(p: unknown): PowerUse | null {
  if (!isObj(p)) return null;
  switch (p.kind) {
    case 'peekOwn':
      return isSlot(p.slot) ? { kind: 'peekOwn', slot: p.slot } : null;
    case 'peekOther':
    case 'peekAndSwap':
      return isId(p.target) && isSlot(p.slot) ? { kind: p.kind, target: p.target, slot: p.slot } : null;
    case 'blindSwap':
      return isSlot(p.ownSlot) && isId(p.target) && isSlot(p.slot)
        ? { kind: 'blindSwap', ownSlot: p.ownSlot, target: p.target, slot: p.slot }
        : null;
    default:
      return null;
  }
}

export function parseOptions(raw: unknown): GameOptions | null {
  if (!isObj(raw)) return null;
  const t = raw.tamalouThreshold;
  if (!Number.isInteger(t) || (t as number) < 0 || (t as number) > 30) return null;
  if (typeof raw.showActivePlayer !== 'boolean') return null;
  const e = raw.endCondition;
  if (!isObj(e)) return null;
  let endCondition: GameOptions['endCondition'];
  if (e.kind === 'single') endCondition = { kind: 'single' };
  else if (e.kind === 'points' && Number.isInteger(e.limit) && (e.limit as number) >= 10 && (e.limit as number) <= 1000)
    endCondition = { kind: 'points', limit: e.limit as number };
  else if (e.kind === 'rounds' && Number.isInteger(e.count) && (e.count as number) >= 1 && (e.count as number) <= 50)
    endCondition = { kind: 'rounds', count: e.count as number };
  else return null;
  return { tamalouThreshold: t as number, showActivePlayer: raw.showActivePlayer, endCondition };
}

/** Pseudo : 1 à 16 caractères visibles, espaces resserrés. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return name.length ? name : null;
}

export const MAX_SEATS = MAX_PLAYERS;
