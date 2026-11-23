import React from 'react';
import { eachDayOfInterval, startOfWeek, endOfWeek, format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayCell } from './DayCell';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';

interface GridViewProps {
  reservations: CalendarReservation[];
  properties: Property[];
  startDate: Date;
  endDate: Date;
  onReservationClick: (reservation: CalendarReservation) => void;
  onDayClick?: (date: Date) => void;
}

export const GridView: React.FC<GridViewProps> = ({
  reservations,
  properties,
  startDate,
  endDate,
  onReservationClick,
  onDayClick,
}) => {
  // Obter todos os dias do intervalo incluindo semanas completas
  const calendarStart = startOfWeek(startDate, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(endDate, { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Agrupar dias em semanas
  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  // Função para obter reservas de um dia específico
  const getReservationsForDay = (day: Date): CalendarReservation[] => {
    return reservations.filter(r => {
      const checkIn = new Date(r.check_in_date);
      const checkOut = new Date(r.check_out_date);
      return day >= checkIn && day < checkOut && r.reservation_status !== 'Cancelada';
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Header com dias da semana */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
          <div
            key={day}
            className="p-2 text-center text-xs font-semibold text-muted-foreground sm:p-3 sm:text-sm"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="divide-y">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 divide-x [&>*]:min-w-0">
            {week.map((day) => {
              const dayReservations = getReservationsForDay(day);
              const isCurrentMonth = isSameMonth(day, startDate);

              return (
                <DayCell
                  key={day.toISOString()}
                  date={day}
                  reservations={dayReservations}
                  properties={properties}
                  isCurrentMonth={isCurrentMonth}
                  onReservationClick={onReservationClick}
                  onDayClick={onDayClick}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
