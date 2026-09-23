export type AlertType = 'underpricing_event' | 'orphan_night' | 'vacancy_risk' | 'competitor_drop';
export type AlertUrgency = 'Crítica' | 'Alta' | 'Média';
export type AlertStatus = 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Expirado';
export type DemandImpact = 'Crítico' | 'Alto' | 'Moderado';

export interface PricingAlert {
  id: string;
  property_id: string;
  property_name?: string;
  alert_type: AlertType;
  target_start_date: string;
  target_end_date: string;
  event_id?: string | null;
  current_price?: number;
  suggested_price?: number;
  suggested_min_nights?: number;
  estimated_revenue_gain?: number;
  reason: string;
  rationale?: string | null;
  supporting_data?: Record<string, any> | null;
  urgency: AlertUrgency;
  status: AlertStatus;
  action_taken?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface LocalEvent {
  id: string;
  name: string;
  city: string;
  neighborhood?: string | null;
  start_date: string;
  end_date: string;
  category: string;
  demand_impact: DemandImpact;
  recommended_min_nights?: number;
  recommended_price_multiplier?: number;
  notes?: string | null;
  created_at: string;
}

export interface PropertyPricingKPIs {
  pendingAlertsCount: number;
  criticalAlertsCount: number;
  estimatedRevenueGain: number;
  orphanGapsCount: number;
  upcomingEventsCount: number;
  activeReservationsCount: number;
}

export interface CompetitorListing {
  id: string;
  property_id: string;
  name: string;
  platform: 'airbnb' | 'booking' | 'vrbo';
  external_listing_id?: string | null;
  listing_url: string;
  neighborhood?: string | null;
  property_type?: string | null;
  bedrooms?: number;
  bathrooms?: number;
  max_guests?: number;
  has_sea_view?: boolean;
  amenities?: string[];
  current_rating?: number;
  reviews_count?: number;
  status: 'Ativo' | 'Pausado' | 'Inativo';
  created_at: string;
  latest_price?: number | null;
  average_price?: number | null;
}

export interface CompetitorPriceSnapshot {
  id: string;
  competitor_listing_id: string;
  snapshot_date: string;
  target_date: string;
  daily_price?: number | null;
  is_available: boolean;
  min_nights?: number;
  raw_payload?: Record<string, any> | null;
  created_at: string;
}

export interface PropertyCalendarPrice {
  id: string;
  property_id: string;
  date: string;
  platform: string;
  price_per_night: number;
  min_nights: number;
  is_available: boolean;
  is_blocked: boolean;
  last_scraped_at: string;
  created_at: string;
}

