
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useOperationalData = (
  startDateString: string,
  endDateString: string,
  selectedProperties: string[]
) => {
  const [data, setData] = useState({
    paidCount: 0,
    pendingCount: 0,
    totalPaidCount: 0,
    totalPendingCount: 0,
    cashflow: { airbnbReceived: 0, bookingReceived: 0, diretoReceived: 0, airbnbReceivable: 0, bookingReceivable: 0, diretoReceivable: 0 },
    periodEvents: [],
    recentReservations: [],
    loading: false
  });
  const [loading, setLoading] = useState(true);

  const propertyFilter = useMemo(() => {
    return selectedProperties.includes('todas') ? null : selectedProperties.filter(id => id !== 'todas');
  }, [selectedProperties]);

  const classifyPlatform = useCallback((platformValue: string | null): 'airbnb' | 'booking' | 'direto' => {
    const platform = (platformValue || '').toLowerCase().trim();
    if (platform.includes('airbnb')) return 'airbnb';
    if (platform.includes('booking')) return 'booking';
    return 'direto';
  }, []);

  const fetchOperationalData = useCallback(async () => {
    setLoading(true);
    try {
      let reservationsInPeriodQuery = supabase.from('reservations').select('payment_status, net_revenue, platform').gte('check_in_date', startDateString).lte('check_in_date', endDateString);
      let allReservationsQuery = supabase.from('reservations').select('payment_status');
      let periodEventsQuery = supabase.from('reservations').select('guest_name, check_in_date, check_out_date, payment_status, properties(nickname, name)').or(`check_in_date.gte.${startDateString},check_out_date.gte.${startDateString}`).or(`check_in_date.lte.${endDateString},check_out_date.lte.${endDateString}`).order('check_in_date', { ascending: true });
      let recentQuery = supabase.from('reservations').select('guest_name, check_in_date, check_out_date, platform, total_revenue, created_at, properties(nickname, name)').order('created_at', { ascending: false }).limit(5);

      if (propertyFilter && propertyFilter.length > 0) {
        reservationsInPeriodQuery = reservationsInPeriodQuery.in('property_id', propertyFilter);
        allReservationsQuery = allReservationsQuery.in('property_id', propertyFilter);
        periodEventsQuery = periodEventsQuery.in('property_id', propertyFilter);
        recentQuery = recentQuery.in('property_id', propertyFilter);
      }

      const [reservationsPeriodRes, allReservationsRes, periodEventsRes, recentRes] = await Promise.all([
        reservationsInPeriodQuery, allReservationsQuery, periodEventsQuery, recentQuery
      ]);

      if (reservationsPeriodRes.error) throw reservationsPeriodRes.error;
      if (allReservationsRes.error) throw allReservationsRes.error;
      if (periodEventsRes.error) throw periodEventsRes.error;
      if (recentRes.error) throw recentRes.error;

      const reservationsPeriod = reservationsPeriodRes.data || [];
      const allReservations = allReservationsRes.data || [];
      const periodEventsData = periodEventsRes.data || [];
      const recent = recentRes.data || [];
      
      const paidCount = reservationsPeriod.filter(r => r.payment_status === 'Pago').length;
      const pendingCount = reservationsPeriod.length - paidCount;

      const totalPaidCount = allReservations.filter(r => r.payment_status === 'Pago').length;
      const totalPendingCount = allReservations.length - totalPaidCount;

      const cashflow = reservationsPeriod.reduce((acc, res) => {
        const platformKey = classifyPlatform(res.platform);
        const netRevenue = res.net_revenue || 0;
        if (res.payment_status === 'Pago') {
          acc[`${platformKey}Received`] += netRevenue;
        } else {
          acc[`${platformKey}Receivable`] += netRevenue;
        }
        return acc;
      }, { airbnbReceived: 0, bookingReceived: 0, diretoReceived: 0, airbnbReceivable: 0, bookingReceivable: 0, diretoReceivable: 0 });

      // Criar eventos do período (check-ins e check-outs) - apenas futuros
      const periodEvents = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      periodEventsData.forEach(res => {
        // Adicionar check-in se estiver no período e for futuro
        if (res.check_in_date >= startDateString && res.check_in_date <= endDateString) {
          const eventDate = new Date(res.check_in_date + 'T00:00:00');
          if (eventDate >= today) {
            periodEvents.push({
              type: 'checkin',
              guest_name: res.guest_name || 'N/A',
              property_name: res.properties?.nickname || res.properties?.name || 'N/A',
              date: res.check_in_date,
              payment_status: res.payment_status || 'Pendente'
            });
          }
        }
        
        // Adicionar check-out se estiver no período e for futuro
        if (res.check_out_date >= startDateString && res.check_out_date <= endDateString) {
          const eventDate = new Date(res.check_out_date + 'T00:00:00');
          if (eventDate >= today) {
            periodEvents.push({
              type: 'checkout',
              guest_name: res.guest_name || 'N/A',
              property_name: res.properties?.nickname || res.properties?.name || 'N/A',
              date: res.check_out_date,
              payment_status: res.payment_status || 'Pendente'
            });
          }
        }
      });
      
      // Ordenar eventos por data (próximos primeiro)
      periodEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const recentReservations = recent.map(res => ({
        guest_name: res.guest_name || 'N/A',
        property_name: res.properties?.nickname || res.properties?.name || 'N/A',
        check_in_date: res.check_in_date,
        check_out_date: res.check_out_date,
        platform: res.platform || 'Direto',
        total_revenue: res.total_revenue || 0,
        created_at: res.created_at || ''
      }));

      setData({ paidCount, pendingCount, totalPaidCount, totalPendingCount, cashflow, periodEvents, recentReservations, loading: false });
    } catch (error) {
      console.error("Erro ao buscar dados operacionais:", error);
    } finally {
      setLoading(false);
    }
  }, [startDateString, endDateString, propertyFilter, classifyPlatform]);
  
  return { data, loading, fetchOperationalData };
};
