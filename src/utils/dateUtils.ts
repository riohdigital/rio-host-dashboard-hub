/**
 * Utilitário de datas para evitar o bug de fuso horário UTC (-1 dia)
 * ao formatar strings ISO 'YYYY-MM-DD' no fuso do Brasil (UTC-3).
 */
export const formatLocalDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  
  // Se for uma string no formato ISO 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm:ss'
  const dateOnly = dateStr.split('T')[0];
  const parts = dateOnly.split('-');
  
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year.length === 4 && month.length === 2 && day.length === 2) {
      return `${day}/${month}/${year}`;
    }
  }
  
  // Fallback seguro caso venha outro formato
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};
