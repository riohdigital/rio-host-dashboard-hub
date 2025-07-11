import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FinancialData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  occupancyRate: number;
  revenueByPlatform: Array<{ name: string; value: number }>;
  reservationsForPeriod: any[];
}

export const useFinancialData = (
  startDateString: string,
  endDateString: string,
  selectedProperties: string[],
  totalDays: number
) => {
  const [data, setData] = useState<FinancialData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    occupancyRate: 0,
    revenueByPlatform: [],
    reservationsForPeriod: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const propertyFilter = useMemo(() => {
    return selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');
  }, [selectedProperties]);

  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // CORREÇÃO: Construção de queries mais robusta
      let reservationsQuery = supabase
        .from('reservations')
        .select('*, properties(name, nickname)')
        .gte('check_in_date', startDateString)
        .lte('check_in_date', endDateString);

      let expensesQuery = supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startDateString)
        .lte('expense_date', endDateString);
      
      let propertiesQuery = supabase.from('properties').select('id');

      if (propertyFilter) {
        reservationsQuery = reservationsQuery.in('property_id', propertyFilter);
        expensesQuery = expensesQuery.in('property_id', propertyFilter);
        propertiesQuery = propertiesQuery.in('id', propertyFilter);
      }
      
      const [reservationsRes, expensesRes, propertiesRes] = await Promise.all([
        reservationsQuery,
        expensesQuery,
        propertiesQuery,
      ]);

      if (reservationsRes.error) throw reservationsRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (propertiesRes.error) throw propertiesRes.error;

      const reservations = reservationsRes.data || [];
      const expenses = expensesRes.data || [];
      const properties = propertiesRes.data || [];

      // Cálculos Financeiros
      const totalRevenue = reservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalNetRevenue = reservations.reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      const netProfit = totalNetRevenue - totalExpenses;

      // Cálculo da Taxa de Ocupação
      const totalBookedDays = reservations.reduce((sum, r) => {
        const checkIn = new Date(r.check_in_date + 'T00:00:00');
        const checkOut = new Date(r.check_out_date + 'T00:00:00');
        return sum + Math.ceil(Math.abs(checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      
      const propertiesCount = properties.length;
      const occupancyRate = (propertiesCount > 0 && totalDays > 0) 
        ? Math.min(100, (totalBookedDays / (totalDays * propertiesCount)) * 100)
        : 0;

      const revenueByPlatform = Object.entries(
        reservations.reduce((acc, res) => {
          const platform = res.platform || 'Outros';
          acc[platform] = (acc[platform] || 0) + (res.total_revenue || 0);
          return acc;
        }, {} as Record<string, number>)
      ).map(([name, value]) => ({ name, value }));
      
      setData({
        totalRevenue,
        totalExpenses,
        netProfit,
        occupancyRate,
        revenueByPlatform,
        reservationsForPeriod: reservations,
      });

    } catch (err: any) {
      console.error('Erro ao buscar dados financeiros:', err);
      setError(err.message || 'Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  }, [startDateString, endDateString, propertyFilter, totalDays]);
  
  return { data, loading, error, fetchFinancialData };
};
