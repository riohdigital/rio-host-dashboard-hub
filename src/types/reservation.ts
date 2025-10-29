
export interface Reservation {
  id: string;
  property_id: string;
  platform: string;
  reservation_code: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  number_of_guests?: number;
  check_in_date: string;
  check_out_date: string;
  checkin_time?: string;
  checkout_time?: string;
  payment_date?: string;
  total_revenue: number;
  base_revenue?: number;
  commission_amount?: number;
  net_revenue?: number;
  payment_status?: string;
  reservation_status: string;
  is_communicated?: boolean;
  receipt_sent?: boolean;
  created_at: string;
  // Campos de rastreamento de criação
  created_by?: string | null;
  created_by_source?: string;
  automation_metadata?: any;
  // Campos relacionados à faxina
  cleaner_user_id?: string | null;
  cleaning_payment_status?: string | null;
  cleaning_rating?: number | null;
  cleaning_notes?: string | null;
  cleaning_fee?: number | null;
  cleaning_allocation?: string | null;
}

