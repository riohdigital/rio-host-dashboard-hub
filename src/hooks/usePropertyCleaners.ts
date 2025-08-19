import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CleanerProfile } from '@/types/master-cleaning';

export const usePropertyCleaners = () => {
  const [propertyCleaners, setPropertyCleaners] = useState<Record<string, CleanerProfile[]>>({});

  const fetchCleanersForProperty = async (propertyId: string): Promise<CleanerProfile[]> => {
    try {
      const { data, error } = await supabase.rpc('fn_get_cleaners_for_properties' as any, {
        property_ids: [propertyId]
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
    } catch (e) {
      console.error('Erro ao buscar faxineiras da propriedade:', e);
      return [];
    }
  };

  const getCleanersForProperty = async (propertyId: string) => {
    if (propertyCleaners[propertyId]) {
      return propertyCleaners[propertyId];
    }

    const cleaners = await fetchCleanersForProperty(propertyId);
    setPropertyCleaners(prev => ({
      ...prev,
      [propertyId]: cleaners
    }));
    
    return cleaners;
  };

  return {
    propertyCleaners,
    getCleanersForProperty
  };
};