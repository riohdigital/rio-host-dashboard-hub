
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
  created_at: string;
}
