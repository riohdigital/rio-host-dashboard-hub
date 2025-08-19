export interface ReservationWithCleanerInfo {
  id: string;
  property_id: string;
  platform: string;
  reservation_code: string;
  guest_name?: string;
  guest_phone?: string;
  number_of_guests?: number;
  check_in_date: string;
  check_out_date: string;
  checkin_time?: string;
  checkout_time?: string;
  total_revenue: number;
  base_revenue?: number;
  commission_amount?: number;
  net_revenue?: number;
  payment_status?: string;
  reservation_status: string;
  is_communicated?: boolean;
  receipt_sent?: boolean;
  created_at: string;
  cleaner_user_id?: string | null;
  cleaning_payment_status?: string | null;
  cleaning_rating?: number | null;
  cleaning_notes?: string | null;
  cleaning_fee?: number | null;
  cleaning_allocation?: string | null;
  cleaning_status?: string | null;
  next_check_in_date?: string | null;
  next_checkin_time?: string | null;
  properties?: {
    id: string;
    name: string;
    address: string;
    default_checkin_time: string;
  };
  cleaner_info?: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  } | null;
}

export interface CleanerProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
}

export interface CleaningStats {
  totalCleanings: number;
  pendingCleanings: number;
  completedCleanings: number;
  availableCleanings: number;
}