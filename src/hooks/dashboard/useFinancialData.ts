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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- linhas de select('*, properties(...)') sem tipo
  reservationsForPeriod: any[];
  /** Imóveis no filtro (bloco Hoje do celular: "N de M imóveis ocupados") */
  propertiesCount: number;
}

export const useFinancialData = (
  startDateString: string,
  endDateString: string,
  selectedProperties: string[],
  selectedPlatform: string,
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
    propertiesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const propertyFilter = useMemo(() => {
    return selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');
  }, [selectedProperties]);

  const platformFilter = useMemo(() => {
    return selectedPlatform === 'all' ? null : selectedPlatform;
  }, [selectedPlatform]);

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

      if (platformFilter) {
        reservationsQuery = reservationsQuery.eq('platform', platformFilter);
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

      console.group('🔍 Debug Financial Data - Dashboard');
      console.log('📅 Período:', startDateString, 'até', endDateString);
      console.log('🏠 Propriedades selecionadas:', selectedProperties);
      console.log('🌐 Plataforma selecionada:', selectedPlatform);
      console.log('🔧 Filtro de propriedades aplicado:', propertyFilter);
      console.log('🔧 Filtro de plataforma aplicado:', platformFilter);
      console.log('📊 Reservas encontradas:', reservations.length);
      if (reservations.length > 0) {
        console.log('Primeiras 3 reservas:', reservations.slice(0, 3).map(r => ({
          code: r.reservation_code,
          platform: r.platform,
          total: r.total_revenue
        })));
      }
      console.groupEnd();

      const totalGrossRevenue = reservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const totalBaseRevenue = reservations.reduce((sum, r) => sum + (r.base_revenue || 0), 0);
      const totalCommission = reservations.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
      const totalNetRevenue = reservations.reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = totalNetRevenue - totalExpenses;

      console.log('💰 Gross Revenue:', totalGrossRevenue);
      console.log('💰 Base Revenue:', totalBaseRevenue);
      console.log('💰 Commission:', totalCommission);
      console.log('💰 Net Revenue:', totalNetRevenue);

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
        propertiesCount,
      });

    } catch (err) {
      console.error('Erro ao buscar dados financeiros:', err);
      setError((err as { message?: string })?.message || 'Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  }, [startDateString, endDateString, propertyFilter, platformFilter, totalDays]);
  
  return { data, loading, error, fetchFinancialData };
};
