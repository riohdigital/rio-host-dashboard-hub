/**
 * Comprovante do Hóspede: quanto o hóspede pagou em cada mês.
 *
 * O valor do hóspede é diferente do valor do anfitrião (`total_revenue`, que é
 * o repasse depois da taxa da plataforma). A ordem das fontes:
 *   1. `guest_total_paid` gravado (sincronização ou formulário);
 *   2. reserva Direta: `total_revenue` (não há plataforma no meio);
 *   3. conferência da plataforma (`platform_verified_data`), só quando as datas
 *      conferidas são as da própria linha — numa estadia parcelada (R3) o valor
 *      conferido é da estadia inteira e não pode ir para uma parcela;
 *   4. sem fonte: o comprovante não é emitido (valor indisponível).
 *
 * Estadia que atravessa meses gera um comprovante por mês, com o valor
 * proporcional às noites daquele mês. Os centavos da divisão vão para o último
 * mês, para a soma bater com o total pago.
 */

export type GuestPaidSource = 'registrado' | 'direto' | 'conferido_plataforma';

export interface GuestReceiptReservation {
  id: string;
  platform: string;
  reservation_code: string;
  check_in_date: string;
  check_out_date: string;
  total_revenue: number | string | null;
  guest_total_paid?: number | string | null;
  reservation_status?: string | null;
  platform_verified_data?: unknown;
}

export interface GuestMonthReceipt<R extends GuestReceiptReservation = GuestReceiptReservation> {
  key: string;
  reservation: R;
  /** "2026-01" */
  monthKey: string;
  /** Noites da estadia dentro do mês. */
  nightsInMonth: number;
  totalNights: number;
  /** Primeira noite do mês e fim do período no mês (saída, ou última noite) — YYYY-MM-DD. */
  periodStart: string;
  periodEnd: string;
  /** Valor pago pelo hóspede referente ao mês. */
  amount: number;
  /** Valor total pago pela estadia. */
  stayTotal: number;
  /** A estadia tem noites em mais de um mês. */
  spansMonths: boolean;
  source: GuestPaidSource;
}

const DIA_MS = 86_400_000;

const toNumber = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

const toUtc = (data: string): number => {
  const [ano, mes, dia] = data.slice(0, 10).split('-').map(Number);
  return Date.UTC(ano, mes - 1, dia);
};

const toIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const parseVerified = (valor: unknown): Record<string, unknown> | null => {
  if (!valor) return null;
  if (typeof valor === 'string') {
    try {
      const objeto = JSON.parse(valor);
      return objeto && typeof objeto === 'object' ? objeto : null;
    } catch {
      return null;
    }
  }
  return typeof valor === 'object' ? (valor as Record<string, unknown>) : null;
};

/** Valor da conferência da plataforma, só quando as datas conferidas são as da linha. */
const valorConferido = (reserva: GuestReceiptReservation): number | null => {
  const dados = parseVerified(reserva.platform_verified_data);
  if (!dados) return null;

  const entrada = (dados.ci ?? dados.check_in_date) as string | undefined;
  const saida = (dados.co ?? dados.check_out_date) as string | undefined;
  if (entrada !== reserva.check_in_date || saida !== reserva.check_out_date) return null;

  // Booking (conferência na extranet): valor comissionável = o que o hóspede paga.
  const comissionavel = toNumber(dados.comissionavel);
  if (comissionavel && comissionavel > 0) return comissionavel;

  // Airbnb (conferência na página da reserva): "O hóspede pagou".
  const repasse = dados.payout_breakdown as Record<string, unknown> | undefined;
  const pagoPeloHospede = toNumber(repasse?.guest_total_paid);
  if (pagoPeloHospede && pagoPeloHospede > 0) return pagoPeloHospede;

  return null;
};

export const getGuestPaidAmount = (
  reserva: GuestReceiptReservation,
): { amount: number; source: GuestPaidSource } | null => {
  const registrado = toNumber(reserva.guest_total_paid);
  if (registrado && registrado > 0) return { amount: registrado, source: 'registrado' };

  if (reserva.platform === 'Direto') {
    const total = toNumber(reserva.total_revenue);
    return total && total > 0 ? { amount: total, source: 'direto' } : null;
  }

  const conferido = valorConferido(reserva);
  return conferido ? { amount: conferido, source: 'conferido_plataforma' } : null;
};

/**
 * Divide a estadia em comprovantes mensais. `range` (YYYY-MM-DD) limita aos
 * meses que têm noites dentro do filtro global; sem range, todos os meses.
 */
export const buildGuestMonthReceipts = <R extends GuestReceiptReservation>(
  reservas: R[],
  range?: { start: string; end: string } | null,
): GuestMonthReceipt<R>[] => {
  const comprovantes: GuestMonthReceipt<R>[] = [];
  const inicioFiltro = range ? toUtc(range.start) : null;
  const fimFiltro = range ? toUtc(range.end) : null;

  for (const reserva of reservas) {
    if (reserva.reservation_status === 'Cancelada') continue;

    const pago = getGuestPaidAmount(reserva);
    if (!pago) continue;

    const entrada = toUtc(reserva.check_in_date);
    const saida = toUtc(reserva.check_out_date);
    const totalNoites = Math.round((saida - entrada) / DIA_MS);
    if (totalNoites <= 0) continue;

    // Noites agrupadas por mês, na ordem.
    const meses: Array<{ chave: string; noites: number; primeira: number; ultima: number }> = [];
    for (let noite = entrada; noite < saida; noite += DIA_MS) {
      const chave = toIso(noite).slice(0, 7);
      const atual = meses[meses.length - 1];
      if (atual?.chave === chave) {
        atual.noites += 1;
        atual.ultima = noite;
      } else {
        meses.push({ chave, noites: 1, primeira: noite, ultima: noite });
      }
    }

    let distribuido = 0;
    meses.forEach((mes, indice) => {
      const ultimoMes = indice === meses.length - 1;
      const valor = ultimoMes
        ? Number((pago.amount - distribuido).toFixed(2))
        : Number(((pago.amount * mes.noites) / totalNoites).toFixed(2));
      distribuido = Number((distribuido + valor).toFixed(2));

      const dentroDoFiltro = inicioFiltro === null || fimFiltro === null
        || (mes.ultima >= inicioFiltro && mes.primeira <= fimFiltro);
      if (!dentroDoFiltro) return;

      comprovantes.push({
        key: `${reserva.id}-${mes.chave}`,
        reservation: reserva,
        monthKey: mes.chave,
        nightsInMonth: mes.noites,
        totalNights: totalNoites,
        periodStart: toIso(mes.primeira),
        // Último mês: a data de saída. Meses anteriores: a última noite do mês
        // (o comprovante de janeiro termina em 31/01, não em 01/02).
        periodEnd: ultimoMes ? toIso(saida) : toIso(mes.ultima),
        amount: valor,
        stayTotal: pago.amount,
        spansMonths: meses.length > 1,
        source: pago.source,
      });
    });
  }

  return comprovantes.sort((a, b) => (
    b.monthKey.localeCompare(a.monthKey) || b.periodStart.localeCompare(a.periodStart)
  ));
};

export const formatMonthLabel = (monthKey: string): string => {
  const [ano, mes] = monthKey.split('-').map(Number);
  const nome = new Date(Date.UTC(ano, mes - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
};
