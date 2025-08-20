import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Função para interpretar datas de forma segura, evitando problemas de timezone
 * que fazem as datas mudarem durante a conversão
 */
export const parseDate = (dateString: string): Date => {
  // Se a string já tem informação de timezone, usar diretamente
  if (dateString.includes('T') || dateString.includes('Z') || dateString.includes('+')) {
    return new Date(dateString);
  }
  
  // Para datas no formato YYYY-MM-DD, usar UTC para evitar problemas de timezone
  const dateParts = dateString.split('-');
  if (dateParts.length === 3) {
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Mês é 0-indexado
    const day = parseInt(dateParts[2]);
    return new Date(Date.UTC(year, month, day, 12, 0, 0)); // UTC para consistência
  }
  
  // Fallback para o comportamento padrão
  return new Date(dateString);
};

/**
 * Formatar data de forma segura para o padrão brasileiro
 */
export const formatDateSafe = (dateString: string): string => {
  const date = parseDate(dateString);
  return format(date, "dd/MM/yyyy", { locale: ptBR });
};

/**
 * Formatar data com horário
 */
export const formatDateWithTime = (dateString: string, time?: string): string => {
  const date = parseDate(dateString);
  const timeToUse = time || (dateString.includes('check_in') ? '14:00' : '11:00');
  return format(date, `dd/MM/yyyy 'às' ${timeToUse}`, { locale: ptBR });
};

/**
 * Calcular número de noites entre duas datas
 */
export const calculateNights = (checkInDate: string, checkOutDate: string): number => {
  const checkIn = parseDate(checkInDate);
  const checkOut = parseDate(checkOutDate);
  const diffInMs = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(diffInMs / (1000 * 60 * 60 * 24)));
};