import React from 'react';
import ProfileSection from '@/components/settings/ProfileSection';
import ExpenseCategoriesSection from '@/components/settings/ExpenseCategoriesSection';
import SecuritySection from '@/components/settings/SecuritySection';
import UserManagementSection from '@/components/settings/UserManagementSection';
import ChannelSyncSection from '@/components/settings/ChannelSyncSection';
import ReceiptIssuerSection from '@/components/settings/ReceiptIssuerSection';
import { Button } from '@/components/ui/button';
import { User, Tag, Shield, Users, RefreshCw, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import BotaoInstalarApp from '@/components/pwa/BotaoInstalarApp';
import { useMidia } from '@/hooks/useMidia';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

const ConfiguracoesPage = () => {
  // A seção aberta volta depois de recarregar a página (celular e computador)
  const [activeSection, setActiveSection] = useEstadoPersistente<string>('configuracoes.secao', 'profile');
  const [secaoCelular, setSecaoCelular] = useEstadoPersistente<string | null>('configuracoes.secao.celular', null);
  const desktop = useMidia('(min-width: 1024px)');

  const sections = [
    { id: 'profile', label: 'Meu Perfil', icon: User, component: ProfileSection },
    { id: 'categories', label: 'Categorias de Despesas', icon: Tag, component: ExpenseCategoriesSection },
    { id: 'sync', label: 'Sincronização de Reservas', icon: RefreshCw, component: ChannelSyncSection },
    { id: 'receipts', label: 'Emissão de Comprovantes', icon: Receipt, component: ReceiptIssuerSection },
    { id: 'security', label: 'Segurança', icon: Shield, component: SecuritySection },
    { id: 'users', label: 'Gerenciamento de Usuários', icon: Users, component: UserManagementSection },
  ];

  const ActiveComponent = sections.find(s => s.id === activeSection)?.component || ProfileSection;
  const secaoAtual = sections.find(s => s.id === activeSection);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:border-b lg:border-gray-200 lg:pb-4">
        {/* Celular: o nome da tela fica só na barra do topo */}
        <div className="max-lg:sr-only">
          <h1 className="text-2xl font-extrabold text-gradient-primary sm:text-3xl">Configurações</h1>
          <p className="text-gray-600 mt-2">Gerencie suas preferências e configurações do sistema</p>
        </div>
        <BotaoInstalarApp className="self-start sm:self-auto" />
      </div>

      {/* Celular e tablet: lista de seções; cada uma abre em tela própria com "Voltar" */}
      {!desktop && (
      <div>
        {secaoCelular === null ? (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => { setActiveSection(section.id); setSecaoCelular(section.id); }}
                    className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-[15px] font-medium text-ink active:bg-surface"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1">{section.label}</span>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" onClick={() => setSecaoCelular(null)} className="-ml-3 gap-1">
              <ChevronLeft className="h-4 w-4" />
              Configurações
            </Button>
            {/* A seção já traz o próprio título: este fica só para leitor de tela (1 título por tela) */}
            <h2 className="sr-only">{secaoAtual?.label}</h2>
            <ActiveComponent />
          </div>
        )}
      </div>
      )}

      {desktop && (
      <div className="flex gap-8">
        {/* Menu lateral */}
        <div className="w-64 shrink-0 space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Button
                key={section.id}
                variant={activeSection === section.id ? "default" : "ghost"}
                className={`w-full justify-start ${
                  activeSection === section.id 
                    ? 'bg-brand hover:bg-brand-hover text-white' 
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
        <div className="min-w-0 flex-1">
          <ActiveComponent />
        </div>
      </div>
      )}
    </div>
  );
};

export default ConfiguracoesPage;
