import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile, UserPermission, UserPropertyAccess, PermissionType } from '@/types/user-management';

interface UserPermissionsContextType {
  userProfile: UserProfile | null;
  role: string | null;
  permissions: UserPermission[];
  propertyAccess: UserPropertyAccess[];
  loading: boolean;
  hasPermission: (permissionType: PermissionType, resourceId?: string) => boolean;
  canAccessProperty: (propertyId: string) => 'full' | 'read_only' | 'restricted' | null;
  isMaster: () => boolean;
  isOwner: () => boolean;
  isGestor: () => boolean;
  getAccessibleProperties: () => string[];
  refetch: () => Promise<void>;
}

const UserPermissionsContext = createContext<UserPermissionsContextType | undefined>(undefined);

export const UserPermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [propertyAccess, setPropertyAccess] = useState<UserPropertyAccess[]>([]);
  const [loading, setLoading] = useState(true);
  
  // LÓGICA DE CACHE: Evita requisições redundantes se os dados foram carregados recentemente
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const fetchUserData = useCallback(async (force = false) => {
    if (!user) {
      setUserProfile(null);
      setPermissions([]);
      setPropertyAccess([]);
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (!force && now - lastFetchTime < 10 * 60 * 1000 && userProfile) {
      setLoading(false);
      return;
    }

    try {
      // Importante: Apenas exibe o loading bloqueante se AINDA NÃO tivermos nenhum perfil carregado (primeiro acesso)
      // Em revalidações periódicas de segundo plano, mantém o perfil ativo para não desmontar a interface
      if (!userProfile) {
        setLoading(true);
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (profileError) throw profileError;

      if (profile) {
        setUserProfile(profile as UserProfile);

        const { data: userPermissions } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', profile.user_id);
        setPermissions(userPermissions || []);

        const { data: propertyAccessData } = await supabase
          .from('user_property_access')
          .select('*')
          .eq('user_id', profile.user_id);
        setPropertyAccess((propertyAccessData || []) as UserPropertyAccess[]);
        
        setLastFetchTime(now);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('[PermissionsProvider] Erro ao buscar dados do usuário:', error);
      // Não zera permissões já existentes se for apenas uma oscilação temporária de rede
      if (!userProfile) {
        setUserProfile(null);
        setPermissions([]);
        setPropertyAccess([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, userProfile, lastFetchTime]);

  useEffect(() => {
    // Dispara a busca apenas quando o ID do usuário de fato mudar ou entrar
    fetchUserData();
  }, [user?.id]);

  const hasPermission = useCallback((permissionType: PermissionType, resourceId?: string): boolean => {
    if (userProfile?.role === 'master') return true;
    const permission = permissions.find(p => p.permission_type === permissionType && (resourceId ? p.resource_id === resourceId : !p.resource_id));
    return permission?.permission_value || false;
  }, [userProfile?.role, permissions]);

  const canAccessProperty = useCallback((propertyId: string): 'full' | 'read_only' | 'restricted' | null => {
    if (userProfile?.role === 'master') return 'full';
    if (hasPermission('properties_view_all')) {
      return hasPermission('properties_edit') ? 'full' : 'read_only';
    }
    const access = propertyAccess.find(pa => pa.property_id === propertyId);
    return access ? access.access_level : null;
  }, [userProfile?.role, hasPermission, propertyAccess]);

  const isMaster = useCallback((): boolean => userProfile?.role === 'master', [userProfile?.role]);
  const isOwner = useCallback((): boolean => userProfile?.role === 'owner', [userProfile?.role]);
  const isGestor = useCallback((): boolean => userProfile?.role === 'gestor', [userProfile?.role]);

  const getAccessibleProperties = useCallback((): string[] => {
    if (isMaster() || hasPermission('properties_view_all')) return [];
    return propertyAccess.map(pa => pa.property_id).filter(Boolean);
  }, [isMaster, hasPermission, propertyAccess]);

  const value = useMemo(() => ({
    userProfile,
    role: userProfile?.role || null,
    permissions,
    propertyAccess,
    loading,
    hasPermission,
    canAccessProperty,
    isMaster,
    isOwner,
    isGestor,
    getAccessibleProperties,
    refetch: () => fetchUserData(true)
  }), [
    userProfile, permissions, propertyAccess, loading,
    hasPermission, canAccessProperty, isMaster, isOwner, isGestor, 
    getAccessibleProperties, fetchUserData
  ]);

  return (
    <UserPermissionsContext.Provider value={value}>
      {children}
    </UserPermissionsContext.Provider>
  );
};

export const useUserPermissions = () => {
  const context = useContext(UserPermissionsContext);
  if (context === undefined) {
    throw new Error('useUserPermissions must be used within a UserPermissionsProvider');
  }
  return context;
};
