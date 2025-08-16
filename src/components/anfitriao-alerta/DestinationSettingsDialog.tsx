import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationDestination } from '@/hooks/useNotificationDestinations';
import PropertySelector from './PropertySelector';
import NotificationToggles from './NotificationToggles';

interface DestinationSettingsDialogProps {
  destination: NotificationDestination;
  onClose: () => void;
}

const DestinationSettingsDialog = ({ destination, onClose }: DestinationSettingsDialogProps) => {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configurações - {destination.destination_name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="properties" className="w-full">
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