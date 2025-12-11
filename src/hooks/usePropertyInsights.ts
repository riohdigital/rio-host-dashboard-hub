import { useState, useEffect, useMemo } from 'react';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { supabase } from '@/integrations/supabase/client';

// Interface alinhada com output do n8n
export interface ActionPlanItem {
  title: string;
  description: string;
  expected_impact: string;
}

export interface PropertyMetrics {
  kpiPast: {
    totalNetRevenue: number;
    occupancyRate: number;
    adr: number;
    revPar: number;
    avgLeadTime: number;
    salesVelocity: string;
    hhi: string;
    mixText: string;
    totalReservations: number;
  };
  kpiCurrent: {
    totalNetRevenue: number;
    occupancyRate: number;
    adr: number;
    revPar: number;
    avgLeadTime: number;
    salesVelocity: string;
    hhi: string;
    mixText: string;
    totalReservations: number;
  };
  kpiFuture: {
    totalNetRevenue: number;
    occupancyRate: number;
    adr: number;
    revPar: number;
    avgLeadTime: number;
    salesVelocity: string;
    hhi: string;
    mixText: string;
    totalReservations: number;
  };
}

export interface AIAnalysis {
  summary: string;
  sentiment: 'positive' | 'warning' | 'critical';
  diagnosis: string;
  opportunity_alert: string;
  strengths?: string[];
  weaknesses?: string[];
  action_plan: ActionPlanItem[];
}

export interface PropertyInsight {
  id: string;
  property_id: string;
  property_name: string;
  target_period: string;
  created_at: string;
  metrics: PropertyMetrics;
  ai_analysis: AIAnalysis;
  is_latest: boolean;
  // Computed/derived fields for easy access
  sentiment: 'positive' | 'warning' | 'critical';
  summary: string;
  diagnosis: string;
  opportunity_alert: string;
  strengths: string[];
  weaknesses: string[];
  actionPlan: ActionPlanItem[];
  occupancyRate: number;
}

interface SupabaseInsightRow {
  id: string;
  property_id: string;
  target_period: string;
  created_at: string;
  metrics: PropertyMetrics;
  ai_analysis: AIAnalysis;
  is_latest: boolean;
}

export function usePropertyInsights() {
  const { selectedProperties } = useGlobalFilters();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<PropertyInsight[]>([]);
  const [activePropertyIndex, setActivePropertyIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      setError(null);

      try {
        // Build query for latest insights
        let query = supabase
          .from('property_insights')
          .select(`
            id,
            property_id,
            target_period,
            created_at,
            metrics,
            ai_analysis,
            is_latest
          `)
          .eq('is_latest', true)
          .order('created_at', { ascending: false });

        // Filter by selected properties if any
        if (selectedProperties.length > 0) {
          query = query.in('property_id', selectedProperties);
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          console.error('Error fetching insights:', queryError);
          setError(queryError.message);
          setInsights([]);
          return;
        }

        if (!data || data.length === 0) {
          setInsights([]);
          return;
        }

        // Fetch property names
        const propertyIds = [...new Set(data.map(d => d.property_id))];
        const { data: propertiesData } = await supabase
          .from('properties')
          .select('id, name, nickname')
          .in('id', propertyIds);

        const propertyMap = new Map(
          propertiesData?.map(p => [p.id, p.nickname || p.name]) || []
        );

        // Transform Supabase data to PropertyInsight format
        const transformedInsights: PropertyInsight[] = data.map(row => {
          const aiAnalysis = row.ai_analysis as unknown as AIAnalysis;
          const metrics = row.metrics as unknown as PropertyMetrics;

          return {
            id: row.id,
            property_id: row.property_id,
            property_name: propertyMap.get(row.property_id) || 'Propriedade',
            target_period: row.target_period,
            created_at: row.created_at,
            metrics,
            ai_analysis: aiAnalysis,
            is_latest: row.is_latest,
            // Derived fields for easy component access
            sentiment: aiAnalysis.sentiment,
            summary: aiAnalysis.summary,
            diagnosis: aiAnalysis.diagnosis,
            opportunity_alert: aiAnalysis.opportunity_alert,
            strengths: aiAnalysis.strengths || [],
            weaknesses: aiAnalysis.weaknesses || [],
            actionPlan: aiAnalysis.action_plan || [],
            occupancyRate: metrics?.kpiFuture?.occupancyRate || 0
          };
        });

        setInsights(transformedInsights);
      } catch (err) {
        console.error('Unexpected error fetching insights:', err);
        setError('Erro ao carregar insights');
        setInsights([]);
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, [selectedProperties]);

  const currentInsight = insights[activePropertyIndex] || null;

  const goToProperty = (index: number) => {
    if (index >= 0 && index < insights.length) {
      setActivePropertyIndex(index);
    }
  };

  // Reset to first property when selection changes
  useEffect(() => {
    setActivePropertyIndex(0);
  }, [selectedProperties]);

  return {
    insights,
    currentInsight,
    activePropertyIndex,
    goToProperty,
    loading,
    error,
    hasMultipleProperties: insights.length > 1
  };
}
