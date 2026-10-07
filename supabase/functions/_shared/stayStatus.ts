/**
 * Status da reserva pela data e hora (pedido do Dono em 07/10/2026).
 *
 * Confirmada → Em Andamento a partir do horário de check-in do dia de entrada;
 * Em Andamento → Finalizada a partir do horário de check-out do dia de saída.
 * Horário de Brasília. Sem horário na reserva, vale o padrão do imóvel e, sem
 * ele, 15:00 e 11:00 (os padrões do banco).
 * Cancelada, pedido e qualquer outro status nunca são tocados. O gatilho de
 * auditoria do banco só reage a cancelamento, então esta troca não dispara nada.
 */

// deno-lint-ignore-file no-explicit-any

export type StatusDeEstadia = 'Confirmada' | 'Em Andamento' | 'Finalizada';

const AUTOMATICOS: StatusDeEstadia[] = ['Confirmada', 'Em Andamento', 'Finalizada'];

/** "2026-10-07T14:00" no horário de Brasília, para comparar com data + hora da reserva. */
export function agoraEmBrasilia(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);
}

function hora(valor: string | null | undefined, padrao: string): string {
  return /^\d{2}:\d{2}/.test(valor ?? '') ? String(valor).slice(0, 5) : padrao;
}

/** Status que a reserva deve ter agora; null quando o status atual não é automático. */
export function statusPorData(
  reserva: { reservation_status?: string | null; check_in_date: string; check_out_date: string; checkin_time?: string | null; checkout_time?: string | null },
  agoraBrasilia: string,
  padraoDoImovel: { checkin?: string | null; checkout?: string | null } = {},
): StatusDeEstadia | null {
  if (!AUTOMATICOS.includes(reserva.reservation_status as StatusDeEstadia)) return null;

  const entrada = `${reserva.check_in_date}T${hora(reserva.checkin_time, hora(padraoDoImovel.checkin, '15:00'))}`;
  const saida = `${reserva.check_out_date}T${hora(reserva.checkout_time, hora(padraoDoImovel.checkout, '11:00'))}`;

  if (agoraBrasilia >= saida) return 'Finalizada';
  if (agoraBrasilia >= entrada) return 'Em Andamento';
  return 'Confirmada';
}

/** Atualiza o status das reservas que começaram ou terminaram desde a última rodada. */
export async function atualizarStatusPorData(admin: any, agora: Date = new Date()): Promise<number> {
  const agoraBR = agoraEmBrasilia(agora);
  const hoje = agoraBR.slice(0, 10);

  // Só o que pode mudar: entrada até hoje e ainda não finalizada.
  const { data, error } = await admin
    .from('reservations')
    .select('id, property_id, reservation_status, check_in_date, check_out_date, checkin_time, checkout_time')
    .in('reservation_status', ['Confirmada', 'Em Andamento'])
    .lte('check_in_date', hoje)
    .limit(1000);

  if (error) throw new Error(`Falha ao ler reservas para o status: ${error.message}`);
  if (!data?.length) return 0;

  const { data: imoveis } = await admin.from('properties').select('id, default_checkin_time, default_checkout_time');
  const padroes = new Map<string, { checkin?: string | null; checkout?: string | null }>(
    (imoveis ?? []).map((p: any) => [p.id, { checkin: p.default_checkin_time, checkout: p.default_checkout_time }]),
  );

  let alteradas = 0;
  for (const r of data) {
    const novo = statusPorData(r, agoraBR, padroes.get(r.property_id));
    if (!novo || novo === r.reservation_status) continue;
    const { error: e } = await admin
      .from('reservations')
      .update({ reservation_status: novo })
      .eq('id', r.id)
      .eq('reservation_status', r.reservation_status);
    if (e) console.error(`Falha ao atualizar o status de ${r.id}:`, e.message);
    else alteradas++;
  }
  return alteradas;
}
