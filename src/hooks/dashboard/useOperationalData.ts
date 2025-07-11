
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OperationalData {
  paidCount: number;
  pendingCount: number;
  cashflow: {
    airbnbReceived: number;
    bookingReceived: number;
    airbnbReceivable: number;
    bookingReceivable: number;
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
    cashflow: {
      airbnbReceived: 0,
      bookingReceived: 0,
      airbnbReceivable: 0,
      bookingReceivable: 0
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
      let reservationsQuery = supabase
        .from('reservations')
        .select('payment_status, net_revenue, platform')
        .gte('check_in_date', startDateString)
        .lte('check_in_date', endDateString);

      let upcomingQuery = supabase
        .from('reservations')
        .select('guest_name, check_in_date, payment_status, properties(nickname, name)')
        .gte('check_in_date', todayString)
        .order('check_in_date', { ascending: true })
        .limit(3);

      // Apply property filter if exists
      if (propertyFilter && propertyFilter.length > 0) {
        reservationsQuery = reservationsQuery.in('property_id', propertyFilter);
        upcomingQuery = upcomingQuery.in('property_id', propertyFilter);
      }

      const [reservationsRes, upcomingRes] = await Promise.all([
        reservationsQuery,
        upcomingQuery
      ]);

      if (reservationsRes.error) throw reservationsRes.error;
      if (upcomingRes.error) throw upcomingRes.error;

      const reservations = reservationsRes.data || [];
      const upcoming = upcomingRes.data || [];

      // Calculate payment status counts
      const paidCount = reservations.filter(r => r.payment_status === 'Pago').length;
      const pendingCount = reservations.length - paidCount;

      // Calculate cashflow by platform and payment status
      const cashflow = reservations.reduce((acc, res) => {
        const platform = res.platform?.toLowerCase().includes('airbnb') ? 'airbnb' : 'booking';
        const netRevenue = res.net_revenue || 0;
        
        if (res.payment_status === 'Pago') {
          acc[`${platform}Received`] += netRevenue;
        } else {
          acc[`${platform}Receivable`] += netRevenue;
        }
        
        return acc;
      }, {
        airbnbReceived: 0,
        bookingReceived: 0,
        airbnbReceivable: 0,
        bookingReceivable: 0
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
