
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

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

  const setSelectedProperties = useCallback((properties: string[]) => {
    setSelectedPropertiesState(properties);
  }, []);

  const setSelectedPeriod = useCallback((period: string) => {
    setSelectedPeriodState(period);
  }, []);

  const value = useMemo(() => ({
    selectedProperties,
    selectedPeriod,
    setSelectedProperties,
    setSelectedPeriod,
  }), [selectedProperties, selectedPeriod, setSelectedProperties, setSelectedPeriod]);

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
