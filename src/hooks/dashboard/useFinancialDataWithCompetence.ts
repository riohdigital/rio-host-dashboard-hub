import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';

interface FinancialDataWithCompetence {
  operational: {
    totalReservations: number;
    occupancyRate: number;
    totalRevenue: number;
    totalNetRevenue: number;
    reservations: Reservation[];
  };
  financial: {
    totalGrossRevenue: number;
    totalNetRevenue: number;
    airbnbRevenue: number;
    bookingRevenue: number;
    directRevenue: number;
    reservations: Reservation[];
  };
  futureRevenue: {
    bookingComTotal: number;
    nextPaymentMonth: string;
    reservations: Reservation[];
  };
}

export const useFinancialDataWithCompetence = (
  startDateString: string,
  endDateString: string,
  selectedProperties: string[],
  selectedPlatform: string,
  totalDays: number
) => {
  const [data, setData] = useState<FinancialDataWithCompetence>({
    operational: { totalReservations: 0, occupancyRate: 0, totalRevenue: 0, totalNetRevenue: 0, reservations: [] },
    financial: { totalGrossRevenue: 0, totalNetRevenue: 0, airbnbRevenue: 0, bookingRevenue: 0, directRevenue: 0, reservations: [] },
    futureRevenue: { bookingComTotal: 0, nextPaymentMonth: '', reservations: [] },
  });
  const [loading, setLoading] = useState(true);

  const propertyFilter = useMemo(() => {
    return selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');
  }, [selectedProperties]);

  const platformFilter = useMemo(() => {
    return selectedPlatform === 'all' ? null : selectedPlatform;
  }, [selectedPlatform]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    try {
      // 1. RESERVAS OPERACIONAIS (ocupam o período)
      let operationalQuery = supabase
        .from('reservations')
        .select('*, properties(name, nickname)')
        .gte('check_out_date', startDateString)
        .lte('check_in_date', endDateString);

      // 2. RESERVAS FINANCEIRAS (payment_date no período)
      let financialQuery = supabase
        .from('reservations')
        .select('*, properties(name, nickname)')
        .gte('payment_date', startDateString)
        .lte('payment_date', endDateString);

      // 3. RECEITAS FUTURAS BOOKING (checkout no período, payment_date depois)
      let futureBookingQuery = supabase
        .from('reservations')
        .select('*, properties(name, nickname)')
        .eq('platform', 'Booking.com')
        .gte('check_out_date', startDateString)
        .lte('check_out_date', endDateString)
        .gt('payment_date', endDateString);

      if (propertyFilter && propertyFilter.length > 0) {
        operationalQuery = operationalQuery.in('property_id', propertyFilter);
        financialQuery = financialQuery.in('property_id', propertyFilter);
        futureBookingQuery = futureBookingQuery.in('property_id', propertyFilter);
      }

      if (platformFilter) {
        operationalQuery = operationalQuery.eq('platform', platformFilter);
        financialQuery = financialQuery.eq('platform', platformFilter);
      }

      const [operationalRes, financialRes, futureBookingRes, propertiesRes] = await Promise.all([
        operationalQuery,
        financialQuery,
        futureBookingQuery,
        propertyFilter && propertyFilter.length > 0
          ? supabase.from('properties').select('id').in('id', propertyFilter)
          : supabase.from('properties').select('id'),
      ]);

      if (operationalRes.error) throw operationalRes.error;
      if (financialRes.error) throw financialRes.error;
      if (futureBookingRes.error) throw futureBookingRes.error;

      const operationalReservations = (operationalRes.data || []) as Reservation[];
      const financialReservations = (financialRes.data || []) as Reservation[];
      const futureBookingReservations = (futureBookingRes.data || []) as Reservation[];
      const properties = propertiesRes.data || [];

      // Calcular métricas operacionais
      const periodStart = new Date(startDateString + 'T00:00:00');
      const periodEnd = new Date(endDateString + 'T00:00:00');
      
      const totalBookedDays = operationalReservations.reduce((sum, r) => {
        const checkIn = new Date(r.check_in_date + 'T00:00:00');
        const checkOut = new Date(r.check_out_date + 'T00:00:00');
        const overlapStart = checkIn > periodStart ? checkIn : periodStart;
        const overlapEnd = checkOut < periodEnd ? checkOut : periodEnd;
        
        if (overlapStart < overlapEnd) {
          return sum + Math.ceil(Math.abs(overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
        }
        return sum;
      }, 0);
      
      const propertiesCount = properties.length || 1;
      const occupancyRate = (totalDays > 0) 
        ? Math.min(100, (totalBookedDays / (totalDays * propertiesCount)) * 100)
        : 0;

      const operationalTotalRevenue = operationalReservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const operationalTotalNetRevenue = operationalReservations.reduce((sum, r) => sum + (r.net_revenue || 0), 0);

      // Calcular métricas financeiras
      const totalGrossRevenue = financialReservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const totalNetRevenue = financialReservations.reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      
      const airbnbRevenue = financialReservations
        .filter(r => r.platform === 'Airbnb')
        .reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      
      const bookingRevenue = financialReservations
        .filter(r => r.platform === 'Booking.com')
        .reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      
      const directRevenue = financialReservations
        .filter(r => r.platform === 'Direto')
        .reduce((sum, r) => sum + (r.net_revenue || 0), 0);

      // Calcular receitas futuras Booking
      const bookingComTotal = futureBookingReservations.reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      const nextPaymentDate = futureBookingReservations[0]?.payment_date;
      const nextPaymentMonth = nextPaymentDate 
        ? new Date(nextPaymentDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : '';

      setData({
        operational: {
          totalReservations: operationalReservations.length,
          occupancyRate,
          totalRevenue: operationalTotalRevenue,
          totalNetRevenue: operationalTotalNetRevenue,
          reservations: operationalReservations,
        },
        financial: {
          totalGrossRevenue,
          totalNetRevenue,
          airbnbRevenue,
          bookingRevenue,
          directRevenue,
          reservations: financialReservations,
        },
        futureRevenue: {
          bookingComTotal,
          nextPaymentMonth,
          reservations: futureBookingReservations,
        },
      });

    } catch (err: any) {
      console.error('Erro ao buscar dados de competência:', err);
    } finally {
      setLoading(false);
    }
  }, [startDateString, endDateString, propertyFilter, platformFilter, totalDays]);

  return { data, loading, fetchData };
};
