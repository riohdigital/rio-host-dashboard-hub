/**
 * Cores dos tokens (src/styles/tokens.css) para uso fora de classes.
 *
 * - `cor('brand')` → 'hsl(var(--brand))', para estilos e gráficos na tela.
 * - `corResolvida('brand')` → 'hsl(238.5 64.6% 64.5%)', com o valor já lido do
 *   CSS. Use nos modelos capturados pelo html2canvas (PDF/recibo): dentro de
 *   SVG ele não resolve var().
 */
export const cor = (token: string, alfa?: number) =>
  alfa === undefined ? `hsl(var(--${token}))` : `hsl(var(--${token}) / ${alfa})`;

export function corResolvida(token: string, alfa?: number): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return cor(token, alfa);
  const valor = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  if (!valor) return cor(token, alfa);
  return alfa === undefined ? `hsl(${valor})` : `hsl(${valor} / ${alfa})`;
}
