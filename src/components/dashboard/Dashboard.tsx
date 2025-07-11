
'use client';

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
import CashflowCard from './CashflowCard';
import UpcomingReservations from './RecentReservations';

const Dashboard = () => {
  // State management
  const [selectedProperties, setSelectedProperties] = useState<string[]>(['todas']);
  const [selectedPeriod, setSelectedPeriod] = useState('3');
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);
  const [propertiesLoading, setPropertiesLoading] = useState(true);

  // Date calculations
  const { startDateString, endDateString, totalDays } = useDateRange(selectedPeriod);

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
    { value: '1', label: 'Último mês' },
    { value: '3', label: 'Últimos 3 meses' },
    { value: '6', label: 'Últimos 6 meses' },
    { value: '12', label: 'Últimos 12 meses' }
  ];

  const isLoading = financialData.loading || operationalData.loading || annualGrowthData.loading || propertiesLoading;

  // Create reservations array for NetProfitKPI compatibility
  const reservationsForNetProfit = Array(financialData.data.reservationsCount).fill({
    net_revenue: financialData.data.netProfit / Math.max(financialData.data.reservationsCount, 1),
    commission_amount: 0
  });

  return (
    <div className="p-6 space-y-8 bg-[#F8F9FA]">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gradient-primary">Dashboard Analítico</h1>
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
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
            <h2 className="text-2xl font-bold text-gray-700">Visão Financeira</h2>
            
            {/* Financial KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MonthlyRevenueKPI 
                totalRevenue={financialData.data.totalRevenue}
                selectedPeriod={periodOptions.find(o => o.value === selectedPeriod)?.label || ''}
              />
              <KPICard
                title="Despesas Totais"
                value={`R$ ${financialData.data.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                isPositive={false}
                icon={<TrendingDown className="h-4 w-4" />}
              />
              <NetProfitKPI reservations={reservationsForNetProfit} />
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
                  <CardHeader>
                    <CardTitle className="text-gradient-primary">Receita por Plataforma</CardTitle>
                  </CardHeader>
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

          {/* Operational Vision */}
          <div className="border-t pt-8 space-y-6">
            <h2 className="text-2xl font-bold text-gray-700">Visão Operacional</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <PaymentStatusCard
                paidCount={operationalData.data.paidCount}
                pendingCount={operationalData.data.pendingCount}
              />
              <CashflowCard data={operationalData.data.cashflow} />
              <UpcomingReservations
                reservations={operationalData.data.upcomingReservations}
                loading={operationalData.loading}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
