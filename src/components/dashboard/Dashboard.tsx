
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
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

const Dashboard = () => {
  const { selectedProperties, selectedPeriod, selectedPlatform, customStartDate, customEndDate } = useGlobalFilters();
  const { hasPermission } = useUserPermissions();
  const [competenceMode, setCompetenceMode] = useState<'operational' | 'financial'>('operational');

  const { startDateString, endDateString, totalDays, periodType } = useDateRange(selectedPeriod, customStartDate, customEndDate);

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
  }, [selectedPeriod, selectedProperties, selectedPlatform, customStartDate, customEndDate, startDateString, endDateString]);
  
  const isLoading = financialLoading || operationalLoading || annualGrowthLoading;
  
  const COLORS = ['#6A6DDF', '#F472B6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];

  return (
    <div className="p-6 space-y-8 bg-[#F8F9FA]">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gradient-primary">Dashboard Analítico</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Modo de Visualização:</span>
          <Select value={competenceMode} onValueChange={(v: any) => setCompetenceMode(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operational">📅 Operacional</SelectItem>
              <SelectItem value="financial">💰 Financeiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-700 -mb-4">
            {competenceMode === 'operational' ? 'Visão Operacional' : 'Visão Financeira'} 
            {periodType === 'future' && <span className="text-sm font-normal text-gray-500"> (Previsão)</span>}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {hasPermission('dashboard_revenue') && competenceMode === 'operational' && (
              <MonthlyRevenueKPI 
                totalRevenue={competenceData.operational.totalRevenue} 
                selectedPeriod="Período Selecionado" 
                subtitle="Receita Bruta - Reservas Ativas"
              />
            )}
            {hasPermission('dashboard_revenue') && competenceMode === 'financial' && (
              <MonthlyRevenueKPI 
                totalRevenue={competenceData.financial.totalGrossRevenue} 
                selectedPeriod="Período Selecionado" 
                subtitle="Receita Bruta Recebida"
              />
            )}
            {hasPermission('dashboard_expenses') && (
              <KPICard title="Despesas Totais" value={`R$ ${financialData.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} isPositive={false} icon={<div className="h-4 w-4" />} />
            )}
            {hasPermission('dashboard_profit') && competenceMode === 'operational' && (
              <NetProfitKPI 
                netRevenue={competenceData.operational.totalNetRevenue}
                commission={0}
                baseRevenue={competenceData.operational.totalRevenue}
              />
            )}
            {hasPermission('dashboard_profit') && competenceMode === 'financial' && (
              <NetProfitKPI 
                netRevenue={competenceData.financial.totalNetRevenue}
                commission={0}
                baseRevenue={competenceData.financial.totalGrossRevenue}
              />
            )}
            {hasPermission('dashboard_occupancy') && competenceMode === 'operational' && (
              <KPICard title="Taxa de Ocupação" value={`${competenceData.operational.occupancyRate.toFixed(1)}%`} icon={<div className="h-4 w-4" />} />
            )}
            {hasPermission('dashboard_occupancy') && competenceMode === 'financial' && (
              <RevenueCompetenceCard 
                mode="financial"
                financial={{
                  totalNetRevenue: competenceData.financial.totalNetRevenue,
                  airbnbRevenue: competenceData.financial.airbnbRevenue,
                  bookingRevenue: competenceData.financial.bookingRevenue,
                  directRevenue: competenceData.financial.directRevenue,
                }}
                futureBooking={{
                  total: competenceData.futureRevenue.bookingComTotal,
                  nextMonth: competenceData.futureRevenue.nextPaymentMonth,
                }}
              />
            )}
          </div>

          {/* Breakdown Detalhado */}
          <div className="mt-6">
            <RevenueBreakdownCard 
              grossRevenue={financialData.totalGrossRevenue}
              baseRevenue={financialData.totalBaseRevenue}
              commission={financialData.totalCommission}
              netRevenue={financialData.totalNetRevenue}
              expenses={financialData.totalExpenses}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3"><AnnualGrowthChart monthlyData={annualGrowthData.monthlyData} yearlyData={annualGrowthData.yearlyData} loading={annualGrowthLoading} /></div>
            <div className="lg:col-span-2"><Card className="bg-white h-full"><CardHeader><CardTitle className="text-gradient-primary">Receita por Plataforma</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={financialData.revenueByPlatform} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{financialData.revenueByPlatform.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} /></PieChart></ResponsiveContainer></CardContent></Card></div>
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
