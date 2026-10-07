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
 * Autenticação: header `x-sync-secret: <EMAIL_INGEST_SECRET>` (ou, enquanto ele
 * não existir, `<CHANNEL_SYNC_SECRET>`) ou um JWT válido do app (usado pela tela
 * de teste em Configurações).
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
  parsePayoutEmail,
  parseReservationEmail,
  type ParsedEmailReservation,
  type RawEmail,
} from '../_shared/emailParsers.ts';
import {
  learnSourceHints,
  resolveProperty,
  type PropertyRow,
  type SourceRow,
} from '../_shared/propertyMatching.ts';
import {
  applyReservation,
  buildPlaceholderCode,
  corsHeaders,
  jsonResponse,
  findReservationByHints,
  logRun,
  recordPending,
  type ReservationCandidate,
} from '../_shared/reservationSync.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
// Segredo próprio do encaminhador de e-mail. Enquanto não for configurado,
// vale o CHANNEL_SYNC_SECRET (o mesmo do cron do iCal); depois de configurado,
// só ele abre esta função — trocar o segredo do e-mail não derruba o iCal.
const SYNC_SECRET = Deno.env.get('EMAIL_INGEST_SECRET') || Deno.env.get('CHANNEL_SYNC_SECRET') || '';

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

/**
 * Fecha a pendência que este mesmo e-mail abriu numa execução anterior.
 *
 * O Apps Script reenvia a conversa pendente a cada execução; quando a
 * informação que faltava aparece (ex.: a reserva que o iCal criou depois), o
 * e-mail é aproveitado e a pendência dele não pode continuar aberta.
 */
async function resolveOwnPendings(
  admin: any,
  platform: string,
  dedupeSeed: string,
  reservationId: string,
): Promise<void> {
  const { error } = await admin
    .from('reservation_sync_pending')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      reservation_id: reservationId,
    })
    .eq('status', 'pending')
    .in('dedupe_key', [
      `email:incomplete:${platform}:${dedupeSeed}`,
      `email:unmatched:${platform}:${dedupeSeed}`,
    ]);

  if (error) console.error('Erro ao resolver pendências do e-mail:', error.message);
}

interface EmailOutcome {
  subject: string | null;
  platform: string | null;
  intent: string;
  action: 'created' | 'updated' | 'skipped' | 'pending' | 'ignored';
  reservationId?: string | null;
  reason?: string;
  /** Falha de processamento. E-mail ignorado de propósito não é erro. */
  erro?: boolean;
  parsed?: Partial<ParsedEmailReservation>;
}

/**
 * Guarda os lançamentos de um aviso de repasse na reserva correspondente,
 * sem mexer em valor nenhum (R5): é o registro que a conferência usa para
 * fechar o valor de cada mês das estadias longas (R3).
 */
async function registerPayout(
  admin: any,
  text: string,
  receivedAt: string | undefined,
  base: EmailOutcome,
  dryRun: boolean,
): Promise<EmailOutcome> {
  const repasse = parsePayoutEmail(text);
  const linhas = repasse.linhas.filter((linha) => linha.codigo);

  if (linhas.length === 0) {
    return { ...base, reason: 'Aviso de repasse sem lançamento por reserva legível' };
  }
  if (dryRun) {
    return { ...base, action: 'skipped', reason: `Simulação. Repasse com ${linhas.length} lançamento(s)` };
  }

  const registradas: string[] = [];
  const naoEncontradas: string[] = [];

  for (const codigo of [...new Set(linhas.map((linha) => linha.codigo!))]) {
    const { data } = await admin
      .from('reservations')
      .select('id, automation_metadata')
      .eq('platform', 'Airbnb')
      .eq('reservation_code', codigo)
      .order('check_in_date', { ascending: true })
      .limit(1);

    const reserva = data?.[0];
    if (!reserva) {
      naoEncontradas.push(codigo);
      continue;
    }

    const metadata = reserva.automation_metadata ?? {};
    const existentes: any[] = Array.isArray(metadata.repasses) ? metadata.repasses : [];
    const novos = linhas
      .filter((linha) => linha.codigo === codigo)
      .map((linha) => ({
        identificador: repasse.identificador,
        tipo: linha.tipo,
        valor: linha.valor,
        periodo_inicio: linha.periodoInicio,
        periodo_fim: linha.periodoFim,
        recebido_em: receivedAt ?? null,
      }))
      .filter((novo) => !existentes.some((e) =>
        e.identificador === novo.identificador && e.tipo === novo.tipo && e.valor === novo.valor));

    if (novos.length) {
      const { error } = await admin
        .from('reservations')
        .update({ automation_metadata: { ...metadata, repasses: [...existentes, ...novos] } })
        .eq('id', reserva.id);
      if (error) throw new Error(`Falha ao registrar repasse: ${error.message}`);
    }
    registradas.push(codigo);
  }

  const partes: string[] = [];
  if (registradas.length) partes.push(`registrado em ${registradas.join(', ')}`);
  if (naoEncontradas.length) partes.push(`sem reserva no dashboard: ${naoEncontradas.join(', ')}`);
  return { ...base, action: 'skipped', reason: `Aviso de repasse ${partes.join('; ')}` };
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
    checkIn: parsed.checkIn,
    checkOut: parsed.checkOut,
    numberOfGuests: parsed.numberOfGuests,
    totalRevenue: parsed.totalRevenue,
    stayTotal: parsed.stayTotal,
    commissionAmount: parsed.commissionAmount,
    listingName: parsed.listingName,
    bookingHotelId: parsed.bookingHotelId,
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

  // O que não é reserva não cria nem altera reserva (REGRAS_DE_NEGOCIO_RESERVAS.md,
  // R6). Já aconteceu: consulta de hóspede virou reserva com código SYNC-, pedido
  // não aceito reescreveu as datas de uma reserva e newsletter mexeu em datas.
  if (parsed.intent === 'marketing') {
    return { ...base, reason: 'Divulgação da plataforma — não é reserva' };
  }
  if (parsed.intent === 'inquiry') {
    return { ...base, reason: 'Consulta de hóspede — ainda não é reserva' };
  }
  if (parsed.intent === 'request') {
    return { ...base, reason: 'Pedido de reserva ainda não aceito — nada foi criado nem alterado' };
  }
  if (parsed.intent === 'payout') {
    return registerPayout(admin, parsed.normalizedText, email.receivedAt, base, dryRun);
  }

  // Aviso de conta, pedido de avaliação: descarta em silêncio em vez de encher
  // a fila de conferência.
  if (!looksLikeReservation(parsed)) {
    return {
      ...base,
      reason: 'E-mail da plataforma sem código de reserva nem datas — não parece uma reserva',
    };
  }

  const resolvida = resolveProperty({
    platform: parsed.platform,
    listingName: parsed.listingName,
    hotelId: parsed.bookingHotelId,
    haystack: `${email.subject ?? ''}\n${parsed.normalizedText}`,
    properties,
    sources,
  });

  // Quando o e-mail não identifica a propriedade ou omite as datas, a reserva
  // que o iCal já criou responde as duas coisas.
  const jaCadastrada = await findReservationByHints(admin, {
    platform: parsed.platform,
    reservationCode: parsed.reservationCode,
    checkIn: parsed.checkIn,
    checkOut: parsed.checkOut,
    propertyId: resolvida.propertyId,
  });

  const propertyId = resolvida.propertyId ?? jaCadastrada?.property_id ?? null;
  const how = resolvida.propertyId
    ? resolvida.how
    : (jaCadastrada ? 'reserva_existente' : 'unmatched');
  const checkIn = parsed.checkIn ?? jaCadastrada?.check_in_date ?? null;
  const checkOut = parsed.checkOut ?? jaCadastrada?.check_out_date ?? null;

  // Assim que a propriedade é conhecida, o nome do anúncio que veio no e-mail
  // entra na configuração do calendário — mesmo que a reserva ainda não possa
  // ser criada. É o que faz uma renomeação se resolver sozinha na sequência.
  if (!dryRun && propertyId) {
    await learnSourceHints(admin, propertyId, parsed.platform, {
      listingName: parsed.listingName,
      hotelId: parsed.bookingHotelId,
    });
  }

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
        listing_name: parsed.listingName,
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
    checkIn,
    checkOut,
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
      // Valor (R1) da estadia inteira. Em estadia mensal ele não vai para a
      // reserva: cada ciclo tem o seu valor (R3), que chega pelos repasses.
      valor_total_estadia: parsed.stayTotal,
      property_match: how,
    },
  };

  const applied = await applyReservation(admin, candidate);

  if (applied.reservationId) {
    await resolveOwnPendings(admin, parsed.platform, dedupeSeed, applied.reservationId);

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
        erro: true,
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
    // Só falha de processamento é erro. E-mail ignorado de propósito (marketing,
    // consulta, aviso de conta) deixava toda execução como "parcial" e o status
    // perdia o sentido.
    const hasError = outcomes.some((o) => o.erro);
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
