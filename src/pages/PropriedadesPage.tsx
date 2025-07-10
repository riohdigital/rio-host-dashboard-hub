
import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PropertyForm from '@/components/properties/PropertyForm';

const PropriedadesPage = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gradient-primary">Gestão de Propriedades</h1>
          <p className="text-gray-600 mt-2">Gerencie suas propriedades de aluguel por temporada</p>
        </div>
        <PropertyForm />
      </div>
    </MainLayout>
  );
};

export default PropriedadesPage;
