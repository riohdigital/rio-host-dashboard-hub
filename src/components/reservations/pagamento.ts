/**
 * Situação do pagamento de uma reserva, num lugar só: a linha da lista
 * ("Pago" / "A receber" / "Cancelada") e os totais "Recebido · A receber"
 * usam estas funções para nunca divergirem.
 */

export type SituacaoPagamento = 'cancelada' | 'pago' | 'a_receber';

interface ReservaComPagamento {
  payment_status?: string | null;
  reservation_status?: string | null;
}

/** O pagamento já foi marcado como "Pago". */
export const ehPago = (status?: string | null) => (status || '').trim().toLowerCase() === 'pago';

/** A reserva foi cancelada (fica fora de Recebido e de A receber). */
export const ehCancelada = (status?: string | null) => /cancel/i.test(status || '');

/** Cancelada vem antes: uma reserva cancelada não conta como paga nem como a receber. */
export const situacaoDoPagamento = (reserva: ReservaComPagamento): SituacaoPagamento =>
  ehCancelada(reserva.reservation_status) ? 'cancelada' : ehPago(reserva.payment_status) ? 'pago' : 'a_receber';

export const ROTULO_DA_SITUACAO: Record<SituacaoPagamento, string> = {
  cancelada: 'Cancelada',
  pago: 'Pago',
  a_receber: 'A receber',
};

export const TOM_DA_SITUACAO: Record<SituacaoPagamento, 'danger' | 'success' | 'warning'> = {
  cancelada: 'danger',
  pago: 'success',
  a_receber: 'warning',
};
