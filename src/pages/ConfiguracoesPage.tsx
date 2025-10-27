import React, { useState } from 'react';
import ProfileSection from '@/components/settings/ProfileSection';
import ExpenseCategoriesSection from '@/components/settings/ExpenseCategoriesSection';
import SecuritySection from '@/components/settings/SecuritySection';
import UserManagementSection from '@/components/settings/UserManagementSection';
import { Button } from '@/components/ui/button';
import { User, Tag, Shield, Users } from 'lucide-react';

const ConfiguracoesPage = () => {
  const [activeSection, setActiveSection] = useState('profile');

  const sections = [
    { id: 'profile', label: 'Meu Perfil', icon: User, component: ProfileSection },
    { id: 'categories', label: 'Categorias de Despesas', icon: Tag, component: ExpenseCategoriesSection },
    { id: 'security', label: 'Segurança', icon: Shield, component: SecuritySection },
    { id: 'users', label: 'Gerenciamento de Usuários', icon: Users, component: UserManagementSection },
  ];

  const ActiveComponent = sections.find(s => s.id === activeSection)?.component || ProfileSection;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gradient-primary">Configurações</h1>
        <p className="text-gray-600 mt-2">Gerencie suas preferências e configurações do sistema</p>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Menu lateral */}
        <div className="w-full lg:w-64 space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Button
                key={section.id}
                variant={activeSection === section.id ? "default" : "ghost"}
                className={`w-full justify-start ${
                  activeSection === section.id 
                    ? 'bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white' 
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                <Icon className="h-4 w-4 mr-3" />
                {section.label}
              </Button>
            );
          })}
        </div>
        
        {/* Conteúdo da seção ativa */}
        <div className="flex-1">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
