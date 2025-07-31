import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReportFilters {
  reportType: string;
  propertyId?: string;
  platform?: string;
  startDate: string;
  endDate: string;
}

export interface ReportData {
  type: string;
  title: string;
  data: any;
  generatedAt: string;
}

export const useReportData = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async (filters: ReportFilters): Promise<ReportData | null> => {
    try {
      setLoading(true);
      setError(null);

      let data;
      let title;

      switch (filters.reportType) {
        case 'financial':
          data = await generateFinancialReport(filters);
          title = 'Relatório Financeiro';
          break;
        case 'occupancy':
          data = await generateOccupancyReport(filters);
          title = 'Relatório de Ocupação';
          break;
        case 'property':
          data = await generatePropertyReport(filters);
          title = 'Performance por Propriedade';
          break;
        case 'platform':
          data = await generatePlatformReport(filters);
          title = 'Relatório de Plataformas';
          break;
        case 'expenses':
          data = await generateExpensesReport(filters);
          title = 'Despesas vs Receitas';
          break;
        case 'checkins':
          data = await generateCheckinsReport(filters);
          title = 'Check-ins/Check-outs';
          break;
        default:
          throw new Error('Tipo de relatório não suportado');
      }

      return {
        type: filters.reportType,
        title,
        data,
        generatedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      setError('Erro ao gerar relatório');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    generateReport,
    loading,
    error
  };
};

// Funções para gerar diferentes tipos de relatórios
const generateFinancialReport = async (filters: ReportFilters) => {
  const query = supabase
    .from('reservations')
    .select(`
      *,
      properties(name, nickname)
    `)
    .gte('check_in_date', filters.startDate)
    .lte('check_out_date', filters.endDate);

  if (filters.propertyId && filters.propertyId !== 'all') {
    query.eq('property_id', filters.propertyId);
  }

  if (filters.platform && filters.platform !== 'all') {
    query.eq('platform', filters.platform);
  }

  const { data: reservations, error } = await query;
  if (error) throw error;

  // Buscar despesas do mesmo período
  const expenseQuery = supabase
    .from('expenses')
    .select('*')
    .gte('expense_date', filters.startDate)
    .lte('expense_date', filters.endDate);

  if (filters.propertyId && filters.propertyId !== 'all') {
    expenseQuery.eq('property_id', filters.propertyId);
  }

  const { data: expenses, error: expenseError } = await expenseQuery;
  if (expenseError) throw expenseError;

  // Calcular métricas
  const totalRevenue = reservations?.reduce((sum, r) => sum + (Number(r.total_revenue) || 0), 0) || 0;
  const netRevenue = reservations?.reduce((sum, r) => sum + (Number(r.net_revenue) || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
  const profit = netRevenue - totalExpenses;

  return {
    summary: {
      totalRevenue,
      netRevenue,
      totalExpenses,
      profit,
      reservationCount: reservations?.length || 0,
      profitMargin: netRevenue > 0 ? ((profit / netRevenue) * 100) : 0,
      averageReservationValue: reservations?.length > 0 ? (totalRevenue / reservations.length) : 0
    },
    reservations: reservations || [],
    expenses: expenses || [],
    charts: {
      monthlyRevenue: calculateMonthlyRevenue(reservations || []),
      expensesByCategory: calculateExpensesByCategory(expenses || []),
      platformDistribution: calculatePlatformDistribution(reservations || [])
    }
  };
};

const generateOccupancyReport = async (filters: ReportFilters) => {
  const query = supabase
    .from('reservations')
    .select(`
      *,
      properties(name, nickname)
    `)
    .gte('check_in_date', filters.startDate)
    .lte('check_out_date', filters.endDate);

  if (filters.propertyId && filters.propertyId !== 'all') {
    query.eq('property_id', filters.propertyId);
  }

  const { data: reservations, error } = await query;
  if (error) throw error;

  // Calcular taxa de ocupação
  const startDate = new Date(filters.startDate);
  const endDate = new Date(filters.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const occupiedDays = reservations?.reduce((sum, r) => {
    const checkIn = new Date(r.check_in_date);
    const checkOut = new Date(r.check_out_date);
    return sum + Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  }, 0) || 0;

  const occupancyRate = totalDays > 0 ? (occupiedDays / totalDays) * 100 : 0;

  return {
    summary: {
      totalDays,
      occupiedDays,
      occupancyRate,
      averageStay: reservations?.length ? occupiedDays / reservations.length : 0
    },
    reservations: reservations || [],
    charts: {
      dailyOccupancy: calculateDailyOccupancy(reservations || [], startDate, endDate)
    }
  };
};

const generatePropertyReport = async (filters: ReportFilters) => {
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select(`
      *,
      properties(name, nickname)
    `)
    .gte('check_in_date', filters.startDate)
    .lte('check_out_date', filters.endDate);

  if (error) throw error;

  // Agrupar por propriedade
  const propertyData = reservations?.reduce((acc, r) => {
    const propertyId = r.property_id;
    if (!acc[propertyId]) {
      acc[propertyId] = {
        property: r.properties,
        reservations: [],
        totalRevenue: 0,
        netRevenue: 0
      };
    }
    acc[propertyId].reservations.push(r);
    acc[propertyId].totalRevenue += Number(r.total_revenue) || 0;
    acc[propertyId].netRevenue += Number(r.net_revenue) || 0;
    return acc;
  }, {} as any) || {};

  return {
    properties: Object.values(propertyData),
    charts: {
      propertyComparison: Object.values(propertyData).map((p: any) => ({
        name: p.property?.nickname || p.property?.name || 'N/A',
        revenue: p.totalRevenue,
        reservations: p.reservations.length
      }))
    }
  };
};

const generatePlatformReport = async (filters: ReportFilters) => {
  const query = supabase
    .from('reservations')
    .select('*')
    .gte('check_in_date', filters.startDate)
    .lte('check_out_date', filters.endDate);

  if (filters.propertyId && filters.propertyId !== 'all') {
    query.eq('property_id', filters.propertyId);
  }

  const { data: reservations, error } = await query;
  if (error) throw error;

  // Agrupar por plataforma
  const platformData = reservations?.reduce((acc, r) => {
    const platform = r.platform || 'Não informado';
    if (!acc[platform]) {
      acc[platform] = {
        reservations: 0,
        revenue: 0,
        commission: 0
      };
    }
    acc[platform].reservations++;
    acc[platform].revenue += Number(r.total_revenue) || 0;
    acc[platform].commission += Number(r.commission_amount) || 0;
    return acc;
  }, {} as any) || {};

  return {
    platforms: Object.entries(platformData).map(([name, data]: [string, any]) => ({
      name,
      ...data
    })),
    charts: {
      platformDistribution: Object.entries(platformData).map(([name, data]: [string, any]) => ({
        name,
        value: data.reservations
      }))
    }
  };
};

const generateExpensesReport = async (filters: ReportFilters) => {
  // Buscar receitas
  const revenueQuery = supabase
    .from('reservations')
    .select('*')
    .gte('check_in_date', filters.startDate)
    .lte('check_out_date', filters.endDate);

  if (filters.propertyId && filters.propertyId !== 'all') {
    revenueQuery.eq('property_id', filters.propertyId);
  }

  // Buscar despesas
  const expenseQuery = supabase
    .from('expenses')
    .select('*')
    .gte('expense_date', filters.startDate)
    .lte('expense_date', filters.endDate);

  if (filters.propertyId && filters.propertyId !== 'all') {
    expenseQuery.eq('property_id', filters.propertyId);
  }

  const [{ data: reservations, error: revenueError }, { data: expenses, error: expenseError }] = 
    await Promise.all([revenueQuery, expenseQuery]);

  if (revenueError) throw revenueError;
  if (expenseError) throw expenseError;

  const totalRevenue = reservations?.reduce((sum, r) => sum + (Number(r.net_revenue) || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

  return {
    summary: {
      totalRevenue,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0
    },
    expenses: expenses || [],
    charts: {
      expensesByCategory: calculateExpensesByCategory(expenses || []),
      monthlyComparison: calculateMonthlyComparison(reservations || [], expenses || [])
    }
  };
};

const generateCheckinsReport = async (filters: ReportFilters) => {
  const query = supabase
    .from('reservations')
    .select(`
      *,
      properties(name, nickname)
    `)
    .gte('check_in_date', filters.startDate)
    .lte('check_out_date', filters.endDate)
    .order('check_in_date');

  if (filters.propertyId && filters.propertyId !== 'all') {
    query.eq('property_id', filters.propertyId);
  }

  const { data: reservations, error } = await query;
  if (error) throw error;

  return {
    reservations: reservations || [],
    upcomingCheckins: (reservations || []).filter(r => new Date(r.check_in_date) >= new Date()),
    upcomingCheckouts: (reservations || []).filter(r => new Date(r.check_out_date) >= new Date()),
    charts: {
      checkinsByDay: calculateCheckinsByDay(reservations || [])
    }
  };
};

// Funções auxiliares para cálculos
const calculateMonthlyRevenue = (reservations: any[]) => {
  const monthlyData: any = {};
  
  reservations.forEach(r => {
    const month = new Date(r.check_in_date).toISOString().slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = 0;
    }
    monthlyData[month] += Number(r.net_revenue) || 0;
  });

  return Object.entries(monthlyData).map(([month, revenue]) => ({
    month,
    revenue
  }));
};

const calculateExpensesByCategory = (expenses: any[]) => {
  const categoryData: any = {};
  
  expenses.forEach(e => {
    const category = e.category || 'Não categorizado';
    if (!categoryData[category]) {
      categoryData[category] = 0;
    }
    categoryData[category] += Number(e.amount) || 0;
  });

  return Object.entries(categoryData).map(([category, amount]) => ({
    category,
    amount
  }));
};

const calculateDailyOccupancy = (reservations: any[], startDate: Date, endDate: Date) => {
  const dailyData: any = {};
  
  // Inicializar todos os dias com 0
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dailyData[d.toISOString().slice(0, 10)] = 0;
  }
  
  // Contar ocupação por dia
  reservations.forEach(r => {
    const checkIn = new Date(r.check_in_date);
    const checkOut = new Date(r.check_out_date);
    
    for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      if (dailyData[day] !== undefined) {
        dailyData[day] = 1;
      }
    }
  });

  return Object.entries(dailyData).map(([date, occupied]) => ({
    date,
    occupied
  }));
};

const calculateMonthlyComparison = (reservations: any[], expenses: any[]) => {
  const monthlyData: any = {};
  
  reservations.forEach(r => {
    const month = new Date(r.check_in_date).toISOString().slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, expenses: 0 };
    }
    monthlyData[month].revenue += Number(r.net_revenue) || 0;
  });

  expenses.forEach(e => {
    const month = new Date(e.expense_date).toISOString().slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, expenses: 0 };
    }
    monthlyData[month].expenses += Number(e.amount) || 0;
  });

  return Object.entries(monthlyData).map(([month, data]: [string, any]) => ({
    month,
    revenue: data.revenue,
    expenses: data.expenses,
    profit: data.revenue - data.expenses
  }));
};

const calculatePlatformDistribution = (reservations: any[]) => {
  const platformData: any = {};
  
  reservations.forEach(r => {
    const platform = r.platform || 'Direto';
    if (!platformData[platform]) {
      platformData[platform] = 0;
    }
    platformData[platform] += Number(r.total_revenue) || 0;
  });

  return Object.entries(platformData).map(([platform, revenue]) => ({
    platform,
    revenue
  }));
};

const calculateCheckinsByDay = (reservations: any[]) => {
  const dailyData: any = {};
  
  reservations.forEach(r => {
    const day = new Date(r.check_in_date).toISOString().slice(0, 10);
    if (!dailyData[day]) {
      dailyData[day] = { checkins: 0, checkouts: 0 };
    }
    dailyData[day].checkins++;
    
    const checkoutDay = new Date(r.check_out_date).toISOString().slice(0, 10);
    if (!dailyData[checkoutDay]) {
      dailyData[checkoutDay] = { checkins: 0, checkouts: 0 };
    }
    dailyData[checkoutDay].checkouts++;
  });

  return Object.entries(dailyData).map(([date, data]: [string, any]) => ({
    date,
    checkins: data.checkins,
    checkouts: data.checkouts
  }));
};