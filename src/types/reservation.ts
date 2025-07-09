
export interface Reservation {
  id: string;
  property_id: string;
  platform: string;
  reservation_code: string;
  guest_name?: string;
  number_of_guests?: number;
  check_in_date: string;
  check_out_date: string;
  total_revenue: number;
  base_revenue?: number;
  commission_amount?: number;
  net_revenue?: number;
  payment_status?: string;
  reservation_status: string;
  created_at: string;
}
