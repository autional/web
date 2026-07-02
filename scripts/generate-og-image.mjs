import { readFileSync, writeFileSync } from 'node:fs';
import { renderAsync } from '@resvg/resvg-js';

const svg = readFileSync('public/og-default.svg', 'utf-8');
const png = await renderAsync(svg, { font: { loadSystemFonts: false } });
writeFileSync('public/og-default.png', png.asPng());
console.log('✅ og-default.png generated');
