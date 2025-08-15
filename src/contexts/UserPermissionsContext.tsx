import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile, UserPermission, UserPropertyAccess, PermissionType } from '@/types/user-management';

interface UserPermissionsContextType {
  userProfile: UserProfile | null;
  role: string | null; // Adicionado para fácil acesso
  permissions: UserPermission[];
  propertyAccess: UserPropertyAccess[];
  loading: boolean;
  hasPermission: (permissionType: PermissionType, resourceId?: string) => boolean;
  canAccessProperty: (propertyId: string) => 'full' | 'read_only' | 'restricted' | null;
  isMaster: () => boolean;
  isOwner: () => boolean;
  isEditor: () => boolean;
  isViewer: () => boolean;
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

  const fetchUserData = useCallback(async (force = false) => {
    // LOG 1: Verificando se a função de busca é chamada
    console.log('[PermissionsProvider] Iniciando busca de dados para o usuário:', user?.id);
    
    if (!user) {
      setUserProfile(null);
      setPermissions([]);
      setPropertyAccess([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      // LOG 2: Verificando o resultado da busca pelo perfil
      if (profileError) {
        console.error('[PermissionsProvider] Erro ao buscar perfil (pode ser normal se o perfil ainda não foi criado):', profileError);
        // Não lançamos o erro para o finally ainda poder rodar
      }
      console.log('[PermissionsProvider] Perfil encontrado:', profile);

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
      } else {
        setUserProfile(null);
        setPermissions([]);
        setPropertyAccess([]);
      }
    } catch (error) {
      console.error('[PermissionsProvider] Erro geral na busca de dados do usuário:', error);
      setUserProfile(null);
      setPermissions([]);
      setPropertyAccess([]);
    } finally {
      // LOG 3: Confirmando que o carregamento terminou
      console.log('[PermissionsProvider] Busca de dados finalizada.');
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const hasPermission = useCallback((permissionType: PermissionType, resourceId?: string): boolean => {
    if (userProfile?.role === 'master') {
      return true;
    }
    const permission = permissions.find(p => 
      p.permission_type === permissionType && 
      (resourceId ? p.resource_id === resourceId : !p.resource_id)
    );
    return permission?.permission_value || false;
  }, [userProfile?.role, permissions]);

  const canAccessProperty = useCallback((propertyId: string): 'full' | 'read_only' | 'restricted' | null => {
    if (userProfile?.role === 'master') {
      return 'full';
    }
    if (hasPermission('properties_view_all')) {
      return hasPermission('properties_edit') ? 'full' : 'read_only';
    }
    const access = propertyAccess.find(pa => pa.property_id === propertyId);
    return access ? access.access_level : null;
  }, [userProfile?.role, hasPermission, propertyAccess]);

  const isMaster = useCallback((): boolean => userProfile?.role === 'master', [userProfile?.role]);
  const isOwner = useCallback((): boolean => userProfile?.role === 'owner', [userProfile?.role]);
  const isEditor = useCallback((): boolean => userProfile?.role === 'editor', [userProfile?.role]);
  const isViewer = useCallback((): boolean => userProfile?.role === 'viewer', [userProfile?.role]);

  const getAccessibleProperties = useCallback((): string[] => {
    if (isMaster() || hasPermission('properties_view_all')) {
      return []; // Retorna array vazio para indicar acesso a tudo (lógica a ser tratada no componente)
    }
    return propertyAccess.map(pa => pa.property_id).filter(Boolean);
  }, [isMaster, hasPermission, propertyAccess]);

  const value = useMemo(() => ({
    userProfile,
    role: userProfile?.role || null, // A correção principal está aqui
    permissions,
    propertyAccess,
    loading,
    hasPermission,
    canAccessProperty,
    isMaster,
    isOwner,
    isEditor,
    isViewer,
    getAccessibleProperties,
    refetch: () => fetchUserData(true)
  }), [
    userProfile, permissions, propertyAccess, loading,
    hasPermission, canAccessProperty, isMaster, isOwner, isEditor, isViewer, 
    getAccessibleProperties, fetchUserData
  ]);
  
  // LOG 4: Verificando o valor que o provedor está oferecendo a cada renderização
  console.log('[PermissionsProvider] Valor fornecido ao contexto:', value);

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
