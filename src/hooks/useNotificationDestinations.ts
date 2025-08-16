import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface NotificationDestination {
  id: string;
  user_id: string;
  destination_name: string;
  destination_role: string;
  whatsapp_number?: string;
  is_authenticated: boolean;
  auth_code?: string;
  auth_code_expires_at?: string;
  preferences?: any;
  created_at: string;
}

export const useNotificationDestinations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [destinations, setDestinations] = useState<NotificationDestination[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDestinations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('notification_destinations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDestinations(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar destinatários:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os destinatários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createDestination = async (destination: Omit<NotificationDestination, 'id' | 'user_id' | 'created_at' | 'is_authenticated'>) => {
    if (!user) return null;

    try {
      const { data, error } = await (supabase as any)
        .from('notification_destinations')
        .insert({
          ...destination,
          user_id: user.id,
          is_authenticated: false
        })
        .select()
        .single();

      if (error) throw error;

      await fetchDestinations();
      toast({
        title: "Sucesso",
        description: "Destinatário criado com sucesso",
      });

      return data;
    } catch (error: any) {
      console.error('Erro ao criar destinatário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o destinatário",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateDestination = async (id: string, updates: Partial<NotificationDestination>) => {
    try {
      const { error } = await (supabase as any)
        .from('notification_destinations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchDestinations();
      toast({
        title: "Sucesso",
        description: "Destinatário atualizado com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao atualizar destinatário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o destinatário",
        variant: "destructive",
      });
    }
  };

  const deleteDestination = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('notification_destinations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchDestinations();
      toast({
        title: "Sucesso",
        description: "Destinatário removido com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao remover destinatário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o destinatário",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, [user]);

  return {
    destinations,
    loading,
    createDestination,
    updateDestination,
    deleteDestination,
    refetch: fetchDestinations
  };
};