/**
 * Tema dos gráficos (Recharts), sempre pelos tokens de src/styles/tokens.css.
 * Paleta categórica validada para daltonismo (chart-1..6); canais de venda
 * com cor fixa em todo o app.
 */
import { formatarMoeda, formatarMoedaCurta } from '@/components/comum/formatos';

export const CORES_SERIE = [1, 2, 3, 4, 5, 6].map((n) => `hsl(var(--chart-${n}))`);

/** Cor fixa por canal. Booking usa o azul claro da marca, legível em gráfico. */
export function corDoCanalGrafico(canal?: string | null): string {
  const c = (canal || '').toLowerCase();
  if (c.includes('airbnb')) return 'hsl(var(--airbnb))';
  if (c.includes('booking')) return 'hsl(var(--booking-light))';
  if (c.includes('vrbo')) return 'hsl(var(--vrbo))';
  if (c.includes('expedia')) return 'hsl(var(--expedia))';
  if (c.includes('diret') || c.includes('direct')) return 'hsl(var(--direct))';
  return 'hsl(var(--channel-other))';
}

/** Grade: só linhas horizontais, bem claras */
export const PROPS_GRADE = {
  vertical: false,
  stroke: 'hsl(var(--chart-grid))',
  strokeDasharray: '0',
} as const;

const TICK = { fontSize: 11, fill: 'hsl(var(--chart-axis))' };

export const PROPS_EIXO_X = {
  tick: TICK,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 8,
} as const;

export const PROPS_EIXO_Y = {
  tick: TICK,
  tickLine: false,
  axisLine: false,
  width: 78,
} as const;

/** Eixo de dinheiro compacto (R$ 12 mil); o tooltip mostra o valor completo */
export const eixoMoeda = (v: number) => formatarMoedaCurta(v);
export const moedaCompleta = (v: number) => formatarMoeda(v);

/** Cantos arredondados no topo das barras verticais */
export const RAIO_BARRA: [number, number, number, number] = [4, 4, 0, 0];
/** Cantos arredondados na ponta das barras horizontais */
export const RAIO_BARRA_H: [number, number, number, number] = [0, 4, 4, 0];
