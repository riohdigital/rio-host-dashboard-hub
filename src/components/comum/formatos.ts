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

const brlInteiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** R$ 12.346 — valores em destaque e gráficos do celular, sem centavos */
export const formatarMoedaSemCentavos = (valor: number | null | undefined) => brlInteiro.format(Math.round(Number(valor) || 0));

/** 4200 → "4,2 mil"; 950 → "950" (rótulos de gráfico; diga "em R$" no título) */
export function formatarNumeroCurto(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1_000) return `${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: a >= 10_000 ? 0 : 1 })} mil`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
