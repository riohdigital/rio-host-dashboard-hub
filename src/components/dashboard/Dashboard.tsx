
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import KPICard from './KPICard';
import { TrendingUp, DollarSign, TrendingDown, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';

const Dashboard = () => {
  const [selectedProperty, setSelectedProperty] = useState('todas');
  const [selectedPeriod, setSelectedPeriod] = useState('12meses');
  const [properties, setProperties] = useState<Property[]>([]);
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    occupancyRate: 0,
    monthlyRevenue: [],
    yearlyRevenue: [],
    expensesByCategory: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedProperty, selectedPeriod]);

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

      // Buscar receitas
      let revenueQuery = supabase
        .from('reservations')
        .select('total_revenue, net_revenue, check_in_date, property_id')
        .gte('check_in_date', startDate.toISOString().split('T')[0]);

      if (selectedProperty !== 'todas') {
        revenueQuery = revenueQuery.eq('property_id', selectedProperty);
      }

      const { data: reservations, error: revenueError } = await revenueQuery;
      if (revenueError) throw revenueError;

      // Buscar despesas
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date, category, property_id')
        .gte('expense_date', startDate.toISOString().split('T')[0]);

      if (selectedProperty !== 'todas') {
        expenseQuery = expenseQuery.eq('property_id', selectedProperty);
      }

      const { data: expenses, error: expenseError } = await expenseQuery;
      if (expenseError) throw expenseError;

      // Calcular KPIs
      const totalRevenue = (reservations || []).reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const totalExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      // Calcular receita mensal
      const monthlyRevenue = calculateMonthlyRevenue(reservations || [], periodMonths);
      
      // Calcular receita anual
      const yearlyRevenue = calculateYearlyRevenue(reservations || []);

      // Calcular despesas por categoria
      const expensesByCategory = calculateExpensesByCategory(expenses || []);

      // Taxa de ocupação simplificada (placeholder)
      const occupancyRate = Math.min(((reservations || []).length / periodMonths) * 10, 100);

      setDashboardData({
        totalRevenue,
        totalExpenses,
        netProfit,
        occupancyRate,
        monthlyRevenue,
        yearlyRevenue,
        expensesByCategory
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
      receita
    })).sort((a, b) => a.year.localeCompare(b.year));
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
        <div className="text-[#6A6DDF] text-lg">Carregando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-[#6A6DDF]">Dashboard Analítico</h1>
        <div className="flex gap-4">
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecionar Propriedade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Propriedades</SelectItem>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.nickname || property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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

      {/* KPIs */}
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

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-[#374151]">Receita Mensal</CardTitle>
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

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-[#374151]">Receita Anual</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.yearlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']} />
                <Bar dataKey="receita" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {dashboardData.expensesByCategory.length > 0 && (
          <Card className="bg-white lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-[#374151]">Despesas por Categoria</CardTitle>
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
    </div>
  );
};

export default Dashboard;
