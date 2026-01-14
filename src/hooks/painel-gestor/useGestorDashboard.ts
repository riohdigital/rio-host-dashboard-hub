import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { 
  GestorKPIs, 
  MonthlyCommission, 
  PropertyPerformance, 
  PlatformBreakdown,
  UpcomingEvent,
  CleaningRiskAlert,
  RecentActivity,
  CommissionSummary,
  CommissionDetail
} from '@/types/painel-gestor';
import { format, subMonths, differenceInDays, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const useGestorDashboard = () => {
  const { selectedProperties, selectedPeriod, customStartDate, customEndDate, selectedPlatform } = useGlobalFilters();
  const { startDate, endDate } = useDateRange(selectedPeriod, customStartDate, customEndDate);
  const { getAccessibleProperties, isMaster } = useUserPermissions();
  
  // Convert dates to strings to ensure stable dependencies
  const startDateString = useMemo(() => startDate.toISOString().split('T')[0], [startDate]);
  const endDateString = useMemo(() => endDate.toISOString().split('T')[0], [endDate]);
  
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<GestorKPIs>({
    totalCommission: 0,
    avgCommission: 0,
    totalReservations: 0,
    totalRevenue: 0,
    occupancyRate: 0,
    pendingCleanings: 0,
    completedCleanings: 0
  });
  const [monthlyCommissions, setMonthlyCommissions] = useState<MonthlyCommission[]>([]);
  const [propertyPerformance, setPropertyPerformance] = useState<PropertyPerformance[]>([]);
  const [platformBreakdown, setPlatformBreakdown] = useState<PlatformBreakdown[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [cleaningRiskAlerts, setCleaningRiskAlerts] = useState<CleaningRiskAlert[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [commissionDetails, setCommissionDetails] = useState<CommissionSummary>({
    totalReceived: 0,
    totalPending: 0,
    receivedCount: 0,
    pendingCount: 0,
    details: []
  });

  const accessiblePropertyIds = useMemo(() => {
    if (isMaster()) return null; // null = all properties
    return getAccessibleProperties();
  }, [isMaster, getAccessibleProperties]);

  const propertyFilter = useMemo(() => {
    if (selectedProperties.length > 0 && !selectedProperties.includes('todas')) {
      return selectedProperties;
    }
    return accessiblePropertyIds;
  }, [selectedProperties, accessiblePropertyIds]);

  const fetchKPIs = useCallback(async () => {
    try {
      let query = supabase
        .from('reservations')
        .select('commission_amount, total_revenue, cleaning_status, cleaner_user_id')
        .gte('check_in_date', startDateString)
        .lte('check_in_date', endDateString)
        .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada']);

      if (propertyFilter && propertyFilter.length > 0) {
        query = query.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        query = query.eq('platform', selectedPlatform);
      }

      const { data: reservations, error } = await query;

      if (error) throw error;

      const totalCommission = reservations?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
      const totalRevenue = reservations?.reduce((sum, r) => sum + (r.total_revenue || 0), 0) || 0;
      const totalReservations = reservations?.length || 0;
      const avgCommission = totalReservations > 0 ? totalCommission / totalReservations : 0;
      
      const pendingCleanings = reservations?.filter(r => 
        r.cleaning_status === 'Pendente' || !r.cleaning_status
      ).length || 0;
      
      const completedCleanings = reservations?.filter(r => 
        r.cleaning_status === 'Realizada'
      ).length || 0;

      // Calculate occupancy rate
      const totalDays = differenceInDays(endDate, startDate) + 1;
      let propertiesQuery = supabase.from('properties').select('id');
      if (propertyFilter && propertyFilter.length > 0) {
        propertiesQuery = propertiesQuery.in('id', propertyFilter);
      }
      const { data: properties } = await propertiesQuery;
      const propertyCount = properties?.length || 1;
      const totalPossibleNights = totalDays * propertyCount;
      
      // Get total nights booked
      let nightsQuery = supabase
        .from('reservations')
        .select('check_in_date, check_out_date')
        .gte('check_out_date', startDateString)
        .lte('check_in_date', endDateString)
        .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada']);

      if (propertyFilter && propertyFilter.length > 0) {
        nightsQuery = nightsQuery.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        nightsQuery = nightsQuery.eq('platform', selectedPlatform);
      }

      const { data: nightsData } = await nightsQuery;
      
      let totalNightsBooked = 0;
      nightsData?.forEach(r => {
        const checkIn = new Date(r.check_in_date);
        const checkOut = new Date(r.check_out_date);
        const effectiveStart = checkIn < startDate ? startDate : checkIn;
        const effectiveEnd = checkOut > endDate ? endDate : checkOut;
        totalNightsBooked += Math.max(0, differenceInDays(effectiveEnd, effectiveStart));
      });

      const occupancyRate = totalPossibleNights > 0 
        ? Math.min(100, (totalNightsBooked / totalPossibleNights) * 100) 
        : 0;

      setKpis({
        totalCommission,
        avgCommission,
        totalReservations,
        totalRevenue,
        occupancyRate,
        pendingCleanings,
        completedCleanings
      });
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    }
  }, [startDateString, endDateString, startDate, endDate, propertyFilter, selectedPlatform]);

  const fetchMonthlyCommissions = useCallback(async () => {
    try {
      // Single query for all reservations in period - OPTIMIZED
      let query = supabase
        .from('reservations')
        .select('check_in_date, commission_amount, total_revenue')
        .gte('check_in_date', startDateString)
        .lte('check_in_date', endDateString)
        .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada']);

      if (propertyFilter && propertyFilter.length > 0) {
        query = query.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        query = query.eq('platform', selectedPlatform);
      }

      const { data } = await query;

      // Group by month in JavaScript
      const monthlyMap = new Map<string, MonthlyCommission>();
      
      data?.forEach(r => {
        const date = new Date(r.check_in_date);
        const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
        
        const existing = monthlyMap.get(key) || {
          month: format(date, 'MMM', { locale: ptBR }),
          year: date.getFullYear(),
          commission: 0,
          reservations: 0,
          revenue: 0
        };
        
        existing.commission += r.commission_amount || 0;
        existing.revenue += r.total_revenue || 0;
        existing.reservations += 1;
        
        monthlyMap.set(key, existing);
      });

      // Sort chronologically
      const months = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([_, value]) => value);

      setMonthlyCommissions(months);
    } catch (error) {
      console.error('Error fetching monthly commissions:', error);
    }
  }, [startDateString, endDateString, propertyFilter, selectedPlatform]);

  const fetchPropertyPerformance = useCallback(async () => {
    try {
      // Fetch properties and reservations in parallel - OPTIMIZED
      let propertiesQuery = supabase
        .from('properties')
        .select('id, name, nickname, commission_rate');

      if (propertyFilter && propertyFilter.length > 0) {
        propertiesQuery = propertiesQuery.in('id', propertyFilter);
      }

      let reservationsQuery = supabase
        .from('reservations')
        .select('property_id, commission_amount, total_revenue, cleaning_status, check_in_date, check_out_date')
        .gte('check_in_date', startDateString)
        .lte('check_in_date', endDateString)
        .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada']);

      if (propertyFilter && propertyFilter.length > 0) {
        reservationsQuery = reservationsQuery.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        reservationsQuery = reservationsQuery.eq('platform', selectedPlatform);
      }

      const [{ data: properties }, { data: reservations }] = await Promise.all([
        propertiesQuery,
        reservationsQuery
      ]);

      if (!properties) return;

      // Group reservations by property_id in JavaScript
      const reservationsByProperty = new Map<string, typeof reservations>();
      reservations?.forEach(r => {
        if (!r.property_id) return;
        const existing = reservationsByProperty.get(r.property_id) || [];
        existing.push(r);
        reservationsByProperty.set(r.property_id, existing);
      });

      const totalDays = differenceInDays(endDate, startDate) + 1;

      const performance: PropertyPerformance[] = properties.map(property => {
        const propReservations = reservationsByProperty.get(property.id) || [];
        
        let nightsBooked = 0;
        propReservations.forEach(r => {
          const checkIn = new Date(r.check_in_date);
          const checkOut = new Date(r.check_out_date);
          const effectiveStart = checkIn < startDate ? startDate : checkIn;
          const effectiveEnd = checkOut > endDate ? endDate : checkOut;
          nightsBooked += Math.max(0, differenceInDays(effectiveEnd, effectiveStart));
        });

        return {
          propertyId: property.id,
          propertyName: property.name,
          nickname: property.nickname || undefined,
          reservations: propReservations.length,
          totalRevenue: propReservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0),
          commission: propReservations.reduce((sum, r) => sum + (r.commission_amount || 0), 0),
          commissionRate: (property.commission_rate || 0) * 100,
          occupancyRate: totalDays > 0 ? Math.min(100, (nightsBooked / totalDays) * 100) : 0,
          completedCleanings: propReservations.filter(r => r.cleaning_status === 'Realizada').length,
          pendingCleanings: propReservations.filter(r => r.cleaning_status === 'Pendente' || !r.cleaning_status).length
        };
      });

      setPropertyPerformance(performance.sort((a, b) => b.commission - a.commission));
    } catch (error) {
      console.error('Error fetching property performance:', error);
    }
  }, [startDateString, endDateString, startDate, endDate, propertyFilter, selectedPlatform]);

  const fetchPlatformBreakdown = useCallback(async () => {
    try {
      let query = supabase
        .from('reservations')
        .select('platform, commission_amount, total_revenue')
        .gte('check_in_date', startDateString)
        .lte('check_in_date', endDateString)
        .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada']);

      if (propertyFilter && propertyFilter.length > 0) {
        query = query.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        query = query.eq('platform', selectedPlatform);
      }

      const { data } = await query;

      if (!data) return;

      const platformMap = new Map<string, PlatformBreakdown>();

      data.forEach(r => {
        const platform = r.platform || 'Direto';
        const existing = platformMap.get(platform) || { platform, commission: 0, reservations: 0, revenue: 0 };
        existing.commission += r.commission_amount || 0;
        existing.revenue += r.total_revenue || 0;
        existing.reservations += 1;
        platformMap.set(platform, existing);
      });

      setPlatformBreakdown(Array.from(platformMap.values()).sort((a, b) => b.commission - a.commission));
    } catch (error) {
      console.error('Error fetching platform breakdown:', error);
    }
  }, [startDateString, endDateString, propertyFilter, selectedPlatform]);

  const fetchUpcomingEvents = useCallback(async () => {
    try {
      // Calcular data efetiva: máximo entre hoje e startDateString (mostrar apenas eventos futuros)
      const today = new Date().toISOString().split('T')[0];
      const effectiveStartDate = today > startDateString ? today : startDateString;
      
      // Fetch check-ins no período (apenas futuros)
      let checkInsQuery = supabase
        .from('reservations')
        .select(`
          id, check_in_date, checkin_time, guest_name, total_revenue, commission_amount,
          cleaning_status, cleaner_user_id, platform,
          properties:property_id (name, nickname)
        `)
        .gte('check_in_date', effectiveStartDate)
        .lte('check_in_date', endDateString)
        .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada'])
        .order('check_in_date', { ascending: true });

      if (propertyFilter && propertyFilter.length > 0) {
        checkInsQuery = checkInsQuery.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        checkInsQuery = checkInsQuery.eq('platform', selectedPlatform);
      }

      // Fetch check-outs no período
      let checkOutsQuery = supabase
        .from('reservations')
        .select(`
          id, check_out_date, checkout_time, guest_name, total_revenue, commission_amount,
          cleaning_status, cleaner_user_id, platform,
          properties:property_id (name, nickname)
        `)
        .gte('check_out_date', effectiveStartDate)
        .lte('check_out_date', endDateString)
        .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada'])
        .order('check_out_date', { ascending: true });

      if (propertyFilter && propertyFilter.length > 0) {
        checkOutsQuery = checkOutsQuery.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        checkOutsQuery = checkOutsQuery.eq('platform', selectedPlatform);
      }

      // Fetch faxinas (baseado em check_out_date - limpeza após checkout)
      let cleaningsQuery = supabase
        .from('reservations')
        .select(`
          id, check_out_date, guest_name, cleaning_status, cleaner_user_id, platform,
          properties:property_id (name, nickname)
        `)
        .gte('check_out_date', effectiveStartDate)
        .lte('check_out_date', endDateString)
        .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada'])
        .neq('cleaning_status', 'Realizada') // Apenas faxinas pendentes/em andamento
        .order('check_out_date', { ascending: true });

      if (propertyFilter && propertyFilter.length > 0) {
        cleaningsQuery = cleaningsQuery.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        cleaningsQuery = cleaningsQuery.eq('platform', selectedPlatform);
      }

      const [checkInsResult, checkOutsResult, cleaningsResult] = await Promise.all([
        checkInsQuery,
        checkOutsQuery,
        cleaningsQuery
      ]);

      const events: UpcomingEvent[] = [];

      // Processar check-ins
      checkInsResult.data?.forEach(r => {
        const property = r.properties as { name: string; nickname: string | null } | null;
        events.push({
          id: r.id,
          type: 'check-in',
          date: r.check_in_date,
          time: r.checkin_time || undefined,
          guestName: r.guest_name || 'Hóspede',
          propertyName: property?.name || 'Propriedade',
          propertyNickname: property?.nickname || undefined,
          totalRevenue: r.total_revenue || 0,
          commission: r.commission_amount || 0,
          cleaningStatus: r.cleaning_status || 'Pendente',
          hasCleanerAssigned: !!r.cleaner_user_id,
          platform: r.platform || 'Direto'
        });
      });

      // Processar check-outs
      checkOutsResult.data?.forEach(r => {
        const property = r.properties as { name: string; nickname: string | null } | null;
        events.push({
          id: r.id,
          type: 'check-out',
          date: r.check_out_date,
          time: r.checkout_time || undefined,
          guestName: r.guest_name || 'Hóspede',
          propertyName: property?.name || 'Propriedade',
          propertyNickname: property?.nickname || undefined,
          totalRevenue: r.total_revenue || 0,
          commission: r.commission_amount || 0,
          cleaningStatus: r.cleaning_status || 'Pendente',
          hasCleanerAssigned: !!r.cleaner_user_id,
          platform: r.platform || 'Direto'
        });
      });

      // Processar faxinas
      cleaningsResult.data?.forEach(r => {
        const property = r.properties as { name: string; nickname: string | null } | null;
        events.push({
          id: `cleaning-${r.id}`,
          type: 'cleaning',
          date: r.check_out_date,
          guestName: r.guest_name || 'Hóspede',
          propertyName: property?.name || 'Propriedade',
          propertyNickname: property?.nickname || undefined,
          totalRevenue: 0,
          commission: 0,
          cleaningStatus: r.cleaning_status || 'Pendente',
          hasCleanerAssigned: !!r.cleaner_user_id,
          platform: r.platform || 'Direto'
        });
      });

      // Ordenar por data
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setUpcomingEvents(events);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  }, [startDateString, endDateString, propertyFilter, selectedPlatform]);

  const fetchCleaningRiskAlerts = useCallback(async () => {
    try {
      const today = new Date();
      const threeDaysLater = addDays(today, 3);
      const todayStr = today.toISOString().split('T')[0];
      const threeDaysStr = threeDaysLater.toISOString().split('T')[0];

      let query = supabase
        .from('reservations')
        .select(`
          id, check_out_date, guest_name, property_id,
          properties:property_id (name, nickname)
        `)
        .gte('check_out_date', todayStr)
        .lte('check_out_date', threeDaysStr)
        .is('cleaner_user_id', null)
        .eq('reservation_status', 'Confirmada')
        .order('check_out_date', { ascending: true });

      if (propertyFilter && propertyFilter.length > 0) {
        query = query.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        query = query.eq('platform', selectedPlatform);
      }

      const { data } = await query;

      const alerts: CleaningRiskAlert[] = (data || []).map(r => {
        const property = r.properties as { name: string; nickname: string | null } | null;
        return {
          reservationId: r.id,
          propertyId: r.property_id || '',
          propertyName: property?.name || 'Propriedade',
          propertyNickname: property?.nickname || undefined,
          checkoutDate: r.check_out_date,
          guestName: r.guest_name || 'Hóspede',
          daysUntilCheckout: differenceInDays(parseISO(r.check_out_date), today)
        };
      });

      setCleaningRiskAlerts(alerts);
    } catch (error) {
      console.error('Error fetching cleaning risk alerts:', error);
    }
  }, [propertyFilter, selectedPlatform]);

  const fetchRecentActivities = useCallback(async () => {
    try {
      const twoDaysAgo = subMonths(new Date(), 0);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString();

      let query = supabase
        .from('reservations')
        .select(`
          id, created_at, guest_name, total_revenue, payment_status, cleaning_status,
          properties:property_id (name)
        `)
        .gte('created_at', twoDaysAgoStr)
        .order('created_at', { ascending: false })
        .limit(10);

      if (propertyFilter && propertyFilter.length > 0) {
        query = query.in('property_id', propertyFilter);
      }

      if (selectedPlatform !== 'all') {
        query = query.eq('platform', selectedPlatform);
      }

      const { data } = await query;

      const activities: RecentActivity[] = (data || []).map(r => {
        const property = r.properties as { name: string } | null;
        return {
          id: r.id,
          type: 'new_reservation' as const,
          description: `Nova reserva: ${r.guest_name || 'Hóspede'}`,
          timestamp: r.created_at || '',
          propertyName: property?.name,
          amount: r.total_revenue || undefined
        };
      });

      setRecentActivities(activities);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  }, [propertyFilter, selectedPlatform]);

  const fetchCommissionDetails = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Determinar quais plataformas buscar baseado no filtro global
      const shouldFetchAirbnb = selectedPlatform === 'all' || selectedPlatform === 'Airbnb';
      const shouldFetchDireto = selectedPlatform === 'all' || selectedPlatform === 'Direto';
      const shouldFetchBooking = selectedPlatform === 'all' || selectedPlatform === 'Booking.com';

      // Determinar plataformas para Query 1 (Airbnb/Direto)
      const airbnbDiretoPlatforms: string[] = [];
      if (shouldFetchAirbnb) airbnbDiretoPlatforms.push('Airbnb');
      if (shouldFetchDireto) airbnbDiretoPlatforms.push('Direto');

      let airbnbDiretoData: any[] | null = null;
      let bookingPendingData: any[] | null = null;
      let bookingReceivedData: any[] | null = null;

      // Query 1: Airbnb e/ou Direto - filtrar por check_in_date no período
      if (airbnbDiretoPlatforms.length > 0) {
        let airbnbDiretoQuery = supabase
          .from('reservations')
          .select(`
            id, guest_name, platform, check_in_date, check_out_date, payment_date, 
            commission_amount, net_revenue,
            properties:property_id (name, nickname)
          `)
          .gte('check_in_date', startDateString)
          .lte('check_in_date', endDateString)
          .in('platform', airbnbDiretoPlatforms)
          .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada'])
          .not('commission_amount', 'is', null);

        if (propertyFilter && propertyFilter.length > 0) {
          airbnbDiretoQuery = airbnbDiretoQuery.in('property_id', propertyFilter);
        }

        const result = await airbnbDiretoQuery;
        airbnbDiretoData = result.data;
      }

      // Query 2: Booking "A Receber" - checkout no período (vai receber no mês seguinte)
      if (shouldFetchBooking) {
        let bookingPendingQuery = supabase
          .from('reservations')
          .select(`
            id, guest_name, platform, check_in_date, check_out_date, payment_date, 
            commission_amount, net_revenue,
            properties:property_id (name, nickname)
          `)
          .gte('check_out_date', startDateString)
          .lte('check_out_date', endDateString)
          .eq('platform', 'Booking.com')
          .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada'])
          .not('commission_amount', 'is', null);

        if (propertyFilter && propertyFilter.length > 0) {
          bookingPendingQuery = bookingPendingQuery.in('property_id', propertyFilter);
        }

        const result = await bookingPendingQuery;
        bookingPendingData = result.data;
      }

      // Query 3: Booking "Recebidas" - payment_date dentro do período selecionado
      if (shouldFetchBooking) {
        let bookingReceivedQuery = supabase
          .from('reservations')
          .select(`
            id, guest_name, platform, check_in_date, check_out_date, payment_date, 
            commission_amount, net_revenue,
            properties:property_id (name, nickname)
          `)
          .gte('payment_date', startDateString)
          .lte('payment_date', endDateString)
          .eq('platform', 'Booking.com')
          .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada'])
          .not('commission_amount', 'is', null);

        if (propertyFilter && propertyFilter.length > 0) {
          bookingReceivedQuery = bookingReceivedQuery.in('property_id', propertyFilter);
        }

        const result = await bookingReceivedQuery;
        bookingReceivedData = result.data;
      }

      // Processar Airbnb/Direto - status baseado em check_in <= hoje
      const airbnbDiretoDetails: CommissionDetail[] = (airbnbDiretoData || []).map(r => {
        const property = r.properties as { name: string; nickname: string | null } | null;
        // Recebida se check-in já passou (D+1 também já passou)
        const status: 'received' | 'pending' = r.check_in_date <= today ? 'received' : 'pending';
        
        return {
          id: r.id,
          propertyName: property?.name || 'Propriedade',
          propertyNickname: property?.nickname || undefined,
          guestName: r.guest_name || 'Hóspede',
          platform: r.platform || 'Direto',
          checkInDate: r.check_in_date,
          checkoutDate: r.check_out_date,
          paymentDate: r.payment_date || '',
          commissionAmount: r.commission_amount || 0,
          netRevenue: r.net_revenue || 0,
          status
        };
      });

      // Processar Booking "A Receber" - todas são pending (checkout no período, pagamento mês seguinte)
      const bookingPendingDetails: CommissionDetail[] = (bookingPendingData || []).map(r => {
        const property = r.properties as { name: string; nickname: string | null } | null;
        return {
          id: r.id,
          propertyName: property?.name || 'Propriedade',
          propertyNickname: property?.nickname || undefined,
          guestName: r.guest_name || 'Hóspede',
          platform: 'Booking.com',
          checkInDate: r.check_in_date,
          checkoutDate: r.check_out_date,
          paymentDate: r.payment_date || '',
          commissionAmount: r.commission_amount || 0,
          netRevenue: r.net_revenue || 0,
          status: 'pending' as const
        };
      });

      // Processar Booking "Recebidas" - todas são received (payment_date dentro do período)
      const bookingReceivedDetails: CommissionDetail[] = (bookingReceivedData || []).map(r => {
        const property = r.properties as { name: string; nickname: string | null } | null;
        return {
          id: r.id,
          propertyName: property?.name || 'Propriedade',
          propertyNickname: property?.nickname || undefined,
          guestName: r.guest_name || 'Hóspede',
          platform: 'Booking.com',
          checkInDate: r.check_in_date,
          checkoutDate: r.check_out_date,
          paymentDate: r.payment_date || '',
          commissionAmount: r.commission_amount || 0,
          netRevenue: r.net_revenue || 0,
          status: 'received' as const
        };
      });

      // Combinar todos os detalhes
      const allDetails = [...airbnbDiretoDetails, ...bookingPendingDetails, ...bookingReceivedDetails];

      const received = allDetails.filter(d => d.status === 'received');
      const pending = allDetails.filter(d => d.status === 'pending');

      setCommissionDetails({
        totalReceived: received.reduce((sum, d) => sum + d.commissionAmount, 0),
        totalPending: pending.reduce((sum, d) => sum + d.commissionAmount, 0),
        receivedCount: received.length,
        pendingCount: pending.length,
        details: allDetails
      });
    } catch (error) {
      console.error('Error fetching commission details:', error);
    }
  }, [startDateString, endDateString, propertyFilter, selectedPlatform]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchKPIs(),
        fetchMonthlyCommissions(),
        fetchPropertyPerformance(),
        fetchPlatformBreakdown(),
        fetchUpcomingEvents(),
        fetchCleaningRiskAlerts(),
        fetchRecentActivities(),
        fetchCommissionDetails()
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    fetchKPIs, 
    fetchMonthlyCommissions, 
    fetchPropertyPerformance, 
    fetchPlatformBreakdown,
    fetchUpcomingEvents,
    fetchCleaningRiskAlerts,
    fetchRecentActivities,
    fetchCommissionDetails
  ]);

  // Use primitive strings as direct dependencies to ensure re-fetch on filter changes
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData, startDateString, endDateString, selectedPeriod]);

  return {
    loading,
    kpis,
    monthlyCommissions,
    propertyPerformance,
    platformBreakdown,
    upcomingEvents,
    cleaningRiskAlerts,
    recentActivities,
    commissionDetails,
    refetch: fetchAllData
  };
};
