
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PropertyInvestment } from '@/types/investment';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';

export const usePropertyInvestments = (propertyId?: string) => {
  const [investments, setInvestments] = useState<PropertyInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isMaster, getAccessibleProperties, loading: permissionsLoading } = useUserPermissions();

  const fetchInvestments = async () => {
    if (permissionsLoading) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('property_investments')
        .select(`
          *,
          category:investment_categories(*),
          property:properties(id, name, nickname)
        `)
        .order('investment_date', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      } else if (!isMaster()) {
        const accessibleProperties = getAccessibleProperties();
        if (accessibleProperties.length === 0) {
          setInvestments([]);
          setLoading(false);
          return;
        }
        query = query.in('property_id', accessibleProperties);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvestments(data || []);
    } catch (error) {
      console.error('Erro ao carregar investimentos:', error);
      toast({
        title: "Erro ao carregar investimentos",
        description: "Não foi possível carregar os investimentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createInvestment = async (investmentData: Omit<PropertyInvestment, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('property_investments')
        .insert([investmentData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Investimento adicionado",
        description: "O investimento foi registrado com sucesso.",
      });

      await fetchInvestments();
      return data;
    } catch (error) {
      console.error('Erro ao criar investimento:', error);
      toast({
        title: "Erro ao adicionar investimento",
        description: "Não foi possível adicionar o investimento.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateInvestment = async (id: string, investmentData: Partial<PropertyInvestment>) => {
    try {
      const { data, error } = await supabase
        .from('property_investments')
        .update({ ...investmentData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Investimento atualizado",
        description: "O investimento foi atualizado com sucesso.",
      });

      await fetchInvestments();
      return data;
    } catch (error) {
      console.error('Erro ao atualizar investimento:', error);
      toast({
        title: "Erro ao atualizar investimento",
        description: "Não foi possível atualizar o investimento.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteInvestment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('property_investments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Investimento removido",
        description: "O investimento foi removido com sucesso.",
      });

      await fetchInvestments();
    } catch (error) {
      console.error('Erro ao deletar investimento:', error);
      toast({
        title: "Erro ao remover investimento",
        description: "Não foi possível remover o investimento.",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    if (!permissionsLoading) {
      fetchInvestments();
    }
  }, [propertyId, permissionsLoading]);

  return {
    investments,
    loading,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    refetch: fetchInvestments
  };
};
