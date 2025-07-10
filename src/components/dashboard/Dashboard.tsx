
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import KPICard from './KPICard';
import PropertyMultiSelect from './PropertyMultiSelect';
import RecentReservations from './RecentReservations';
import AnnualGrowthChart from './AnnualGrowthChart';
import { TrendingUp, DollarSign, TrendingDown, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';

const Dashboard = () => {
  const [selectedProperties, setSelectedProperties] = useState<string[]>(['todas']);
  const [selectedPeriod, setSelectedPeriod] = useState('12meses');
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    occupancyRate: 0,
    monthlyRevenue: [],
    expensesByCategory: [],
    monthlyGrowth: [],
    recentReservations: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedProperties, selectedPeriod]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('name');

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const periodMonths = selectedPeriod === '3meses' ? 3 : selectedPeriod === '6meses' ? 6 : 12;
      const startDate = new Date(now.getFullYear(), now.getMonth() - periodMonths, 1);

      // Construir condições de filtro de propriedades
      const propertyFilter = selectedProperties.includes('todas') && selectedProperties.length === 1 
        ? null 
        : selectedProperties.filter(id => id !== 'todas');

      // Buscar receitas
      let revenueQuery = supabase
        .from('reservations')
        .select('id, total_revenue, net_revenue, check_in_date, check_out_date, property_id, guest_name, reservation_status, properties(name, nickname)')
        .gte('check_in_date', startDate.toISOString().split('T')[0]);

      if (propertyFilter && propertyFilter.length > 0) {
        revenueQuery = revenueQuery.in('property_id', propertyFilter);
      }

      const { data: reservations, error: revenueError } = await revenueQuery;
      if (revenueError) throw revenueError;

      // Buscar receitas do ano anterior para crescimento
      const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);

      let lastYearQuery = supabase
        .from('reservations')
        .select('total_revenue, check_in_date')
        .gte('check_in_date', lastYearStart.toISOString().split('T')[0])
        .lte('check_in_date', lastYearEnd.toISOString().split('T')[0]);

      if (propertyFilter && propertyFilter.length > 0) {
        lastYearQuery = lastYearQuery.in('property_id', propertyFilter);
      }

      const { data: lastYearReservations, error: lastYearError } = await lastYearQuery;
      if (lastYearError) throw lastYearError;

      // Buscar despesas
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date, category, property_id')
        .gte('expense_date', startDate.toISOString().split('T')[0]);

      if (propertyFilter && propertyFilter.length > 0) {
        expenseQuery = expenseQuery.in('property_id', propertyFilter);
      }

      const { data: expenses, error: expenseError } = await expenseQuery;
      if (expenseError) throw expenseError;

      // Calcular KPIs
      const totalRevenue = (reservations || []).reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const totalExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      // Calcular receita mensal
      const monthlyRevenue = calculateMonthlyRevenue(reservations || [], periodMonths);
      
      // Calcular receita anual para o gráfico de crescimento
      const yearlyRevenue = calculateYearlyRevenue(reservations || []);

      // Calcular crescimento mensal
      const monthlyGrowth = calculateMonthlyGrowth(reservations || [], lastYearReservations || []);

      // Calcular despesas por categoria
      const expensesByCategory = calculateExpensesByCategory(expenses || []);

      // Preparar reservas recentes
      const recentReservations = (reservations || [])
        .sort((a, b) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime())
        .slice(0, 8)
        .map(r => ({
          id: r.id || '',
          guest_name: r.guest_name || '',
          property_name: r.properties?.nickname || r.properties?.name || 'Propriedade não informada',
          check_in_date: r.check_in_date,
          check_out_date: r.check_out_date || '',
          total_revenue: r.total_revenue || 0,
          reservation_status: r.reservation_status || 'Confirmada'
        }));

      // Taxa de ocupação simplificada
      const occupancyRate = Math.min(((reservations || []).length / periodMonths) * 10, 100);

      setDashboardData({
        totalRevenue,
        totalExpenses,
        netProfit,
        occupancyRate,
        monthlyRevenue,
        expensesByCategory,
        monthlyGrowth,
        recentReservations
      });
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyRevenue = (reservations: any[], months: number) => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                       'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();
    const data = [];

    for (let i = months - 1; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${month.getFullYear()}-${(month.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const monthRevenue = reservations
        .filter(r => r.check_in_date.startsWith(monthKey))
        .reduce((sum, r) => sum + (r.total_revenue || 0), 0);

      data.push({
        month: monthNames[month.getMonth()],
        receita: monthRevenue
      });
    }

    return data;
  };

  const calculateYearlyRevenue = (reservations: any[]) => {
    const yearlyData: { [key: string]: number } = {};
    
    reservations.forEach(r => {
      const year = r.check_in_date.split('-')[0];
      yearlyData[year] = (yearlyData[year] || 0) + (r.total_revenue || 0);
    });

    return Object.entries(yearlyData).map(([year, receita]) => ({
      year,
      receita,
      revenue: receita
    })).sort((a, b) => a.year.localeCompare(b.year));
  };

  const calculateMonthlyGrowth = (currentReservations: any[], lastYearReservations: any[]) => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                       'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date().getFullYear();
    const data = [];

    for (let month = 0; month < 12; month++) {
      const currentMonthKey = `${currentYear}-${(month + 1).toString().padStart(2, '0')}`;
      const lastYearMonthKey = `${currentYear - 1}-${(month + 1).toString().padStart(2, '0')}`;

      const currentRevenue = currentReservations
        .filter(r => r.check_in_date.startsWith(currentMonthKey))
        .reduce((sum, r) => sum + (r.total_revenue || 0), 0);

      const previousRevenue = lastYearReservations
        .filter(r => r.check_in_date.startsWith(lastYearMonthKey))
        .reduce((sum, r) => sum + (r.total_revenue || 0), 0);

      const growth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      data.push({
        month: monthNames[month],
        current: currentRevenue,
        previous: previousRevenue,
        growth: growth
      });
    }

    return data;
  };

  const calculateExpensesByCategory = (expenses: any[]) => {
    const categoryData: { [key: string]: number } = {};
    
    expenses.forEach(e => {
      const category = e.category || 'Outros';
      categoryData[category] = (categoryData[category] || 0) + (e.amount || 0);
    });

    return Object.entries(categoryData).map(([name, value]) => ({
      name,
      value
    }));
  };

  const COLORS = ['#6A6DDF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gradient-primary text-lg">Carregando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gradient-primary">Dashboard Analítico</h1>
        <div className="flex gap-4">
          <PropertyMultiSelect
            properties={properties}
            selectedProperties={selectedProperties}
            onSelectionChange={setSelectedProperties}
            isOpen={propertySelectOpen}
            onToggle={() => setPropertySelectOpen(!propertySelectOpen)}
          />
          
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3meses">3 Meses</SelectItem>
              <SelectItem value="6meses">6 Meses</SelectItem>
              <SelectItem value="12meses">12 Meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs - Arrastáveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Receita Bruta"
          value={`R$ ${dashboardData.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          isPositive={true}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KPICard
          title="Despesas Totais"
          value={`R$ ${dashboardData.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          isPositive={false}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <KPICard
          title="Lucro Líquido"
          value={`R$ ${dashboardData.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          isPositive={dashboardData.netProfit >= 0}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KPICard
          title="Taxa de Ocupação"
          value={`${dashboardData.occupancyRate.toFixed(1)}%`}
          isPositive={true}
          icon={<Calendar className="h-4 w-4" />}
        />
      </div>

      {/* Segunda linha: Receita Mensal e Últimas Reservas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-gradient-primary">Receita Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboardData.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']} />
                <Line 
                  type="monotone" 
                  dataKey="receita" 
                  stroke="#6A6DDF" 
                  strokeWidth={3}
                  dot={{ fill: '#6A6DDF', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <RecentReservations
          reservations={dashboardData.recentReservations}
          loading={loading}
        />
      </div>

      {/* Terceira linha: Gráfico de Crescimento Anual - largura completa */}
      <div className="w-full">
        <AnnualGrowthChart
          monthlyData={dashboardData.monthlyGrowth}
          yearlyData={[]}
          loading={loading}
        />
      </div>

      {/* Despesas por Categoria */}
      {dashboardData.expensesByCategory.length > 0 && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-gradient-primary">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dashboardData.expensesByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dashboardData.expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
