/**
 * sync-channel-reservations
 *
 * Lê os feeds iCal exportados pelo Airbnb e pelo Booking.com e transforma os
 * eventos em reservas. É o canal "esqueleto": garante datas e bloqueios sempre
 * atualizados. Os dados comerciais (hóspede, valor, comissão) chegam pelo canal
 * de e-mail (`ingest-reservation-email`).
 *
 * Invocação:
 *   - Cron/serviço externo: POST com header `x-sync-secret: <CHANNEL_SYNC_SECRET>`
 *   - Usuário logado no app: POST com `Authorization: Bearer <jwt>`
 *
 * Corpo opcional: { sourceId?: string, propertyId?: string, force?: boolean }
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

import { hashContent, parseIcs, type IcsEvent } from '../_shared/ics.ts';
import {
  applyReservation,
  buildPlaceholderCode,
  corsHeaders,
  jsonResponse,
  logRun,
  recordPending,
  type ReservationCandidate,
} from '../_shared/reservationSync.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SYNC_SECRET = Deno.env.get('CHANNEL_SYNC_SECRET') ?? '';

const FETCH_TIMEOUT_MS = 20_000;

/** Palavras que marcam um período bloqueado (e não uma reserva). */
const BLOCK_KEYWORDS = [
  'not available', 'unavailable', 'blocked', 'block',
  'indisponivel', 'indisponível', 'bloqueado', 'bloqueio',
  'no disponible', 'airbnb (not available)',
];

/** Rótulos genéricos que o feed usa no lugar do nome do hóspede. */
const GENERIC_SUMMARIES = [
  'reserved', 'reservado', 'reserva', 'booked', 'busy', 'ocupado',
  'closed', 'closed - not available', 'airbnb', 'booking.com',
];

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function isBlockEvent(event: IcsEvent): boolean {
  const summary = normalize(event.summary);
  return BLOCK_KEYWORDS.some((keyword) => summary.includes(normalize(keyword)));
}

/** Airbnb publica o código dentro da URL da reserva, no DESCRIPTION. */
function extractAirbnbCode(event: IcsEvent): string | null {
  const source = `${event.description} ${event.location} ${event.summary}`;
  const fromUrl = /reservations\/details\/([A-Z0-9]{6,})/i.exec(source);
  if (fromUrl) return fromUrl[1].toUpperCase();

  const bare = /\b(HM[A-Z0-9]{5,})\b/.exec(source.toUpperCase());
  return bare ? bare[1] : null;
}

function extractPhoneLast4(event: IcsEvent): string | null {
  const match = /(?:last\s*4\s*digits|ultimos\s*4\s*digitos)[^\d]{0,12}(\d{4})/i
    .exec(normalize(event.description));
  return match ? match[1] : null;
}

/** Usa o SUMMARY como nome do hóspede quando ele não é um rótulo genérico. */
function extractGuestName(event: IcsEvent): string | null {
  const summary = event.summary.trim();
  if (!summary) return null;
  const normalized = normalize(summary);
  if (GENERIC_SUMMARIES.some((generic) => normalized === normalize(generic))) return null;
  if (BLOCK_KEYWORDS.some((keyword) => normalized.includes(normalize(keyword)))) return null;
  if (summary.length > 80) return null;
  if (!/[a-zà-ú]/i.test(summary)) return null;
  return summary;
}

async function fetchIcs(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RioHost-Dashboard/1.0 (calendar sync)' },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao baixar o feed`);
    }

    const body = await response.text();
    if (!body.includes('BEGIN:VCALENDAR')) {
      throw new Error('A resposta não é um arquivo iCal válido');
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

interface SourceResult {
  sourceId: string;
  propertyId: string;
  platform: string;
  status: 'success' | 'partial' | 'error' | 'skipped';
  eventsFound: number;
  created: number;
  updated: number;
  skipped: number;
  pending: number;
  message?: string;
}

async function syncSource(admin: any, source: any, force: boolean): Promise<SourceResult> {
  const startedAt = new Date().toISOString();
  const isAirbnb = source.platform === 'Airbnb';
  const externalSource = isAirbnb ? 'ical_airbnb' : 'ical_booking';

  const result: SourceResult = {
    sourceId: source.id,
    propertyId: source.property_id,
    platform: source.platform,
    status: 'success',
    eventsFound: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    pending: 0,
  };

  let content: string;
  try {
    content = await fetchIcs(source.ical_url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.status = 'error';
    result.message = message;

    await admin.from('channel_sync_sources').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_message: message,
    }).eq('id', source.id);

    await logRun(admin, {
      sourceId: source.id,
      propertyId: source.property_id,
      channel: 'ical',
      platform: source.platform,
      status: 'error',
      message,
      startedAt,
    });

    return result;
  }

  const contentHash = await hashContent(content);
  if (!force && contentHash === source.last_content_hash) {
    result.status = 'skipped';
    result.message = 'Feed sem alterações desde a última sincronização';

    await admin.from('channel_sync_sources').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'skipped',
      last_sync_message: result.message,
    }).eq('id', source.id);

    await logRun(admin, {
      sourceId: source.id,
      propertyId: source.property_id,
      channel: 'ical',
      platform: source.platform,
      status: 'skipped',
      message: result.message,
      startedAt,
    });

    return result;
  }

  const today = new Date().toISOString().slice(0, 10);
  const events = parseIcs(content).filter((event) => event.start && event.end);
  const seenUids = new Set<string>();
  const errors: string[] = [];

  for (const event of events) {
    const checkIn = event.start!;
    // Airbnb e Booking publicam DTEND como a data de check-out. Feeds que usam
    // a última noite ocupada são corrigidos pela flag da fonte.
    const checkOut = source.dtend_is_checkout === false
      ? shiftIso(event.end!, 1)
      : event.end!;

    if (checkOut < today) continue;               // reserva já encerrada
    if (checkOut <= checkIn) continue;            // evento degenerado

    result.eventsFound++;

    if (isAirbnb && isBlockEvent(event)) {
      result.skipped++;
      continue;
    }

    const uid = event.uid || buildPlaceholderCode(`${source.id}:${checkIn}:${checkOut}`);
    seenUids.add(uid);

    const airbnbCode = isAirbnb ? extractAirbnbCode(event) : null;
    const reservationCode = airbnbCode ?? buildPlaceholderCode(`${source.platform}:${uid}`);
    // No Booking o feed não distingue reserva de bloqueio manual, então o item
    // entra na fila de conferência mesmo depois de criado.
    const needsReview = !isAirbnb || !airbnbCode;

    const candidate: ReservationCandidate = {
      propertyId: source.property_id,
      platform: source.platform,
      reservationCode,
      externalUid: uid,
      externalSource,
      checkIn,
      checkOut,
      guestName: extractGuestName(event),
      metadata: {
        ical_uid: uid,
        ical_summary: event.summary,
        source_id: source.id,
        phone_last4: isAirbnb ? extractPhoneLast4(event) : null,
        needs_review: needsReview,
      },
    };

    try {
      const applied = await applyReservation(admin, candidate);
      if (applied.action === 'created') result.created++;
      else if (applied.action === 'updated') result.updated++;
      else result.skipped++;

      if (needsReview && applied.action === 'created') {
        const recorded = await recordPending(admin, {
          channel: 'ical',
          platform: source.platform,
          propertyId: source.property_id,
          reservationId: applied.reservationId,
          kind: 'incomplete_data',
          dedupeKey: `ical:${source.id}:${uid}`,
          summary: isAirbnb
            ? `Reserva do Airbnb sem código no feed (${checkIn} a ${checkOut}). Confirme os dados.`
            : `Período ocupado no Booking.com (${checkIn} a ${checkOut}). Confirme se é reserva ou bloqueio e informe o valor.`,
          payload: {
            check_in: checkIn,
            check_out: checkOut,
            summary: event.summary,
            description: event.description.slice(0, 1000),
            uid,
          },
        });
        if (recorded) result.pending++;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  // Reservas futuras que sumiram do feed podem ter sido canceladas. Nunca
  // cancelamos sozinhos: registramos para conferência.
  if (events.length > 0) {
    const { data: tracked } = await admin
      .from('reservations')
      .select('id, external_uid, check_in_date, check_out_date, guest_name, reservation_status')
      .eq('property_id', source.property_id)
      .eq('external_source', externalSource)
      .gte('check_in_date', today)
      .not('external_uid', 'is', null);

    for (const reservation of tracked ?? []) {
      if (seenUids.has(reservation.external_uid)) continue;
      if (reservation.reservation_status === 'Cancelada') continue;

      const recorded = await recordPending(admin, {
        channel: 'ical',
        platform: source.platform,
        propertyId: source.property_id,
        reservationId: reservation.id,
        kind: 'possible_cancellation',
        dedupeKey: `cancel:${source.id}:${reservation.external_uid}`,
        summary: `Reserva de ${reservation.check_in_date} a ${reservation.check_out_date} sumiu do calendário do ${source.platform}. Pode ter sido cancelada.`,
        payload: {
          reservation_id: reservation.id,
          guest_name: reservation.guest_name,
          check_in: reservation.check_in_date,
          check_out: reservation.check_out_date,
        },
      });
      if (recorded) result.pending++;
    }
  }

  if (errors.length > 0) {
    result.status = 'partial';
    result.message = `${errors.length} evento(s) com erro: ${errors.slice(0, 3).join('; ')}`;
  }

  await admin.from('channel_sync_sources').update({
    last_sync_at: new Date().toISOString(),
    last_sync_status: result.status,
    last_sync_message: result.message ?? `${result.created} criada(s), ${result.updated} atualizada(s)`,
    last_content_hash: contentHash,
  }).eq('id', source.id);

  await logRun(admin, {
    sourceId: source.id,
    propertyId: source.property_id,
    channel: 'ical',
    platform: source.platform,
    status: result.status,
    eventsFound: result.eventsFound,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    pending: result.pending,
    message: result.message ?? null,
    details: { errors: errors.slice(0, 10) },
    startedAt,
  });

  return result;
}

function shiftIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // --- Autenticação: segredo de cron OU usuário autenticado do app ---------
  const providedSecret = req.headers.get('x-sync-secret') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const viaSecret = !!SYNC_SECRET && providedSecret === SYNC_SECRET;

  let userId: string | null = null;
  let visibleSourceIds: Set<string> | null = null;

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
    userId = data.user.id;

    // Respeita as políticas de RLS: o usuário só dispara o que ele enxerga.
    const { data: visible, error: visibleError } = await userClient
      .from('channel_sync_sources')
      .select('id');

    if (visibleError) {
      return jsonResponse({ error: 'Não foi possível validar as permissões' }, 403);
    }

    visibleSourceIds = new Set((visible ?? []).map((row: any) => row.id));
  }

  let body: { sourceId?: string; propertyId?: string; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let query = admin
    .from('channel_sync_sources')
    .select('*')
    .eq('is_active', true)
    .eq('source_type', 'ical');

  if (body.sourceId) query = query.eq('id', body.sourceId);
  if (body.propertyId) query = query.eq('property_id', body.propertyId);

  const { data: sources, error } = await query;
  if (error) {
    return jsonResponse({ error: `Erro ao carregar fontes: ${error.message}` }, 500);
  }

  const allowed = viaSecret || !visibleSourceIds
    ? (sources ?? [])
    : (sources ?? []).filter((source: any) => visibleSourceIds!.has(source.id));

  if (allowed.length === 0) {
    return jsonResponse({
      ok: true,
      message: 'Nenhuma fonte de sincronização ativa encontrada',
      results: [],
    });
  }

  const results: SourceResult[] = [];
  for (const source of allowed) {
    try {
      results.push(await syncSource(admin, source, body.force === true));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Falha na fonte ${source.id}:`, message);
      results.push({
        sourceId: source.id,
        propertyId: source.property_id,
        platform: source.platform,
        status: 'error',
        eventsFound: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        pending: 0,
        message,
      });
    }
  }

  const totals = results.reduce(
    (acc, item) => ({
      created: acc.created + item.created,
      updated: acc.updated + item.updated,
      skipped: acc.skipped + item.skipped,
      pending: acc.pending + item.pending,
    }),
    { created: 0, updated: 0, skipped: 0, pending: 0 },
  );

  return jsonResponse({ ok: true, triggeredBy: userId ?? 'cron', totals, results });
});
