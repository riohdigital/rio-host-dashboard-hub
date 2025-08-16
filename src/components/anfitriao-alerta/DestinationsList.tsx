import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationDestinations } from '@/hooks/useNotificationDestinations';
import DestinationCard from './DestinationCard';
import DestinationForm from './DestinationForm';

const DestinationsList = () => {
  const { destinations, loading } = useNotificationDestinations();
  const [showForm, setShowForm] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando destinatários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">Destinatários de Alertas</h2>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Destinatário
        </Button>
      </div>

      {destinations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            Nenhum destinatário configurado ainda
          </div>
          <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Primeiro Destinatário
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {destinations.map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      )}

      {showForm && (
        <DestinationForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default DestinationsList;