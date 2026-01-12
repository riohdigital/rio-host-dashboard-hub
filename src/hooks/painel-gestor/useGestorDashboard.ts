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
  const { selectedProperties, selectedPeriod, customStartDate, customEndDate } = useGlobalFilters();
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
  }, [startDateString, endDateString, startDate, endDate, propertyFilter]);

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
  }, [startDateString, endDateString, propertyFilter]);

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
  }, [startDateString, endDateString, startDate, endDate, propertyFilter]);

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
  }, [startDateString, endDateString, propertyFilter]);

  const fetchUpcomingEvents = useCallback(async () => {
    try {
      const today = new Date();
      const nextWeek = addDays(today, 7);
      const todayStr = today.toISOString().split('T')[0];
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      // Fetch check-ins
      let checkInsQuery = supabase
        .from('reservations')
        .select(`
          id, check_in_date, checkin_time, guest_name, total_revenue, commission_amount,
          cleaning_status, cleaner_user_id, platform,
          properties:property_id (name, nickname)
        `)
        .gte('check_in_date', todayStr)
        .lte('check_in_date', nextWeekStr)
        .eq('reservation_status', 'Confirmada')
        .order('check_in_date', { ascending: true });

      if (propertyFilter && propertyFilter.length > 0) {
        checkInsQuery = checkInsQuery.in('property_id', propertyFilter);
      }

      // Fetch check-outs
      let checkOutsQuery = supabase
        .from('reservations')
        .select(`
          id, check_out_date, checkout_time, guest_name, total_revenue, commission_amount,
          cleaning_status, cleaner_user_id, platform,
          properties:property_id (name, nickname)
        `)
        .gte('check_out_date', todayStr)
        .lte('check_out_date', nextWeekStr)
        .eq('reservation_status', 'Confirmada')
        .order('check_out_date', { ascending: true });

      if (propertyFilter && propertyFilter.length > 0) {
        checkOutsQuery = checkOutsQuery.in('property_id', propertyFilter);
      }

      const [checkInsResult, checkOutsResult] = await Promise.all([
        checkInsQuery,
        checkOutsQuery
      ]);

      const events: UpcomingEvent[] = [];

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

      // Sort by date
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setUpcomingEvents(events);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  }, [propertyFilter]);

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
  }, [propertyFilter]);

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
  }, [propertyFilter]);

  const fetchCommissionDetails = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('reservations')
        .select(`
          id, guest_name, platform, check_out_date, payment_date, 
          commission_amount, net_revenue,
          properties:property_id (name, nickname)
        `)
        .gte('check_in_date', startDateString)
        .lte('check_in_date', endDateString)
        .in('reservation_status', ['Confirmada', 'Em Andamento', 'Finalizada'])
        .not('commission_amount', 'is', null)
        .order('payment_date', { ascending: true });

      if (propertyFilter && propertyFilter.length > 0) {
        query = query.in('property_id', propertyFilter);
      }

      const { data } = await query;

      const details: CommissionDetail[] = (data || []).map(r => {
        const property = r.properties as { name: string; nickname: string | null } | null;
        const status = r.payment_date && r.payment_date <= today ? 'received' : 'pending';
        
        return {
          id: r.id,
          propertyName: property?.name || 'Propriedade',
          propertyNickname: property?.nickname || undefined,
          guestName: r.guest_name || 'Hóspede',
          platform: r.platform || 'Direto',
          checkoutDate: r.check_out_date,
          paymentDate: r.payment_date || '',
          commissionAmount: r.commission_amount || 0,
          netRevenue: r.net_revenue || 0,
          status
        };
      });

      const received = details.filter(d => d.status === 'received');
      const pending = details.filter(d => d.status === 'pending');

      setCommissionDetails({
        totalReceived: received.reduce((sum, d) => sum + d.commissionAmount, 0),
        totalPending: pending.reduce((sum, d) => sum + d.commissionAmount, 0),
        receivedCount: received.length,
        pendingCount: pending.length,
        details
      });
    } catch (error) {
      console.error('Error fetching commission details:', error);
    }
  }, [startDateString, endDateString, propertyFilter]);

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
