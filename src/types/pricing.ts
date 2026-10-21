export type AlertType = 'underpricing_event' | 'overpricing_event' | 'orphan_night' | 'vacancy_risk' | 'competitor_drop';
export type AlertUrgency = 'Crítica' | 'Alta' | 'Média' | 'Baixa';
export type AlertStatus = 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Expirado' | 'Resolvido';
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
  supporting_data?: AlertSupportingData | null;
  urgency: AlertUrgency;
  status: AlertStatus;
  action_taken?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

/** Evidências que o radar grava em cada alerta (todas com origem comprovada). */
export interface AlertSupportingData {
  fonte_diaria_atual?: 'calendario_coletado' | 'diaria_base_cadastro' | string;
  diaria_base?: number;
  regra_tipo?: string;
  regra_fator?: number;
  regra_origem?: 'historico' | 'mercado' | 'manual' | string;
  regra_amostras?: number;
  preco_pela_regra?: number;
  confianca?: 'alta' | 'média' | string;
  fonte_evento?: string | null;
  escopo_evento?: string | null;
  compset_median?: number | null;
  compset_amostras?: number;
  noites_periodo?: number;
  dias_ate_evento?: number;
  mediana_comum_vendida?: number | null;
  base_desatualizada?: boolean;
  noites_lacuna?: number;
  // Alertas "acima do mercado" (só com concorrentes reais coletados).
  price_diff_pct?: number;
  calculation_formula?: string;
  market_evidence?: string;
  risk_analysis?: string;
}

export interface LocalEvent {
  id: string;
  name: string;
  /** Escopo do evento: cidade, estado (region_code, ex. BR-RJ) ou país (country_code). */
  city: string | null;
  region_code?: string | null;
  country_code?: string | null;
  /** Origem comprovada (ex.: 'nager' para feriados oficiais) e endereço da fonte. */
  source?: string | null;
  source_url?: string | null;
  is_active?: boolean;
  is_confirmed?: boolean;
  neighborhood?: string | null;
  start_date: string;
  end_date: string;
  category: string;
  demand_impact: DemandImpact;
  recommended_min_nights?: number;
  /** Não é usado: o quanto subir vem da regra aprendida de cada imóvel (PricingRule). */
  recommended_price_multiplier?: number | null;
  notes?: string | null;
  created_at: string;
}

export type TipoDeData = 'feriado_prolongado' | 'feriado' | 'fim_de_semana' | 'evento_critico' | 'evento_alto';

/** Regra vigente do imóvel (view property_pricing_rules_vigentes): manual > mercado > histórico. */
export interface PricingRule {
  property_id: string;
  tipo_data: TipoDeData | string;
  fator: number;
  origem: 'manual' | 'mercado' | 'historico' | string;
  amostras: number | null;
  detalhe: Record<string, unknown> | null;
  updated_at: string | null;
}

export type EtapaStatus = 'pendente' | 'rodando' | 'ok' | 'bloqueado' | 'falhou';

/** Uma etapa da esteira de precificação de um imóvel (tabela property_pipeline). */
export interface PipelineStage {
  property_id: string;
  etapa: string;
  status: EtapaStatus | string;
  motivo: string | null;
  tentativas: number | null;
  proxima_tentativa_em: string | null;
  ultima_ok_em: string | null;
  dados_ate: string | null;
  detalhe: Record<string, unknown> | null;
  updated_at: string | null;
}

export interface PropertyPricingKPIs {
  pendingAlertsCount: number;
  pendingUnderpricingCount?: number;
  pendingOverpricingCount?: number;
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
  raw_payload?: Record<string, unknown> | null;
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

