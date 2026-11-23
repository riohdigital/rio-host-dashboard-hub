/** Cores semânticas das etiquetas e canais, sempre pelos tokens */

/** Tom de cor de uma etiqueta, sempre pelos tokens */
export type Tom = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutro';

export const TONS: Record<Tom, string> = {
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-800 border-warning-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  info: 'bg-info-50 text-info-700 border-info-200',
  neutro: 'bg-gray-100 text-gray-700 border-gray-200',
};

/** Status de reserva, pagamento e faxina → tom */
export function tomDoStatus(status?: string | null): Tom {
  switch ((status || '').toLowerCase()) {
    case 'confirmada':
    case 'pago':
    case 'paga':
    case 'realizada':
    case 'concluída':
    case 'concluida':
      return 'success';
    case 'em andamento':
      return 'info';
    case 'pendente':
    case 'pagamento no próximo ciclo':
      return 'warning';
    case 'cancelada':
    case 'atrasado':
      return 'danger';
    case 'finalizada':
      return 'neutro';
    default:
      return 'neutro';
  }
}

/** Canal de venda → classe de cor do token (cor fixa em todo o app) */
export function corDoCanal(plataforma?: string | null): { fundo: string; texto: string; ponto: string; css: string } {
  const p = (plataforma || '').toLowerCase();
  if (p.includes('airbnb')) return { fundo: 'bg-airbnb/10', texto: 'text-airbnb', ponto: 'bg-airbnb', css: 'hsl(var(--airbnb))' };
  if (p.includes('booking')) return { fundo: 'bg-booking/10', texto: 'text-booking', ponto: 'bg-booking', css: 'hsl(var(--booking))' };
  if (p.includes('vrbo')) return { fundo: 'bg-vrbo/10', texto: 'text-vrbo', ponto: 'bg-vrbo', css: 'hsl(var(--vrbo))' };
  if (p.includes('expedia')) return { fundo: 'bg-expedia/15', texto: 'text-warning-800', ponto: 'bg-expedia', css: 'hsl(var(--expedia))' };
  if (p.includes('diret') || p.includes('direct')) return { fundo: 'bg-direct/10', texto: 'text-success-700', ponto: 'bg-direct', css: 'hsl(var(--direct))' };
  return { fundo: 'bg-gray-100', texto: 'text-gray-700', ponto: 'bg-gray-400', css: 'hsl(var(--channel-other))' };
}

