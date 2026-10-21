import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { LocalEvent } from '@/types/pricing';
import { eventosFuturos } from '@/components/pricing/ocupacao';

/**
 * Feriados e eventos confirmados (com fonte) que cruzam o período. O filtro por imóvel fica com
 * quem usa (eventoValeParaImovel), pelo escopo do evento contra a localização de cada imóvel.
 */
export const useEventosDoPeriodo = (startDate: Date, endDate: Date) => {
  const inicio = format(startDate, 'yyyy-MM-dd');
  const fim = format(endDate, 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['eventos-do-periodo', inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('local_events')
        .select('*')
        .eq('is_active', true)
        .eq('is_confirmed', true)
        .lte('start_date', fim)
        .gte('end_date', inicio)
        .order('start_date', { ascending: true });
      if (error) throw error;
      // Mesma limpeza da Precificação: sem repetidos e sem o feriado já coberto pelo prolongado.
      return eventosFuturos((data as unknown as LocalEvent[]) || [], inicio) as LocalEvent[];
    },
    staleTime: 10 * 60 * 1000,
  });
};
