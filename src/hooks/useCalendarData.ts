import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarReservation } from '@/types/calendar';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface UseCalendarDataParams {
  startDate: Date;
  endDate: Date;
  propertyIds?: string[];
  platform?: string;
}

export const useCalendarData = ({ 
  startDate, 
  endDate, 
  propertyIds,
  platform 
}: UseCalendarDataParams) => {
  return useQuery({
    queryKey: ['calendar-reservations', startDate, endDate, propertyIds, platform],
    queryFn: async () => {
      let query = supabase
        .from('reservations')
        .select(`
          *,
          properties (
            id,
            name,
            nickname,
            address
          )
        `)
        .gte('check_out_date', format(startDate, 'yyyy-MM-dd'))
        .lte('check_in_date', format(endDate, 'yyyy-MM-dd'))
        .order('check_in_date', { ascending: true });

      // Filtro de propriedades
      if (propertyIds && propertyIds.length > 0 && !propertyIds.includes('todas')) {
        query = query.in('property_id', propertyIds);
      }

      // Filtro de plataforma
      if (platform && platform !== 'all') {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar reservas do calendário:', error);
        throw error;
      }

      return (data || []) as CalendarReservation[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};
