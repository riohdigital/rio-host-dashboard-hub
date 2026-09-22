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
