import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { parseDate } from '@/lib/dateUtils';

interface FinancialDataWithCompetence {
  operational: {
    totalReservations: number;
    occupancyRate: number;
    totalRevenue: number;
    totalNetRevenue: number;
    totalCommission: number;
    totalRevenueWithFuture: number;
    totalNetRevenueWithFuture: number;
    totalCommissionWithFuture: number;
    airbnbRevenue: number;
    bookingRevenue: number;
    directRevenue: number;
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
    operational: { totalReservations: 0, occupancyRate: 0, totalRevenue: 0, totalNetRevenue: 0, totalCommission: 0, totalRevenueWithFuture: 0, totalNetRevenueWithFuture: 0, totalCommissionWithFuture: 0, airbnbRevenue: 0, bookingRevenue: 0, directRevenue: 0, reservations: [] },
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
      // 1. RESERVAS OPERACIONAIS
      // Query mista: cada plataforma usa sua regra de data
      let operationalReservations: Reservation[] = [];
      
      if (!platformFilter) {
        // TODAS AS PLATAFORMAS: buscar separadamente
        
        // Booking: check-out no período
        let bookingQuery = supabase
          .from('reservations')
          .select('*, properties(name, nickname)')
          .eq('platform', 'Booking.com')
          .gte('check_out_date', startDateString)
          .lte('check_out_date', endDateString);
        
        // Airbnb: check-in no período
        let airbnbQuery = supabase
          .from('reservations')
          .select('*, properties(name, nickname)')
          .eq('platform', 'Airbnb')
          .gte('check_in_date', startDateString)
          .lte('check_in_date', endDateString);
        
        // Direto: check-in no período
        let directQuery = supabase
          .from('reservations')
          .select('*, properties(name, nickname)')
          .eq('platform', 'Direto')
          .gte('check_in_date', startDateString)
          .lte('check_in_date', endDateString);
        
        if (propertyFilter && propertyFilter.length > 0) {
          bookingQuery = bookingQuery.in('property_id', propertyFilter);
          airbnbQuery = airbnbQuery.in('property_id', propertyFilter);
          directQuery = directQuery.in('property_id', propertyFilter);
        }
        
        const [bookingRes, airbnbRes, directRes] = await Promise.all([
          bookingQuery,
          airbnbQuery,
          directQuery
        ]);
        
        if (bookingRes.error) throw bookingRes.error;
        if (airbnbRes.error) throw airbnbRes.error;
        if (directRes.error) throw directRes.error;
        
        operationalReservations = [
          ...(bookingRes.data || []),
          ...(airbnbRes.data || []),
          ...(directRes.data || [])
        ] as Reservation[];
        
      } else if (platformFilter === 'Booking.com') {
        // Booking: check-out no período
        let operationalQuery = supabase
          .from('reservations')
          .select('*, properties(name, nickname)')
          .eq('platform', platformFilter)
          .gte('check_out_date', startDateString)
          .lte('check_out_date', endDateString);
        
        if (propertyFilter && propertyFilter.length > 0) {
          operationalQuery = operationalQuery.in('property_id', propertyFilter);
        }
        
        const operationalRes = await operationalQuery;
        if (operationalRes.error) throw operationalRes.error;
        operationalReservations = (operationalRes.data || []) as Reservation[];
        
      } else {
        // Airbnb/Direto: check-in no período
        let operationalQuery = supabase
          .from('reservations')
          .select('*, properties(name, nickname)')
          .eq('platform', platformFilter)
          .gte('check_in_date', startDateString)
          .lte('check_in_date', endDateString);
        
        if (propertyFilter && propertyFilter.length > 0) {
          operationalQuery = operationalQuery.in('property_id', propertyFilter);
        }
        
        const operationalRes = await operationalQuery;
        if (operationalRes.error) throw operationalRes.error;
        operationalReservations = (operationalRes.data || []) as Reservation[];
      }

      // 2. RESERVAS FINANCEIRAS (payment_date no período)
      let financialQuery = supabase
        .from('reservations')
        .select('*, properties(name, nickname)')
        .gte('payment_date', startDateString)
        .lte('payment_date', endDateString);

      if (propertyFilter && propertyFilter.length > 0) {
        financialQuery = financialQuery.in('property_id', propertyFilter);
      }

      if (platformFilter) {
        financialQuery = financialQuery.eq('platform', platformFilter);
      }

      // 3. RECEITAS FUTURAS BOOKING (checkout no período, payment_date depois)
      // Só buscar se não há filtro de plataforma OU se o filtro é Booking.com
      let futureBookingReservations: Reservation[] = [];
      
      if (!platformFilter || platformFilter === 'Booking.com') {
        let futureBookingQuery = supabase
          .from('reservations')
          .select('*, properties(name, nickname)')
          .eq('platform', 'Booking.com')
          .gte('check_out_date', startDateString)
          .lte('check_out_date', endDateString)
          .gt('payment_date', endDateString);

        if (propertyFilter && propertyFilter.length > 0) {
          futureBookingQuery = futureBookingQuery.in('property_id', propertyFilter);
        }

        const futureBookingRes = await futureBookingQuery;
        if (futureBookingRes.error) throw futureBookingRes.error;
        futureBookingReservations = (futureBookingRes.data || []) as Reservation[];
      }

      const [financialRes, propertiesRes] = await Promise.all([
        financialQuery,
        propertyFilter && propertyFilter.length > 0
          ? supabase.from('properties').select('id').in('id', propertyFilter)
          : supabase.from('properties').select('id'),
      ]);

      if (financialRes.error) throw financialRes.error;

      const financialReservations = (financialRes.data || []) as Reservation[];
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
      const operationalTotalCommission = operationalReservations.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

      // Calcular breakdown por plataforma das reservas operacionais
      const operationalAirbnbRevenue = operationalReservations
        .filter(r => r.platform === 'Airbnb')
        .reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      
      const operationalBookingRevenue = operationalReservations
        .filter(r => r.platform === 'Booking.com')
        .reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      
      const operationalDirectRevenue = operationalReservations
        .filter(r => r.platform === 'Direto')
        .reduce((sum, r) => sum + (r.net_revenue || 0), 0);

      // Calcular receitas futuras do Booking para incluir na receita operacional
      const futureBookingRevenue = futureBookingReservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
      const futureBookingNetRevenue = futureBookingReservations.reduce((sum, r) => sum + (r.net_revenue || 0), 0);
      const futureBookingCommission = futureBookingReservations.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
      
      // Só somar receitas futuras quando filtrar por Airbnb ou Direto
      // Booking e "Todas": não somar (já incluídas em operacional)
      const shouldAddFutureRevenue = platformFilter !== 'Booking.com' && platformFilter !== null;
      
      const operationalTotalWithFuture = operationalTotalRevenue + (shouldAddFutureRevenue ? futureBookingRevenue : 0);
      const operationalNetWithFuture = operationalTotalNetRevenue + (shouldAddFutureRevenue ? futureBookingNetRevenue : 0);
      const operationalCommissionWithFuture = operationalTotalCommission + (shouldAddFutureRevenue ? futureBookingCommission : 0);

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
        ? parseDate(nextPaymentDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : '';

      setData({
        operational: {
          totalReservations: operationalReservations.length,
          occupancyRate,
          totalRevenue: operationalTotalRevenue,
          totalNetRevenue: operationalTotalNetRevenue,
          totalCommission: operationalTotalCommission,
          totalRevenueWithFuture: operationalTotalWithFuture,
          totalNetRevenueWithFuture: operationalNetWithFuture,
          totalCommissionWithFuture: operationalCommissionWithFuture,
          airbnbRevenue: operationalAirbnbRevenue,
          bookingRevenue: operationalBookingRevenue,
          directRevenue: operationalDirectRevenue,
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
