import React from 'react';
import { FOLHA_NO_CELULAR } from '@/components/comum/classes';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationDestination } from '@/hooks/useNotificationDestinations';
import PropertySelector from './PropertySelector';
import NotificationToggles from './NotificationToggles';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

interface DestinationSettingsDialogProps {
  destination: NotificationDestination;
  onClose: () => void;
}

const DestinationSettingsDialog = ({ destination, onClose }: DestinationSettingsDialogProps) => {
  const [aba, setAba] = useEstadoPersistente<string>('alertas.destinatario.configurar.aba', 'properties', { aceita: ['properties', 'notifications'] });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className={cn("sm:max-w-[600px]", FOLHA_NO_CELULAR)}>
        <DialogHeader>
          <DialogTitle>Configurações - {destination.destination_name}</DialogTitle>
        </DialogHeader>

        <Tabs value={aba} onValueChange={setAba} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="properties">Propriedades</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
          </TabsList>
          
          <TabsContent value="properties" className="space-y-4">
            <PropertySelector destinationId={destination.id} />
          </TabsContent>
          
          <TabsContent value="notifications" className="space-y-4">
            <NotificationToggles destination={destination} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default DestinationSettingsDialog;