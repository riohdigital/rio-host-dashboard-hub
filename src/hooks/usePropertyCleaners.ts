import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CleanerProfile } from '@/types/master-cleaning';

export const usePropertyCleaners = () => {
  const [propertyCleaners, setPropertyCleaners] = useState<Record<string, CleanerProfile[]>>({});

  const fetchCleanersForProperty = async (propertyId: string): Promise<CleanerProfile[]> => {
    try {
      // Usar a mesma lógica do ReservationForm
      const { data: cleanerLinks, error: linkError } = await (supabase as any)
        .from('cleaner_properties')
        .select('user_id')
        .eq('property_id', propertyId);
      
      if (linkError) throw linkError;
      
      const userIds = (cleanerLinks || []).map((link) => link.user_id).filter(Boolean);
      if (userIds.length === 0) {
        return [];
      }
      
      const { data: profiles, error: profError } = await supabase
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
        .eq('is_active', true)
        .in('user_id', userIds);
      
      if (profError) throw profError;
      
      return (profiles || []).map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        is_active: profile.is_active,
        phone: (profile.cleaner_profiles as any)?.[0]?.phone
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