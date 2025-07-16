import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile, UserPermission, UserPropertyAccess, PermissionType } from '@/types/user-management';

export const useUserPermissions = () => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [propertyAccess, setPropertyAccess] = useState<UserPropertyAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserData();
    } else {
      setUserProfile(null);
      setPermissions([]);
      setPropertyAccess([]);
      setLoading(false);
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile as UserProfile);

        // Buscar permissões
        const { data: userPermissions } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', profile.user_id);

        setPermissions(userPermissions || []);

        // Buscar acesso a propriedades
        const { data: propertyAccess } = await supabase
          .from('user_property_access')
          .select('*')
          .eq('user_id', profile.user_id);

        setPropertyAccess((propertyAccess || []) as UserPropertyAccess[]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionType: PermissionType, resourceId?: string): boolean => {
    // Usuário mestre tem todas as permissões
    if (userProfile?.role === 'master') {
      return true;
    }

    const permission = permissions.find(p => 
      p.permission_type === permissionType && 
      (resourceId ? p.resource_id === resourceId : !p.resource_id)
    );

    return permission?.permission_value || false;
  };

  const canAccessProperty = (propertyId: string): 'full' | 'read_only' | 'restricted' | null => {
    // Usuário mestre tem acesso total
    if (userProfile?.role === 'master') {
      return 'full';
    }

    // Verificar se tem acesso a todas as propriedades
    if (hasPermission('properties_view_all')) {
      return hasPermission('properties_edit') ? 'full' : 'read_only';
    }

    // Verificar acesso específico à propriedade
    const access = propertyAccess.find(pa => pa.property_id === propertyId);
    return access ? access.access_level : null;
  };

  const isMaster = (): boolean => {
    return userProfile?.role === 'master';
  };

  const isOwner = (): boolean => {
    return userProfile?.role === 'owner';
  };

  const isEditor = (): boolean => {
    return userProfile?.role === 'editor';
  };

  const isViewer = (): boolean => {
    return userProfile?.role === 'viewer';
  };

  const getAccessibleProperties = (): string[] => {
    // Usuário mestre ou com acesso a todas as propriedades
    if (isMaster() || hasPermission('properties_view_all')) {
      return []; // Array vazio significa "todas as propriedades"
    }

    // Retornar apenas IDs das propriedades com acesso específico
    return propertyAccess.map(pa => pa.property_id);
  };

  return {
    userProfile,
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
    refetch: fetchUserData
  };
};