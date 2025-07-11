
import { useMemo } from 'react';

export const useDateRange = (selectedPeriod: string) => {
  return useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let periodType: 'past' | 'current' | 'future' = 'past';
    
    switch (selectedPeriod) {
      // Períodos Passados
      case 'last_month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = lastMonth;
        endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Último dia do mês passado
        periodType = 'past';
        break;
        
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = now;
        periodType = 'past';
        break;
        
      case 'last_6_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        endDate = now;
        periodType = 'past';
        break;
        
      case 'last_year':
        const lastYear = now.getFullYear() - 1;
        startDate = new Date(lastYear, 0, 1);
        endDate = new Date(lastYear, 11, 31);
        periodType = 'past';
        break;
        
      // Período Atual
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        periodType = 'current';
        break;
        
      case 'current_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        periodType = 'current';
        break;
        
      // Períodos Futuros
      case 'next_month':
        startDate = now;
        endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0); // Último dia do próximo mês
        periodType = 'future';
        break;
        
      case 'next_3_months':
        startDate = now;
        endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
        periodType = 'future';
        break;
        
      case 'next_6_months':
        startDate = now;
        endDate = new Date(now.getFullYear(), now.getMonth() + 6, 0);
        periodType = 'future';
        break;
        
      case 'next_12_months':
        startDate = now;
        endDate = new Date(now.getFullYear() + 1, now.getMonth(), 0);
        periodType = 'future';
        break;
        
      // Compatibilidade com períodos antigos (manter por enquanto)
      case '1':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = now;
        periodType = 'past';
        break;
        
      case '3':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = now;
        periodType = 'past';
        break;
        
      case '6':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        endDate = now;
        periodType = 'past';
        break;
        
      case '12':
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        periodType = 'current';
        break;
    }
    
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];
    
    return {
      startDate,
      endDate,
      startDateString,
      endDateString,
      periodType,
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
