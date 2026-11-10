import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FALLBACK = ['Erika', 'Erdal', 'Pascal P.', 'Josiane', 'Gérard', 'Nadège'];

function load(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.BOT_NAMES_FILE,
    path.resolve(here, '../../config/bot-names.json'),
    path.resolve(here, '../config/bot-names.json'),
    path.resolve(process.cwd(), 'config/bot-names.json'),
  ].filter(Boolean) as string[];
  for (const file of candidates) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8')) as { names?: unknown };
      const names = Array.isArray(data.names) ? data.names.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : [];
      if (names.length) return names.map((n) => n.trim().slice(0, 16));
    } catch {
      // fichier absent ou invalide : on essaie le suivant
    }
  }
  return FALLBACK;
}

export const BOT_NAMES = load();

/** Un prénom libre au hasard ; si la liste est épuisée, "Singe 2", "Singe 3"… */
export function pickBotName(taken: string[], random: () => number): string {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  const free = BOT_NAMES.filter((n) => !used.has(n.toLowerCase()));
  if (free.length) return free[Math.floor(random() * free.length)]!;
  for (let i = 2; ; i++) if (!used.has(`singe ${i}`)) return `Singe ${i}`;
}
