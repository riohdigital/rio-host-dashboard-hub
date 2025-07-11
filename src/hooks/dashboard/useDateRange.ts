import { useMemo } from 'react';

export const useDateRange = (selectedPeriod: string) => {
  return useMemo(() => {
    const now = new Date();
    // Normaliza a data para evitar problemas de fuso horário nos cálculos
    now.setHours(0, 0, 0, 0);
    
    let startDate: Date;
    let endDate: Date;
    let periodType: 'past' | 'current' | 'future' = 'past';
    
    switch (selectedPeriod) {
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_6_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_year':
        const lastYear = now.getFullYear() - 1;
        startDate = new Date(lastYear, 0, 1);
        endDate = new Date(lastYear, 11, 31);
        break;
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        periodType = 'current';
        break;
      case 'current_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        periodType = 'current';
        break;
      case 'next_month':
        startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        periodType = 'future';
        break;
      case 'next_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 4, 0);
        periodType = 'future';
        break;
      case 'next_6_months':
        startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 7, 0);
        periodType = 'future';
        break;
      case 'next_12_months':
        startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        endDate = new Date(now.getFullYear() + 1, now.getMonth() + 1, 0);
        periodType = 'future';
        break;
      default: // Fallback para "Ano Atual"
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        periodType = 'current';
        break;
    }
    
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return { startDate, endDate, startDateString, endDateString, periodType, totalDays };
  }, [selectedPeriod]);
};
