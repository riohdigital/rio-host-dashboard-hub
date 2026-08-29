/**
 * ingest-reservation-email
 *
 * Recebe e-mails de confirmação/alteração/cancelamento do Airbnb e do
 * Booking.com e transforma em reservas. É o canal que traz o que o iCal não
 * entrega: nome do hóspede, valor, número de hóspedes e cancelamentos.
 *
 * Quem envia o e-mail para cá pode ser qualquer coisa que faça um POST:
 * Google Apps Script lendo o Gmail (grátis), Cloudflare Email Worker (grátis),
 * n8n, Make, Zapier etc. Ver docs/SINCRONIZACAO-AUTOMATICA.md.
 *
 * Autenticação: header `x-sync-secret: <CHANNEL_SYNC_SECRET>` ou um JWT válido
 * do app (usado pela tela de teste em Configurações).
 *
 * Corpo aceito:
 *   { from, subject, html?, text?, messageId?, receivedAt?, propertyId?, dryRun? }
 *   ou { emails: [ ...acima ] }
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

import {
  looksLikeReservation,
  parseReservationEmail,
  type ParsedEmailReservation,
  type RawEmail,
} from '../_shared/emailParsers.ts';
import { normalizeForMatch } from '../_shared/textUtils.ts';
import {
  applyReservation,
  buildPlaceholderCode,
  corsHeaders,
  jsonResponse,
  logRun,
  recordPending,
  shiftDate,
  type ReservationCandidate,
} from '../_shared/reservationSync.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SYNC_SECRET = Deno.env.get('CHANNEL_SYNC_SECRET') ?? '';

/** Aceita os nomes de campo mais comuns dos serviços de inbound e-mail. */
function normalizeEmailPayload(raw: any): RawEmail & { propertyId?: string } {
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = raw?.[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return undefined;
  };

  return {
    from: pick('from', 'sender', 'From', 'fromAddress'),
    subject: pick('subject', 'Subject', 'title'),
    html: pick('html', 'bodyHtml', 'body-html', 'html_body', 'HtmlBody'),
    text: pick('text', 'plain', 'bodyText', 'body-plain', 'text_body', 'TextBody', 'body'),
    messageId: pick('messageId', 'message-id', 'Message-Id', 'id'),
    receivedAt: pick('receivedAt', 'date', 'Date', 'timestamp'),
    propertyId: pick('propertyId', 'property_id'),
  };
}

interface PropertyRow {
  id: string;
  name: string;
  nickname: string | null;
}

interface SourceRow {
  property_id: string;
  platform: string;
  listing_alias: string | null;
}

/**
 * Descobre a propriedade do e-mail. Ordem: id explícito -> apelido do anúncio
 * configurado na fonte -> nome/apelido da propriedade citado no texto ->
 * propriedade única da conta.
 */
function resolveProperty(
  parsed: ParsedEmailReservation,
  email: RawEmail & { propertyId?: string },
  properties: PropertyRow[],
  sources: SourceRow[],
): { propertyId: string | null; how: string } {
  if (email.propertyId && properties.some((p) => p.id === email.propertyId)) {
    return { propertyId: email.propertyId, how: 'payload' };
  }

  const haystack = normalizeForMatch(`${email.subject ?? ''}\n${parsed.normalizedText}`);
  const listing = parsed.listingName ? normalizeForMatch(parsed.listingName) : null;

  const platformSources = sources.filter(
    (source) => !parsed.platform || source.platform === parsed.platform,
  );

  // 1) apelido do anúncio configurado pelo usuário
  const byAlias = platformSources
    .filter((source) => source.listing_alias && source.listing_alias.trim().length >= 3)
    .map((source) => ({ source, alias: normalizeForMatch(source.listing_alias!) }))
    .filter(({ alias }) => haystack.includes(alias) || (listing && listing.includes(alias)))
    .sort((a, b) => b.alias.length - a.alias.length);

  if (byAlias.length > 0) {
    return { propertyId: byAlias[0].source.property_id, how: 'listing_alias' };
  }

  // 2) nome ou apelido da propriedade citado no e-mail
  const byName = properties
    .flatMap((property) => [property.name, property.nickname]
      .filter((value): value is string => !!value && value.trim().length >= 4)
      .map((value) => ({ property, term: normalizeForMatch(value) })))
    .filter(({ term }) => haystack.includes(term) || (listing && listing.includes(term)))
    .sort((a, b) => b.term.length - a.term.length);

  if (byName.length > 0) {
    return { propertyId: byName[0].property.id, how: 'property_name' };
  }

  // 3) conta com um imóvel só: não há ambiguidade possível
  if (properties.length === 1) {
    return { propertyId: properties[0].id, how: 'single_property' };
  }

  return { propertyId: null, how: 'unmatched' };
}

const COLUNAS_RESERVA =
  'id, property_id, platform, reservation_code, check_in_date, check_out_date';

/** Só aceita o resultado quando todas as linhas são da mesma propriedade. */
function umaPropriedadeSo(rows: any[] | null | undefined): any | null {
  if (!rows?.length) return null;
  const propriedades = new Set(rows.map((row: any) => row.property_id));
  return propriedades.size === 1 ? rows[0] : null;
}

/**
 * Procura a reserva que este e-mail descreve.
 *
 * É o outro lado da moeda dos dois canais: o e-mail traz hóspede e valor mas
 * às vezes omite a propriedade e as datas; a reserva que o iCal já criou tem
 * exatamente essas duas coisas. Da pista mais forte para a mais fraca.
 */
async function findReservationForEmail(
  admin: any,
  parsed: ParsedEmailReservation,
  knownPropertyId: string | null,
): Promise<any | null> {
  if (!parsed.platform) return null;

  // 1. Código real da plataforma.
  if (parsed.reservationCode) {
    const { data } = await admin
      .from('reservations')
      .select(COLUNAS_RESERVA)
      .eq('platform', parsed.platform)
      .eq('reservation_code', parsed.reservationCode)
      .limit(2);
    if (data?.length === 1) return data[0];
  }

  // 2. As duas datas.
  if (parsed.checkIn && parsed.checkOut) {
    let query = admin
      .from('reservations')
      .select(COLUNAS_RESERVA)
      .eq('platform', parsed.platform)
      .eq('check_in_date', parsed.checkIn)
      .eq('check_out_date', parsed.checkOut);
    if (knownPropertyId) query = query.eq('property_id', knownPropertyId);

    const { data } = await query;
    const unica = umaPropriedadeSo(data);
    if (unica) return unica;
  }

  // 3. Só a data de entrada — é o que o assunto do "Nova reserva!" do
  //    Booking.com oferece: "(6124022858, sexta-feira, 11 de setembro de 2026)".
  if (parsed.checkIn) {
    let query = admin
      .from('reservations')
      .select(COLUNAS_RESERVA)
      .eq('platform', parsed.platform)
      .gte('check_in_date', shiftDate(parsed.checkIn, -1))
      .lte('check_in_date', shiftDate(parsed.checkIn, 1));
    if (knownPropertyId) query = query.eq('property_id', knownPropertyId);

    const { data } = await query;
    const unica = umaPropriedadeSo(data);
    if (unica) return unica;
  }

  return null;
}

/**
 * Guarda o nome do anúncio na fonte correspondente quando ele ainda não foi
 * preenchido. Assim o próximo e-mail da mesma propriedade se resolve sozinho,
 * sem depender de a reserva já existir.
 */
async function learnListingAlias(
  admin: any,
  propertyId: string,
  platform: string,
  listingName: string | null,
): Promise<void> {
  if (!listingName || listingName.trim().length < 5) return;

  const { error } = await admin
    .from('channel_sync_sources')
    .update({ listing_alias: listingName.trim() })
    .eq('property_id', propertyId)
    .eq('platform', platform)
    .is('listing_alias', null);

  if (error) console.error('Não foi possível guardar o nome do anúncio:', error.message);
}

/** Fecha pendências que este e-mail acabou de resolver. */
async function resolvePendings(
  admin: any,
  reservationId: string,
  kinds: string[],
): Promise<void> {
  const { error } = await admin
    .from('reservation_sync_pending')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('reservation_id', reservationId)
    .eq('status', 'pending')
    .in('kind', kinds);

  if (error) console.error('Erro ao resolver pendências:', error.message);
}

interface EmailOutcome {
  subject: string | null;
  platform: string | null;
  intent: string;
  action: 'created' | 'updated' | 'skipped' | 'pending' | 'ignored';
  reservationId?: string | null;
  reason?: string;
  parsed?: Partial<ParsedEmailReservation>;
}

async function processEmail(
  admin: any,
  raw: any,
  properties: PropertyRow[],
  sources: SourceRow[],
  dryRun: boolean,
): Promise<EmailOutcome> {
  const email = normalizeEmailPayload(raw);
  const parsed = parseReservationEmail(email);

  const summaryOfParsed: Partial<ParsedEmailReservation> = {
    platform: parsed.platform,
    intent: parsed.intent,
    reservationCode: parsed.reservationCode,
    guestName: parsed.guestName,
    checkIn,
    checkOut,
    numberOfGuests: parsed.numberOfGuests,
    totalRevenue: parsed.totalRevenue,
    commissionAmount: parsed.commissionAmount,
    listingName: parsed.listingName,
    missing: parsed.missing,
  };

  const base: EmailOutcome = {
    subject: email.subject ?? null,
    platform: parsed.platform,
    intent: parsed.intent,
    action: 'ignored',
    parsed: summaryOfParsed,
  };

  if (!parsed.platform) {
    return { ...base, reason: 'Remetente não reconhecido como Airbnb ou Booking.com' };
  }

  // Aviso de conta, pedido de avaliação, marketing: descarta em silêncio em vez
  // de encher a fila de conferência.
  if (!looksLikeReservation(parsed)) {
    return {
      ...base,
      reason: 'E-mail da plataforma sem código de reserva nem datas — não parece uma reserva',
    };
  }

  const resolvida = resolveProperty(parsed, email, properties, sources);

  // Quando o e-mail não identifica a propriedade ou omite as datas, a reserva
  // que o iCal já criou responde as duas coisas.
  const jaCadastrada = await findReservationForEmail(admin, parsed, resolvida.propertyId);

  const propertyId = resolvida.propertyId ?? jaCadastrada?.property_id ?? null;
  const how = resolvida.propertyId
    ? resolvida.how
    : (jaCadastrada ? 'reserva_existente' : 'unmatched');
  const checkIn = parsed.checkIn ?? jaCadastrada?.check_in_date ?? null;
  const checkOut = parsed.checkOut ?? jaCadastrada?.check_out_date ?? null;

  const dedupeSeed = parsed.reservationCode
    ?? email.messageId
    ?? buildPlaceholderCode(`${email.subject}${parsed.checkIn}${parsed.checkOut}`);

  if (dryRun) {
    return {
      ...base,
      action: 'skipped',
      reason: `Simulação. Propriedade resolvida por: ${how}`,
      parsed: { ...summaryOfParsed },
    };
  }

  if (!propertyId) {
    await recordPending(admin, {
      channel: 'email',
      platform: parsed.platform,
      kind: 'unmatched_property',
      dedupeKey: `email:unmatched:${parsed.platform}:${dedupeSeed}`,
      summary: `E-mail do ${parsed.platform} sem propriedade identificada: ${email.subject ?? '(sem assunto)'}`,
      payload: {
        subject: email.subject,
        from: email.from,
        parsed: summaryOfParsed,
        excerpt: parsed.normalizedText.slice(0, 2000),
      },
    });
    return { ...base, action: 'pending', reason: 'Propriedade não identificada' };
  }

  // Sem datas não dá para criar reserva: vai para conferência com o que temos.
  if (!checkIn || !checkOut) {
    await recordPending(admin, {
      channel: 'email',
      platform: parsed.platform,
      propertyId,
      kind: 'incomplete_data',
      dedupeKey: `email:incomplete:${parsed.platform}:${dedupeSeed}`,
      summary: `E-mail do ${parsed.platform} sem datas legíveis: ${email.subject ?? '(sem assunto)'}`,
      payload: {
        subject: email.subject,
        parsed: summaryOfParsed,
        excerpt: parsed.normalizedText.slice(0, 2000),
      },
    });
    return { ...base, action: 'pending', reason: 'Datas não identificadas no e-mail' };
  }

  const reservationCode = parsed.reservationCode
    ?? buildPlaceholderCode(`${parsed.platform}:${propertyId}:${checkIn}`);

  const candidate: ReservationCandidate = {
    propertyId,
    platform: parsed.platform,
    reservationCode,
    externalUid: parsed.reservationCode ? `${parsed.platform}:${parsed.reservationCode}` : null,
    externalSource: parsed.platform === 'Airbnb' ? 'email_airbnb' : 'email_booking',
    checkIn: parsed.checkIn,
    checkOut: parsed.checkOut,
    guestName: parsed.guestName,
    guestEmail: parsed.guestEmail,
    guestPhone: parsed.guestPhone,
    numberOfGuests: parsed.numberOfGuests,
    totalRevenue: parsed.totalRevenue,
    reservationStatus: parsed.intent === 'cancelled' ? 'Cancelada' : 'Confirmada',
    metadata: {
      email_subject: email.subject,
      email_message_id: email.messageId,
      email_intent: parsed.intent,
      commission_amount_informado: parsed.commissionAmount,
      property_match: how,
    },
  };

  const applied = await applyReservation(admin, candidate);

  if (applied.reservationId && how !== 'listing_alias') {
    await learnListingAlias(admin, propertyId, parsed.platform, parsed.listingName);
  }

  if (applied.reservationId) {
    const kinds = parsed.intent === 'cancelled'
      ? ['possible_cancellation', 'incomplete_data']
      : ['incomplete_data'];
    // Só considera a pendência resolvida quando os dados comerciais chegaram.
    if (parsed.intent === 'cancelled' || (parsed.reservationCode && parsed.totalRevenue)) {
      await resolvePendings(admin, applied.reservationId, kinds);
    }
  }

  return {
    ...base,
    action: applied.action,
    reservationId: applied.reservationId,
    reason: applied.reason,
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  const providedSecret = req.headers.get('x-sync-secret') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const viaSecret = !!SYNC_SECRET && providedSecret === SYNC_SECRET;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (!viaSecret) {
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Não autorizado' }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) {
      return jsonResponse({ error: 'Não autorizado' }, 401);
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Corpo inválido: envie JSON' }, 400);
  }

  const emails: any[] = Array.isArray(body?.emails) ? body.emails : [body];
  if (emails.length === 0) {
    return jsonResponse({ error: 'Nenhum e-mail informado' }, 400);
  }
  if (emails.length > 50) {
    return jsonResponse({ error: 'Máximo de 50 e-mails por requisição' }, 400);
  }

  const dryRun = body?.dryRun === true;
  const startedAt = new Date().toISOString();

  const [{ data: properties }, { data: sources }] = await Promise.all([
    admin.from('properties').select('id, name, nickname').eq('status', 'Ativo'),
    admin.from('channel_sync_sources').select('property_id, platform, listing_alias'),
  ]);

  const outcomes: EmailOutcome[] = [];
  for (const item of emails) {
    try {
      outcomes.push(
        await processEmail(admin, item, properties ?? [], sources ?? [], dryRun),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Erro ao processar e-mail:', message);
      outcomes.push({
        subject: item?.subject ?? null,
        platform: null,
        intent: 'unknown',
        action: 'ignored',
        reason: message,
      });
    }
  }

  const totals = {
    created: outcomes.filter((o) => o.action === 'created').length,
    updated: outcomes.filter((o) => o.action === 'updated').length,
    pending: outcomes.filter((o) => o.action === 'pending').length,
    ignored: outcomes.filter((o) => o.action === 'ignored').length,
    skipped: outcomes.filter((o) => o.action === 'skipped').length,
  };

  if (!dryRun) {
    const hasError = outcomes.some((o) => o.action === 'ignored' && o.reason);
    await logRun(admin, {
      channel: 'email',
      status: hasError && totals.created + totals.updated === 0 ? 'partial' : 'success',
      eventsFound: emails.length,
      created: totals.created,
      updated: totals.updated,
      skipped: totals.skipped + totals.ignored,
      pending: totals.pending,
      message: `${emails.length} e-mail(s) processado(s)`,
      details: { outcomes: outcomes.slice(0, 20) },
      startedAt,
    });
  }

  return jsonResponse({ ok: true, dryRun, totals, results: outcomes });
});
