
import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import ProfileSection from '@/components/settings/ProfileSection';
import ExpenseCategoriesSection from '@/components/settings/ExpenseCategoriesSection';
import SecuritySection from '@/components/settings/SecuritySection';

const ConfiguracoesPage = () => {
  const [activeSection, setActiveSection] = useState('profile');

  const menuItems = [
    { id: 'profile', label: 'Meu Perfil' },
    { id: 'categories', label: 'Categorias de Despesas' },
    { id: 'security', label: 'Segurança' }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSection />;
      case 'categories':
        return <ExpenseCategoriesSection />;
      case 'security':
        return <SecuritySection />;
      default:
        return <ProfileSection />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-[#6A6DDF]">Configurações</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Menu de Navegação */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <Button
                    key={item.id}
                    variant={activeSection === item.id ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      activeSection === item.id 
                        ? 'bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </nav>
            </div>
          </div>

          {/* Área de Conteúdo */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ConfiguracoesPage;
