/**
 * Código da versão do proxy: hash do código-fonte. O /health devolve este código e o
 * workflow de deploy espera até ele bater com o do commit, porque um /health "ok" logo
 * depois do deploy pode ser o contêiner antigo ainda no ar.
 *
 * Linha de comando: `node src/versao.js` imprime o código (usado pelo GitHub Actions).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export function codigoDaVersao(raiz = RAIZ) {
  const arquivos = ['server.js', 'package.json', ...readdirSync(join(raiz, 'src')).filter((f) => f.endsWith('.js')).sort().map((f) => `src/${f}`)];
  const hash = createHash('sha256');
  for (const f of arquivos) {
    // Fim de linha normalizado: o checkout no Windows pode trazer CRLF.
    hash.update(f).update('\0').update(readFileSync(join(raiz, f), 'utf8').replace(/\r\n/g, '\n')).update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(codigoDaVersao());
