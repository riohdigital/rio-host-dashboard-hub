/** Utilitários de texto compartilhados pelos parsers de e-mail. */

const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"',
  hellip: '...', reg: '(R)', copy: '(c)', trade: '(TM)', euro: '€', pound: '£',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (full, name) => HTML_ENTITIES[name.toLowerCase()] ?? full);
}

/**
 * Converte HTML de e-mail em texto legível preservando a quebra de linhas
 * das tabelas — é dela que os parsers dependem para casar rótulo/valor.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|table|thead|tbody)>/gi, '\n')
      .replace(/<\/(td|th)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeForMatch(input: string): string {
  return stripDiacritics(input).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Converte valores monetários de e-mail em número.
 * Aceita "R$ 1.234,56", "BRL 1234,56", "$1,234.56", "1234.56".
 */
export function parseMoney(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized: string;

  if (lastComma === -1 && lastDot === -1) {
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    // vírgula é o separador decimal (pt-BR)
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // ponto é o separador decimal (en-US)
    normalized = cleaned.replace(/,/g, '');
  } else {
    normalized = cleaned;
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Encontra o primeiro valor monetário dentro de um trecho de texto. */
export function findMoneyInText(text: string): number | null {
  const match = /(?:R\$|BRL|US\$|USD|\$|€|EUR)\s*([\d.,]+)|([\d]{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/i.exec(text);
  if (!match) return null;
  return parseMoney(match[1] ?? match[2]);
}

const MONTHS: Record<string, number> = {
  jan: 1, janeiro: 1, january: 1,
  fev: 2, fevereiro: 2, feb: 2, february: 2,
  mar: 3, marco: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  mai: 5, maio: 5, may: 5,
  jun: 6, junho: 6, june: 6,
  jul: 7, julho: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, setembro: 9, sep: 9, sept: 9, september: 9,
  out: 10, outubro: 10, oct: 10, october: 10,
  nov: 11, novembro: 11, november: 11,
  dez: 12, dezembro: 12, dec: 12, december: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function buildDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Infere o ano quando o e-mail omite (ex.: "sex, 12 de set").
 * Datas de reserva estão sempre próximas de hoje: se o mês já passou há mais
 * de dois meses, assume o ano seguinte.
 */
function inferYear(month: number, reference: Date): number {
  const refMonth = reference.getUTCMonth() + 1;
  const refYear = reference.getUTCFullYear();
  if (month < refMonth - 2) return refYear + 1;
  if (month > refMonth + 9) return refYear - 1;
  return refYear;
}

export interface ParseDateOptions {
  /** 'pt' interpreta dd/mm/yyyy; 'en' interpreta mm/dd/yyyy. */
  locale?: 'pt' | 'en';
  reference?: Date;
}

/** Extrai a primeira data reconhecível de um texto e devolve YYYY-MM-DD. */
export function parseDateFlexible(
  raw: string | null | undefined,
  options: ParseDateOptions = {},
): string | null {
  if (!raw) return null;

  const locale = options.locale ?? 'pt';
  const reference = options.reference ?? new Date();
  const text = normalizeForMatch(raw);

  // 2026-09-12
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return buildDate(+iso[1], +iso[2], +iso[3]);

  // 12 de setembro de 2026 / 12 de set 2026 / 12 setembro
  for (const m of text.matchAll(/(\d{1,2})\s*(?:de\s+)?([a-z]{3,9})\.?(?:\s*(?:de\s+)?(\d{4}))?/g)) {
    const month = MONTHS[m[2]];
    if (!month) continue;
    const year = m[3] ? +m[3] : inferYear(month, reference);
    return buildDate(year, month, +m[1]);
  }

  // September 12, 2026 / Sep 12 2026 / Sep 12
  for (const m of text.matchAll(/([a-z]{3,9})\.?\s+(\d{1,2})(?:\s*,)?(?:\s*(\d{4}))?/g)) {
    const month = MONTHS[m[1]];
    if (!month) continue;
    const year = m[3] ? +m[3] : inferYear(month, reference);
    return buildDate(year, month, +m[2]);
  }

  // 12/09/2026 ou 12/09/26
  const numeric = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(text);
  if (numeric) {
    let [, a, b, y] = numeric;
    let year = +y;
    if (year < 100) year += 2000;

    let day = +a;
    let month = +b;
    if (locale === 'en' && +a <= 12) {
      month = +a;
      day = +b;
    }
    // Desempate: se o "mês" for maior que 12, os campos estão trocados.
    if (month > 12 && day <= 12) {
      const swap = month;
      month = day;
      day = swap;
    }
    return buildDate(year, month, day);
  }

  return null;
}

/**
 * Normaliza mantendo um mapa de índices para o texto original, para que o
 * valor devolvido preserve acentuação e maiúsculas do e-mail.
 */
function normalizeWithMap(input: string): { text: string; map: number[] } {
  const map: number[] = [];
  let text = '';
  let lastWasSpace = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (/\s/.test(char)) {
      if (lastWasSpace || text.length === 0) continue;
      text += ' ';
      map.push(i);
      lastWasSpace = true;
      continue;
    }

    lastWasSpace = false;
    const folded = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const piece of folded) {
      text += piece;
      map.push(i);
    }
  }

  return { text, map };
}

function isWordChar(char: string | undefined): boolean {
  return !!char && /[a-z0-9]/.test(char);
}

/**
 * Procura o valor associado a um rótulo. Cobre tanto "Rótulo: valor" quanto
 * tabelas HTML em que o valor cai na linha seguinte.
 *
 * Os rótulos são testados na ordem recebida (do mais específico para o mais
 * genérico) e só casam em fronteira de palavra — assim "Hóspede" não captura
 * o "s" de "Hóspedes" nem "Nome" rouba "Nome da acomodação".
 */
export function findLabelledValue(
  lines: string[],
  labels: string[],
  lookahead = 3,
): string | null {
  const normalizedLines = lines.map(normalizeWithMap);

  for (const label of labels) {
    const normalizedLabel = normalizeForMatch(label);
    if (!normalizedLabel) continue;

    for (let i = 0; i < normalizedLines.length; i++) {
      const { text, map } = normalizedLines[i];

      let at = text.indexOf(normalizedLabel);
      while (at !== -1) {
        const before = at > 0 ? text[at - 1] : undefined;
        const after = text[at + normalizedLabel.length];

        if (!isWordChar(before) && !isWordChar(after)) {
          const cutAt = map[at + normalizedLabel.length] ?? lines[i].length;
          const rest = lines[i].slice(cutAt).replace(/^[\s:：\-–—]+/, '').trim();
          if (rest) return rest;

          for (let j = i + 1; j <= i + lookahead && j < lines.length; j++) {
            const next = lines[j].trim();
            if (next) return next;
          }
        }

        at = text.indexOf(normalizedLabel, at + 1);
      }
    }
  }

  return null;
}

export function toLines(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}
