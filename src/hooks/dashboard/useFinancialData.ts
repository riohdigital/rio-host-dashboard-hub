
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FinancialData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  occupancyRate: number;
  revenueByPlatform: Array<{ name: string; value: number }>;
  reservationsCount: number;
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
    reservationsCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propertyFilter = useMemo(() => {
    return selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');
  }, [selectedProperties]);

  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build queries with conditional property filter
      let reservationsQuery = supabase
        .from('reservations')
        .select('total_revenue, net_revenue, platform, check_in_date, check_out_date')
        .gte('check_in_date', startDateString)
        .lte('check_in_date', endDateString);

      let expensesQuery = supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', startDateString)
        .lte('expense_date', endDateString);

      // Apply property filter if exists
      if (propertyFilter && propertyFilter.length > 0) {
        reservationsQuery = reservationsQuery.in('property_id', propertyFilter);
        expensesQuery = expensesQuery.in('property_id', propertyFilter);
      }

      const [reservationsRes, expensesRes] = await Promise.all([
        reservationsQuery,
        expensesQuery
      ]);

      if (reservationsRes.error) throw reservationsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const reservations = reservationsRes.data || [];
      const expenses = expensesRes.data || [];

      // Calculate financial KPIs
      const totalRevenue = reservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netRevenue = reservations.reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      const netProfit = netRevenue - totalExpenses;

      // Calculate occupancy rate
      const totalBookedDays = reservations.reduce((sum, r) => {
        const checkIn = new Date(r.check_in_date + 'T00:00:00');
        const checkOut = new Date(r.check_out_date + 'T00:00:00');
        return sum + Math.ceil(Math.abs(checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);

      const filteredPropertiesCount = propertyFilter ? propertyFilter.length : await getPropertiesCount();
      const occupancyRate = (filteredPropertiesCount > 0 && totalDays > 0) 
        ? Math.min(100, (totalBookedDays / (totalDays * filteredPropertiesCount)) * 100)
        : 0;

      // Group revenue by platform
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
        reservationsCount: reservations.length
      });

    } catch (err: any) {
      console.error('Erro ao buscar dados financeiros:', err);
      setError(err.message || 'Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  }, [startDateString, endDateString, propertyFilter, totalDays]);

  const getPropertiesCount = async () => {
    const { count } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  };

  return {
    data,
    loading,
    error,
    fetchFinancialData
  };
};
