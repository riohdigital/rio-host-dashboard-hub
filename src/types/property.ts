
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
  amenities?: string[];
  high_demand_events?: Array<{
    event_name: string;
    category?: string;
    period_description?: string;
    target_dates?: string;
    demand_impact?: string;
    recommended_multiplier?: number;
    recommended_min_nights?: number;
    notes?: string;
  }>;
  default_checkin_time?: string;
  default_checkout_time?: string;
  created_at: string;
}
