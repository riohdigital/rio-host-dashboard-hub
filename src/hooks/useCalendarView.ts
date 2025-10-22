import { useState, useCallback, useMemo } from 'react';
import { CalendarView } from '@/types/calendar';
import { startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';

export const useCalendarView = () => {
  const [view, setView] = useState<CalendarView>('timeline');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [daysVisible, setDaysVisible] = useState(30);

  const dateRange = useMemo(() => {
    if (view === 'timeline') {
      // Timeline mostra N dias a partir da data atual
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return { start, end };
    } else {
      // Grid mostra o mês completo
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
      return { start, end };
    }
  }, [view, currentDate, daysVisible]);

  const goToNextPeriod = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const goToPreviousPeriod = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  return {
    view,
    setView,
    currentDate,
    setCurrentDate,
    daysVisible,
    setDaysVisible,
    dateRange,
    goToNextPeriod,
    goToPreviousPeriod,
    goToToday,
  };
};
