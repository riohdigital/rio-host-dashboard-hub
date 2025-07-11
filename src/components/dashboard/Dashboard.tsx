import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import KPICard from './KPICard';
import NetProfitKPI from './NetProfitKPI';
import MonthlyRevenueKPI from './MonthlyRevenueKPI';
import PropertyMultiSelect from './PropertyMultiSelect';
import RecentReservations from './RecentReservations';
import AnnualGrowthChart from './AnnualGrowthChart';
import { TrendingDown, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';

const Dashboard = () => {
  const [selectedProperties, setSelectedProperties] = useState<string[]>(['todas']);
  const [selectedPeriod, setSelectedPeriod] = useState('12');
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    occupancyRate: 0,
    expensesByCategory: [],
    reservationsForPeriod: []
  });
  const [annualGrowthData, setAnnualGrowthData] = useState<{ monthlyData: any[], yearlyData: any[] }>({
    monthlyData: [],
    yearlyData: []
  });
  const [recentReservationsData, setRecentReservationsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const calculateAnnualGrowth = (currentReservations: any[], previousReservations: any[], currentYear: number, previousYear: number) => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = [];
    for (let month = 0; month < 12; month++) {
      const currentMonthKey = `${currentYear}-${(month + 1).toString().padStart(2, '0')}`;
      const previousMonthKey = `${previousYear}-${(month + 1).toString().padStart(2, '0')}`;
      const currentRevenue = currentReservations.filter(r => r.check_in_date.startsWith(currentMonthKey)).reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const previousRevenue = previousReservations.filter(r => r.check_in_date.startsWith(previousMonthKey)).reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      data.push({ month: monthNames[month], current: currentRevenue, previous: previousRevenue });
    }
    return data;
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const previousYear = currentYear - 1;
      const monthsBack = parseInt(selectedPeriod, 10);
      const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
      const startDateString = startDate.toISOString().split('T')[0];

      const propertyFilter = selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');

      // Buscas paralelas para otimização
      const [
        { data: propertiesData, error: propertiesError },
        { data: reservationsData, error: reservationsError },
        { data: expensesData, error: expensesError },
        { data: currentYearReservations, error: currentYearError },
        { data: previousYearReservations, error: previousYearError }
      ] = await Promise.all([
        supabase.from('properties').select('*').order('name'),
        supabase.from('reservations').select('*, properties(name, nickname)').gte('check_in_date', startDateString).or(propertyFilter ? `property_id.in.(${propertyFilter.join(',')})` : ''),
        supabase.from('expenses').select('*').gte('expense_date', startDateString).or(propertyFilter ? `property_id.in.(${propertyFilter.join(',')})` : ''),
        supabase.from('reservations').select('total_revenue, check_in_date').gte('check_in_date', `${currentYear}-01-01`).lte('check_in_date', `${currentYear}-12-31`).or(propertyFilter ? `property_id.in.(${propertyFilter.join(',')})` : ''),
        supabase.from('reservations').select('total_revenue, check_in_date').gte('check_in_date', `${previousYear}-01-01`).lte('check_in_date', `${previousYear}-12-31`).or(propertyFilter ? `property_id.in.(${propertyFilter.join(',')})` : '')
      ]);

      if (propertiesError) throw propertiesError;
      if (reservationsError) throw reservationsError;
      if (expensesError) throw expensesError;
      if (currentYearError) throw currentYearError;
      if (previousYearError) throw previousYearError;

      // Atualiza estado das propriedades
      setProperties(propertiesData || []);

      // Cálculos dos KPIs
      const totalRevenue = (reservationsData || []).reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const totalExpenses = (expensesData || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = (reservationsData || []).reduce((sum, r) => sum + (r.net_revenue || 0), 0) - totalExpenses;

      // Lógica de Taxa de Ocupação
      const totalDaysInPeriod = monthsBack * 30; // Simplificação
      const totalBookedDays = (reservationsData || []).reduce((sum, r) => {
          const checkIn = new Date(r.check_in_date);
          const checkOut = new Date(r.check_out_date);
          return sum + Math.ceil(Math.abs(checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      const occupancyRate = propertiesData && propertiesData.length > 0 ? (totalBookedDays / (totalDaysInPeriod * propertiesData.length)) * 100 : 0;

      // Processamento para o gráfico de despesas
      const expensesByCategory = (expensesData || []).reduce((acc: {[key: string]: number}, expense) => {
        const category = expense.category || 'Outros';
        acc[category] = (acc[category] || 0) + expense.amount;
        return acc;
      }, {});

      // Processamento para o gráfico de crescimento anual
      const monthlyGrowthData = calculateAnnualGrowth(currentYearReservations || [], previousYearReservations || [], currentYear, previousYear);
      const currentYearTotal = (currentYearReservations || []).reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const previousYearTotal = (previousYearReservations || []).reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const yearlyData = [
        { year: previousYear.toString(), revenue: previousYearTotal },
        { year: currentYear.toString(), revenue: currentYearTotal }
      ];

      setAnnualGrowthData({ monthlyData: monthlyGrowthData, yearlyData });

      // Preparar dados para o widget de reservas recentes
      const recentReservations = (reservationsData || [])
        .sort((a, b) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime())
        .slice(0, 8)
        .map(r => ({
            id: r.id || '',
            guest_name: r.guest_name || 'N/A',
            property_name: r.properties?.nickname || r.properties?.name || 'N/A',
            check_in_date: r.check_in_date,
            check_out_date: r.check_out_date || '',
            total_revenue: r.total_revenue || 0,
            reservation_status: r.reservation_status || 'Confirmada'
        }));
      setRecentReservationsData(recentReservations);

      // Atualiza o estado principal do dashboard
      setDashboardData({
        totalRevenue,
        totalExpenses,
        netProfit,
        occupancyRate: Math.min(100, occupancyRate),
        expensesByCategory: Object.entries(expensesByCategory).map(([name, value]) => ({ name, value })),
        reservationsForPeriod: reservationsData || [],
      });

    } catch (error: any) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedProperties]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const COLORS = ['#6A6DDF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  const periodOptions = [
    { value: '1', label: 'Último mês' },
    { value: '3', label: 'Últimos 3 meses' },
    { value: '6', label: 'Últimos 6 meses' },
    { value: '12', label: 'Últimos 12 meses' }
  ];

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gradient-primary">Dashboard Analítico</h1>
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>{periodOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
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

      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MonthlyRevenueKPI totalRevenue={dashboardData.totalRevenue} selectedPeriod={periodOptions.find(o => o.value === selectedPeriod)?.label || ''} />
            <KPICard title="Despesas Totais" value={`R$ ${dashboardData.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} isPositive={false} icon={<TrendingDown className="h-4 w-4" />} />
            <NetProfitKPI reservations={dashboardData.reservationsForPeriod} />
            <KPICard title="Taxa de Ocupação" value={`${dashboardData.occupancyRate.toFixed(1)}%`} icon={<Calendar className="h-4 w-4" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AnnualGrowthChart monthlyData={annualGrowthData.monthlyData} yearlyData={annualGrowthData.yearlyData} loading={loading} />
            </div>
            <div className="lg:col-span-1">
              <RecentReservations reservations={recentReservationsData} loading={loading} />
            </div>
          </div>
          
          {dashboardData.expensesByCategory.length > 0 && (
            <Card className="bg-white">
              <CardHeader><CardTitle className="text-gradient-primary">Despesas por Categoria</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={dashboardData.expensesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {dashboardData.expensesByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
