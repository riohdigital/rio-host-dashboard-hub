import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

interface AvailableUser {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  phone?: string;
}

export const useAvailableUsers = () => {
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const { role: currentUserRole } = useUserRole();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Master vê todos os usuários ativos
        // Outros veem apenas usuários que eles criaram
        let query = supabase
          .from('user_profiles')
          .select('user_id, full_name, email, role')
          .eq('is_active', true)
          .eq('is_destination_only', false); // Não mostrar perfis virtuais

        if (currentUserRole !== 'master') {
          query = query.eq('created_by', user.id);
        }

        const { data: profilesData, error: profilesError } = await query;

        if (profilesError) {
          console.error('Erro ao buscar usuários:', profilesError);
          return;
        }

        // Buscar telefones dos cleaner_profiles para faxineiras
        const cleanerUserIds = profilesData
          ?.filter(p => p.role === 'faxineira' && p.user_id)
          .map(p => p.user_id) || [];

        let cleanerPhones: Record<string, string> = {};
        
        if (cleanerUserIds.length > 0) {
          const { data: cleanerData } = await supabase
            .from('cleaner_profiles')
            .select('user_id, phone')
            .in('user_id', cleanerUserIds);
          
          if (cleanerData) {
            cleanerPhones = cleanerData.reduce((acc, c) => {
              if (c.user_id && c.phone) {
                acc[c.user_id] = c.phone;
              }
              return acc;
            }, {} as Record<string, string>);
          }
        }

        const formattedUsers: AvailableUser[] = (profilesData || [])
          .filter(p => p.user_id) // Garantir que tem user_id
          .map(profile => ({
            user_id: profile.user_id!,
            full_name: profile.full_name || profile.email,
            email: profile.email,
            role: profile.role,
            phone: cleanerPhones[profile.user_id!],
          }));

        setUsers(formattedUsers);
      } catch (error) {
        console.error('Erro ao buscar usuários:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user, currentUserRole]);

  // Filtrar por termo de busca
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter(u => 
      u.full_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  return {
    users: filteredUsers,
    allUsers: users,
    loading,
    searchTerm,
    setSearchTerm,
  };
};
