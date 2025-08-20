import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type UserRole = 'master' | 'owner' | 'gestor' | 'faxineira' | null;

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    } else {
      setRole(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRole = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      setRole((profile?.role as UserRole) || null);
    } catch (error) {
      console.error('Erro ao buscar role do usuário:', error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    role,
    loading,
    isMaster: role === 'master',
    isOwner: role === 'owner',
    isGestor: role === 'gestor',
    isCleaner: role === 'faxineira',
    refetch: fetchUserRole
  };
};