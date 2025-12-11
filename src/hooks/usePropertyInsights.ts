import { useState, useEffect, useMemo } from 'react';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';

export interface PropertyInsight {
  id: string;
  propertyId: string;
  propertyName: string;
  targetMonth: string;
  createdAt: string;
  occupancyRate: number;
  sentiment: 'positive' | 'warning' | 'critical';
  summary: string;
  strengths: string[];
  weaknesses: string[];
  actionPlan: string[];
}

// Mock data for demonstration - will be replaced with Supabase query
const mockInsights: PropertyInsight[] = [
  {
    id: '1',
    propertyId: 'prop-1',
    propertyName: 'Studio Centro',
    targetMonth: '2025-01',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    occupancyRate: 78,
    sentiment: 'positive',
    summary: 'Excelente desempenho! Ocupação 15% acima da média do mercado. ADR competitivo com potencial de aumento.',
    strengths: [
      'Alta ocupação nos finais de semana (95%)',
      'ADR subiu 12% comparado ao mês anterior',
      'Nenhum cancelamento registrado'
    ],
    weaknesses: [
      'Terças e quartas com ocupação baixa (40%)',
      'Gap de 5 dias sem reservas (15-20)'
    ],
    actionPlan: [
      'Criar promoção "Mid-week Special" com 15% de desconto para Ter-Qua',
      'Reduzir estadia mínima para 1 noite nos dias 15-20',
      'Aumentar diária em 8% para reservas de última hora no fim de semana'
    ]
  },
  {
    id: '2',
    propertyId: 'prop-2',
    propertyName: 'Apartamento Praia',
    targetMonth: '2025-01',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    occupancyRate: 45,
    sentiment: 'warning',
    summary: 'Ocupação abaixo do esperado para alta temporada. Ação imediata recomendada para evitar perda de receita.',
    strengths: [
      'Avaliações excelentes (4.9 estrelas)',
      'Preço competitivo para a região'
    ],
    weaknesses: [
      'Ocupação 30% abaixo do esperado',
      '12 dias livres na segunda quinzena',
      'Booking window muito curto (média 3 dias)'
    ],
    actionPlan: [
      'Ativar promoção relâmpago de 20% para reservas nos próximos 7 dias',
      'Verificar posicionamento nas plataformas (fotos, descrição)',
      'Considerar parceria com empresas locais para estadias corporativas'
    ]
  },
  {
    id: '3',
    propertyId: 'prop-3',
    propertyName: 'Cobertura Luxo',
    targetMonth: '2025-01',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    occupancyRate: 25,
    sentiment: 'critical',
    summary: 'Situação crítica! Apenas 25% de ocupação com alta temporada. Intervenção urgente necessária.',
    strengths: [
      'Imóvel premium com alto potencial de ADR'
    ],
    weaknesses: [
      'Ocupação crítica de apenas 25%',
      '20 dias consecutivos sem reservas',
      'Nenhuma reserva confirmada para o próximo mês'
    ],
    actionPlan: [
      'URGENTE: Reduzir diária em 25% imediatamente',
      'Remover restrição de mínimo de noites',
      'Atualizar fotos e descrição do anúncio',
      'Considerar oferta de early check-in/late checkout gratuito'
    ]
  }
];

export function usePropertyInsights() {
  const { selectedProperties } = useGlobalFilters();
  const [loading, setLoading] = useState(false);
  const [activePropertyIndex, setActivePropertyIndex] = useState(0);

  // Simulate fetching insights based on selected properties
  const insights = useMemo(() => {
    if (selectedProperties.length === 0) {
      return mockInsights;
    }
    
    // In real implementation, filter by actual property IDs
    // For now, return mock data mapped to selected properties
    return selectedProperties.slice(0, 3).map((propId, index) => ({
      ...mockInsights[index % mockInsights.length],
      propertyId: propId,
      propertyName: `Propriedade ${index + 1}`
    }));
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
    hasMultipleProperties: insights.length > 1
  };
}
