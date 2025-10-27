import React from 'react';
import PropertiesList from '@/components/properties/PropertiesList';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const PropriedadesPage = () => {
  const { hasPermission, loading } = useUserPermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">Carregando permissões...</div>
      </div>
    );
  }

  const canViewProperties = hasPermission('properties_view_all') || hasPermission('properties_view_assigned');

  if (!canViewProperties) {
    return (
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gradient-primary">Gestão de Propriedades</h1>
          <p className="text-gray-600 mt-2">Gerencie suas propriedades de aluguel por temporada</p>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para acessar esta seção. Entre em contato com o administrador para solicitar acesso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gradient-primary">Gestão de Propriedades</h1>
        <p className="text-gray-600 mt-2">Gerencie suas propriedades de aluguel por temporada</p>
      </div>
      <PropertiesList />
    </div>
  );
};

export default PropriedadesPage;
