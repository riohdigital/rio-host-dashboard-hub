/**
 * Regras de correspondência e gravação de reservas vindas de fontes externas.
 *
 * Princípio: a sincronização nunca sobrescreve trabalho manual. Ela cria o que
 * não existe, completa o que está vazio e manda para conferência humana tudo
 * que for ambíguo.
 */

// deno-lint-ignore-file no-explicit-any
import type { SyncPlatform } from './emailParsers.ts';

export interface ReservationCandidate {
  propertyId: string;
  platform: SyncPlatform;
  reservationCode: string;
  externalUid: string | null;
  externalSource: string;
  checkIn: string;
  checkOut: string;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  numberOfGuests?: number | null;
  totalRevenue?: number | null;
  reservationStatus?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ApplyResult {
  action: 'created' | 'updated' | 'skipped';
  reservationId: string | null;
  reason?: string;
  changes?: Record<string, unknown>;
}

/** Códigos gerados por nós quando a origem não expõe o código real. */
export function isPlaceholderCode(code: string | null | undefined): boolean {
  return !!code && /^SYNC-/.test(code);
}

export function buildPlaceholderCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `SYNC-${hash.toString(36).toUpperCase().padStart(7, '0')}`;
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '' ||
    (typeof value === 'number' && value === 0);
}

/**
 * Procura a reserva correspondente, do critério mais forte para o mais fraco:
 *   1. mesmo UID externo na mesma propriedade (idempotência exata)
 *   2. mesmo código de reserva real na mesma plataforma
 *   3. mesma propriedade + plataforma + data de check-in (tolerância 1 dia)
 */
export async function findExistingReservation(
  supabase: any,
  candidate: ReservationCandidate,
): Promise<any | null> {
  if (candidate.externalUid) {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('property_id', candidate.propertyId)
      .eq('external_uid', candidate.externalUid)
      .maybeSingle();
    if (data) return data;
  }

  if (!isPlaceholderCode(candidate.reservationCode)) {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('platform', candidate.platform)
      .eq('reservation_code', candidate.reservationCode)
      .limit(1);
    if (data?.length) return data[0];
  }

  const from = shiftDate(candidate.checkIn, -1);
  const to = shiftDate(candidate.checkIn, 1);
  const { data } = await supabase
    .from('reservations')
    .select('*')
    .eq('property_id', candidate.propertyId)
    .eq('platform', candidate.platform)
    .gte('check_in_date', from)
    .lte('check_in_date', to)
    .order('check_in_date', { ascending: true });

  if (!data?.length) return null;

  // Entre candidatos próximos, prefere o que também bate o check-out.
  return data.find((row: any) => row.check_out_date === candidate.checkOut) ?? data[0];
}

export function shiftDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

const COLUNAS_RESERVA =
  'id, property_id, platform, reservation_code, check_in_date, check_out_date, reservation_status';

/** Só aceita o resultado quando todas as linhas são da mesma propriedade. */
function umaPropriedadeSo(rows: any[] | null | undefined): any | null {
  if (!rows?.length) return null;
  const propriedades = new Set(rows.map((row: any) => row.property_id));
  return propriedades.size === 1 ? rows[0] : null;
}

export interface ReservationLookup {
  platform: string;
  reservationCode?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  /** Quando a propriedade já é conhecida, restringe a busca a ela. */
  propertyId?: string | null;
}

/**
 * Procura a reserva que um e-mail ou uma linha de extrato descreve.
 *
 * É o outro lado da moeda dos dois canais: a plataforma traz hóspede e valor
 * mas às vezes omite a propriedade e as datas; a reserva que o iCal já criou
 * tem exatamente essas duas coisas. Da pista mais forte para a mais fraca.
 */
export async function findReservationByHints(
  supabase: any,
  lookup: ReservationLookup,
): Promise<any | null> {
  // 1. Código real da plataforma.
  if (lookup.reservationCode) {
    const { data } = await supabase
      .from('reservations')
      .select(COLUNAS_RESERVA)
      .eq('platform', lookup.platform)
      .eq('reservation_code', lookup.reservationCode)
      .limit(2);
    if (data?.length === 1) return data[0];
  }

  // 2. As duas datas.
  if (lookup.checkIn && lookup.checkOut) {
    let query = supabase
      .from('reservations')
      .select(COLUNAS_RESERVA)
      .eq('platform', lookup.platform)
      .eq('check_in_date', lookup.checkIn)
      .eq('check_out_date', lookup.checkOut);
    if (lookup.propertyId) query = query.eq('property_id', lookup.propertyId);

    const { data } = await query;
    const unica = umaPropriedadeSo(data);
    if (unica) return unica;
  }

  // 3. Só a data de entrada — é o que o assunto do "Nova reserva!" do
  //    Booking.com oferece: "(6124022858, sexta-feira, 11 de setembro de 2026)".
  if (lookup.checkIn) {
    let query = supabase
      .from('reservations')
      .select(COLUNAS_RESERVA)
      .eq('platform', lookup.platform)
      .gte('check_in_date', shiftDate(lookup.checkIn, -1))
      .lte('check_in_date', shiftDate(lookup.checkIn, 1));
    if (lookup.propertyId) query = query.eq('property_id', lookup.propertyId);

    const { data } = await query;
    const unica = umaPropriedadeSo(data);
    if (unica) return unica;
  }

  return null;
}

export interface ApplyOptions {
  /**
   * Não cria a reserva quando o período já está ocupado por outra reserva da
   * mesma propriedade, em qualquer plataforma. Usado para eventos de iCal que
   * não trazem código próprio — é impossível distinguir uma reserva real do
   * espelho de uma reserva feita na outra plataforma.
   */
  skipCreateIfOverlapping?: boolean;
}

/** Dois períodos se sobrepõem? A data de check-out é dia livre, logo exclusiva. */
export function datesOverlap(
  aCheckIn: string,
  aCheckOut: string,
  bCheckIn: string,
  bCheckOut: string,
): boolean {
  return aCheckIn < bCheckOut && aCheckOut > bCheckIn;
}

/**
 * Procura uma reserva ativa da propriedade que ocupe o mesmo período,
 * independente da plataforma. Prefere a que casa exatamente as duas datas.
 */
export async function findOverlappingReservation(
  supabase: any,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<any | null> {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, platform, reservation_code, check_in_date, check_out_date, reservation_status')
    .eq('property_id', propertyId)
    .lt('check_in_date', checkOut)
    .gt('check_out_date', checkIn);

  if (error) {
    console.error('Erro ao checar sobreposição:', error.message);
    return null;
  }

  const active = (data ?? []).filter((row: any) =>
    row.reservation_status !== 'Cancelada'
    && datesOverlap(row.check_in_date, row.check_out_date, checkIn, checkOut));

  if (active.length === 0) return null;

  return active.find((row: any) =>
    row.check_in_date === checkIn && row.check_out_date === checkOut) ?? active[0];
}

/**
 * Cria ou completa a reserva. Campos já preenchidos manualmente são mantidos;
 * datas e status de cancelamento são as únicas informações que a origem tem
 * autoridade para atualizar.
 */
export async function applyReservation(
  supabase: any,
  candidate: ReservationCandidate,
  options: ApplyOptions = {},
): Promise<ApplyResult> {
  const existing = await findExistingReservation(supabase, candidate);
  const now = new Date().toISOString();

  const metadata = {
    ...(candidate.metadata ?? {}),
    external_source: candidate.externalSource,
    synced_at: now,
  };

  if (!existing) {
    // Calendários cruzados entre plataformas espelham a mesma estadia: o que o
    // Airbnb reserva vira "bloqueado" no feed do Booking e vice-versa. Sem esta
    // checagem a mesma hospedagem entraria duas vezes.
    if (options.skipCreateIfOverlapping) {
      const overlap = await findOverlappingReservation(
        supabase,
        candidate.propertyId,
        candidate.checkIn,
        candidate.checkOut,
      );

      if (overlap) {
        const sameDates = overlap.check_in_date === candidate.checkIn
          && overlap.check_out_date === candidate.checkOut;
        return {
          action: 'skipped',
          reservationId: overlap.id,
          reason: sameDates ? 'espelho_de_outra_plataforma' : 'sobreposicao_parcial',
          changes: {
            reserva_existente: overlap.reservation_code,
            plataforma_existente: overlap.platform,
            periodo_existente: `${overlap.check_in_date} a ${overlap.check_out_date}`,
          },
        };
      }
    }

    const insertPayload: Record<string, unknown> = {
      property_id: candidate.propertyId,
      platform: candidate.platform,
      reservation_code: candidate.reservationCode,
      external_uid: candidate.externalUid,
      external_source: candidate.externalSource,
      check_in_date: candidate.checkIn,
      check_out_date: candidate.checkOut,
      guest_name: candidate.guestName ?? null,
      guest_email: candidate.guestEmail ?? null,
      guest_phone: candidate.guestPhone ?? null,
      number_of_guests: candidate.numberOfGuests ?? null,
      total_revenue: candidate.totalRevenue ?? 0,
      reservation_status: candidate.reservationStatus ?? 'Confirmada',
      payment_status: 'Pendente',
      created_by_source: candidate.externalSource,
      automation_metadata: metadata,
      last_synced_at: now,
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) throw new Error(`Falha ao criar reserva: ${error.message}`);
    return { action: 'created', reservationId: data.id };
  }

  const updates: Record<string, unknown> = {};

  // Datas: a plataforma é a fonte da verdade.
  if (existing.check_in_date !== candidate.checkIn) updates.check_in_date = candidate.checkIn;
  if (existing.check_out_date !== candidate.checkOut) updates.check_out_date = candidate.checkOut;

  // Código real substitui placeholder gerado por nós.
  if (isPlaceholderCode(existing.reservation_code) && !isPlaceholderCode(candidate.reservationCode)) {
    updates.reservation_code = candidate.reservationCode;
  }

  if (!existing.external_uid && candidate.externalUid) {
    updates.external_uid = candidate.externalUid;
  }

  // Demais campos: só completam lacunas.
  const fillable: Array<[string, unknown]> = [
    ['guest_name', candidate.guestName],
    ['guest_email', candidate.guestEmail],
    ['guest_phone', candidate.guestPhone],
    ['number_of_guests', candidate.numberOfGuests],
    ['total_revenue', candidate.totalRevenue],
  ];

  for (const [column, value] of fillable) {
    if (!isEmpty(value) && isEmpty(existing[column])) {
      updates[column] = value;
    }
  }

  // Cancelamento é informação nova e relevante o bastante para sobrescrever.
  if (candidate.reservationStatus === 'Cancelada' && existing.reservation_status !== 'Cancelada') {
    updates.reservation_status = 'Cancelada';
  }

  if (Object.keys(updates).length === 0) {
    await supabase
      .from('reservations')
      .update({ last_synced_at: now })
      .eq('id', existing.id);
    return { action: 'skipped', reservationId: existing.id, reason: 'sem_mudancas' };
  }

  updates.last_synced_at = now;
  updates.automation_metadata = {
    ...(existing.automation_metadata ?? {}),
    ...metadata,
    last_changes: Object.keys(updates),
  };

  const { error } = await supabase
    .from('reservations')
    .update(updates)
    .eq('id', existing.id);

  if (error) throw new Error(`Falha ao atualizar reserva: ${error.message}`);

  return { action: 'updated', reservationId: existing.id, changes: updates };
}

export interface PendingItem {
  channel: 'ical' | 'email';
  platform?: string | null;
  propertyId?: string | null;
  reservationId?: string | null;
  kind: 'unmatched_property' | 'incomplete_data' | 'possible_cancellation' | 'conflict';
  dedupeKey: string;
  summary: string;
  payload: Record<string, unknown>;
}

/** Grava (sem duplicar) um item na fila de conferência humana. */
export async function recordPending(supabase: any, item: PendingItem): Promise<boolean> {
  const { error } = await supabase
    .from('reservation_sync_pending')
    .upsert(
      {
        channel: item.channel,
        platform: item.platform ?? null,
        property_id: item.propertyId ?? null,
        reservation_id: item.reservationId ?? null,
        kind: item.kind,
        dedupe_key: item.dedupeKey,
        summary: item.summary,
        payload: item.payload,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );

  if (error) {
    console.error('Erro ao registrar pendência:', error.message);
    return false;
  }
  return true;
}

export interface RunLog {
  sourceId?: string | null;
  propertyId?: string | null;
  channel: 'ical' | 'email';
  platform?: string | null;
  status: 'success' | 'partial' | 'error' | 'skipped';
  eventsFound?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  pending?: number;
  message?: string | null;
  details?: Record<string, unknown> | null;
  startedAt: string;
}

export async function logRun(supabase: any, run: RunLog): Promise<void> {
  const { error } = await supabase.from('channel_sync_runs').insert({
    source_id: run.sourceId ?? null,
    property_id: run.propertyId ?? null,
    channel: run.channel,
    platform: run.platform ?? null,
    status: run.status,
    events_found: run.eventsFound ?? 0,
    reservations_created: run.created ?? 0,
    reservations_updated: run.updated ?? 0,
    reservations_skipped: run.skipped ?? 0,
    pending_created: run.pending ?? 0,
    message: run.message ?? null,
    details: run.details ?? null,
    started_at: run.startedAt,
    finished_at: new Date().toISOString(),
  });

  if (error) console.error('Erro ao gravar log de sincronização:', error.message);
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
