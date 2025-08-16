import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DestinationProperty {
  id: string;
  destination_id: string;
  property_id: string;
}

export const useDestinationProperties = (destinationId?: string) => {
  const { toast } = useToast();
  const [links, setLinks] = useState<DestinationProperty[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLinks = async () => {
    if (!destinationId) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('alerts_destination_property_links')
        .select('*')
        .eq('destination_id', destinationId);

      if (error) throw error;
      setLinks(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar propriedades:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as propriedades",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const linkProperty = async (propertyId: string) => {
    if (!destinationId) return;

    try {
      const { error } = await (supabase as any)
        .from('alerts_destination_property_links')
        .insert({
          destination_id: destinationId,
          property_id: propertyId
        });

      if (error) throw error;

      await fetchLinks();
      toast({
        title: "Sucesso",
        description: "Propriedade vinculada com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao vincular propriedade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível vincular a propriedade",
        variant: "destructive",
      });
    }
  };

  const unlinkProperty = async (propertyId: string) => {
    if (!destinationId) return;

    try {
      const { error } = await (supabase as any)
        .from('alerts_destination_property_links')
        .delete()
        .eq('destination_id', destinationId)
        .eq('property_id', propertyId);

      if (error) throw error;

      await fetchLinks();
      toast({
        title: "Sucesso",
        description: "Propriedade desvinculada com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao desvincular propriedade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desvincular a propriedade",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [destinationId]);

  return {
    links,
    loading,
    linkProperty,
    unlinkProperty,
    refetch: fetchLinks
  };
};