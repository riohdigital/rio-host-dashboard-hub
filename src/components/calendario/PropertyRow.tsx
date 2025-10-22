import React from 'react';
import { CalendarReservation } from '@/types/calendar';
import { ReservationBlock } from './ReservationBlock';
import { cn } from '@/lib/utils';

interface PropertyRowProps {
  propertyId: string;
  propertyName: string;
  reservations: CalendarReservation[];
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  onReservationClick: (reservation: CalendarReservation) => void;
  isEven: boolean;
}

export const PropertyRow: React.FC<PropertyRowProps> = ({
  propertyId,
  propertyName,
  reservations,
  startDate,
  endDate,
  dayWidth,
  onReservationClick,
  isEven,
}) => {
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalWidth = totalDays * dayWidth;

  return (
    <div className={cn(
      'flex border-b hover:bg-muted/30 transition-colors',
      isEven && 'bg-muted/10'
    )}>
      {/* Nome da propriedade (fixo à esquerda) */}
      <div className="w-48 flex-shrink-0 border-r px-4 py-4 flex items-center">
        <span className="text-sm font-medium text-foreground truncate">
          {propertyName}
        </span>
      </div>

      {/* Timeline com reservas */}
      <div className="flex-1 relative overflow-x-auto" style={{ minHeight: '72px' }}>
        <div style={{ width: `${totalWidth}px`, position: 'relative', height: '72px' }}>
          {reservations.map((reservation) => (
            <ReservationBlock
              key={reservation.id}
              reservation={reservation}
              startDate={startDate}
              dayWidth={dayWidth}
              onClick={() => onReservationClick(reservation)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
