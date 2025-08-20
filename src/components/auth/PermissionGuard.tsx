import React from 'react';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { PermissionType } from '@/types/user-management';

interface PermissionGuardProps {
  permission: PermissionType;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback
}) => {
  const { hasPermission, loading } = useUserPermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return (
      fallback || (
        <Card className="max-w-md mx-auto mt-10">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Você não possui permissão para acessar esta funcionalidade.
            </p>
          </CardContent>
        </Card>
      )
    );
  }

  return <>{children}</>;
};

export default PermissionGuard;