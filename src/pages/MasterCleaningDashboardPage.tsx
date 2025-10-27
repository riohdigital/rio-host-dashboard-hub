import React from 'react';
import PermissionGuard from '@/components/auth/PermissionGuard';
import MasterCleaningDashboard from '@/pages/MasterCleaningDashboard';

const MasterCleaningDashboardPage = () => {
  return (
    <PermissionGuard permission="gestao_faxinas_view">
      <MasterCleaningDashboard />
    </PermissionGuard>
  );
};

export default MasterCleaningDashboardPage;