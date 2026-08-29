/**
 * Parser mínimo de iCalendar (RFC 5545) — suficiente para os feeds que o
 * Airbnb e o Booking.com publicam. Escrito sem dependências para rodar em
 * Deno/Edge Functions sem custo de bundle.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  /** Data de início em formato YYYY-MM-DD (sempre no fuso do próprio feed). */
  start: string | null;
  /** Data de fim em formato YYYY-MM-DD. */
  end: string | null;
  /** true quando DTSTART veio como VALUE=DATE (evento de dia inteiro). */
  allDay: boolean;
  raw: Record<string, string>;
}

/** Desdobra linhas continuadas (RFC 5545 §3.1: folding com espaço/tab). */
function unfold(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const out: string[] = [];

  for (const line of normalized.split('\n')) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }

  return out;
}

/** Separa `NOME;PARAM=VAL:VALOR` respeitando `:` dentro de aspas. */
function splitLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  let inQuotes = false;
  let colonAt = -1;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) {
      colonAt = i;
      break;
    }
  }

  if (colonAt === -1) return null;

  const head = line.slice(0, colonAt);
  const value = line.slice(colonAt + 1);
  const [name, ...paramParts] = head.split(';');
  const params: Record<string, string> = {};

  for (const part of paramParts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
  }

  return { name: name.toUpperCase(), params, value };
}

/** Reverte o escaping de texto do iCal (\n, \, \; \\). */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Converte DTSTART/DTEND para YYYY-MM-DD.
 * Aceita `20260912`, `20260912T140000Z` e `20260912T140000`.
 * Datas com horário em UTC são convertidas para o dia UTC — os feeds de
 * hospedagem publicam eventos de dia inteiro, então isso é seguro.
 */
export function icsDateToISO(value: string): string | null {
  const compact = value.trim();
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(compact);
  if (!match) {
    // Alguns feeds usam formato estendido (2026-09-12)
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(compact);
    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** Extrai todos os VEVENTs de um arquivo .ics. */
export function parseIcs(content: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: Record<string, string> | null = null;
  let currentParams: Record<string, Record<string, string>> = {};

  for (const line of unfold(content)) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      current = {};
      currentParams = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (current) {
        const startRaw = current.DTSTART ?? '';
        const endRaw = current.DTEND ?? '';
        events.push({
          uid: current.UID ?? '',
          summary: unescapeText(current.SUMMARY ?? ''),
          description: unescapeText(current.DESCRIPTION ?? ''),
          location: unescapeText(current.LOCATION ?? ''),
          start: startRaw ? icsDateToISO(startRaw) : null,
          end: endRaw ? icsDateToISO(endRaw) : null,
          allDay: (currentParams.DTSTART?.VALUE ?? '').toUpperCase() === 'DATE'
            || /^\d{8}$/.test(startRaw),
          raw: current,
        });
      }
      current = null;
      continue;
    }

    if (!current) continue;

    const parsed = splitLine(trimmed);
    if (!parsed) continue;

    // Repetições da mesma propriedade: mantém a primeira ocorrência.
    if (!(parsed.name in current)) {
      current[parsed.name] = parsed.value;
      currentParams[parsed.name] = parsed.params;
    }
  }

  return events;
}

/** Hash estável e barato do conteúdo, para pular feeds que não mudaram. */
export async function hashContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
