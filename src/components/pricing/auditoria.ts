/**
 * Leitura da auditoria de uma reserva: o que o sistema tem × o que foi visto
 * no portal da plataforma, e o resultado que vira etiqueta na lista.
 *
 * Só apresentação: nada aqui grava nem muda valores. `platform_verified_data`
 * chega em dois formatos, conforme quem conferiu:
 *   - conferência manual: { ci, co, r1, comissionavel?, comissao?, fonte, conferido_por }
 *   - auditoria automática (texto JSON): { check_in_date, check_out_date,
 *     total_revenue, cleaning_fee, payout_breakdown, discrepancies, installments, status }
 * Campo que não vier simplesmente não aparece.
 *
 * Arquivo sem dependências, para rodar direto no Node:
 *   node --experimental-strip-types src/components/pricing/auditoria.ts
 */

export type ResultadoAuditoria = 'conferida' | 'diferenca' | 'pendente' | 'nao_concluida';

/** O mínimo de uma reserva que a leitura precisa */
export interface ReservaParaAuditoria {
  check_in_date?: string | null;
  check_out_date?: string | null;
  total_revenue?: number | string | null;
  is_verified_by_ai?: boolean | null;
  verification_notes?: string | null;
  platform_verified_data?: unknown;
}

/** O que foi visto no portal, já com nomes únicos */
export interface ConferenciaPortal {
  entrada?: string;
  saida?: string;
  /** Receita do anfitrião vista no portal (mesma medida do `total_revenue`) */
  receita?: number;
  limpeza?: number;
  /** Booking: valor comissionável e comissão */
  comissionavel?: number;
  comissao?: number;
  /** Airbnb: detalhes do repasse */
  bruto?: number;
  repasse?: number;
  coanfitriao?: number;
  pagoPeloHospede?: number;
  fonte?: string;
  conferidoPor?: string;
  /** Observações escritas pela auditoria automática */
  apontamentos: string[];
  /** Parcelas de uma estadia longa (0 quando não há) */
  parcelas: number;
  /** A auditoria automática terminou com erro */
  falhou: boolean;
}

const numero = (valor: unknown): number | undefined => {
  if (valor === null || valor === undefined || valor === '') return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
};

const texto = (valor: unknown): string | undefined => (typeof valor === 'string' && valor.trim() ? valor.trim() : undefined);

const objeto = (valor: unknown): Record<string, unknown> | null => {
  if (!valor) return null;
  if (typeof valor === 'string') {
    try {
      const lido: unknown = JSON.parse(valor);
      return lido && typeof lido === 'object' && !Array.isArray(lido) ? (lido as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
};

/** Lê `platform_verified_data` nos dois formatos; null quando não há nada aproveitável */
export function lerConferencia(valor: unknown): ConferenciaPortal | null {
  const dados = objeto(valor);
  if (!dados) return null;
  const repasse = objeto(dados.payout_breakdown) ?? {};
  return {
    entrada: texto(dados.ci ?? dados.check_in_date)?.slice(0, 10),
    saida: texto(dados.co ?? dados.check_out_date)?.slice(0, 10),
    receita: numero(dados.r1 ?? dados.total_revenue),
    limpeza: numero(dados.cleaning_fee),
    comissionavel: numero(dados.comissionavel),
    comissao: numero(dados.comissao),
    bruto: numero(repasse.gross_total),
    repasse: numero(repasse.host_payout),
    coanfitriao: numero(repasse.cohost_fee),
    pagoPeloHospede: numero(repasse.guest_total_paid),
    fonte: texto(dados.fonte),
    conferidoPor: texto(dados.conferido_por),
    apontamentos: Array.isArray(dados.discrepancies) ? dados.discrepancies.filter((d): d is string => typeof d === 'string' && d.trim() !== '') : [],
    parcelas: Array.isArray(dados.installments) ? dados.installments.length : 0,
    falhou: dados.status === 'error',
  };
}

/** O portal mostrou as mesmas datas desta linha (numa estadia parcelada mostra a estadia inteira) */
export function mesmoPeriodo(reserva: ReservaParaAuditoria, conferencia: ConferenciaPortal | null): boolean {
  if (!conferencia?.entrada || !conferencia.saida) return false;
  return conferencia.entrada === (reserva.check_in_date || '').slice(0, 10) && conferencia.saida === (reserva.check_out_date || '').slice(0, 10);
}

/**
 * Receita do portal − receita do sistema, em reais. null quando não dá para
 * comparar: sem valor do portal, ou datas diferentes das da linha.
 */
export function diferencaDeReceita(reserva: ReservaParaAuditoria, conferencia: ConferenciaPortal | null): number | null {
  if (!conferencia || conferencia.receita === undefined || !mesmoPeriodo(reserva, conferencia)) return null;
  const sistema = numero(reserva.total_revenue);
  if (sistema === undefined) return null;
  return Math.round((conferencia.receita - sistema) * 100) / 100;
}

/** A nota começa dizendo que a auditoria não rodou ou falhou */
const NOTA_SEM_RESULTADO = /^\s*\[Auditoria (falhou|não executada)/i;

/**
 * O resultado que vira etiqueta:
 *   conferida      conferida no portal, sem diferença de valor
 *   diferenca      conferida, mas o valor do portal não é o do sistema
 *   nao_concluida  tentou auditar e não conseguiu (erro ou sem login)
 *   pendente       ainda não foi conferida
 */
export function resultadoDaAuditoria(reserva: ReservaParaAuditoria): ResultadoAuditoria {
  const conferencia = lerConferencia(reserva.platform_verified_data);
  if (reserva.is_verified_by_ai) {
    const diferenca = diferencaDeReceita(reserva, conferencia);
    return diferenca !== null && diferenca !== 0 ? 'diferenca' : 'conferida';
  }
  if (conferencia?.falhou || NOTA_SEM_RESULTADO.test(reserva.verification_notes || '')) return 'nao_concluida';
  return 'pendente';
}

export const ROTULO_DO_RESULTADO: Record<ResultadoAuditoria, string> = {
  conferida: 'Conferida',
  diferenca: 'Com diferença',
  pendente: 'Pendente',
  nao_concluida: 'Não concluída',
};

export const TOM_DO_RESULTADO: Record<ResultadoAuditoria, 'success' | 'warning' | 'danger'> = {
  conferida: 'success',
  diferenca: 'warning',
  pendente: 'warning',
  nao_concluida: 'danger',
};

/** Sem acento e em minúsculas, para a busca */
export const semAcento = (valor: string) => valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
