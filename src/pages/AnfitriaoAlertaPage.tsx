import React from 'react';
import PermissionGuard from '@/components/auth/PermissionGuard';
import DestinationsList from '@/components/anfitriao-alerta/DestinationsList';
import EmailTemplatesList from '@/components/anfitriao-alerta/EmailTemplatesList';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail } from 'lucide-react';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

const AnfitriaoAlertaPage = () => {
  const [activeTab, setActiveTab] = useEstadoPersistente<'whatsapp' | 'email'>('alertas.aba', 'whatsapp', { aceita: ['whatsapp', 'email'] });

  return (
    <PermissionGuard permission="anfitriao_alerta_view">
      <div className="space-y-6">
        {/* Celular: o nome da tela fica só na barra do topo */}
        <div className="max-lg:sr-only">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Anfitrião Alerta</h1>
          <p className="text-muted-foreground">
            Configure destinatários para receber alertas sobre suas propriedades
          </p>
        </div>
        
        {/* Toggle Buttons */}
        <div className="flex w-full gap-1 rounded-full bg-muted p-1 sm:w-fit">
          <Button
            variant={activeTab === 'whatsapp' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('whatsapp')}
            className="flex flex-1 items-center gap-2 sm:flex-none"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Avisos por </span>WhatsApp
          </Button>
          <Button
            variant={activeTab === 'email' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('email')}
            className="flex flex-1 items-center gap-2 sm:flex-none"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Avisos por </span>E-mail
          </Button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'whatsapp' && <DestinationsList />}
        {activeTab === 'email' && <EmailTemplatesList />}
      </div>
    </PermissionGuard>
  );
};

export default AnfitriaoAlertaPage;