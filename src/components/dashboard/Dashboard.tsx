import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, DollarSign, TrendingDown, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';

// Import hooks
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { useFinancialData } from '@/hooks/dashboard/useFinancialData';
import { useOperationalData } from '@/hooks/dashboard/useOperationalData';
import { useAnnualGrowthData } from '@/hooks/dashboard/useAnnualGrowthData';

// Import components
import KPICard from './KPICard';
import NetProfitKPI from './NetProfitKPI';
import MonthlyRevenueKPI from './MonthlyRevenueKPI';
import PropertyMultiSelect from './PropertyMultiSelect';
import AnnualGrowthChart from './AnnualGrowthChart';
import PaymentStatusCard from './PaymentStatusCard';
import PaymentSummaryCard from './PaymentSummaryCard';
import CashflowCard from './CashflowCard';
import UpcomingReservations from './RecentReservations';

const Dashboard = () => {
  // State management
  const [selectedProperties, setSelectedProperties] = useState<string[]>(['todas']);
  const [selectedPeriod, setSelectedPeriod] = useState('current_year'); // Definido para 'current_year' para corresponder ao seu caso
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);
  const [propertiesLoading, setPropertiesLoading] = useState(true);

  // Date calculations
  const { startDateString, endDateString, totalDays, periodType } = useDateRange(selectedPeriod);

  // Data hooks
  const financialData = useFinancialData(startDateString, endDateString, selectedProperties, totalDays);
  const operationalData = useOperationalData(startDateString, endDateString, selectedProperties);
  const annualGrowthData = useAnnualGrowthData(selectedProperties);

  // Load properties on mount
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .order('name');

        if (error) throw error;
        setProperties(data || []);
      } catch (error) {
        console.error('Erro ao carregar propriedades:', error);
      } finally {
        setPropertiesLoading(false);
      }
    };

    fetchProperties();
  }, []);

  // Fetch data when dependencies change
  useEffect(() => {
    if (!propertiesLoading) {
      financialData.fetchFinancialData();
      operationalData.fetchOperationalData();
      annualGrowthData.fetchAnnualGrowthData();
    }
  }, [selectedPeriod, selectedProperties, propertiesLoading]);

  // Chart configuration
  const COLORS = ['#6A6DDF', '#F472B6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];
  
  const periodOptions = [
    { value: 'current_month', label: 'Mês Atual (Julho)', group: 'Atual' },
    { value: 'current_year', label: 'Ano Atual (2025)', group: 'Atual' },
    { value: 'last_month', label: 'Último Mês (Junho)', group: 'Passado' },
    { value: 'last_3_months', label: 'Últimos 3 Meses (Jun/Mai/Abr)', group: 'Passado' },
    { value: 'last_6_months', label: 'Últimos 6 Meses (Jun-Jan)', group: 'Passado' },
    { value: 'last_year', label: 'Ano Passado (2024)', group: 'Passado' },
    { value: 'next_month', label: 'Próximo Mês (Agosto)', group: 'Futuro' },
    { value: 'next_3_months', label: 'Próximos 3 Meses (Ago/Set/Out)', group: 'Futuro' },
    { value: 'next_6_months', label: 'Próximos 6 Meses (Ago-Jan)', group: 'Futuro' },
    { value: 'next_12_months', label: 'Próximos 12 Meses (Ago-Jul)', group: 'Futuro' }
  ];

  const isLoading = financialData.loading || operationalData.loading || annualGrowthData.loading || propertiesLoading;

  // REMOVIDO: Bloco que criava dados "fake" para o KPI de Lucro.
  // const reservationsForNetProfit = Array(financialData.data.reservationsCount).fill({...});

  const getCurrentPeriodLabel = () => {
    const selectedOption = periodOptions.find(option => option.value === selectedPeriod);
    return selectedOption?.label || 'Período Selecionado';
  };

  return (
    <div className="p-6 space-y-8 bg-[#F8F9FA]">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gradient-primary">Dashboard Analítico</h1>
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Período Atual</div>
              {periodOptions.filter(option => option.group === 'Atual').map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t mt-1 pt-2">Períodos Passados</div>
              {periodOptions.filter(option => option.group === 'Passado').map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t mt-1 pt-2">Períodos Futuros</div>
              {periodOptions.filter(option => option.group === 'Futuro').map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <PropertyMultiSelect
            properties={properties}
            selectedProperties={selectedProperties}
            onSelectionChange={setSelectedProperties}
            isOpen={propertySelectOpen}
            onToggle={() => setPropertySelectOpen(!propertySelectOpen)}
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Financial Vision */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-700">
              Visão Financeira {periodType === 'future' && <span className="text-sm font-normal text-gray-500">(Previsão)</span>}
            </h2>
            
            {/* Financial KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MonthlyRevenueKPI 
                totalRevenue={financialData.data.totalRevenue}
                selectedPeriod={getCurrentPeriodLabel()}
              />
              <KPICard
                title="Despesas Totais"
                value={`R$ ${financialData.data.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                isPositive={false}
                icon={<TrendingDown className="h-4 w-4" />}
              />
              {/* CORREÇÃO: Passando o array de reservas real, não o "fake". */}
              {/* O `|| []` é uma boa prática para evitar erros se `reservations` for undefined. */}
              <NetProfitKPI reservations={financialData.data.reservations || []} />
              
              <KPICard
                title="Taxa de Ocupação"
                value={`${financialData.data.occupancyRate.toFixed(1)}%`}
                icon={<Calendar className="h-4 w-4" />}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <AnnualGrowthChart
                  monthlyData={annualGrowthData.data.monthlyData}
                  yearlyData={annualGrowthData.data.yearlyData}
                  loading={annualGrowthData.loading}
                />
              </div>
              
              <div className="lg:col-span-2">
                <Card className="bg-white h-full">
                  <CardHeader><CardTitle className="text-gradient-primary">Receita por Plataforma</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={financialData.data.revenueByPlatform}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {financialData.data.revenueByPlatform.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Upcoming Events Section */}
          <div className="border-t pt-8 space-y-6">
            <h2 className="text-2xl font-bold text-gray-700">Próximos Eventos</h2>
            
            <div className="max-w-4xl">
              <UpcomingReservations
                reservations={operationalData.data.upcomingReservations}
                loading={operationalData.loading}
              />
            </div>
          </div>

          {/* Operational Vision */}
          <div className="border-t pt-8 space-y-6">
            <h2 className="text-2xl font-bold text-gray-700">
              Visão Operacional {periodType === 'future' && <span className="text-sm font-normal text-gray-500">(Previsão)</span>}
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <PaymentSummaryCard
                totalPaidCount={operationalData.data.totalPaidCount}
                totalPendingCount={operationalData.data.totalPendingCount}
              />
              <PaymentStatusCard
                paidCount={operationalData.data.paidCount}
                pendingCount={operationalData.data.pendingCount}
              />
              <CashflowCard data={operationalData.data.cashflow} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
