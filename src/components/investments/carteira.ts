/**
 * Números da carteira de investimentos (faixa do celular e cartões do
 * computador), somados a partir do ROI por imóvel (useROICalculations).
 * É a mesma fonte das linhas "Por imóvel", então a soma das linhas é a faixa.
 *
 * Tudo aqui é acumulado: todas as reservas e todos os investimentos dos
 * imóveis que têm investimento. O filtro de período não entra.
 *
 * ROI da carteira = (receita líquida − investido) ÷ investido, com as somas
 * de todos os imóveis. Assim cada imóvel pesa pelo valor investido: na média
 * simples dos percentuais, um imóvel com pouquíssimo investido (e por isso
 * um ROI de milhares por cento) valia o mesmo que o de maior investimento.
 */
import type { PropertyROI } from '@/types/investment';

export interface ResumoCarteira {
  /** Soma do investido nos imóveis */
  investido: number;
  /** Soma da receita líquida das reservas desses imóveis */
  receitaLiquida: number;
  /** Receita líquida − investido */
  retornoLiquido: number;
  /** Retorno líquido ÷ investido, em % (0 sem investimento) */
  roi: number;
  /** Imóveis que já recuperaram o investido */
  lucrativos: number;
  /** Imóveis com investimento */
  imoveis: number;
}

export function resumirCarteira(roiData: PropertyROI[]): ResumoCarteira {
  const investido = roiData.reduce((soma, roi) => soma + roi.total_investment, 0);
  const receitaLiquida = roiData.reduce((soma, roi) => soma + roi.total_revenue, 0);
  const retornoLiquido = roiData.reduce((soma, roi) => soma + roi.net_revenue, 0);
  return {
    investido,
    receitaLiquida,
    retornoLiquido,
    roi: investido > 0 ? (retornoLiquido / investido) * 100 : 0,
    lucrativos: roiData.filter((roi) => roi.is_profitable).length,
    imoveis: roiData.length,
  };
}

/** Texto curto que acompanha os números (mesma base de tempo em toda a faixa) */
export const NOTA_ACUMULADO = 'Acumulado de todo o histórico. O período do filtro não entra.';

/** Explicação atrás do "i" do ROI da carteira */
export const AJUDA_ROI_CARTEIRA =
  'ROI da carteira = (receita líquida − investido) ÷ investido, somando os imóveis que têm investimento. É ponderado pelo valor investido: quanto mais dinheiro num imóvel, mais ele pesa no resultado. Conta todas as reservas e todos os investimentos desses imóveis, de qualquer data.';

/** Explicação atrás do "i" do ROI de cada imóvel */
export const AJUDA_ROI_IMOVEL =
  'ROI do imóvel = (receita líquida − investido) ÷ investido, com todas as reservas e todos os investimentos dele. Lucrativo: a receita líquida já passou do investido. A recuperar: ainda não.';
