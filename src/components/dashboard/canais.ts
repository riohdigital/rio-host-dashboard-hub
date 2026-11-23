/**
 * Regras de recebimento de cada canal, usadas no Detalhamento por Plataforma
 * (computador) e no bloco Receita por canal (celular, ao tocar no canal).
 */
export function regraDeRecebimento(canal: string): string {
  const c = canal.toLowerCase();
  if (c.includes('airbnb')) return 'Recebe em D+1';
  if (c.includes('booking')) return 'Recebe mês seguinte';
  return 'Recebe no check-in';
}

/** Explicação mais longa da regra, para o toque no canal no celular */
export function explicacaoDoRecebimento(canal: string): string {
  const c = canal.toLowerCase();
  if (c.includes('airbnb')) return 'O Airbnb repassa em D+1: o valor entra um dia depois do check-in.';
  if (c.includes('booking')) return 'O Booking.com repassa no mês seguinte ao check-out.';
  return 'Reserva direta: o valor é recebido no check-in.';
}
