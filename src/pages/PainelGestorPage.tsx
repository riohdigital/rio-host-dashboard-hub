import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import PageHeader from '@/components/comum/PageHeader';
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
import { CommissionDetailsCard } from '@/components/painel-gestor/CommissionDetailsCard';
import PainelGestorCelular from '@/components/painel-gestor/PainelGestorCelular';
import { useEhCompacto } from '@/hooks/useMidia';

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
    commissionDetails,
    refetch 
  } = useGestorDashboard();
  const compacto = useEhCompacto();

  // Check access
  if (!permissionsLoading && !isMaster() && !isGestor() && !isOwner()) {
    return <Navigate to="/dashboard" replace />;
  }

  // Celular: o desenho do plano (T6), com os mesmos dados
  if (compacto) {
    return (
      <>
        <PageHeader titulo="Painel do Gestor" descricao="Acompanhe suas comissões e performance operacional" />
        <PainelGestorCelular
          loading={loading}
          kpis={kpis}
          monthlyCommissions={monthlyCommissions}
          propertyPerformance={propertyPerformance}
          platformBreakdown={platformBreakdown}
          upcomingEvents={upcomingEvents}
          cleaningRiskAlerts={cleaningRiskAlerts}
          recentActivities={recentActivities}
          commissionDetails={commissionDetails}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        titulo="Painel do Gestor"
        descricao="Acompanhe suas comissões e performance operacional"
        acao={
          <Button variant="outline" onClick={refetch} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      {/* KPI Cards */}
      <CommissionKPICards kpis={kpis} loading={loading} />

      {/* Cleaning Risk Alerts */}
      <CleaningRiskAlerts alerts={cleaningRiskAlerts} loading={loading} />

      {/* Charts and Commission Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CommissionChart data={monthlyCommissions} loading={loading} />
        </div>
        <div>
          <CommissionDetailsCard data={commissionDetails} loading={loading} />
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PropertyPerformanceTable data={propertyPerformance} loading={loading} />
        </div>
        <div>
          <PlatformBreakdownChart data={platformBreakdown} loading={loading} />
        </div>
      </div>

      {/* Events and Activities Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingEventsTimeline events={upcomingEvents} loading={loading} />
        <RecentActivityFeed activities={recentActivities} loading={loading} />
      </div>
    </div>
  );
};

export default PainelGestorPage;
