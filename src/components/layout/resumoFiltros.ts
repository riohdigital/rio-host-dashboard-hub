import { format } from 'date-fns';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';

const PERIODOS: Record<string, string> = {
  current_month: 'Mês atual',
  current_year: 'Ano atual',
  general: 'Todo o histórico',
  custom: 'Período personalizado',
  last_month: 'Mês passado',
  last_3_months: 'Últimos 3 meses',
  last_6_months: 'Últimos 6 meses',
  last_year: 'Ano passado',
  next_month: 'Próximo mês',
  next_3_months: 'Próximos 3 meses',
  next_6_months: 'Próximos 6 meses',
  next_12_months: 'Próximos 12 meses',
};

/** Resumo curto dos filtros globais, para a barra do celular */
export function useResumoFiltros() {
  const { selectedPeriod, selectedProperties, selectedPlatform, customStartDate, customEndDate } =
    useGlobalFilters();

  const periodo =
    selectedPeriod === 'custom' && customStartDate && customEndDate
      ? `${format(customStartDate, 'dd/MM')}–${format(customEndDate, 'dd/MM/yy')}`
      : PERIODOS[selectedPeriod] ?? 'Período';

  const imoveis = selectedProperties.includes('todas')
    ? 'Todos os imóveis'
    : selectedProperties.length === 1
      ? '1 imóvel'
      : `${selectedProperties.length} imóveis`;

  const plataforma = selectedPlatform === 'all' ? null : selectedPlatform;

  const alterado =
    selectedPeriod !== 'current_year' || !selectedProperties.includes('todas') || selectedPlatform !== 'all';

  return {
    periodo,
    imoveis,
    plataforma,
    alterado,
    texto: [periodo, imoveis, plataforma].filter(Boolean).join(' · '),
  };
}
