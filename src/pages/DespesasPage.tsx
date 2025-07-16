
import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ExpensesList from '@/components/expenses/ExpensesList';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const DespesasPage = () => {
  const { hasPermission, loading, getAccessibleProperties } = useUserPermissions();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">Carregando permissões...</div>
        </div>
      </MainLayout>
    );
  }

  const canViewExpenses = hasPermission('expenses_view') || getAccessibleProperties().length > 0;

  if (!canViewExpenses) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h1 className="text-3xl font-bold text-gradient-primary">Gestão de Despesas</h1>
            <p className="text-gray-600 mt-2">Controle e monitore todas as despesas das suas propriedades</p>
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
          <h1 className="text-3xl font-bold text-gradient-primary">Gestão de Despesas</h1>
          <p className="text-gray-600 mt-2">Controle e monitore todas as despesas das suas propriedades</p>
        </div>
        <ExpensesList />
      </div>
    </MainLayout>
  );
};

export default DespesasPage;
