import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FinancialData {
  totalGrossRevenue: number;      // Receita bruta total (total_revenue)
  totalBaseRevenue: number;       // Base de cálculo (base_revenue)
  totalCommission: number;        // Comissão (commission_amount)
  totalNetRevenue: number;        // Líquido proprietário (net_revenue)
  totalExpenses: number;
  netProfit: number;              // net_revenue - despesas
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
    totalGrossRevenue: 0,
    totalBaseRevenue: 0,
    totalCommission: 0,
    totalNetRevenue: 0,
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
      // Busca reservas que se sobrepõem ao período (não apenas as que começam nele)
      let reservationsQuery = supabase
        .from('reservations')
        .select('*, properties(name, nickname)')
        .gte('check_out_date', startDateString)  // check-out depois do início do período
        .lte('check_in_date', endDateString);     // check-in antes do fim do período

      let expensesQuery = supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startDateString)
        .lte('expense_date', endDateString);
      
      let propertiesQuery = supabase.from('properties').select('id');

      if (propertyFilter && propertyFilter.length > 0) {
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

      const totalGrossRevenue = reservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const totalBaseRevenue = reservations.reduce((sum, r) => sum + (r.base_revenue || 0), 0);
      const totalCommission = reservations.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
      const totalNetRevenue = reservations.reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = totalNetRevenue - totalExpenses;

      // Calcula apenas os dias que estão dentro do período analisado
      const periodStart = new Date(startDateString + 'T00:00:00');
      const periodEnd = new Date(endDateString + 'T00:00:00');
      
      const totalBookedDays = reservations.reduce((sum, r) => {
        const checkIn = new Date(r.check_in_date + 'T00:00:00');
        const checkOut = new Date(r.check_out_date + 'T00:00:00');
        
        // Calcula a sobreposição entre a reserva e o período
        const overlapStart = checkIn > periodStart ? checkIn : periodStart;
        const overlapEnd = checkOut < periodEnd ? checkOut : periodEnd;
        
        // Se há sobreposição, conta os dias
        if (overlapStart < overlapEnd) {
          const daysInPeriod = Math.ceil(Math.abs(overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysInPeriod;
        }
        
        return sum;
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
        totalGrossRevenue,
        totalBaseRevenue,
        totalCommission,
        totalNetRevenue,
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
