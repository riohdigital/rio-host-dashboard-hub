import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PermissionGuard from '@/components/auth/PermissionGuard';
import MasterCleaningDashboard from '@/pages/MasterCleaningDashboard';

const MasterCleaningDashboardPage = () => {
  return (
    <MainLayout>
      <PermissionGuard permission="gestao_faxinas_view">
        <MasterCleaningDashboard />
      </PermissionGuard>
    </MainLayout>
  );
};

export default MasterCleaningDashboardPage;