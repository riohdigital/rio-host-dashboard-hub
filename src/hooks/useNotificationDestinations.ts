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

export interface CreateDestinationInput {
  destination_name: string;
  destination_role: string;
  whatsapp_number?: string;
  // Para usuários existentes do sistema
  existing_user_id?: string;
  // Para contatos externos (não são usuários do sistema)
  is_external_contact?: boolean;
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

  const createVirtualUserProfile = async (
    name: string,
    role: string,
    whatsappNumber?: string
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      // Gerar email placeholder usando o número do WhatsApp ou UUID
      const emailSuffix = whatsappNumber 
        ? whatsappNumber.replace(/\D/g, '') 
        : crypto.randomUUID().slice(0, 8);
      const placeholderEmail = `${emailSuffix}@destination.local`;

      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          email: placeholderEmail,
          full_name: name,
          role: role,
          is_destination_only: true,
          created_by: user.id,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Erro ao criar perfil virtual:', error);
      return null;
    }
  };

  const deleteVirtualUserProfile = async (userId: string): Promise<boolean> => {
    try {
      // Verificar se o perfil é destination_only antes de deletar
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('is_destination_only')
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        // Se não encontrar por user_id, tentar por id
        const { data: profileById, error: fetchByIdError } = await supabase
          .from('user_profiles')
          .select('is_destination_only')
          .eq('id', userId)
          .single();

        if (fetchByIdError || !profileById?.is_destination_only) {
          return false; // Não deletar perfis reais
        }

        // Deletar perfil virtual por id
        const { error: deleteError } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', userId);

        return !deleteError;
      }

      if (!profile?.is_destination_only) {
        return false; // Não deletar perfis reais
      }

      // Deletar perfil virtual
      const { error: deleteError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);

      return !deleteError;
    } catch (error) {
      console.error('Erro ao deletar perfil virtual:', error);
      return false;
    }
  };

  const createDestination = async (input: CreateDestinationInput) => {
    if (!user) return null;

    try {
      let effectiveUserId: string;

      if (input.is_external_contact) {
        // Criar perfil virtual para contato externo
        const virtualProfileId = await createVirtualUserProfile(
          input.destination_name,
          input.destination_role,
          input.whatsapp_number
        );

        if (!virtualProfileId) {
          throw new Error('Não foi possível criar o perfil do destinatário');
        }

        // Para perfis virtuais, usar o ID do perfil criado
        // Mas como notification_destinations referencia user_profiles.user_id,
        // precisamos usar o user_id do master temporariamente e depois ajustar
        // Na verdade, para contatos externos, usamos o próprio user_id do master
        // pois o N8N identificará pelo is_destination_only no user_profile
        effectiveUserId = user.id;
      } else if (input.existing_user_id) {
        // Usuário existente do sistema
        effectiveUserId = input.existing_user_id;
      } else {
        // Fallback para o usuário logado
        effectiveUserId = user.id;
      }

      const { data, error } = await (supabase as any)
        .from('notification_destinations')
        .insert({
          destination_name: input.destination_name,
          destination_role: input.destination_role,
          whatsapp_number: input.whatsapp_number,
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
      let errorMessage = "Não foi possível criar o destinatário";
      
      // Tratamento específico para constraint de duplicidade
      if (error.code === '23505' || error.message?.includes('unique_destination_name_role')) {
        errorMessage = "Já existe um destinatário com esse nome e papel.";
      }
      
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
      // Primeiro, buscar o destinatário para obter o user_id
      const { data: destination, error: fetchError } = await (supabase as any)
        .from('notification_destinations')
        .select('user_id, destination_name')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Deletar o destinatário
      const { error } = await (supabase as any)
        .from('notification_destinations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Tentar deletar o perfil virtual associado (se existir)
      if (destination?.user_id) {
        await deleteVirtualUserProfile(destination.user_id);
      }

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
