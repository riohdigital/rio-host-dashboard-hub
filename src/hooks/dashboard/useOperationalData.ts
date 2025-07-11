
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OperationalData {
  paidCount: number;
  pendingCount: number;
  totalPaidCount: number;
  totalPendingCount: number;
  cashflow: {
    airbnbReceived: number;
    bookingReceived: number;
    diretoReceived: number;
    airbnbReceivable: number;
    bookingReceivable: number;
    diretoReceivable: number;
  };
  upcomingReservations: Array<{
    guest_name: string;
    property_name: string;
    check_in_date: string;
    payment_status: string;
  }>;
}

export const useOperationalData = (
  startDateString: string,
  endDateString: string,
  selectedProperties: string[]
) => {
  const [data, setData] = useState<OperationalData>({
    paidCount: 0,
    pendingCount: 0,
    totalPaidCount: 0,
    totalPendingCount: 0,
    cashflow: {
      airbnbReceived: 0,
      bookingReceived: 0,
      diretoReceived: 0,
      airbnbReceivable: 0,
      bookingReceivable: 0,
      diretoReceivable: 0
    },
    upcomingReservations: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propertyFilter = useMemo(() => {
    return selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');
  }, [selectedProperties]);

  const fetchOperationalData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const todayString = new Date().toISOString().split('T')[0];

      // Build queries with conditional property filter
      let reservationsPeriodQuery = supabase
        .from('reservations')
        .select('payment_status, net_revenue, platform')
        .gte('check_in_date', startDateString)
        .lte('check_in_date', endDateString);

      let upcomingQuery = supabase
        .from('reservations')
        .select('guest_name, check_in_date, payment_status, properties(nickname, name)')
        .gte('check_in_date', todayString)
        .order('check_in_date', { ascending: true })
        .limit(4);

      // Apply property filter if exists
      if (propertyFilter && propertyFilter.length > 0) {
        reservationsPeriodQuery = reservationsPeriodQuery.in('property_id', propertyFilter);
        upcomingQuery = upcomingQuery.in('property_id', propertyFilter);
      }

      const [reservationsPeriodRes, upcomingRes] = await Promise.all([
        reservationsPeriodQuery,
        upcomingQuery
      ]);

      if (reservationsPeriodRes.error) throw reservationsPeriodRes.error;
      if (upcomingRes.error) throw upcomingRes.error;

      const reservationsPeriod = reservationsPeriodRes.data || [];
      const upcoming = upcomingRes.data || [];

      // Calculate payment status counts for period
      const paidCount = reservationsPeriod.filter(r => r.payment_status === 'Pago').length;
      const pendingCount = reservationsPeriod.length - paidCount;

      // For operational view, use the same period data for total counts
      const totalPaidCount = paidCount;
      const totalPendingCount = pendingCount;

      // Calculate cashflow by platform and payment status with proper platform classification
      const cashflow = reservationsPeriod.reduce((acc, res) => {
        const platform = res.platform?.toLowerCase();
        const netRevenue = res.net_revenue || 0;
        
        let platformKey: 'airbnb' | 'booking' | 'direto' = 'direto';
        
        if (platform?.includes('airbnb')) {
          platformKey = 'airbnb';
        } else if (platform?.includes('booking')) {
          platformKey = 'booking';
        }
        
        if (res.payment_status === 'Pago') {
          acc[`${platformKey}Received`] += netRevenue;
        } else {
          acc[`${platformKey}Receivable`] += netRevenue;
        }
        
        return acc;
      }, {
        airbnbReceived: 0,
        bookingReceived: 0,
        diretoReceived: 0,
        airbnbReceivable: 0,
        bookingReceivable: 0,
        diretoReceivable: 0
      });

      // Format upcoming reservations
      const upcomingReservations = upcoming.map(res => ({
        guest_name: res.guest_name || 'N/A',
        property_name: res.properties?.nickname || res.properties?.name || 'N/A',
        check_in_date: res.check_in_date,
        payment_status: res.payment_status || 'Pendente'
      }));

      setData({
        paidCount,
        pendingCount,
        totalPaidCount,
        totalPendingCount,
        cashflow,
        upcomingReservations
      });

    } catch (err: any) {
      console.error('Erro ao buscar dados operacionais:', err);
      setError(err.message || 'Erro ao carregar dados operacionais');
    } finally {
      setLoading(false);
    }
  }, [startDateString, endDateString, propertyFilter]);

  return {
    data,
    loading,
    error,
    fetchOperationalData
  };
};
