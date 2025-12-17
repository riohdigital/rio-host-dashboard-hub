import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AvailableCleaner {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

export const useAvailableCleaners = () => {
  const [cleaners, setCleaners] = useState<AvailableCleaner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCleaners = async () => {
      try {
        setLoading(true);
        
        // Buscar faxineiras ativas que ainda não têm notification_destinations como faxineira
        const { data, error } = await supabase
          .from('user_profiles')
          .select(`
            user_id,
            full_name,
            email,
            cleaner_profiles (phone)
          `)
          .eq('role', 'faxineira')
          .eq('is_active', true);

        if (error) throw error;

        // Buscar quais faxineiras já têm destinations
        const { data: existingDestinations } = await (supabase as any)
          .from('notification_destinations')
          .select('user_id')
          .eq('destination_role', 'faxineira');

        const existingUserIds = new Set(
          existingDestinations?.map((d: any) => d.user_id) || []
        );

        // Filtrar apenas faxineiras sem destination
        const availableCleaners: AvailableCleaner[] = (data || [])
          .filter((cleaner: any) => cleaner.user_id && !existingUserIds.has(cleaner.user_id))
          .map((cleaner: any) => ({
            user_id: cleaner.user_id,
            full_name: cleaner.full_name || 'Sem nome',
            email: cleaner.email,
            phone: cleaner.cleaner_profiles?.[0]?.phone || null,
          }));

        setCleaners(availableCleaners);
      } catch (error) {
        console.error('Erro ao buscar faxineiras disponíveis:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCleaners();
  }, []);

  return { cleaners, loading };
};
