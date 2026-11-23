#!/usr/bin/env node
/**
 * Gera os ícones do app instalável (PWA) a partir de public/LOGO RIOH HOST.png.
 *
 * Uso (o sharp não é dependência do projeto):
 *   npm i --no-save sharp && node scripts/gerar-icones.mjs
 *
 * Saída em public/: pwa-192x192.png, pwa-512x512.png, maskable-512x512.png
 * e apple-touch-icon-180x180.png. Fundo branco com o logotipo roxo; no
 * maskable o logotipo fica dentro da área segura (círculo de 80%).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const PUBLIC = new URL('../public/', import.meta.url).pathname;
const LOGO = join(PUBLIC, 'LOGO RIOH HOST.png');
const BRANCO = { r: 255, g: 255, b: 255, alpha: 1 };

async function icone(nome, lado, larguraLogo) {
  const logo = await sharp(LOGO).trim().resize({ width: Math.round(larguraLogo) }).toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: BRANCO } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(PUBLIC, nome));
  console.log('ok', nome);
}

await icone('pwa-192x192.png', 192, 192 * 0.84);
await icone('pwa-512x512.png', 512, 512 * 0.84);
await icone('maskable-512x512.png', 512, 512 * 0.66);
await icone('apple-touch-icon-180x180.png', 180, 180 * 0.8);
