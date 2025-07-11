
import { useMemo } from 'react';

export const useDateRange = (selectedPeriod: string) => {
  return useMemo(() => {
    const now = new Date();
    const monthsBack = parseInt(selectedPeriod, 10);
    
    // Primeiro dia do período (início do mês)
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
    
    // Data atual como fim do período
    const endDate = now;
    
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];
    
    return {
      startDate,
      endDate,
      startDateString,
      endDateString,
      totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    };
  }, [selectedPeriod]);
};

export const useCurrentYearRange = () => {
  return useMemo(() => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    
    return {
      currentYear,
      previousYear,
      currentYearStart: `${currentYear}-01-01`,
      currentYearEnd: `${currentYear}-12-31`,
      previousYearStart: `${previousYear}-01-01`,
      previousYearEnd: `${previousYear}-12-31`
    };
  }, []);
};
