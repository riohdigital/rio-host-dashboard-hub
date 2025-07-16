
import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PropertiesList from '@/components/properties/PropertiesList';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const PropriedadesPage = () => {
  const { hasPermission, loading } = useUserPermissions();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">Carregando permissões...</div>
        </div>
      </MainLayout>
    );
  }

  const canViewProperties = hasPermission('properties_view_all') || hasPermission('properties_view_assigned');

  if (!canViewProperties) {
    return (
      <MainLayout>
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
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gradient-primary">Gestão de Propriedades</h1>
          <p className="text-gray-600 mt-2">Gerencie suas propriedades de aluguel por temporada</p>
        </div>
        <PropertiesList />
      </div>
    </MainLayout>
  );
};

export default PropriedadesPage;
