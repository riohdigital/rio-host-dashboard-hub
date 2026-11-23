import React, { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';
import { DateAxis } from './DateAxis';
import { PropertyRow } from './PropertyRow';

interface TimelineViewProps {
  reservations: CalendarReservation[];
  properties: Property[];
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  onReservationClick: (reservation: CalendarReservation) => void;
  datasEspeciais?: Map<string, string[]>;
}

/**
 * Linha do tempo: uma única área de rolagem (dias e imóveis rolam juntos de
 * lado; a coluna do imóvel fica fixa à esquerda e a régua de dias fixa no topo).
 */
export const TimelineView: React.FC<TimelineViewProps> = ({
  reservations,
  properties,
  startDate,
  endDate,
  dayWidth,
  onReservationClick,
  datasEspeciais,
}) => {
  // Agrupar reservas por propriedade
  const reservationsByProperty = useMemo(() => {
    const grouped: Record<string, CalendarReservation[]> = {};
    properties.forEach((property) => {
      grouped[property.id] = [];
    });
    reservations.forEach((reservation) => {
      if (reservation.property_id && grouped[reservation.property_id]) {
        grouped[reservation.property_id].push(reservation);
      }
    });
    return grouped;
  }, [reservations, properties]);

  if (properties.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Nenhuma propriedade encontrada
      </div>
    );
  }

  const totalDias = differenceInCalendarDays(endDate, startDate) + 1;
  const larguraDias = totalDias * dayWidth;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="max-h-[calc(100dvh-16rem)] min-h-[320px] overflow-auto overscroll-contain">
        <div style={{ width: `calc(var(--coluna-imovel) + ${larguraDias}px)` }} className="[--coluna-imovel:7rem] sm:[--coluna-imovel:12rem]">
          <DateAxis startDate={startDate} endDate={endDate} dayWidth={dayWidth} datasEspeciais={datasEspeciais} />
          {properties.map((property, index) => (
            <PropertyRow
              key={property.id}
              propertyId={property.id}
              propertyName={property.nickname || property.name}
              reservations={reservationsByProperty[property.id] || []}
              startDate={startDate}
              endDate={endDate}
              dayWidth={dayWidth}
              larguraDias={larguraDias}
              onReservationClick={onReservationClick}
              isEven={index % 2 === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
