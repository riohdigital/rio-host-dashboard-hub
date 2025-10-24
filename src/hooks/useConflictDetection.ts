import { useMemo } from 'react';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';

export interface Conflict {
  propertyId: string;
  propertyName: string;
  reservations: CalendarReservation[];
  conflictType: 'overlap' | 'gap_too_short';
  message: string;
}

export const useConflictDetection = (
  reservations: CalendarReservation[],
  properties: Property[]
) => {
  return useMemo(() => {
    const conflicts: Conflict[] = [];

    properties.forEach(property => {
      const propReservations = reservations
        .filter(
          r =>
            r.property_id === property.id &&
            r.reservation_status !== 'Cancelada'
        )
        .sort(
          (a, b) =>
            new Date(a.check_in_date).getTime() -
            new Date(b.check_in_date).getTime()
        );

      // Detectar sobreposições e gaps muito curtos
      for (let i = 0; i < propReservations.length - 1; i++) {
        const current = propReservations[i];
        const next = propReservations[i + 1];

        const currentCheckOut = new Date(current.check_out_date);
        const nextCheckIn = new Date(next.check_in_date);

        // Conflito de sobreposição
        if (currentCheckOut > nextCheckIn) {
          conflicts.push({
            propertyId: property.id,
            propertyName: property.nickname || property.name,
            reservations: [current, next],
            conflictType: 'overlap',
            message: `Sobreposição entre ${current.reservation_code} e ${next.reservation_code}`,
          });
        }
        // Gap muito curto (menos de 1 dia para limpeza)
        else {
          const gapHours =
            (nextCheckIn.getTime() - currentCheckOut.getTime()) /
            (1000 * 60 * 60);
          if (gapHours < 24) {
            conflicts.push({
              propertyId: property.id,
              propertyName: property.nickname || property.name,
              reservations: [current, next],
              conflictType: 'gap_too_short',
              message: `Gap de apenas ${Math.round(gapHours)}h entre ${current.reservation_code} e ${next.reservation_code}`,
            });
          }
        }
      }
    });

    return conflicts;
  }, [reservations, properties]);
};
