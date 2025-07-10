
import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ProfileSection from '@/components/settings/ProfileSection';
import ExpenseCategoriesSection from '@/components/settings/ExpenseCategoriesSection';
import SecuritySection from '@/components/settings/SecuritySection';

const ConfiguracoesPage = () => {
  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gradient-primary">Configurações</h1>
          <p className="text-gray-600 mt-2">Gerencie suas preferências e configurações do sistema</p>
        </div>
        
        <div className="grid gap-8">
          <ProfileSection />
          <ExpenseCategoriesSection />
          <SecuritySection />
        </div>
      </div>
    </MainLayout>
  );
};

export default ConfiguracoesPage;
