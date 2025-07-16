
export interface Property {
  id: string;
  name: string;
  nickname?: string;
  address?: string;
  property_type: string;
  status: string;
  airbnb_link?: string;
  booking_link?: string;
  commission_rate: number;
  cleaning_fee: number;
  base_nightly_price?: number;
  max_guests?: number;
  notes?: string;
  default_checkin_time?: string;
  default_checkout_time?: string;
  created_at: string;
}
