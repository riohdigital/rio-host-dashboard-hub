/**
 * import-platform-statement
 *
 * Aplica as linhas de um extrato exportado do Airbnb ou do Booking.com.
 *
 * É a terceira e última fonte: o iCal traz as datas, o e-mail traz o hóspede,
 * e só o extrato traz o dinheiro — nenhuma das duas plataformas informa valor
 * por e-mail ou por calendário.
 *
 * O arquivo é lido no navegador; aqui chegam apenas as linhas já normalizadas.
 * Com `dryRun` a função não grava nada e apenas informa o que aconteceria, que
 * é o que alimenta a prévia da tela.
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

import {
  learnSourceHints,
  resolveProperty,
  type PropertyRow,
  type SourceRow,
} from '../_shared/propertyMatching.ts';
import {
  applyReservation,
  corsHeaders,
  findReservationByHints,
  jsonResponse,
  logRun,
  type ReservationCandidate,
} from '../_shared/reservationSync.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const MAX_LINHAS = 500;

interface StatementRow {
  reservationCode: string;
  guestName?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  numberOfGuests?: number | null;
  totalRevenue?: number | null;
  platformCommission?: number | null;
  listingName?: string | null;
  cancelled?: boolean;
}

interface RowOutcome {
  reservationCode: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  totalRevenue: number | null;
  propertyId: string | null;
  action: 'created' | 'updated' | 'skipped' | 'pending' | 'ignored';
  reason?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Não autorizado' }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'Não autorizado' }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Corpo inválido: envie JSON' }, 400);
  }

  const platform: string = body?.platform;
  if (platform !== 'Airbnb' && platform !== 'Booking.com') {
    return jsonResponse({ error: 'Plataforma inválida' }, 400);
  }

  const rows: StatementRow[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) return jsonResponse({ error: 'Nenhuma linha enviada' }, 400);
  if (rows.length > MAX_LINHAS) {
    return jsonResponse({ error: `Máximo de ${MAX_LINHAS} linhas por importação` }, 400);
  }

  const dryRun = body?.dryRun === true;
  const propertyIdInformado: string | null = body?.propertyId ?? null;
  const startedAt = new Date().toISOString();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Só é possível importar para propriedades que o próprio usuário enxerga.
  const { data: visiveis, error: visiveisError } = await userClient
    .from('properties')
    .select('id, name, nickname');

  if (visiveisError) return jsonResponse({ error: 'Não foi possível ler as propriedades' }, 403);

  const properties = (visiveis ?? []) as PropertyRow[];
  const permitidas = new Set(properties.map((property) => property.id));

  if (propertyIdInformado && !permitidas.has(propertyIdInformado)) {
    return jsonResponse({ error: 'Propriedade fora do seu acesso' }, 403);
  }

  const { data: fontes } = await admin
    .from('channel_sync_sources')
    .select('property_id, platform, listing_alias');
  const sources = (fontes ?? []) as SourceRow[];

  const outcomes: RowOutcome[] = [];

  for (const row of rows) {
    const codigo = String(row.reservationCode ?? '').trim();

    const base: RowOutcome = {
      reservationCode: codigo,
      guestName: row.guestName ?? null,
      checkIn: row.checkIn ?? null,
      checkOut: row.checkOut ?? null,
      totalRevenue: row.totalRevenue ?? null,
      propertyId: null,
      action: 'ignored',
    };

    if (!codigo) {
      outcomes.push({ ...base, reason: 'Linha sem código de reserva' });
      continue;
    }

    try {
      const resolvida = propertyIdInformado
        ? { propertyId: propertyIdInformado, how: 'escolhida_na_tela' }
        : resolveProperty({
            platform,
            listingName: row.listingName,
            properties,
            sources,
          });

      // O que o extrato não diz, a reserva já cadastrada costuma dizer.
      const jaCadastrada = await findReservationByHints(admin, {
        platform,
        reservationCode: codigo,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        propertyId: resolvida.propertyId,
      });

      const propertyId = resolvida.propertyId ?? jaCadastrada?.property_id ?? null;
      const checkIn = row.checkIn ?? jaCadastrada?.check_in_date ?? null;
      const checkOut = row.checkOut ?? jaCadastrada?.check_out_date ?? null;

      if (!propertyId) {
        outcomes.push({ ...base, reason: 'Não identifiquei o imóvel deste anúncio', action: 'pending' });
        continue;
      }

      if (!permitidas.has(propertyId)) {
        outcomes.push({ ...base, propertyId, reason: 'Propriedade fora do seu acesso' });
        continue;
      }

      if (!checkIn || !checkOut) {
        outcomes.push({ ...base, propertyId, reason: 'Linha sem as duas datas', action: 'pending' });
        continue;
      }

      if (dryRun) {
        outcomes.push({
          ...base,
          propertyId,
          checkIn,
          checkOut,
          action: jaCadastrada ? 'updated' : 'created',
          reason: jaCadastrada ? 'Completa a reserva existente' : 'Cria a reserva',
        });
        continue;
      }

      const candidate: ReservationCandidate = {
        propertyId,
        platform: platform as any,
        reservationCode: codigo,
        externalUid: `${platform}:${codigo}`,
        externalSource: platform === 'Airbnb' ? 'statement_airbnb' : 'statement_booking',
        checkIn,
        checkOut,
        guestName: row.guestName ?? null,
        numberOfGuests: row.numberOfGuests ?? null,
        totalRevenue: row.totalRevenue ?? null,
        reservationStatus: row.cancelled ? 'Cancelada' : 'Confirmada',
        metadata: {
          origem: 'extrato',
          comissao_da_plataforma: row.platformCommission ?? null,
          listing_name: row.listingName ?? null,
        },
      };

      const applied = await applyReservation(admin, candidate);

      if (row.listingName) {
        await learnSourceHints(admin, propertyId, platform, { listingName: row.listingName });
      }

      outcomes.push({
        ...base,
        propertyId,
        checkIn,
        checkOut,
        action: applied.action,
        reason: applied.reason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Erro ao importar linha:', message);
      outcomes.push({ ...base, reason: message });
    }
  }

  const totals = {
    created: outcomes.filter((o) => o.action === 'created').length,
    updated: outcomes.filter((o) => o.action === 'updated').length,
    skipped: outcomes.filter((o) => o.action === 'skipped').length,
    pending: outcomes.filter((o) => o.action === 'pending').length,
    ignored: outcomes.filter((o) => o.action === 'ignored').length,
  };

  if (!dryRun) {
    await logRun(admin, {
      propertyId: propertyIdInformado,
      channel: 'email',
      platform,
      status: totals.ignored > 0 ? 'partial' : 'success',
      eventsFound: rows.length,
      created: totals.created,
      updated: totals.updated,
      skipped: totals.skipped,
      pending: totals.pending,
      message: `Extrato do ${platform}: ${rows.length} linha(s)`,
      details: { outcomes: outcomes.slice(0, 50) },
      startedAt,
    });
  }

  return jsonResponse({ ok: true, dryRun, totals, results: outcomes });
});
