'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, DollarSign, TrendingDown, TrendingUp, Calendar } from 'lucide-react';
import { format, addMonths, subMonths, addYears, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';

// Importando os hooks customizados
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { useFinancialData } from '@/hooks/dashboard/useFinancialData';
import { useOperationalData } from '@/hooks/dashboard/useOperationalData';
import { useAnnualGrowthData } from '@/hooks/dashboard/useAnnualGrowthData';
import { useUserPermissions } from '@/hooks/useUserPermissions';

// Importando os componentes de UI
import KPICard from './KPICard';
import NetProfitKPI from './NetProfitKPI';
import MonthlyRevenueKPI from './MonthlyRevenueKPI';
import PropertyMultiSelect from './PropertyMultiSelect';
import AnnualGrowthChart from './AnnualGrowthChart';
import PaymentStatusCard from './PaymentStatusCard';
import PaymentSummaryCard from './PaymentSummaryCard';
import CashflowCard from './CashflowCard';
import UpcomingReservations from './UpcomingReservations';
import RecentReservations from './RecentReservations';

const Dashboard = () => {
  const [selectedProperties, setSelectedProperties] = useState<string[]>(['todas']);
  const [selectedPeriod, setSelectedPeriod] = useState('current_year');
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const { hasPermission, getAccessibleProperties, isMaster, loading: permissionsLoading } = useUserPermissions();

  const { startDateString, endDateString, totalDays, periodType } = useDateRange(selectedPeriod);

  // Usando os hooks para buscar dados
  const { data: financialData, loading: financialLoading, fetchFinancialData } = useFinancialData(startDateString, endDateString, selectedProperties, totalDays);
  const { data: operationalData, loading: operationalLoading, fetchOperationalData } = useOperationalData(startDateString, endDateString, selectedProperties);
  const { data: annualGrowthData, loading: annualGrowthLoading, fetchAnnualGrowthData } = useAnnualGrowthData(selectedProperties);

  useEffect(() => {
    const fetchProps = async () => {
      if (permissionsLoading) return;
      
      setPropertiesLoading(true);
      const { data, error } = await supabase.from('properties').select('*').order('name');
      if (error) {
        console.error("Erro ao carregar propriedades", error);
      } else {
        // Filter properties based on user permissions
        let filteredProperties = data || [];
        if (!isMaster() && !hasPermission('properties_view_all')) {
          const accessiblePropertyIds = getAccessibleProperties();
          filteredProperties = data?.filter(property => 
            accessiblePropertyIds.includes(property.id)
          ) || [];
        }
        
        setProperties(filteredProperties);
        if (filteredProperties.length > 0) {
          // Set to accessible properties or all properties based on permissions
          setSelectedProperties(
            !isMaster() && !hasPermission('properties_view_all')
              ? filteredProperties.map(p => p.id) 
              : ['todas']
          );
        }
      }
      setPropertiesLoading(false);
    };
    fetchProps();
  }, [permissionsLoading, isMaster, hasPermission, getAccessibleProperties]);

  useEffect(() => {
    if (!propertiesLoading) {
      fetchFinancialData();
      fetchOperationalData();
      fetchAnnualGrowthData();
    }
  }, [selectedPeriod, selectedProperties, propertiesLoading, fetchFinancialData, fetchOperationalData, fetchAnnualGrowthData]);
  
  const isLoading = financialLoading || operationalLoading || annualGrowthLoading || propertiesLoading || permissionsLoading;
  
  const generatePeriodOptions = () => {
    const now = new Date();
    const currentMonth = format(now, 'MMMM', { locale: ptBR });
    const currentYear = now.getFullYear();
    
    const lastMonth = format(subMonths(now, 1), 'MMMM', { locale: ptBR });
    const nextMonth = format(addMonths(now, 1), 'MMMM', { locale: ptBR });
    
    // Para 3 meses passados (Ex: Jun/Mai/Abr)
    const last3Months = Array.from({ length: 3 }, (_, i) => 
      format(subMonths(now, i + 1), 'MMM', { locale: ptBR })
    ).join('/');
    
    // Para 6 meses passados (Ex: Jun-Jan)
    const last6Start = format(subMonths(now, 6), 'MMM', { locale: ptBR });
    const last6End = format(subMonths(now, 1), 'MMM', { locale: ptBR });
    
    // Para 3 meses futuros (Ex: Ago/Set/Out)
    const next3Months = Array.from({ length: 3 }, (_, i) => 
      format(addMonths(now, i + 1), 'MMM', { locale: ptBR })
    ).join('/');
    
    // Para 6 meses futuros (Ex: Ago-Jan)
    const next6Start = format(addMonths(now, 1), 'MMM', { locale: ptBR });
    const next6End = format(addMonths(now, 6), 'MMM', { locale: ptBR });
    
    // Para 12 meses futuros (Ex: Ago-Jul)
    const next12Start = format(addMonths(now, 1), 'MMM', { locale: ptBR });
    const next12End = format(addMonths(now, 12), 'MMM', { locale: ptBR });

    return [
      { value: 'current_month', label: `Mês Atual (${currentMonth})`, group: 'Atual' },
      { value: 'current_year', label: `Ano Atual (${currentYear})`, group: 'Atual' },
      { value: 'last_month', label: `Último Mês (${lastMonth})`, group: 'Passado' },
      { value: 'last_3_months', label: `Últimos 3 Meses (${last3Months})`, group: 'Passado' },
      { value: 'last_6_months', label: `Últimos 6 Meses (${last6Start}-${last6End})`, group: 'Passado' },
      { value: 'last_year', label: `Ano Passado (${currentYear - 1})`, group: 'Passado' },
      { value: 'next_month', label: `Próximo Mês (${nextMonth})`, group: 'Futuro' },
      { value: 'next_3_months', label: `Próximos 3 Meses (${next3Months})`, group: 'Futuro' },
      { value: 'next_6_months', label: `Próximos 6 Meses (${next6Start}-${next6End})`, group: 'Futuro' },
      { value: 'next_12_months', label: `Próximos 12 Meses (${next12Start}-${next12End})`, group: 'Futuro' }
    ];
  };

  const periodOptions = generatePeriodOptions();

  const COLORS = ['#6A6DDF', '#F472B6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];

  const getCurrentPeriodLabel = () => {
    return periodOptions.find(option => option.value === selectedPeriod)?.label || 'Período Selecionado';
  };

  return (
    <div className="p-6 space-y-8 bg-[#F8F9FA]">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gradient-primary">Dashboard Analítico</h1>
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              {['Atual', 'Passado', 'Futuro'].map(group => (
                <React.Fragment key={group}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t mt-1 pt-2 first:mt-0 first:border-t-0">{group}</div>
                  {periodOptions.filter(o => o.group === group).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
          <PropertyMultiSelect properties={properties} selectedProperties={selectedProperties} onSelectionChange={setSelectedProperties} isOpen={propertySelectOpen} onToggle={() => setPropertySelectOpen(!propertySelectOpen)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-700 -mb-4">Visão Financeira {periodType === 'future' && <span className="text-sm font-normal text-gray-500">(Previsão)</span>}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MonthlyRevenueKPI totalRevenue={financialData.totalRevenue} selectedPeriod={getCurrentPeriodLabel()} />
            <KPICard title="Despesas Totais" value={`R$ ${financialData.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} isPositive={false} icon={<TrendingDown className="h-4 w-4" />} />
            <NetProfitKPI reservations={financialData.reservationsForPeriod} />
            <KPICard title="Taxa de Ocupação" value={`${financialData.occupancyRate.toFixed(1)}%`} icon={<Calendar className="h-4 w-4" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3"><AnnualGrowthChart monthlyData={annualGrowthData.monthlyData} yearlyData={annualGrowthData.yearlyData} loading={annualGrowthLoading} /></div>
            <div className="lg:col-span-2"><Card className="bg-white h-full"><CardHeader><CardTitle className="text-gradient-primary">Receita por Plataforma</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={financialData.revenueByPlatform} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{financialData.revenueByPlatform.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} /></PieChart></ResponsiveContainer></CardContent></Card></div>
          </div>

          <div className="border-t pt-8 space-y-6">
            {/* Payment Summary Cards */}
            <div>
              <h2 className="text-2xl font-bold text-gray-700 mb-4">Resumo de Pagamentos</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PaymentSummaryCard totalPaidCount={operationalData.totalPaidCount} totalPendingCount={operationalData.totalPendingCount} />
                <PaymentStatusCard paidCount={operationalData.paidCount} pendingCount={operationalData.pendingCount} />
              </div>
            </div>

            {/* Events Section */}
            <div>
              <h2 className="text-2xl font-bold text-gray-700 mb-4">Eventos</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UpcomingReservations reservations={operationalData.upcomingReservations} loading={operationalData.loading} />
                <RecentReservations reservations={operationalData.recentReservations} loading={operationalData.loading} />
              </div>
            </div>

            {/* Cashflow */}
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
