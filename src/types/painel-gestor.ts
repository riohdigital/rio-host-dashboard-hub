export interface GestorKPIs {
  totalCommission: number;
  avgCommission: number;
  totalReservations: number;
  totalRevenue: number;
  occupancyRate: number;
  pendingCleanings: number;
  completedCleanings: number;
}

export interface MonthlyCommission {
  month: string;
  year: number;
  commission: number;
  reservations: number;
  revenue: number;
}

export interface PropertyPerformance {
  propertyId: string;
  propertyName: string;
  nickname?: string;
  reservations: number;
  totalRevenue: number;
  commission: number;
  commissionRate: number;
  occupancyRate: number;
  completedCleanings: number;
  pendingCleanings: number;
}

export interface PlatformBreakdown {
  platform: string;
  commission: number;
  reservations: number;
  revenue: number;
}

export interface UpcomingEvent {
  id: string;
  type: 'check-in' | 'check-out';
  date: string;
  time?: string;
  guestName: string;
  propertyName: string;
  propertyNickname?: string;
  totalRevenue: number;
  commission: number;
  cleaningStatus: string;
  hasCleanerAssigned: boolean;
  platform: string;
  cleanerName?: string;
}

export interface CleaningRiskAlert {
  reservationId: string;
  propertyId: string;
  propertyName: string;
  propertyNickname?: string;
  checkoutDate: string;
  guestName: string;
  daysUntilCheckout: number;
}

export interface RecentActivity {
  id: string;
  type: 'new_reservation' | 'cleaning_completed' | 'payment_received' | 'reservation_updated';
  description: string;
  timestamp: string;
  propertyName?: string;
  amount?: number;
}

export interface CommissionDetail {
  id: string;
  propertyName: string;
  propertyNickname?: string;
  guestName: string;
  platform: string;
  checkoutDate: string;
  paymentDate: string;
  commissionAmount: number;
  netRevenue: number;
  status: 'received' | 'pending';
}

export interface CommissionSummary {
  totalReceived: number;
  totalPending: number;
  receivedCount: number;
  pendingCount: number;
  details: CommissionDetail[];
}

export interface GestorDashboardData {
  kpis: GestorKPIs;
  monthlyCommissions: MonthlyCommission[];
  propertyPerformance: PropertyPerformance[];
  platformBreakdown: PlatformBreakdown[];
  upcomingEvents: UpcomingEvent[];
  cleaningRiskAlerts: CleaningRiskAlert[];
  recentActivities: RecentActivity[];
  commissionDetails: CommissionSummary;
}
