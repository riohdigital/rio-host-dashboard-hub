
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
  // Localização (E1 da esteira de precificação): encontrada pelo endereço ou digitada pelo usuário.
  city?: string | null;
  state_code?: string | null;
  state_name?: string | null;
  country_code?: string | null;
  geo_status?: 'ok' | 'nao_encontrado' | 'manual' | string | null;
  geo_source?: string | null;
  geo_address?: string | null;
  geo_checked_at?: string | null;
  // Precificação automática: ligada pelo usuário na página Precificação.
  pricing_activated_at?: string | null;
  pricing_activated_by?: string | null;
  default_checkin_time?: string;
  default_checkout_time?: string;
  created_at: string;
}
