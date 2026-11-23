
'use client';

import { useState, useEffect } from 'react';
import ChartCard from '@/components/graficos/ChartCard';
import GraficoProporcao from '@/components/graficos/GraficoProporcao';
import { corDoCanalGrafico, eixoMoeda, moedaCompleta } from '@/components/graficos/tema';
import { Loader2 } from 'lucide-react';

// Importando os hooks customizados
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { useFinancialData } from '@/hooks/dashboard/useFinancialData';
import { useOperationalData } from '@/hooks/dashboard/useOperationalData';
import { useAnnualGrowthData } from '@/hooks/dashboard/useAnnualGrowthData';
import { useFinancialDataWithCompetence } from '@/hooks/dashboard/useFinancialDataWithCompetence';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';

// Importando os componentes de UI
import KPICard from './KPICard';
import NetProfitKPI from './NetProfitKPI';
import MonthlyRevenueKPI from './MonthlyRevenueKPI';
import RevenueBreakdownCard from './RevenueBreakdownCard';
import { RevenueCompetenceCard } from './RevenueCompetenceCard';
import AnnualGrowthChart from './AnnualGrowthChart';
import PaymentStatusCard from './PaymentStatusCard';
import PaymentSummaryCard from './PaymentSummaryCard';
import CashflowCard from './CashflowCard';
import UpcomingReservations from './UpcomingReservations';
import RecentReservations from './RecentReservations';
import { StrategicInsightsCard } from './StrategicInsightsCard';

const Dashboard = () => {
  const { selectedProperties, selectedPeriod, selectedPlatform, customStartDate, customEndDate } = useGlobalFilters();
  const { hasPermission } = useUserPermissions();

  const { startDateString, endDateString, totalDays, periodType } = useDateRange(selectedPeriod, customStartDate, customEndDate);
  
  // Dashboard inteligente: automaticamente mostra regime de caixa ou previsão
  const showCashBasis = periodType === 'past' || periodType === 'current';
  const showForecast = periodType === 'future';

  // Usando os hooks para buscar dados
  const { data: financialData, loading: financialLoading, fetchFinancialData } = useFinancialData(startDateString, endDateString, selectedProperties, selectedPlatform, totalDays);
  const { data: operationalData, loading: operationalLoading, fetchOperationalData } = useOperationalData(startDateString, endDateString, selectedProperties);
  const { data: annualGrowthData, loading: annualGrowthLoading, fetchAnnualGrowthData } = useAnnualGrowthData(selectedProperties);
  const { data: competenceData, loading: loadingCompetence, fetchData: fetchCompetenceData } = useFinancialDataWithCompetence(
    startDateString,
    endDateString,
    selectedProperties,
    selectedPlatform,
    totalDays
  );

  useEffect(() => {
    fetchFinancialData();
    fetchOperationalData();
    fetchAnnualGrowthData();
    fetchCompetenceData();
  }, [startDateString, endDateString, selectedProperties, selectedPlatform]);
  
  const isLoading = financialLoading || operationalLoading || annualGrowthLoading;
  

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Celular: o nome da tela fica só na barra do topo */}
      <div className="flex justify-between items-center max-lg:sr-only">
        <h1 className="text-2xl font-extrabold text-gradient-primary sm:text-3xl">Dashboard Analítico</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>
      ) : (
        <>
          {/* Business Insights da IA - Topo */}
          {hasPermission('dashboard_revenue') && (
            <StrategicInsightsCard />
          )}

          <h2 className="text-2xl font-bold text-gray-700 lg:-mb-4">
            {showForecast ? 'Previsão de Receita' : 'Receita do Período'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hasPermission('dashboard_revenue') && showForecast && (
              <MonthlyRevenueKPI 
                totalRevenue={competenceData.operational.totalRevenue} 
                selectedPeriod="Período Selecionado" 
                subtitle="Receita Prevista das Reservas"
              />
            )}
            {hasPermission('dashboard_revenue') && showCashBasis && (
              <MonthlyRevenueKPI 
                totalRevenue={competenceData.operational.totalRevenueWithFuture} 
                selectedPeriod="Período Selecionado" 
                subtitle="Receita Recebida no Período"
              />
            )}
            {hasPermission('dashboard_expenses') && (
              <KPICard title="Despesas do Período" value={`R$ ${financialData.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} isPositive={false} icon={<div className="h-4 w-4" />} />
            )}
            {hasPermission('dashboard_profit') && showForecast && (
              <NetProfitKPI 
                netRevenue={competenceData.operational.totalNetRevenue}
                commission={competenceData.operational.totalCommission}
                baseRevenue={competenceData.operational.totalRevenue}
              />
            )}
            {hasPermission('dashboard_profit') && showCashBasis && (
              <NetProfitKPI 
                netRevenue={competenceData.operational.totalNetRevenueWithFuture}
                commission={competenceData.operational.totalCommissionWithFuture}
                baseRevenue={competenceData.operational.totalRevenueWithFuture}
              />
            )}
            {hasPermission('dashboard_occupancy') && showForecast && (
              <KPICard title="Taxa de Ocupação Prevista" value={`${competenceData.operational.occupancyRate.toFixed(1)}%`} icon={<div className="h-4 w-4" />} />
            )}
          </div>

          {/* Detalhamento por Plataforma - Expandido */}
          {hasPermission('dashboard_occupancy') && showCashBasis && (
            <div className="mt-6">
              <RevenueCompetenceCard 
                periodType={periodType}
                financial={{
                  totalNetRevenue: competenceData.operational.totalNetRevenue,
                  airbnbRevenue: competenceData.operational.airbnbRevenue,
                  bookingRevenue: competenceData.operational.bookingRevenue,
                  directRevenue: competenceData.operational.directRevenue,
                }}
                futureBooking={{
                  total: competenceData.futureRevenue.bookingComTotal,
                  nextMonth: competenceData.futureRevenue.nextPaymentMonth,
                }}
              />
            </div>
          )}

          {/* Breakdown Detalhado */}
          <div className="mt-6">
            <RevenueBreakdownCard 
              grossRevenue={competenceData.operational.totalRevenueWithFuture}
              baseRevenue={competenceData.operational.totalRevenueWithFuture}
              commission={competenceData.operational.totalCommissionWithFuture}
              netRevenue={competenceData.operational.totalNetRevenueWithFuture}
              expenses={financialData.totalExpenses}
            />
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3"><AnnualGrowthChart monthlyData={annualGrowthData.monthlyData} yearlyData={annualGrowthData.yearlyData} loading={annualGrowthLoading} /></div>
            <div className="lg:col-span-2">
              <ChartCard
                titulo={<span className="text-gradient-primary">Receita por Plataforma</span>}
                vazio={!financialData.revenueByPlatform.some((p) => p.value > 0)}
              >
                {(altura) => (
                  <GraficoProporcao
                    fatias={financialData.revenueByPlatform.map((p) => ({ nome: p.name, valor: p.value, cor: corDoCanalGrafico(p.name) }))}
                    altura={altura}
                    formatar={moedaCompleta}
                    formatarTotal={eixoMoeda}
                  />
                )}
              </ChartCard>
            </div>
          </div>

          <div className="border-t pt-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-700 mb-4">Resumo de Pagamentos</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PaymentSummaryCard totalPaidCount={operationalData.totalPaidCount} totalPendingCount={operationalData.totalPendingCount} />
                <PaymentStatusCard paidCount={operationalData.paidCount} pendingCount={operationalData.pendingCount} />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-700 mb-4">Eventos</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UpcomingReservations events={operationalData.periodEvents} loading={operationalData.loading} />
                <RecentReservations reservations={operationalData.recentReservations} loading={operationalData.loading} />
              </div>
            </div>

            <div>
              <CashflowCard data={operationalData.cashflow} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
