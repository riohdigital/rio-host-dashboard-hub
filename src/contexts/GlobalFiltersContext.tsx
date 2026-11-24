
import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

interface GlobalFiltersContextType {
  selectedProperties: string[];
  selectedPeriod: string;
  selectedPlatform: string;
  customStartDate?: Date;
  customEndDate?: Date;
  setSelectedProperties: (properties: string[]) => void;
  setSelectedPeriod: (period: string) => void;
  setSelectedPlatform: (platform: string) => void;
  setCustomStartDate: (date: Date | undefined) => void;
  setCustomEndDate: (date: Date | undefined) => void;
}

const GlobalFiltersContext = createContext<GlobalFiltersContextType | undefined>(undefined);

/** Períodos e plataformas que o filtro oferece (um valor guardado fora daqui é ignorado). */
const PERIODOS_DO_FILTRO = [
  'current_month', 'current_year', 'general', 'custom',
  'last_month', 'last_3_months', 'last_6_months', 'last_year',
  'next_month', 'next_3_months', 'next_6_months', 'next_12_months',
] as const;
const PLATAFORMAS_DO_FILTRO = ['all', 'Airbnb', 'Booking.com', 'Direto', 'VRBO', 'Hospedagem.com'] as const;

const IMOVEIS_PADRAO = ['todas'];
const listaDeImoveis = (v: unknown) =>
  Array.isArray(v) && v.length > 0 && v.every((id) => typeof id === 'string' && id.length > 0);
const dataGuardada = (v: unknown) => v === null || (typeof v === 'string' && !Number.isNaN(new Date(v).getTime()));

/**
 * Filtros globais (imóveis, período, plataforma e datas personalizadas).
 * Ficam guardados no aparelho (`localStorage`), numa chave com o id do
 * usuário: voltam ao recarregar a página e ao reabrir o app, e nunca passam
 * de uma conta para outra. As datas são gravadas em ISO e lidas como `Date`.
 * Imóvel guardado que não existe mais (ou perdeu o acesso) é retirado pelo
 * GlobalFilters, que conhece a lista de imóveis do usuário.
 */
export const GlobalFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedProperties, setSelectedPropertiesState] = useEstadoPersistente<string[]>('filtros.imoveis', IMOVEIS_PADRAO, {
    onde: 'aparelho',
    aceita: listaDeImoveis,
  });
  const [selectedPeriod, setSelectedPeriod] = useEstadoPersistente<string>('filtros.periodo', 'current_year', {
    onde: 'aparelho',
    aceita: PERIODOS_DO_FILTRO,
  });
  const [selectedPlatform, setSelectedPlatform] = useEstadoPersistente<string>('filtros.plataforma', 'all', {
    onde: 'aparelho',
    aceita: PLATAFORMAS_DO_FILTRO,
  });
  const [inicioISO, setInicioISO] = useEstadoPersistente<string | null>('filtros.inicio', null, { onde: 'aparelho', aceita: dataGuardada });
  const [fimISO, setFimISO] = useEstadoPersistente<string | null>('filtros.fim', null, { onde: 'aparelho', aceita: dataGuardada });

  const customStartDate = useMemo(() => (inicioISO ? new Date(inicioISO) : undefined), [inicioISO]);
  const customEndDate = useMemo(() => (fimISO ? new Date(fimISO) : undefined), [fimISO]);

  const setSelectedProperties = useCallback(
    (properties: string[]) => {
      // Evitar atualizações desnecessárias
      setSelectedPropertiesState((prev) => (JSON.stringify(prev) === JSON.stringify(properties) ? prev : properties));
    },
    [setSelectedPropertiesState],
  );

  const setCustomStartDate = useCallback(
    (date: Date | undefined) => setInicioISO(date && !Number.isNaN(date.getTime()) ? date.toISOString() : null),
    [setInicioISO],
  );
  const setCustomEndDate = useCallback(
    (date: Date | undefined) => setFimISO(date && !Number.isNaN(date.getTime()) ? date.toISOString() : null),
    [setFimISO],
  );

  const value = useMemo(
    () => ({
      selectedProperties,
      selectedPeriod,
      selectedPlatform,
      customStartDate,
      customEndDate,
      setSelectedProperties,
      setSelectedPeriod,
      setSelectedPlatform,
      setCustomStartDate,
      setCustomEndDate,
    }),
    [
      selectedProperties, selectedPeriod, selectedPlatform, customStartDate, customEndDate,
      setSelectedProperties, setSelectedPeriod, setSelectedPlatform, setCustomStartDate, setCustomEndDate,
    ],
  );

  return (
    <GlobalFiltersContext.Provider value={value}>
      {children}
    </GlobalFiltersContext.Provider>
  );
};

export const useGlobalFilters = () => {
  const context = useContext(GlobalFiltersContext);
  if (context === undefined) {
    throw new Error('useGlobalFilters must be used within a GlobalFiltersProvider');
  }
  return context;
};
