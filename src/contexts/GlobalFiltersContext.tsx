
import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';

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

export const GlobalFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedProperties, setSelectedPropertiesState] = useState<string[]>(['todas']);
  const [selectedPeriod, setSelectedPeriodState] = useState('current_year');
  const [selectedPlatform, setSelectedPlatformState] = useState('all');
  const [customStartDate, setCustomStartDateState] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDateState] = useState<Date | undefined>(undefined);
  const stableSettersRef = useRef({ 
    setSelectedProperties: null as any, 
    setSelectedPeriod: null as any, 
    setSelectedPlatform: null as any,
    setCustomStartDate: null as any,
    setCustomEndDate: null as any
  });

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

  const setSelectedPlatform = useCallback((platform: string) => {
    setSelectedPlatformState(prev => prev === platform ? prev : platform);
  }, []);

  const setCustomStartDate = useCallback((date: Date | undefined) => {
    setCustomStartDateState(date);
  }, []);

  const setCustomEndDate = useCallback((date: Date | undefined) => {
    setCustomEndDateState(date);
  }, []);

  // Manter referências estáveis dos setters
  stableSettersRef.current.setSelectedProperties = setSelectedProperties;
  stableSettersRef.current.setSelectedPeriod = setSelectedPeriod;
  stableSettersRef.current.setSelectedPlatform = setSelectedPlatform;
  stableSettersRef.current.setCustomStartDate = setCustomStartDate;
  stableSettersRef.current.setCustomEndDate = setCustomEndDate;

  const value = useMemo(() => ({
    selectedProperties,
    selectedPeriod,
    selectedPlatform,
    customStartDate,
    customEndDate,
    setSelectedProperties: stableSettersRef.current.setSelectedProperties,
    setSelectedPeriod: stableSettersRef.current.setSelectedPeriod,
    setSelectedPlatform: stableSettersRef.current.setSelectedPlatform,
    setCustomStartDate: stableSettersRef.current.setCustomStartDate,
    setCustomEndDate: stableSettersRef.current.setCustomEndDate,
  }), [selectedProperties, selectedPeriod, selectedPlatform, customStartDate, customEndDate]);

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
