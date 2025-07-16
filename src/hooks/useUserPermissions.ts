import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile, UserPermission, UserPropertyAccess, PermissionType } from '@/types/user-management';

export const useUserPermissions = () => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [propertyAccess, setPropertyAccess] = useState<UserPropertyAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    };

    try {
      setLoading(true);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

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
      }
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const hasPermission = (permissionType: PermissionType, resourceId?: string): boolean => {
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
    if (userProfile?.role === 'master') {
      return 'full';
    }
    if (hasPermission('properties_view_all')) {
      return hasPermission('properties_edit') ? 'full' : 'read_only';
    }
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
    if (isMaster() || hasPermission('properties_view_all')) {
      return []; // Empty array means all properties accessible
    }
    return propertyAccess.map(pa => pa.property_id).filter(Boolean);
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
