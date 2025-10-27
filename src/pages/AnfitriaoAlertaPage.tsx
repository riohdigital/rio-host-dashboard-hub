import React, { useState } from 'react';
import PermissionGuard from '@/components/auth/PermissionGuard';
import DestinationsList from '@/components/anfitriao-alerta/DestinationsList';
import EmailTemplatesList from '@/components/anfitriao-alerta/EmailTemplatesList';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail } from 'lucide-react';

const AnfitriaoAlertaPage = () => {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email'>('whatsapp');

  return (
    <PermissionGuard permission="anfitriao_alerta_view">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anfitrião Alerta</h1>
          <p className="text-muted-foreground">
            Configure destinatários para receber alertas sobre suas propriedades
          </p>
        </div>
        
        {/* Toggle Buttons */}
        <div className="flex space-x-2 bg-muted p-1 rounded-lg w-fit">
          <Button
            variant={activeTab === 'whatsapp' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('whatsapp')}
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Avisos por WhatsApp
          </Button>
          <Button
            variant={activeTab === 'email' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('email')}
            className="flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Avisos por E-mail
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