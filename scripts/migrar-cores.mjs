#!/usr/bin/env node
/**
 * Migração única das cores soltas para os tokens de src/styles/tokens.css.
 *
 * Uso: node scripts/migrar-cores.mjs [--dry]
 *
 * Troca, nos arquivos .tsx/.jsx de src/:
 *  1. classes com hex arbitrário (bg-[#6A6DDF]/10 → bg-brand/10);
 *  2. hex em strings ('#10B981' → 'hsl(var(--success))');
 *  3. famílias de cor do Tailwind com equivalente seguro
 *     (emerald/green → success, red/rose → danger, amber/yellow → warning,
 *      blue/sky → info, indigo/violet/purple → brand, slate/neutral → gray).
 *
 * Só troca quando há equivalência; o que sobra é revisado à mão. Os modelos
 * capturados para PDF (src/components/reports) ficam de fora da troca de hex
 * em strings, porque o html2canvas não resolve var() dentro de SVG.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const SRC = join(RAIZ, 'src');
const DRY = process.argv.includes('--dry');

// hex (minúsculo) → nome do token
const HEX = {
  '#6a6ddf': 'brand',
  '#5a5bcf': 'brand-hover',
  '#5a5ccf': 'brand-hover',
  '#585ac7': 'brand-hover',
  '#5254be': 'brand-hover',
  '#f472b6': 'brand-accent',
  '#a5b4fc': 'brand-300',
  '#f8f9fa': 'surface',
  '#374151': 'ink',
  '#10b981': 'success',
  '#059669': 'success-600',
  '#f59e0b': 'warning',
  '#d97706': 'warning-600',
  '#ef4444': 'danger',
  '#0891b2': 'info-600',
  '#0284c7': 'info-700',
  '#ff5a5f': 'airbnb',
  '#003580': 'booking',
  '#0071c2': 'booking-light',
  '#fddb32': 'expedia',
  '#94a3b8': 'gray-400',
  '#e5e7eb': 'gray-200',
  '#f0f0f0': 'chart-grid',
};

// família do Tailwind → token
const FAMILIAS = {
  emerald: 'success',
  green: 'success',
  red: 'danger',
  rose: 'danger',
  amber: 'warning',
  yellow: 'warning',
  blue: 'info',
  sky: 'info',
  indigo: 'brand',
  violet: 'brand',
  purple: 'brand',
  slate: 'gray',
  neutral: 'gray',
};

const PREFIXOS =
  'bg|text|border|border-[trblxyse]|ring|ring-offset|from|via|to|fill|stroke|divide|outline|shadow|placeholder|accent|decoration|caret';

const reClasseHex = new RegExp(`(\\b(?:${PREFIXOS})-)\\[(#[0-9a-fA-F]{6})\\]`, 'g');
const reStringHex = /(['"`])(#[0-9a-fA-F]{6})\1/g;
const reFamilia = new RegExp(
  `(\\b(?:${PREFIXOS})-)(${Object.keys(FAMILIAS).join('|')})-(50|[1-9]00|950)\\b`,
  'g',
);

const ignorarHex = (arquivo) => arquivo.includes('/components/reports/');

function* arquivos(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) yield* arquivos(p);
    else if (/\.(tsx|jsx)$/.test(nome)) yield p;
  }
}

const sobras = [];
let total = { classeHex: 0, stringHex: 0, familia: 0, arquivos: 0 };

for (const arquivo of arquivos(SRC)) {
  const original = readFileSync(arquivo, 'utf8');
  let texto = original;

  // Classes viram estilo calculado, que o html2canvas lê sem problema.
  texto = texto.replace(reClasseHex, (m, prefixo, hex) => {
    const nome = HEX[hex.toLowerCase()];
    if (!nome) return m;
    total.classeHex++;
    return `${prefixo}${nome}`;
  });

  if (!ignorarHex(arquivo)) {
    texto = texto.replace(reStringHex, (m, aspas, hex) => {
      const nome = HEX[hex.toLowerCase()];
      if (!nome) return m;
      total.stringHex++;
      return `${aspas}hsl(var(--${nome}))${aspas}`;
    });
  }

  texto = texto.replace(reFamilia, (m, prefixo, familia, tom) => {
    total.familia++;
    return `${prefixo}${FAMILIAS[familia]}-${tom}`;
  });

  for (const [, hex] of texto.matchAll(/(#[0-9a-fA-F]{6})\b/g)) {
    sobras.push(`${relative(RAIZ, arquivo)}: ${hex}`);
  }

  if (texto !== original) {
    total.arquivos++;
    if (!DRY) writeFileSync(arquivo, texto);
  }
}

console.log(JSON.stringify(total, null, 2));
if (sobras.length) {
  console.log('\nHex sem equivalente (revisar à mão):');
  for (const s of sobras) console.log('  ' + s);
}
