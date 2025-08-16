import React, { useState } from 'react';
import { Phone, Settings, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationDestination, useNotificationDestinations } from '@/hooks/useNotificationDestinations';
import AuthenticationDialog from './AuthenticationDialog';
import DestinationSettingsDialog from './DestinationSettingsDialog';

interface DestinationCardProps {
  destination: NotificationDestination;
}

const DestinationCard = ({ destination }: DestinationCardProps) => {
  const { deleteDestination } = useNotificationDestinations();
  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja remover este destinatário?')) {
      await deleteDestination(destination.id);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{destination.destination_name}</CardTitle>
            <Badge variant={destination.is_authenticated ? "default" : "secondary"}>
              {destination.is_authenticated ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {destination.is_authenticated ? 'Autenticado' : 'Pendente'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              {destination.whatsapp_number || 'Não informado'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Papel:</span> {destination.destination_role}
            </div>
          </div>

          <div className="flex gap-2">
            {!destination.is_authenticated && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAuth(true)}
                className="flex-1"
              >
                Autenticar
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {showAuth && (
        <AuthenticationDialog
          destination={destination}
          onClose={() => setShowAuth(false)}
        />
      )}

      {showSettings && (
        <DestinationSettingsDialog
          destination={destination}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
};

export default DestinationCard;