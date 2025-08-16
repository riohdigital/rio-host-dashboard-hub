import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import DestinationsList from '@/components/anfitriao-alerta/DestinationsList';

const AnfitriaoAlertaPage = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anfitrião Alerta</h1>
          <p className="text-muted-foreground">
            Configure destinatários para receber alertas sobre suas propriedades
          </p>
        </div>
        
        <DestinationsList />
      </div>
    </MainLayout>
  );
};

export default AnfitriaoAlertaPage;