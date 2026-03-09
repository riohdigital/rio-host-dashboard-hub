import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, parseISO, isAfter } from 'date-fns';

export interface CleaningEntry {
  reservationId: string;
  date: string;
  propertyName: string;
  propertyNickname?: string;
  fee: number;
  paymentStatus: string;
  platform: string;
}

export interface CleanerPayment {
  cleanerId: string;
  cleanerName: string;
  phone?: string;
  pix?: string;
  cleanings: CleaningEntry[];
  totalPaid: number;
  totalPending: number;
  totalNextCycle: number;
  total: number;
}

export interface PlatformEntry {
  platform: string;
  totalRevenue: number;
  commission: number;
  netRevenue: number;
  reservations: number;
  status: 'received' | 'pending';
}

export interface OwnerPayment {
  propertyId: string;
  propertyName: string;
  nickname?: string;
  platformBreakdown: PlatformEntry[];
  investments: number;
  totalOwner: number;
  totalCommission: number;
  totalToTransfer: number;
}

export interface ScheduleEntry {
  reservationId: string;
  propertyName: string;
  propertyNickname?: string;
  platform: string;
  amount: number;
  type: 'commission' | 'owner';
  status: 'received' | 'pending';
  guestName?: string;
}

export interface ScheduleDay {
  date: string;
  entries: ScheduleEntry[];
  dailyTotal: number;
}

export interface PaymentsKPIs {
  totalCommissionReceived: number;
  totalCommissionPending: number;
  totalCleaningsPaid: number;
  totalCleaningsPending: number;
  totalOwnerTransfer: number;
  netBalance: number;
}

export interface PaymentsDashboardData {
  cleanerPayments: CleanerPayment[];
  ownerPayments: OwnerPayment[];
  schedule: ScheduleDay[];
  kpis: PaymentsKPIs;
  loading: boolean;
  error: string | null;
}

const PAID_STATUSES = ['Pago', 'Paga', 'pago', 'paga', 'PAGO'];

const getCleaningPaymentStatus = (status: string | null): string => {
  if (!status) return 'Pendente';
  if (PAID_STATUSES.some(s => status.includes(s))) return 'Pago';
  if (status.toLowerCase().includes('próximo ciclo') || status.toLowerCase().includes('proximo ciclo')) return 'Próximo Ciclo';
  if (status.toLowerCase().includes('pagamento na data')) return 'Pagamento na Data';
  if (status.toLowerCase().includes('d+1')) return 'D+1';
  return status;
};

const isPlatformReceived = (platform: string, checkInDate: string, paymentDate: string | null): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (platform === 'Booking.com') {
    if (!paymentDate) return false;
    return !isAfter(parseISO(paymentDate), today);
  }
  // Airbnb D+1 and Direto = on check-in
  const checkin = parseISO(checkInDate);
  return !isAfter(checkin, today);
};

// propertyIds: ['todas'] or [] means no filter (all properties)
export const usePaymentsDashboard = (month: number, year: number, propertyIds: string[]) => {
  const [data, setData] = useState<PaymentsDashboardData>({
    cleanerPayments: [],
    ownerPayments: [],
    schedule: [],
    kpis: {
      totalCommissionReceived: 0,
      totalCommissionPending: 0,
      totalCleaningsPaid: 0,
      totalCleaningsPending: 0,
      totalOwnerTransfer: 0,
      netBalance: 0,
    },
    loading: false,
    error: null,
  });

  const hasFilter = propertyIds.length > 0 && !propertyIds.includes('todas');

  useEffect(() => {
    fetchDashboardData();
  }, [month, year, JSON.stringify(propertyIds)]);

  const fetchDashboardData = async () => {
    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

      const resSELECT = `
        id, property_id, platform, check_in_date, check_out_date, payment_date,
        total_revenue, base_revenue, commission_amount, net_revenue,
        payment_status, reservation_status, guest_name,
        cleaner_user_id, cleaning_payment_status, cleaning_fee, cleaning_status,
        cleaning_allocation
      `;

      // Fetch reservations with checkout in the month (cleaners + owners)
      let allResQuery = supabase
        .from('reservations')
        .select(resSELECT)
        .neq('reservation_status', 'Cancelada')
        .gte('check_out_date', startDate)
        .lte('check_out_date', endDate);

      if (hasFilter) {
        allResQuery = allResQuery.in('property_id', propertyIds);
      }

      const { data: allReservations, error: resError } = await allResQuery;
      if (resError) throw resError;

      // Fetch reservations with payment_date in the month (schedule - Booking)
      let schedQuery = supabase
        .from('reservations')
        .select(resSELECT)
        .neq('reservation_status', 'Cancelada')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (hasFilter) {
        schedQuery = schedQuery.in('property_id', propertyIds);
      }

      const { data: scheduleReservations, error: schedError } = await schedQuery;
      if (schedError) throw schedError;

      // Fetch properties
      let propertiesQuery = supabase
        .from('properties')
        .select('id, name, nickname, commission_rate');

      if (hasFilter) {
        propertiesQuery = propertiesQuery.in('id', propertyIds);
      }

      const { data: properties, error: propError } = await propertiesQuery;
      if (propError) throw propError;

      // Fetch user profiles (cleaners)
      const { data: userProfiles, error: upError } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email')
        .eq('role', 'faxineira');
      if (upError) throw upError;

      // Fetch cleaner profiles (phone/pix)
      const { data: cleanerProfiles, error: cpError } = await supabase
        .from('cleaner_profiles')
        .select('user_id, phone, pix');
      if (cpError) throw cpError;

      // Fetch property investments for the month
      const propertyIdsList = (properties || []).map(p => p.id);
      const { data: investments, error: invError } = await supabase
        .from('property_investments')
        .select('property_id, amount')
        .in('property_id', propertyIdsList.length > 0 ? propertyIdsList : ['00000000-0000-0000-0000-000000000000'])
        .gte('investment_date', startDate)
        .lte('investment_date', endDate);

      if (invError) throw invError;

      const propertyMap = new Map((properties || []).map(p => [p.id, p]));
      const userProfileMap = new Map((userProfiles || []).map(u => [u.user_id, u]));
      const cleanerProfileMap = new Map((cleanerProfiles || []).map(c => [c.user_id, c]));
      const investmentsMap = new Map<string, number>();
      (investments || []).forEach(inv => {
        const current = investmentsMap.get(inv.property_id) || 0;
        investmentsMap.set(inv.property_id, current + inv.amount);
      });

      // ---- CLEANER PAYMENTS ----
      const cleanerMap = new Map<string, CleanerPayment>();
      (allReservations || []).forEach(res => {
        if (!res.cleaner_user_id || !res.cleaning_fee) return;
        const prop = propertyMap.get(res.property_id);
        if (!prop && hasFilter) return;

        const cleanerId = res.cleaner_user_id;
        const userProfile = userProfileMap.get(cleanerId);
        const cleanerProfile = cleanerProfileMap.get(cleanerId);
        const cleanerName = userProfile?.full_name || userProfile?.email || 'Faxineira';

        if (!cleanerMap.has(cleanerId)) {
          cleanerMap.set(cleanerId, {
            cleanerId,
            cleanerName,
            phone: cleanerProfile?.phone || undefined,
            pix: cleanerProfile?.pix || undefined,
            cleanings: [],
            totalPaid: 0,
            totalPending: 0,
            totalNextCycle: 0,
            total: 0,
          });
        }

        const cleaner = cleanerMap.get(cleanerId)!;
        const statusNorm = getCleaningPaymentStatus(res.cleaning_payment_status);
        const fee = res.cleaning_fee || 0;

        // Get property name even when not filtered
        const propName = prop?.name || 'Propriedade';
        const propNickname = prop?.nickname || undefined;

        cleaner.cleanings.push({
          reservationId: res.id,
          date: res.check_out_date,
          propertyName: propName,
          propertyNickname: propNickname,
          fee,
          paymentStatus: statusNorm,
          platform: res.platform,
        });

        cleaner.total += fee;
        if (statusNorm === 'Pago') cleaner.totalPaid += fee;
        else if (statusNorm === 'Próximo Ciclo') cleaner.totalNextCycle += fee;
        else cleaner.totalPending += fee;
      });

      const cleanerPayments = Array.from(cleanerMap.values());
      cleanerPayments.forEach(c => c.cleanings.sort((a, b) => a.date.localeCompare(b.date)));

      // ---- OWNER PAYMENTS ----
      const ownerMap = new Map<string, OwnerPayment>();
      (allReservations || []).forEach(res => {
        const prop = propertyMap.get(res.property_id);
        if (!prop) return;

        const propId = res.property_id;
        if (!ownerMap.has(propId)) {
          ownerMap.set(propId, {
            propertyId: propId,
            propertyName: prop.name,
            nickname: prop.nickname || undefined,
            platformBreakdown: [],
            investments: investmentsMap.get(propId) || 0,
            totalOwner: 0,
            totalCommission: 0,
            totalToTransfer: 0,
          });
        }

        const owner = ownerMap.get(propId)!;
        const isReceived = isPlatformReceived(res.platform, res.check_in_date, res.payment_date);
        const commission = res.commission_amount || 0;
        const netRev = res.net_revenue || 0;
        const totalRev = res.total_revenue || 0;

        let platformEntry = owner.platformBreakdown.find(p => p.platform === res.platform);
        if (!platformEntry) {
          platformEntry = {
            platform: res.platform,
            totalRevenue: 0,
            commission: 0,
            netRevenue: 0,
            reservations: 0,
            status: isReceived ? 'received' : 'pending',
          };
          owner.platformBreakdown.push(platformEntry);
        }

        platformEntry.totalRevenue += totalRev;
        platformEntry.commission += commission;
        platformEntry.netRevenue += netRev;
        platformEntry.reservations += 1;

        owner.totalCommission += commission;
        owner.totalOwner += netRev;
      });

      ownerMap.forEach(owner => {
        owner.totalToTransfer = owner.totalOwner - owner.investments;
      });

      const ownerPayments = Array.from(ownerMap.values());

      // ---- SCHEDULE (Agenda de Recebimentos) ----
      const scheduleMap = new Map<string, ScheduleDay>();

      const allScheduleIds = new Set<string>();
      const allScheduleRes = [...(allReservations || []), ...(scheduleReservations || [])].filter(r => {
        if (allScheduleIds.has(r.id)) return false;
        allScheduleIds.add(r.id);
        return true;
      });

      allScheduleRes.forEach(res => {
        const prop = propertyMap.get(res.property_id);
        if (!prop) return;
        if (!res.payment_date) return;

        const payDate = res.payment_date;
        if (payDate < startDate || payDate > endDate) return;

        const isReceived = isPlatformReceived(res.platform, res.check_in_date, res.payment_date);
        const commissionAmt = res.commission_amount || 0;

        if (!scheduleMap.has(payDate)) {
          scheduleMap.set(payDate, { date: payDate, entries: [], dailyTotal: 0 });
        }

        const day = scheduleMap.get(payDate)!;
        day.entries.push({
          reservationId: res.id,
          propertyName: prop.name,
          propertyNickname: prop.nickname || undefined,
          platform: res.platform,
          amount: commissionAmt,
          type: 'commission',
          status: isReceived ? 'received' : 'pending',
          guestName: res.guest_name || undefined,
        });
        day.dailyTotal += commissionAmt;
      });

      const schedule = Array.from(scheduleMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      // ---- KPIs ----
      const totalCommissionReceived = schedule
        .flatMap(d => d.entries)
        .filter(e => e.status === 'received')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalCommissionPending = schedule
        .flatMap(d => d.entries)
        .filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalCleaningsPaid = cleanerPayments.reduce((sum, c) => sum + c.totalPaid, 0);
      const totalCleaningsPending = cleanerPayments.reduce((sum, c) => sum + c.totalPending, 0);
      const totalOwnerTransfer = ownerPayments.reduce((sum, o) => sum + Math.max(0, o.totalToTransfer), 0);
      const netBalance = totalCommissionReceived - totalCleaningsPaid - totalOwnerTransfer;

      setData({
        cleanerPayments,
        ownerPayments,
        schedule,
        kpis: {
          totalCommissionReceived,
          totalCommissionPending,
          totalCleaningsPaid,
          totalCleaningsPending,
          totalOwnerTransfer,
          netBalance,
        },
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Error fetching payments dashboard:', err);
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  return { ...data, refetch: fetchDashboardData };
};
