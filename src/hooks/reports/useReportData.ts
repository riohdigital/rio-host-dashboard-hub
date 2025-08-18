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

// Calculate additional metrics (owner payout based) - moved before netProfit calculation
const ownerPayout = (r: any) => {
  const commission = Number(r.commission_amount) || 0;
  const baseNet = (Number(r.net_revenue) || (Number(r.total_revenue) - commission));
  const alloc = (r.cleaning_allocation || '').toLowerCase();
  const cleaningFee = Number(r.cleaning_fee || 0);
  const cleaningDeduct = (alloc === 'proprietário' || alloc === 'proprietario' || alloc === 'owner') ? cleaningFee : 0;
  return Math.max(0, baseNet - cleaningDeduct);
};
const receivedAmount = (reservations || []).filter((r: any) => r.payment_status === 'Pago')
  .reduce((sum: number, r: any) => sum + ownerPayout(r), 0);
const pendingAmount = ((reservations || []).reduce((sum: number, r: any) => sum + ownerPayout(r), 0)) - receivedAmount;

    // Calculate netProfit based on receivedAmount - totalExpenses
    const netProfit = receivedAmount - totalExpenses;
    const profitMargin = receivedAmount > 0 ? (netProfit / receivedAmount) * 100 : 0;

// Fetch properties for detailed report
const { data: properties } = await supabase
  .from('properties')
  .select('id, name, nickname');

const periodStart = new Date(filters.startDate);
const periodEnd = new Date(filters.endDate);
const periodDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));

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
  const propertyOwnerTotal = propertyReservations.reduce((sum: number, r: any) => sum + ownerPayout(r), 0);
  const propertyReceived = propertyReservations
    .filter(r => r.payment_status === 'Pago')
    .reduce((sum: number, r: any) => sum + ownerPayout(r), 0);
  const propertyPending = propertyOwnerTotal - propertyReceived;

  // Ocupação da propriedade no período
  const occupiedNights = propertyReservations.reduce((sum, r) => {
    const ci = new Date(r.check_in_date);
    const co = new Date(r.check_out_date);
    const overlapStart = ci > periodStart ? ci : periodStart;
    const overlapEnd = co < periodEnd ? co : periodEnd;
    const nights = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
    return sum + nights;
  }, 0);
  const occupancyRate = (occupiedNights / periodDays) * 100;

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
  }, [] as any[]);

  return {
    name: property.nickname || property.name,
    totalRevenue: propertyRevenue,
    receivedAmount: propertyReceived,
    pendingAmount: propertyPending,
    totalReservations: propertyReservations.length,
    platforms: platformsData,
    reservations: propertyReservations.map(r => ({ code: r.reservation_code })),
    occupancyRate
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
  const startDate = new Date(filters.startDate);
  const endDate = new Date(filters.endDate);

  let query = supabase
    .from('reservations')
    .select(`
      *,
      properties(name, nickname)
    `)
    .lte('check_in_date', filters.endDate)
    .gte('check_out_date', filters.startDate);

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
    query = query.eq('property_id', filters.propertyId);
  }

  if (filters.selectedProperties && filters.selectedProperties.length > 0 && !filters.selectedProperties.includes('todas')) {
    query = query.in('property_id', filters.selectedProperties);
  }

  const { data: reservations, error } = await query;
  if (error) throw error;

  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  const occupiedDays = (reservations || []).reduce((sum, r: any) => {
    const ci = new Date(r.check_in_date);
    const co = new Date(r.check_out_date);
    const overlapStart = ci > startDate ? ci : startDate;
    const overlapEnd = co < endDate ? co : endDate;
    const nights = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
    return sum + nights;
  }, 0);

  const occupancyRate = (occupiedDays / totalDays) * 100;

  return {
    summary: {
      totalDays,
      occupiedDays,
      occupancyRate,
      averageStay: (reservations?.length || 0) > 0 ? occupiedDays / (reservations!.length) : 0
    },
    reservations: reservations || [],
    charts: {
      dailyOccupancy: calculateDailyOccupancy(reservations || [], startDate, endDate)
    }
  };
};

const generatePropertyReport = async (filters: ReportFilters) => {
  const startDate = new Date(filters.startDate);
  const endDate = new Date(filters.endDate);
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  let query = supabase
    .from('reservations')
    .select(`
      *,
      properties(name, nickname)
    `)
    .lte('check_in_date', filters.endDate)
    .gte('check_out_date', filters.startDate);

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
    query = query.eq('property_id', filters.propertyId);
  }

  if (filters.selectedProperties && filters.selectedProperties.length > 0 && !filters.selectedProperties.includes('todas')) {
    query = query.in('property_id', filters.selectedProperties);
  }

  const { data: reservations, error } = await query;
  if (error) throw error;

  // Agrupar e calcular métricas por propriedade
  const byProperty = (reservations || []).reduce((acc: any, r: any) => {
    const propertyId = r.property_id;
    if (!acc[propertyId]) {
      acc[propertyId] = {
        property: r.properties,
        reservations: [],
        totalRevenue: 0,
        netRevenue: 0,
        occupiedNights: 0
      };
    }
    acc[propertyId].reservations.push(r);
    acc[propertyId].totalRevenue += Number(r.total_revenue) || 0;
    acc[propertyId].netRevenue += Number(r.net_revenue) || 0;

    // Noites ocupadas sobrepondo o período
    const ci = new Date(r.check_in_date);
    const co = new Date(r.check_out_date);
    const overlapStart = ci > startDate ? ci : startDate;
    const overlapEnd = co < endDate ? co : endDate;
    const nights = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
    acc[propertyId].occupiedNights += nights;

    return acc;
  }, {} as any);

  const properties = Object.values(byProperty).map((p: any) => {
    const occupancyRatio = totalDays > 0 ? (p.occupiedNights / totalDays) : 0;
    const adr = p.occupiedNights > 0 ? (p.netRevenue || p.totalRevenue) / p.occupiedNights : 0;
    const revpar = totalDays > 0 ? (p.netRevenue || p.totalRevenue) / totalDays : 0;
    return {
      name: p.property?.nickname || p.property?.name || 'N/A',
      totalRevenue: p.totalRevenue,
      occupancy: occupancyRatio * 100,
      adr,
      revpar
    };
  });

  return {
    properties,
    charts: {
      propertyComparison: properties.map((p: any) => ({
        name: p.name,
        revenue: p.totalRevenue,
        reservations: (byProperty as any)[Object.keys(byProperty).find(k => ((byProperty as any)[k].property?.nickname || (byProperty as any)[k].property?.name) === p.name)]?.reservations?.length || 0
      }))
    }
  };
};

const generatePlatformReport = async (filters: ReportFilters) => {
  let query = supabase
    .from('reservations')
    .select('*')
    .lte('check_in_date', filters.endDate)
    .gte('check_out_date', filters.startDate);

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
    query = query.eq('property_id', filters.propertyId);
  }
  if (filters.selectedProperties && filters.selectedProperties.length > 0 && !filters.selectedProperties.includes('todas')) {
    query = query.in('property_id', filters.selectedProperties);
  }
  if (filters.platform && filters.platform !== 'all') {
    query = query.eq('platform', filters.platform);
  }

  const { data: reservations, error } = await query;
  if (error) throw error;

  const platformData = (reservations || []).reduce((acc: any, r: any) => {
    const platform = r.platform || 'Não informado';
    if (!acc[platform]) {
      acc[platform] = { reservations: 0, revenue: 0, commission: 0 };
    }
    acc[platform].reservations++;
    acc[platform].revenue += Number(r.total_revenue) || 0;
    acc[platform].commission += Number(r.commission_amount) || 0;
    return acc;
  }, {} as any);

  return {
    platforms: Object.entries(platformData).map(([name, data]: [string, any]) => ({
      name,
      ...data
    })),
    charts: {
      platformDistribution: Object.entries(platformData).map(([name, data]: [string, any]) => ({
        name,
        value: (data as any).reservations
      }))
    }
  };
};

const generateExpensesReport = async (filters: ReportFilters) => {
  // Buscar receitas
  let revenueQuery = supabase
    .from('reservations')
    .select('*')
    .gte('check_in_date', filters.startDate)
    .lte('check_out_date', filters.endDate);

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
    revenueQuery = revenueQuery.eq('property_id', filters.propertyId);
  }
  if (filters.selectedProperties && filters.selectedProperties.length > 0 && !filters.selectedProperties.includes('todas')) {
    revenueQuery = revenueQuery.in('property_id', filters.selectedProperties);
  }

  // Buscar despesas
  let expenseQuery = supabase
    .from('expenses')
    .select('*')
    .gte('expense_date', filters.startDate)
    .lte('expense_date', filters.endDate);

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
    expenseQuery = expenseQuery.eq('property_id', filters.propertyId);
  }
  if (filters.selectedProperties && filters.selectedProperties.length > 0 && !filters.selectedProperties.includes('todas')) {
    expenseQuery = expenseQuery.in('property_id', filters.selectedProperties);
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
  let query = supabase
    .from('reservations')
    .select(`
      *,
      properties(name, nickname)
    `)
    .lte('check_in_date', filters.endDate)
    .gte('check_out_date', filters.startDate)
    .order('check_in_date');

  if (filters.propertyId && filters.propertyId !== 'all' && filters.propertyId !== 'todas') {
    query = query.eq('property_id', filters.propertyId);
  }
  if (filters.selectedProperties && filters.selectedProperties.length > 0 && !filters.selectedProperties.includes('todas')) {
    query = query.in('property_id', filters.selectedProperties);
  }

  const { data: reservations, error } = await query;
  if (error) throw error;

  return {
    reservations: reservations || [],
    upcomingCheckins: (reservations || []).filter(r => new Date(r.check_in_date) >= new Date(filters.startDate) && new Date(r.check_in_date) <= new Date(filters.endDate)),
    upcomingCheckouts: (reservations || []).filter(r => new Date(r.check_out_date) >= new Date(filters.startDate) && new Date(r.check_out_date) <= new Date(filters.endDate)),
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