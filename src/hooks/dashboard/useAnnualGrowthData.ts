
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MonthlyData {
  month: string;
  current: number;
  previous: number;
}

interface YearlyData {
  year: string;
  revenue: number;
}

interface AnnualGrowthData {
  monthlyData: MonthlyData[];
  yearlyData: YearlyData[];
}

export const useAnnualGrowthData = (selectedProperties: string[]) => {
  const [data, setData] = useState<AnnualGrowthData>({
    monthlyData: [],
    yearlyData: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propertyFilter = useMemo(() => {
    return selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');
  }, [selectedProperties]);

  const yearRanges = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    return {
      currentYear,
      previousYear,
      currentYearStart: `${currentYear}-01-01`,
      currentYearEnd: `${currentYear}-12-31`,
      previousYearStart: `${previousYear}-01-01`,
      previousYearEnd: `${previousYear}-12-31`
    };
  }, []);

  const calculateMonthlyGrowth = useCallback((currentReservations: any[], previousReservations: any[]) => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const data: MonthlyData[] = [];
    
    for (let month = 0; month < 12; month++) {
      const currentMonthKey = `${yearRanges.currentYear}-${(month + 1).toString().padStart(2, '0')}`;
      const previousMonthKey = `${yearRanges.previousYear}-${(month + 1).toString().padStart(2, '0')}`;
      
      const currentRevenue = currentReservations
        .filter(r => r.check_in_date.startsWith(currentMonthKey))
        .reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      
      const previousRevenue = previousReservations
        .filter(r => r.check_in_date.startsWith(previousMonthKey))
        .reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      
      data.push({
        month: monthNames[month],
        current: currentRevenue,
        previous: previousRevenue
      });
    }
    
    return data;
  }, [yearRanges]);

  const fetchAnnualGrowthData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build queries for current and previous year - independent of global period
      let currentYearQuery = supabase
        .from('reservations')
        .select('total_revenue, check_in_date')
        .gte('check_in_date', yearRanges.currentYearStart)
        .lte('check_in_date', yearRanges.currentYearEnd);

      let previousYearQuery = supabase
        .from('reservations')
        .select('total_revenue, check_in_date')
        .gte('check_in_date', yearRanges.previousYearStart)
        .lte('check_in_date', yearRanges.previousYearEnd);

      // Apply property filter if exists
      if (propertyFilter && propertyFilter.length > 0) {
        currentYearQuery = currentYearQuery.in('property_id', propertyFilter);
        previousYearQuery = previousYearQuery.in('property_id', propertyFilter);
      }

      const [currentYearRes, previousYearRes] = await Promise.all([
        currentYearQuery,
        previousYearQuery
      ]);

      if (currentYearRes.error) throw currentYearRes.error;
      if (previousYearRes.error) throw previousYearRes.error;

      const currentYearReservations = currentYearRes.data || [];
      const previousYearReservations = previousYearRes.data || [];

      // Calculate monthly comparison data
      const monthlyData = calculateMonthlyGrowth(currentYearReservations, previousYearReservations);

      // Calculate yearly totals
      const currentYearTotal = currentYearReservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const previousYearTotal = previousYearReservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);

      const yearlyData: YearlyData[] = [
        { year: yearRanges.previousYear.toString(), revenue: previousYearTotal },
        { year: yearRanges.currentYear.toString(), revenue: currentYearTotal }
      ];

      setData({
        monthlyData,
        yearlyData
      });

    } catch (err: any) {
      console.error('Erro ao buscar dados de crescimento anual:', err);
      setError(err.message || 'Erro ao carregar dados de crescimento anual');
    } finally {
      setLoading(false);
    }
  }, [yearRanges, propertyFilter, calculateMonthlyGrowth]);

  return {
    data,
    loading,
    error,
    fetchAnnualGrowthData
  };
};
