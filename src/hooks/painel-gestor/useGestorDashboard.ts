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
  RecentActivity 
} from '@/types/painel-gestor';
import { format, subMonths, differenceInDays, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const useGestorDashboard = () => {
  const { selectedProperties, selectedPeriod, customStartDate, customEndDate } = useGlobalFilters();
  const { startDate, endDate } = useDateRange(selectedPeriod, customStartDate, customEndDate);
  const { getAccessibleProperties, isMaster } = useUserPermissions();
  
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
        .gte('check_in_date', startDate.toISOString().split('T')[0])
        .lte('check_in_date', endDate.toISOString().split('T')[0])
        .eq('reservation_status', 'Confirmada');

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
        .gte('check_out_date', startDate.toISOString().split('T')[0])
        .lte('check_in_date', endDate.toISOString().split('T')[0])
        .eq('reservation_status', 'Confirmada');

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
  }, [startDate, endDate, propertyFilter]);

  const fetchMonthlyCommissions = useCallback(async () => {
    try {
      const months: MonthlyCommission[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

        let query = supabase
          .from('reservations')
          .select('commission_amount, total_revenue')
          .gte('check_in_date', monthStart.toISOString().split('T')[0])
          .lte('check_in_date', monthEnd.toISOString().split('T')[0])
          .eq('reservation_status', 'Confirmada');

        if (propertyFilter && propertyFilter.length > 0) {
          query = query.in('property_id', propertyFilter);
        }

        const { data } = await query;

        months.push({
          month: format(monthDate, 'MMM', { locale: ptBR }),
          year: monthDate.getFullYear(),
          commission: data?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0,
          reservations: data?.length || 0,
          revenue: data?.reduce((sum, r) => sum + (r.total_revenue || 0), 0) || 0
        });
      }

      setMonthlyCommissions(months);
    } catch (error) {
      console.error('Error fetching monthly commissions:', error);
    }
  }, [propertyFilter]);

  const fetchPropertyPerformance = useCallback(async () => {
    try {
      let propertiesQuery = supabase
        .from('properties')
        .select('id, name, nickname, commission_rate');

      if (propertyFilter && propertyFilter.length > 0) {
        propertiesQuery = propertiesQuery.in('id', propertyFilter);
      }

      const { data: properties } = await propertiesQuery;

      if (!properties) return;

      const performance: PropertyPerformance[] = [];

      for (const property of properties) {
        let query = supabase
          .from('reservations')
          .select('commission_amount, total_revenue, cleaning_status, check_in_date, check_out_date')
          .eq('property_id', property.id)
          .gte('check_in_date', startDate.toISOString().split('T')[0])
          .lte('check_in_date', endDate.toISOString().split('T')[0])
          .eq('reservation_status', 'Confirmada');

        const { data: reservations } = await query;

        const totalDays = differenceInDays(endDate, startDate) + 1;
        let nightsBooked = 0;
        reservations?.forEach(r => {
          const checkIn = new Date(r.check_in_date);
          const checkOut = new Date(r.check_out_date);
          const effectiveStart = checkIn < startDate ? startDate : checkIn;
          const effectiveEnd = checkOut > endDate ? endDate : checkOut;
          nightsBooked += Math.max(0, differenceInDays(effectiveEnd, effectiveStart));
        });

        performance.push({
          propertyId: property.id,
          propertyName: property.name,
          nickname: property.nickname || undefined,
          reservations: reservations?.length || 0,
          totalRevenue: reservations?.reduce((sum, r) => sum + (r.total_revenue || 0), 0) || 0,
          commission: reservations?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0,
          commissionRate: (property.commission_rate || 0) * 100,
          occupancyRate: totalDays > 0 ? Math.min(100, (nightsBooked / totalDays) * 100) : 0,
          completedCleanings: reservations?.filter(r => r.cleaning_status === 'Realizada').length || 0,
          pendingCleanings: reservations?.filter(r => r.cleaning_status === 'Pendente' || !r.cleaning_status).length || 0
        });
      }

      setPropertyPerformance(performance.sort((a, b) => b.commission - a.commission));
    } catch (error) {
      console.error('Error fetching property performance:', error);
    }
  }, [startDate, endDate, propertyFilter]);

  const fetchPlatformBreakdown = useCallback(async () => {
    try {
      let query = supabase
        .from('reservations')
        .select('platform, commission_amount, total_revenue')
        .gte('check_in_date', startDate.toISOString().split('T')[0])
        .lte('check_in_date', endDate.toISOString().split('T')[0])
        .eq('reservation_status', 'Confirmada');

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
  }, [startDate, endDate, propertyFilter]);

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
        fetchRecentActivities()
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
    fetchRecentActivities
  ]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    loading,
    kpis,
    monthlyCommissions,
    propertyPerformance,
    platformBreakdown,
    upcomingEvents,
    cleaningRiskAlerts,
    recentActivities,
    refetch: fetchAllData
  };
};
