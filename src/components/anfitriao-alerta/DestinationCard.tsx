import React, { useState } from 'react';
import { Phone, Settings, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationDestination, useNotificationDestinations } from '@/hooks/useNotificationDestinations';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import AuthenticationDialog from './AuthenticationDialog';
import DestinationSettingsDialog from './DestinationSettingsDialog';
import { useEhCompacto } from '@/hooks/useMidia';
import LinhaLista from '@/components/comum/LinhaLista';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import { Etiqueta } from '@/components/comum/Etiquetas';

interface DestinationCardProps {
  destination: NotificationDestination;
}

const DestinationCard = ({ destination }: DestinationCardProps) => {
  const { deleteDestination } = useNotificationDestinations();
  const { hasPermission } = useUserPermissions();
  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Celular: uma linha; tocar abre a folha com Autenticar, Configurar e Remover (longe de editar)
  const compacto = useEhCompacto();
  const [folha, setFolha] = useState(false);
  
  const canEdit = hasPermission('anfitriao_alerta_edit');
  const canDelete = hasPermission('anfitriao_alerta_delete');

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja remover este destinatário?')) {
      await deleteDestination(destination.id);
    }
  };

  const dialogos = (
    <>
      {showAuth && canEdit && (
        <AuthenticationDialog
          destination={destination}
          onClose={() => setShowAuth(false)}
        />
      )}

      {showSettings && canEdit && (
        <DestinationSettingsDialog
          destination={destination}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );

  if (compacto) {
    const status = (
      <Etiqueta tom={destination.is_authenticated ? 'success' : 'warning'}>
        {destination.is_authenticated ? 'Autenticado' : 'Pendente'}
      </Etiqueta>
    );
    return (
      <>
        <LinhaLista
          icone={Phone}
          titulo={destination.destination_name}
          subtitulo={[destination.whatsapp_number || 'Número não informado', destination.destination_role].filter(Boolean).join(' · ')}
          etiqueta={status}
          aoTocar={() => setFolha(true)}
        />
        <FolhaDetalhes
          aberta={folha}
          aoMudar={setFolha}
          titulo={destination.destination_name}
          etiqueta={status}
          subtitulo={destination.whatsapp_number || 'Número não informado'}
          acoes={canEdit ? (
            <>
              {!destination.is_authenticated && (
                <Button variant="outline" onClick={() => { setFolha(false); setShowAuth(true); }}>Autenticar</Button>
              )}
              <Button variant="outline" className="gap-2" onClick={() => { setFolha(false); setShowSettings(true); }}>
                <Settings className="h-4 w-4" />
                Configurar
              </Button>
            </>
          ) : undefined}
          excluir={canDelete ? {
            rotulo: 'Remover destinatário',
            titulo: 'Remover este destinatário?',
            descricao: 'Ele deixa de receber os alertas.',
            aoConfirmar: async () => {
              await deleteDestination(destination.id);
              setFolha(false);
            },
          } : undefined}
        >
          <p className="text-sm text-gray-700">
            <span className="text-gray-500">Papel:</span> {destination.destination_role}
          </p>
        </FolhaDetalhes>
        {dialogos}
      </>
    );
  }

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
            {!destination.is_authenticated && canEdit && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAuth(true)}
                className="flex-1"
              >
                Autenticar
              </Button>
            )}
            {canEdit && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {dialogos}
    </>
  );
};

export default DestinationCard;