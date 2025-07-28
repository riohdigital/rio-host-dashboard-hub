import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';

export const useProperties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('status', 'Ativo')
        .order('name');

      if (error) throw error;
      
      setProperties(data || []);
    } catch (err) {
      console.error('Erro ao buscar propriedades:', err);
      setError('Erro ao carregar propriedades');
    } finally {
      setLoading(false);
    }
  };

  return {
    properties,
    loading,
    error,
    refetch: fetchProperties
  };
};