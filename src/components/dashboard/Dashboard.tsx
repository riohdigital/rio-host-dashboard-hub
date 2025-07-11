import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import KPICard from './KPICard';
import NetProfitKPI from './NetProfitKPI';
import MonthlyRevenueKPI from './MonthlyRevenueKPI';
import PropertyMultiSelect from './PropertyMultiSelect';
import AnnualGrowthChart from './AnnualGrowthChart';
import PaymentStatusCard from './PaymentStatusCard'; // Importado
import CashflowCard from './CashflowCard';         // Importado
import UpcomingReservations from './RecentReservations'; // Renomeado para a nova função
import { TrendingDown, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';

const Dashboard = () => {
  const [selectedProperties, setSelectedProperties] = useState<string[]>(['todas']);
  const [selectedPeriod, setSelectedPeriod] = useState('12');
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estados para os dados
  const [financialData, setFinancialData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    reservationsForPeriod: [],
    expensesByCategory: [],
    revenueByPlatform: []
  });
  const [operationalData, setOperationalData] = useState({
    paidCount: 0,
    pendingCount: 0,
    cashflow: { airbnbReceived: 0, bookingReceived: 0, airbnbReceivable: 0, bookingReceivable: 0 },
    upcomingReservations: []
  });
  const [annualGrowthData, setAnnualGrowthData] = useState<{ monthlyData: any[], yearlyData: any[] }>({
    monthlyData: [],
    yearlyData: []
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const previousYear = currentYear - 1;
      const monthsBack = parseInt(selectedPeriod, 10);
      const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
      const startDateString = startDate.toISOString().split('T')[0];

      const propertyFilter = selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');

      // --- Buscas Paralelas ---
      const [
        propertiesRes,
        reservationsRes,
        expensesRes,
        currentYearRes,
        previousYearRes,
        upcomingRes
      ] = await Promise.all([
        supabase.from('properties').select('*').order('name'),
        supabase.from('reservations').select('*, properties(name, nickname)').gte('check_in_date', startDateString).or(propertyFilter ? `property_id.in.(${propertyFilter.join(',')})` : ''),
        supabase.from('expenses').select('*').gte('expense_date', startDateString).or(propertyFilter ? `property_id.in.(${propertyFilter.join(',')})` : ''),
        supabase.from('reservations').select('total_revenue, check_in_date').gte('check_in_date', `${currentYear}-01-01`).lte('check_in_date', `${currentYear}-12-31`).or(propertyFilter ? `property_id.in.(${propertyFilter.join(',')})` : ''),
        supabase.from('reservations').select('total_revenue, check_in_date').gte('check_in_date', `${previousYear}-01-01`).lte('check_in_date', `${previousYear}-12-31`).or(propertyFilter ? `property_id.in.(${propertyFilter.join(',')})` : ''),
        supabase.from('reservations').select('*, properties(nickname, name)').gte('check_in_date', new Date().toISOString().split('T')[0]).order('check_in_date', { ascending: true }).limit(3)
      ]);

      // --- Processamento de Dados ---
      if (propertiesRes.error) throw propertiesRes.error;
      setProperties(propertiesRes.data || []);
      
      const reservations = reservationsRes.data || [];
      const expenses = expensesRes.data || [];

      // Dados Financeiros
      const totalRevenue = reservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const expensesByCategory = Object.entries(expenses.reduce((acc, exp) => ({...acc, [exp.category || 'Outros']: (acc[exp.category || 'Outros'] || 0) + exp.amount}), {})).map(([name, value]) => ({name, value}));
      const revenueByPlatform = Object.entries(reservations.reduce((acc, res) => ({...acc, [res.platform || 'Outros']: (acc[res.platform || 'Outros'] || 0) + res.total_revenue}), {})).map(([name, value]) => ({name, value}));

      setFinancialData({
        totalRevenue,
        totalExpenses,
        reservationsForPeriod: reservations,
        expensesByCategory,
        revenueByPlatform
      });

      // Dados Operacionais
      const paidCount = reservations.filter(r => r.payment_status === 'Pago').length;
      const pendingCount = reservations.filter(r => r.payment_status !== 'Pago').length;
      const cashflow = reservations.reduce((acc, res) => {
        const platform = res.platform?.toLowerCase().includes('airbnb') ? 'airbnb' : 'booking';
        if (res.payment_status === 'Pago') acc[`${platform}Received`] += res.net_revenue || 0;
        else acc[`${platform}Receivable`] += res.net_revenue || 0;
        return acc;
      }, { airbnbReceived: 0, bookingReceived: 0, airbnbReceivable: 0, bookingReceivable: 0 });

      setOperationalData({ paidCount, pendingCount, cashflow, upcomingReservations: upcomingRes.data || [] });
      
      // Dados de Crescimento Anual
      const monthlyGrowthData = calculateAnnualGrowth(currentYearRes.data || [], previousYearRes.data || [], currentYear, previousYear);
      const yearlyData = [
        { year: previousYear.toString(), revenue: (previousYearRes.data || []).reduce((s, r) => s + r.total_revenue, 0) },
        { year: currentYear.toString(), revenue: (currentYearRes.data || []).reduce((s, r) => s + r.total_revenue, 0) }
      ];
      setAnnualGrowthData({ monthlyData: monthlyGrowthData, yearlyData });

    } catch (error: any) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedProperties]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const COLORS = ['#6A6DDF', '#F472B6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];
  const periodOptions = [{ value: '1', label: 'Último mês' }, { value: '3', label: 'Últimos 3 meses' }, { value: '6', label: 'Últimos 6 meses' }, { value: '12', label: 'Últimos 12 meses' }];

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gradient-primary">Dashboard Analítico</h1>
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}><SelectTrigger className="w-40"><SelectValue placeholder="Período" /></SelectTrigger><SelectContent>{periodOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
          <PropertyMultiSelect properties={properties} selectedProperties={selectedProperties} onSelectionChange={setSelectedProperties} isOpen={propertySelectOpen} onToggle={() => setPropertySelectOpen(!propertySelectOpen)} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>
      ) : (
        <>
          {/* SEÇÃO 1: VISÃO FINANCEIRA */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MonthlyRevenueKPI totalRevenue={financialData.totalRevenue} selectedPeriod={periodOptions.find(o => o.value === selectedPeriod)?.label || ''} />
            <KPICard title="Despesas Totais" value={`R$ ${financialData.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} isPositive={false} icon={<TrendingDown className="h-4 w-4" />} />
            <NetProfitKPI reservations={financialData.reservationsForPeriod} />
            <KPICard title="Taxa de Ocupação" value={`${(0).toFixed(1)}%`} icon={<Calendar className="h-4 w-4" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3"><AnnualGrowthChart monthlyData={annualGrowthData.monthlyData} yearlyData={annualGrowthData.yearlyData} loading={loading} /></div>
            <div className="lg:col-span-2"><Card className="bg-white h-full"><CardHeader><CardTitle className="text-gradient-primary">Receita por Plataforma</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={financialData.revenueByPlatform} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} label>{financialData.revenueByPlatform.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} /></PieChart></ResponsiveContainer></CardContent></Card></div>
          </div>

          {/* SEÇÃO 2: VISÃO OPERACIONAL E DE CAIXA */}
          <div className="border-t pt-8">
            <h2 className="text-2xl font-bold text-gradient-primary mb-4">Visão Operacional</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <PaymentStatusCard paidCount={operationalData.paidCount} pendingCount={operationalData.pendingCount} />
              <CashflowCard data={operationalData.cashflow} />
              <UpcomingReservations reservations={operationalData.upcomingReservations} loading={loading} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
