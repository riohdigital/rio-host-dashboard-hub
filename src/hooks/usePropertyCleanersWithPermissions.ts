import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CleanerProfile } from '@/types/master-cleaning';

export const usePropertyCleanersWithPermissions = () => {
  const [propertyCleaners, setPropertyCleaners] = useState<Record<string, CleanerProfile[]>>({});
  const [loading, setLoading] = useState(false);

  const fetchCleanersForProperty = async (propertyId: string): Promise<CleanerProfile[]> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('fn_get_property_cleaners_for_user' as any, {
        p_property_id: propertyId
      });
      
      if (error) {
        console.error('Erro ao buscar faxineiras:', error);
        return [];
      }
      
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
    } finally {
      setLoading(false);
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
    getCleanersForProperty,
    loading
  };
};