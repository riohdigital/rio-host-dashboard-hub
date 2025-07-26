
import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';

interface GlobalFiltersContextType {
  selectedProperties: string[];
  selectedPeriod: string;
  setSelectedProperties: (properties: string[]) => void;
  setSelectedPeriod: (period: string) => void;
}

const GlobalFiltersContext = createContext<GlobalFiltersContextType | undefined>(undefined);

export const GlobalFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedProperties, setSelectedPropertiesState] = useState<string[]>(['todas']);
  const [selectedPeriod, setSelectedPeriodState] = useState('current_year');
  const stableSettersRef = useRef({ setSelectedProperties: null as any, setSelectedPeriod: null as any });

  const setSelectedProperties = useCallback((properties: string[]) => {
    // Evitar atualizações desnecessárias
    setSelectedPropertiesState(prev => {
      if (JSON.stringify(prev) === JSON.stringify(properties)) {
        return prev;
      }
      return properties;
    });
  }, []);

  const setSelectedPeriod = useCallback((period: string) => {
    setSelectedPeriodState(prev => prev === period ? prev : period);
  }, []);

  // Manter referências estáveis dos setters
  stableSettersRef.current.setSelectedProperties = setSelectedProperties;
  stableSettersRef.current.setSelectedPeriod = setSelectedPeriod;

  const value = useMemo(() => ({
    selectedProperties,
    selectedPeriod,
    setSelectedProperties: stableSettersRef.current.setSelectedProperties,
    setSelectedPeriod: stableSettersRef.current.setSelectedPeriod,
  }), [selectedProperties, selectedPeriod]);

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
