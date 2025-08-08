import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReportFilters {
  reportType: string;
  propertyId?: string;
  platform?: string;
  startDate: string;
  endDate: string;
  selectedProperties?: string[]; // Adicionar propriedades selecionadas do filtro global
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
  try {
    console.log('Generating financial report with filters:', filters);
    
    // Fetch reservations
    let reservationsQuery = supabase
      .from('reservations')
      .select(`
        *,
        properties (
          name,
          nickname
        )
      `)
      .gte('check_in_date', filters.startDate)
      .lte('check_in_date', filters.endDate);

    // Apply property filter if specified
    if (filters.propertyId && filters.propertyId !== 'all') {
      reservationsQuery = reservationsQuery.eq('property_id', filters.propertyId);
    }

    // Apply global property filter for reservations
    if (filters.selectedProperties && filters.selectedProperties.length > 0 && !filters.selectedProperties.includes('todas')) {
      reservationsQuery = reservationsQuery.in('property_id', filters.selectedProperties);
    }

    const { data: reservations, error: reservationsError } = await reservationsQuery;
    console.log('Reservations fetched:', reservations);

    if (reservationsError) {
      console.error('Reservations error:', reservationsError);
      throw reservationsError;
    }

    // Fetch expenses
    let expensesQuery = supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', filters.startDate)
      .lte('expense_date', filters.endDate);

    if (filters.propertyId && filters.propertyId !== 'all') {
      expensesQuery = expensesQuery.eq('property_id', filters.propertyId);
    }

    // Apply global property filter for expenses
    if (filters.selectedProperties && filters.selectedProperties.length > 0 && !filters.selectedProperties.includes('todas')) {
      expensesQuery = expensesQuery.in('property_id', filters.selectedProperties);
    }

    const { data: expenses, error: expensesError } = await expensesQuery;

    if (expensesError) throw expensesError;

    // Calculate totals with null safety
    const totalRevenue = reservations?.reduce((sum, r) => sum + (Number(r.total_revenue) || 0), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Fetch properties for detailed report
    const { data: properties } = await supabase
      .from('properties')
      .select('id, name, nickname');

    // Calculate additional metrics
    const receivedAmount = reservations?.filter(r => r.payment_status === 'Pago')
      .reduce((sum, r) => sum + (Number(r.total_revenue) || 0), 0) || 0;
    const pendingAmount = totalRevenue - receivedAmount;

    // Group by property - Filter by selected property if specified
    let filteredProperties = properties || [];
    if (filters.propertyId && filters.propertyId !== 'all') {
      filteredProperties = filteredProperties.filter(p => p.id === filters.propertyId);
    }
    
    // Apply global property filter if available
    if (filters.selectedProperties && filters.selectedProperties.length > 0 && !filters.selectedProperties.includes('todas')) {
      filteredProperties = filteredProperties.filter(p => filters.selectedProperties!.includes(p.id));
    }
    
    const propertiesData = filteredProperties.map(property => {
      const propertyReservations = (reservations || []).filter(r => r.property_id === property.id);
      const propertyRevenue = propertyReservations.reduce((sum, r) => sum + (Number(r.total_revenue) || 0), 0);
      const propertyReceived = propertyReservations
        .filter(r => r.payment_status === 'Pago')
        .reduce((sum, r) => sum + (Number(r.total_revenue) || 0), 0);
      const propertyPending = propertyRevenue - propertyReceived;

      // Platform breakdown for this property
      const platformsData = propertyReservations.reduce((acc: any[], reservation) => {
        const existing = acc.find(item => item.name === reservation.platform);
        if (existing) {
          existing.revenue += Number(reservation.total_revenue) || 0;
          existing.count += 1;
        } else {
          acc.push({
            name: reservation.platform,
            revenue: Number(reservation.total_revenue) || 0,
            count: 1
          });
        }
        return acc;
      }, []);

      return {
        name: property.nickname || property.name,
        totalRevenue: propertyRevenue,
        receivedAmount: propertyReceived,
        pendingAmount: propertyPending,
        totalReservations: propertyReservations.length,
        platforms: platformsData,
        reservations: propertyReservations.map(r => ({ code: r.reservation_code }))
      };
    });

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      monthlyRevenue: calculateMonthlyRevenue(reservations || []),
      platformRevenue: calculatePlatformDistribution(reservations || []),
      expensesByCategory: calculateExpensesByCategory(expenses || []),
      properties: propertiesData,
      receivedAmount,
      pendingAmount,
      totalReservations: reservations?.length || 0,
      reservations: reservations || []
    };
  } catch (error) {
    console.error('Error generating financial report:', error);
    throw error;
  }
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

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
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

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
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

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
    revenueQuery.eq('property_id', filters.propertyId);
  }

  // Buscar despesas
  const expenseQuery = supabase
    .from('expenses')
    .select('*')
    .gte('expense_date', filters.startDate)
    .lte('expense_date', filters.endDate);

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
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

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
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
      platformData[platform] = { revenue: 0, count: 0 };
    }
    platformData[platform].revenue += Number(r.total_revenue) || 0;
    platformData[platform].count += 1;
  });

  return Object.entries(platformData).map(([name, data]: [string, any]) => ({
    name,
    revenue: data.revenue,
    count: data.count
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