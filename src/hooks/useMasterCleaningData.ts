import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReservationWithCleanerInfo, CleanerProfile } from '@/types/master-cleaning';

export const useMasterCleaningData = () => {
  const allCleaningsQuery = useQuery({
    queryKey: ['master-all-cleanings'],
    queryFn: async (): Promise<ReservationWithCleanerInfo[]> => {
      const { data, error } = await supabase.rpc('fn_get_all_cleaner_reservations' as any);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const availableCleaningsQuery = useQuery({
    queryKey: ['master-available-cleanings'],
    queryFn: async (): Promise<ReservationWithCleanerInfo[]> => {
      const { data, error } = await supabase.rpc('fn_get_all_available_reservations' as any);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const cleanersQuery = useQuery({
    queryKey: ['master-cleaners'],
    queryFn: async (): Promise<CleanerProfile[]> => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          user_id,
          full_name,
          email,
          is_active,
          cleaner_profiles(phone)
        `)
        .eq('role', 'faxineira')
        .eq('is_active', true);
      
      if (error) throw error;
      
      return (data || []).map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        is_active: profile.is_active,
        phone: (profile.cleaner_profiles as any)?.[0]?.phone
      }));
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    allCleanings: allCleaningsQuery.data || [],
    availableCleanings: availableCleaningsQuery.data || [],
    cleaners: cleanersQuery.data || [],
    isLoading: allCleaningsQuery.isLoading || availableCleaningsQuery.isLoading || cleanersQuery.isLoading,
    refetch: () => {
      allCleaningsQuery.refetch();
      availableCleaningsQuery.refetch();
      cleanersQuery.refetch();
    }
  };
};