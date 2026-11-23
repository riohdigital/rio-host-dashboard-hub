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
  /** Largura total da faixa de dias (px) */
  larguraDias: number;
  onReservationClick: (reservation: CalendarReservation) => void;
  isEven: boolean;
}

export const PropertyRow: React.FC<PropertyRowProps> = ({
  propertyName,
  reservations,
  startDate,
  endDate,
  dayWidth,
  larguraDias,
  onReservationClick,
  isEven,
}) => (
  <div className={cn('flex border-b', isEven ? 'bg-card' : 'bg-gray-50')}>
    {/* Nome do imóvel: fixo à esquerda ao rolar de lado */}
    <div
      className={cn(
        'sticky left-0 z-10 flex w-[var(--coluna-imovel)] shrink-0 items-center border-r px-3 py-4 sm:px-4',
        isEven ? 'bg-card' : 'bg-gray-50',
      )}
    >
      <span className="line-clamp-2 text-sm font-medium text-foreground">{propertyName}</span>
    </div>

    {/* Faixa de dias com as reservas */}
    <div className="relative h-[72px]" style={{ width: `${larguraDias}px` }}>
      {reservations.map((reservation) => (
        <ReservationBlock
          key={reservation.id}
          reservation={reservation}
          startDate={startDate}
          endDate={endDate}
          dayWidth={dayWidth}
          onReservationClick={onReservationClick}
          style={{ top: '20px' }}
        />
      ))}
    </div>
  </div>
);
