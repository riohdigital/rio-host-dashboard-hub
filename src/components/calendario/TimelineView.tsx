import React, { useMemo } from 'react';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';
import { DateAxis } from './DateAxis';
import { PropertyRow } from './PropertyRow';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TimelineViewProps {
  reservations: CalendarReservation[];
  properties: Property[];
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  onReservationClick: (reservation: CalendarReservation) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  reservations,
  properties,
  startDate,
  endDate,
  dayWidth,
  onReservationClick,
}) => {
  // Agrupar reservas por propriedade
  const reservationsByProperty = useMemo(() => {
    const grouped: Record<string, CalendarReservation[]> = {};
    
    properties.forEach(property => {
      grouped[property.id] = [];
    });

    reservations.forEach(reservation => {
      if (reservation.property_id && grouped[reservation.property_id]) {
        grouped[reservation.property_id].push(reservation);
      }
    });

    return grouped;
  }, [reservations, properties]);

  if (properties.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhuma propriedade encontrada
      </div>
    );
  }

  // Calcular altura dinâmica baseada no número de propriedades
  const scrollHeight = Math.min(
    Math.max(400, properties.length * 72 + 100),
    window.innerHeight - 400
  );

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <DateAxis startDate={startDate} endDate={endDate} dayWidth={dayWidth} />
      
      <ScrollArea style={{ height: `${scrollHeight}px` }}>
        <div>
          {properties.map((property, index) => (
            <PropertyRow
              key={property.id}
              propertyId={property.id}
              propertyName={property.nickname || property.name}
              reservations={reservationsByProperty[property.id] || []}
              startDate={startDate}
              endDate={endDate}
              dayWidth={dayWidth}
              onReservationClick={onReservationClick}
              isEven={index % 2 === 0}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
