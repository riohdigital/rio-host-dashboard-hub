import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationDestinations } from '@/hooks/useNotificationDestinations';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import DestinationCard from './DestinationCard';
import DestinationForm from './DestinationForm';
import { useEhCompacto } from '@/hooks/useMidia';
import Bloco from '@/components/comum/Bloco';
import { ListaLinhas } from '@/components/comum/GrupoLista';

const DestinationsList = () => {
  const { destinations, loading } = useNotificationDestinations();
  const { hasPermission } = useUserPermissions();
  const [showForm, setShowForm] = useState(false);
  const compacto = useEhCompacto();
  
  const canCreate = hasPermission('anfitriao_alerta_create');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando destinatários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Celular: o título fica no bloco da lista */}
        <h2 className="text-xl font-semibold text-foreground max-lg:sr-only">Destinatários de Alertas</h2>
        {canCreate && (
          <Button onClick={() => setShowForm(true)} className="gap-2 max-lg:min-h-11">
            <Plus className="h-4 w-4" />
            Novo Destinatário
          </Button>
        )}
      </div>

      {destinations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            Nenhum destinatário configurado ainda
          </div>
          {canCreate && (
            <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeiro Destinatário
            </Button>
          )}
        </div>
      ) : compacto ? (
        <Bloco titulo="Destinatários" extra={destinations.length} compacto>
          <ListaLinhas>
            {destinations.map((destination) => (
              <DestinationCard key={destination.id} destination={destination} />
            ))}
          </ListaLinhas>
        </Bloco>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {destinations.map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      )}

      {showForm && canCreate && (
        <DestinationForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default DestinationsList;