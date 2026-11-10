// Génère les icônes PNG de la PWA à partir d'un dessin SVG original (singe + banane).
// Usage : node scripts/gen-icons.mjs  (utilise le Chromium de Playwright)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/public/icons');
const INK = '#1B2A21';
const monkey = (fur, face) => `
  <circle cx="44" cy="98" r="22" fill="${fur}" stroke="${INK}" stroke-width="5"/><circle cx="44" cy="98" r="11" fill="${face}"/>
  <circle cx="156" cy="98" r="22" fill="${fur}" stroke="${INK}" stroke-width="5"/><circle cx="156" cy="98" r="11" fill="${face}"/>
  <circle cx="100" cy="98" r="55" fill="${fur}" stroke="${INK}" stroke-width="5"/>
  <g stroke="${INK}" stroke-width="9" fill="${face}"><circle cx="83" cy="96" r="22"/><circle cx="117" cy="96" r="22"/><ellipse cx="100" cy="122" rx="34" ry="24"/></g>
  <g fill="${face}"><circle cx="83" cy="96" r="22"/><circle cx="117" cy="96" r="22"/><ellipse cx="100" cy="122" rx="34" ry="24"/></g>
  <path d="M75 96q9-8 18 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="117" cy="94" rx="9" ry="11" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="119" cy="96" r="5" fill="${INK}"/>
  <ellipse cx="94" cy="117" rx="2.8" ry="3.8" fill="${INK}"/><ellipse cx="106" cy="117" rx="2.8" ry="3.8" fill="${INK}"/>
  <path d="M82 126q18 20 36 0Z" fill="#7A1F2B" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M50 70Q100 18 150 70Z" fill="#E63946" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M128 68q34-4 44 6q-20 6-46 2Z" fill="#E63946" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`;
const banana = `<path d="M2 18Q32 36 62 6Q64 0 60-1Q36 20 6 10Q-2 12 2 18Z" fill="#FFD23F" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M60-1 66-9" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;

const icon = (maskable) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${maskable ? '' : 'rx="112"'} fill="#1A6B43"/>
  <circle cx="256" cy="256" r="${maskable ? 190 : 225}" fill="#FFD23F" stroke="${INK}" stroke-width="12"/>
  <g transform="translate(256 ${maskable ? 262 : 252}) scale(${maskable ? 1.55 : 1.85}) translate(-100 -98)">${monkey('#9C5B2E', '#F3C99A')}</g>
  <g transform="translate(${maskable ? 300 : 310} ${maskable ? 360 : 380}) rotate(-20) scale(${maskable ? 1.4 : 1.7})">${banana}</g>
</svg>`;

// Playwright est préinstallé globalement dans l'environnement de développement.
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${icon(maskable).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(out, file), omitBackground: true });
  console.log('✓', file);
}
await browser.close();
