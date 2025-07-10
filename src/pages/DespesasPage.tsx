
import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ExpenseForm from '@/components/expenses/ExpenseForm';

const DespesasPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCancel = () => {
    // No action needed for cancel on this page
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gradient-primary">Gestão de Despesas</h1>
          <p className="text-gray-600 mt-2">Controle e monitore todas as despesas das suas propriedades</p>
        </div>
        <ExpenseForm 
          key={refreshKey}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </MainLayout>
  );
};

export default DespesasPage;
