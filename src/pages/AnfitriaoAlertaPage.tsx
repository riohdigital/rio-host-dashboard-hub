import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PermissionGuard from '@/components/auth/PermissionGuard';
import DestinationsList from '@/components/anfitriao-alerta/DestinationsList';

const AnfitriaoAlertaPage = () => {
  return (
    <MainLayout>
      <PermissionGuard permission="anfitriao_alerta_view">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Anfitrião Alerta</h1>
            <p className="text-muted-foreground">
              Configure destinatários para receber alertas sobre suas propriedades
            </p>
          </div>
          
          <DestinationsList />
        </div>
      </PermissionGuard>
    </MainLayout>
  );
};

export default AnfitriaoAlertaPage;