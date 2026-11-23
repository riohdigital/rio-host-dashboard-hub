/** Formatos de número e data usados nas telas (valores em fonte mono) */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** R$ 12.345,67 */
export const formatarMoeda = (valor: number | null | undefined) => brl.format(Number(valor) || 0);

/** R$ 12 mil / R$ 1,2 mi — para eixos de gráfico e espaços curtos */
export function formatarMoedaCurta(valor: number | null | undefined): string {
  const v = Number(valor) || 0;
  const abs = Math.abs(v);
  const sinal = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: abs >= 10_000 ? 0 : 1 })} mil`;
  return `${sinal}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

/** "2026-11-23" → "23/11/2026" (sem fuso) */
export function formatarData(data: string | null | undefined, curta = false): string {
  if (!data) return '';
  const [a, m, d] = data.slice(0, 10).split('-');
  if (!a || !m || !d) return '';
  return curta ? `${d}/${m}` : `${d}/${m}/${a}`;
}
