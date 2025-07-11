import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import KPICard from './KPICard';
import NetProfitKPI from './NetProfitKPI';
import MonthlyRevenueKPI from './MonthlyRevenueKPI';
import PropertyMultiSelect from './PropertyMultiSelect';
import AnnualGrowthChart from './AnnualGrowthChart';
import PaymentStatusCard from './PaymentStatusCard';
import CashflowCard from './CashflowCard';
import UpcomingReservations from './RecentReservations';
import { TrendingDown, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';

const Dashboard = () => {
  const [selectedProperties, setSelectedProperties] = useState<string[]>(['todas']);
  const [selectedPeriod, setSelectedPeriod] = useState('12');
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estados segmentados para os dados do dashboard
  const [financialData, setFinancialData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    reservationsForPeriod: [],
    expensesByCategory: [],
    revenueByPlatform: [],
    occupancyRate: 0
  });
  const [operationalData, setOperationalData] = useState({
    paidCount: 0,
    pendingCount: 0,
    cashflow: { 
      airbnbReceived: 0, 
      bookingReceived: 0, 
      diretoReceived: 0,
      airbnbReceivable: 0, 
      bookingReceivable: 0,
      diretoReceivable: 0
    },
    upcomingReservations: []
  });
  const [annualGrowthData, setAnnualGrowthData] = useState<{ monthlyData: any[], yearlyData: any[] }>({
    monthlyData: [],
    yearlyData: []
  });

  // CORREÇÃO: Função utilitária para formatação consistente de moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // CORREÇÃO: Função para padronizar status de pagamento
  const normalizePaymentStatus = (status: string) => {
    if (!status) return 'Pendente';
    const normalized = status.toLowerCase();
    if (normalized.includes('pago') || normalized.includes('paid')) return 'Pago';
    if (normalized.includes('pendente') || normalized.includes('pending')) return 'Pendente';
    return 'Pendente'; // default
  };

  // CORREÇÃO: Função para validação de datas
  const isValidDate = (dateString: string) => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  // CORREÇÃO: Função para mapeamento de plataformas
  const getPlatformKey = (platform: string) => {
    if (!platform) return 'booking.com';
    const normalized = platform.toLowerCase();
    if (normalized.includes('airbnb')) return 'airbnb';
    if (normalized.includes('direto') || normalized.includes('direct')) return 'direto';
    return 'booking.com';
  };

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

  // CORREÇÃO: Função para calcular taxa de ocupação
  const calculateOccupancyRate = (reservations: any[], properties: Property[], startDate: Date, endDate: Date) => {
    const propertyFilter = selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');
    const filteredPropertiesCount = propertyFilter ? propertyFilter.length : properties.length;
    
    if (filteredPropertiesCount === 0) return 0;
    
    const totalDaysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalAvailableDays = totalDaysInPeriod * filteredPropertiesCount;
    
    const totalBookedDays = reservations.reduce((sum, r) => {
      const checkIn = new Date(r.check_in_date);
      const checkOut = new Date(r.check_out_date);
      const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    
    return Math.min(100, (totalBookedDays / totalAvailableDays) * 100);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const previousYear = currentYear - 1;
      const monthsBack = parseInt(selectedPeriod, 10);
      const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
      const endDate = new Date(); // Para o cálculo da taxa de ocupação
      const startDateString = startDate.toISOString().split('T')[0];
      const todayString = now.toISOString().split('T')[0];
      
      const propertyFilter = selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');

      // Construção das queries
      let propertiesQuery = supabase.from('properties').select('*').order('name');
      
      let reservationsQuery = supabase.from('reservations').select('*, properties(name, nickname)').gte('check_in_date', startDateString);
      let expensesQuery = supabase.from('expenses').select('*').gte('expense_date', startDateString);
      let currentYearQuery = supabase.from('reservations').select('total_revenue, check_in_date').gte('check_in_date', `${currentYear}-01-01`).lte('check_in_date', `${currentYear}-12-31`);
      let previousYearQuery = supabase.from('reservations').select('total_revenue, check_in_date').gte('check_in_date', `${previousYear}-01-01`).lte('check_in_date', `${previousYear}-12-31`);
      let upcomingQuery = supabase.from('reservations').select('*, properties(nickname, name)').gte('check_in_date', todayString).order('check_in_date', { ascending: true }).limit(3);

      // Aplicar filtro de propriedade se existir
      if (propertyFilter && propertyFilter.length > 0) {
        reservationsQuery = reservationsQuery.in('property_id', propertyFilter);
        expensesQuery = expensesQuery.in('property_id', propertyFilter);
        currentYearQuery = currentYearQuery.in('property_id', propertyFilter);
        previousYearQuery = previousYearQuery.in('property_id', propertyFilter);
        upcomingQuery = upcomingQuery.in('property_id', propertyFilter);
      }

      const [propertiesRes, reservationsRes, expensesRes, currentYearRes, previousYearRes, upcomingRes] = await Promise.all([
        propertiesQuery, reservationsQuery, expensesQuery, currentYearQuery, previousYearQuery, upcomingQuery
      ]);

      if (propertiesRes.error) throw propertiesRes.error;
      if (reservationsRes.error) throw reservationsRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (currentYearRes.error) throw currentYearRes.error;
      if (previousYearRes.error) throw previousYearRes.error;
      if (upcomingRes.error) throw upcomingRes.error;
      
      const properties = propertiesRes.data || [];
      const reservations = reservationsRes.data || [];
      const expenses = expensesRes.data || [];
      
      setProperties(properties);

      // CORREÇÃO: Filtrar reservas com datas válidas
      const validReservations = reservations.filter(r => 
        isValidDate(r.check_in_date) && isValidDate(r.check_out_date)
      );

      // CORREÇÃO: Cálculos financeiros com validação dos campos
      const totalRevenue = validReservations.reduce((sum, r) => {
        return sum + (r.total_revenue || r.valor_total || 0);
      }, 0);

      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      
      // CORREÇÃO: Usar a função corrigida para calcular taxa de ocupação
      const occupancyRate = calculateOccupancyRate(validReservations, properties, startDate, endDate);
      
      const expensesByCategory = Object.entries(expenses.reduce((acc, exp) => ({...acc, [exp.category || 'Outros']: (acc[exp.category || 'Outros'] || 0) + exp.amount}), {})).map(([name, value]) => ({name, value}));
      const revenueByPlatform = Object.entries(validReservations.reduce((acc, res) => ({...acc, [res.platform || 'Outros']: (acc[res.platform || 'Outros'] || 0) + res.total_revenue}), {})).map(([name, value]) => ({name, value}));

      setFinancialData({ totalRevenue, totalExpenses, reservationsForPeriod: validReservations, expensesByCategory, revenueByPlatform, occupancyRate });

      // CORREÇÃO: Cálculos operacionais com status normalizado
      const paidCount = validReservations.filter(r => 
        normalizePaymentStatus(r.payment_status) === 'Pago'
      ).length;
      const pendingCount = validReservations.length - paidCount;
      
      // CORREÇÃO: Cashflow com suporte a 3 plataformas
      const cashflow = validReservations.reduce((acc, res) => {
        const platform = getPlatformKey(res.platform);
        const netRevenue = res.net_revenue || res.valor_proprietario || 0;
        
        if (normalizePaymentStatus(res.payment_status) === 'Pago') {
          acc[`${platform}Received`] += netRevenue;
        } else {
          acc[`${platform}Receivable`] += netRevenue;
        }
        return acc;
      }, { 
        airbnbReceived: 0, 
        bookingReceived: 0, 
        diretoReceived: 0,
        airbnbReceivable: 0, 
        bookingReceivable: 0,
        diretoReceivable: 0
      });
      
      setOperationalData({ paidCount, pendingCount, cashflow, upcomingReservations: upcomingRes.data || [] });
      
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
  const periodOptions = [
    { value: '1', label: 'Último mês' }, 
    { value: '3', label: 'Últimos 3 meses' }, 
    { value: '6', label: 'Últimos 6 meses' }, 
    { value: '12', label: 'Últimos 12 meses' }
  ];

  return (
    <div className="p-6 space-y-8 bg-[#F8F9FA]">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gradient-primary">Dashboard Analítico</h1>
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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

      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-700 -mb-4">Visão Financeira</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MonthlyRevenueKPI 
              totalRevenue={financialData.totalRevenue} 
              selectedPeriod={periodOptions.find(o => o.value === selectedPeriod)?.label || ''} 
            />
            <KPICard 
              title="Despesas Totais" 
              value={formatCurrency(financialData.totalExpenses)} 
              isPositive={false} 
              icon={<TrendingDown className="h-4 w-4" />} 
            />
            <NetProfitKPI reservations={financialData.reservationsForPeriod} />
            <KPICard 
              title="Taxa de Ocupação" 
              value={`${financialData.occupancyRate.toFixed(1)}%`} 
              icon={<Calendar className="h-4 w-4" />} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <AnnualGrowthChart 
                monthlyData={annualGrowthData.monthlyData} 
                yearlyData={annualGrowthData.yearlyData} 
                loading={loading} 
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
                        data={financialData.revenueByPlatform} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60} 
                        outerRadius={80} 
                        paddingAngle={5} 
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {financialData.revenueByPlatform.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => formatCurrency(Number(value))} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="border-t pt-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-4">Visão Operacional</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <PaymentStatusCard 
                paidCount={operationalData.paidCount} 
                pendingCount={operationalData.pendingCount} 
              />
              <CashflowCard data={operationalData.cashflow} />
              <UpcomingReservations 
                reservations={operationalData.upcomingReservations} 
                loading={loading} 
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
