/**
 * Cores do kit de gráficos do celular, sempre pelos tokens de
 * src/styles/tokens.css. Canais de venda usam `corDoCanalGrafico` (tema.ts).
 */
export type TomGrafico = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutro';

const TOKENS: Record<TomGrafico, string> = {
  brand: 'hsl(var(--brand))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--danger))',
  info: 'hsl(var(--info))',
  neutro: 'hsl(var(--gray-400))',
};

/** Tom → cor CSS. Aceita também uma cor CSS pronta (ex.: a de um canal). */
export function corDoTom(tom: TomGrafico | string): string {
  return (TOKENS as Record<string, string>)[tom] ?? tom;
}

/** Texto e linhas dos gráficos sem eixo */
export const COR_TEXTO_FORTE = 'hsl(var(--gray-900))';
export const COR_TEXTO_FRACO = 'hsl(var(--gray-500))';
export const COR_TRILHO = 'hsl(var(--gray-100))';
export const FONTE_MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
