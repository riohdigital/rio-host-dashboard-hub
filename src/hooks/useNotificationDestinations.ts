import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

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

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useNotificationDestinations = () => {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [destinations, setDestinations] = useState<NotificationDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const lastFetchTime = useRef<number>(0);
  const hasFetchedData = useRef(false);

  const fetchDestinations = async (forceRefresh = false) => {
    // Wait for role to load before fetching
    if (!user || roleLoading) return;
    
    // Ensure role is actually loaded (not null) before fetching
    if (role === null) return;

    // Check cache
    const now = Date.now();
    if (!forceRefresh && hasFetchedData.current && (now - lastFetchTime.current < CACHE_DURATION)) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Masters see ALL destinations, others see only their own
      let query = (supabase as any)
        .from('notification_destinations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (role !== 'master') {
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      setDestinations(data || []);
      lastFetchTime.current = now;
      hasFetchedData.current = true;
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

  const createDestination = async (destination: Omit<NotificationDestination, 'id' | 'user_id' | 'created_at' | 'is_authenticated'> & { target_user_id?: string }) => {
    if (!user) return null;

    try {
      // Extrair target_user_id e remover do objeto antes de inserir
      const { target_user_id, ...destinationData } = destination;
      
      // Se target_user_id for fornecido (para faxineiras), usar esse ID
      // Caso contrário, usar o ID do usuário logado (para outros roles)
      const effectiveUserId = target_user_id || user.id;

      const { data, error } = await (supabase as any)
        .from('notification_destinations')
        .insert({
          ...destinationData,
          user_id: effectiveUserId,
          is_authenticated: false
        })
        .select()
        .single();

      if (error) throw error;

      await fetchDestinations(true); // Force refresh after create
      toast({
        title: "Sucesso",
        description: "Destinatário criado com sucesso",
      });

      return data;
    } catch (error: any) {
      console.error('Erro ao criar destinatário:', error);
      const errorMessage = error.message || "Não foi possível criar o destinatário";
      toast({
        title: "Erro",
        description: errorMessage,
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

      await fetchDestinations(true); // Force refresh after update
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

      await fetchDestinations(true); // Force refresh after delete
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
    if (!roleLoading && role !== null) {
      fetchDestinations();
    }
  }, [user, role, roleLoading]);

  return {
    destinations,
    loading,
    createDestination,
    updateDestination,
    deleteDestination,
    refetch: () => fetchDestinations(true) // Force refresh on manual refetch
  };
};