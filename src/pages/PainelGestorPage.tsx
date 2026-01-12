import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useGestorDashboard } from '@/hooks/painel-gestor/useGestorDashboard';
import { CommissionKPICards } from '@/components/painel-gestor/CommissionKPICards';
import { CommissionChart } from '@/components/painel-gestor/CommissionChart';
import { PlatformBreakdownChart } from '@/components/painel-gestor/PlatformBreakdownChart';
import { PropertyPerformanceTable } from '@/components/painel-gestor/PropertyPerformanceTable';
import { UpcomingEventsTimeline } from '@/components/painel-gestor/UpcomingEventsTimeline';
import { CleaningRiskAlerts } from '@/components/painel-gestor/CleaningRiskAlerts';
import { RecentActivityFeed } from '@/components/painel-gestor/RecentActivityFeed';

const PainelGestorPage = () => {
  const { isMaster, isGestor, isOwner, loading: permissionsLoading } = useUserPermissions();
  const { 
    loading, 
    kpis, 
    monthlyCommissions, 
    propertyPerformance, 
    platformBreakdown,
    upcomingEvents,
    cleaningRiskAlerts,
    recentActivities,
    refetch 
  } = useGestorDashboard();

  // Check access
  if (!permissionsLoading && !isMaster() && !isGestor() && !isOwner()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient-primary">🎯 Painel do Gestor</h1>
          <p className="text-muted-foreground">
            Acompanhe suas comissões e performance operacional
          </p>
        </div>
        <Button variant="outline" onClick={refetch} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <CommissionKPICards kpis={kpis} loading={loading} />

      {/* Cleaning Risk Alerts */}
      <CleaningRiskAlerts alerts={cleaningRiskAlerts} loading={loading} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CommissionChart data={monthlyCommissions} loading={loading} />
        </div>
        <div>
          <PlatformBreakdownChart data={platformBreakdown} loading={loading} />
        </div>
      </div>

      {/* Property Performance Table */}
      <PropertyPerformanceTable data={propertyPerformance} loading={loading} />

      {/* Events and Activities Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingEventsTimeline events={upcomingEvents} loading={loading} />
        <RecentActivityFeed activities={recentActivities} loading={loading} />
      </div>
    </div>
  );
};

export default PainelGestorPage;
