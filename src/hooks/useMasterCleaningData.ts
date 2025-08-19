import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReservationWithCleanerInfo, CleanerProfile } from '@/types/master-cleaning';

interface UseMasterCleaningDataParams {
  startDate?: string;
  endDate?: string;
  propertyIds?: string[];
}

export const useMasterCleaningData = (params?: UseMasterCleaningDataParams) => {
  const allCleaningsQuery = useQuery({
    queryKey: ['master-all-cleanings', params?.startDate, params?.endDate, params?.propertyIds],
    queryFn: async (): Promise<ReservationWithCleanerInfo[]> => {
      const { data, error } = await supabase.rpc('fn_get_all_cleaner_reservations' as any, {
        start_date: params?.startDate || '1900-01-01',
        end_date: params?.endDate || '2099-12-31',
        property_ids: params?.propertyIds?.length && !params.propertyIds.includes('todas') ? params.propertyIds : null
      });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const availableCleaningsQuery = useQuery({
    queryKey: ['master-available-cleanings', params?.startDate, params?.endDate, params?.propertyIds],
    queryFn: async (): Promise<ReservationWithCleanerInfo[]> => {
      const { data, error } = await supabase.rpc('fn_get_all_available_reservations' as any, {
        start_date: params?.startDate || '1900-01-01',
        end_date: params?.endDate || '2099-12-31',
        property_ids: params?.propertyIds?.length && !params.propertyIds.includes('todas') ? params.propertyIds : null
      });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const cleanersQuery = useQuery({
    queryKey: ['master-cleaners', params?.propertyIds],
    queryFn: async (): Promise<CleanerProfile[]> => {
      const propertyIds = params?.propertyIds?.length && !params.propertyIds.includes('todas') ? params.propertyIds : null;
      const { data, error } = await supabase.rpc('fn_get_cleaners_for_properties' as any, {
        property_ids: propertyIds
      });
      if (error) throw error;
      return (data || []).map((profile: any) => ({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        is_active: profile.is_active,
        phone: profile.phone
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