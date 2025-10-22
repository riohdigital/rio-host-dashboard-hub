import { useMemo } from 'react';
import { differenceInDays, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';

export interface OccupancyStats {
  propertyId: string;
  propertyName: string;
  totalDays: number;
  occupiedDays: number;
  occupancyRate: number;
  totalRevenue: number;
  averageDailyRate: number;
  reservationCount: number;
}

export const useOccupancyStats = (
  properties: Property[],
  reservations: CalendarReservation[],
  startDate: Date,
  endDate: Date
): OccupancyStats[] => {
  return useMemo(() => {
    const totalDays = differenceInDays(endDate, startDate) + 1;
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    return properties.map(property => {
      const propertyReservations = reservations.filter(
        r => r.property_id === property.id && r.reservation_status !== 'Cancelada'
      );

      // Calcular dias ocupados (union de intervalos para evitar contagem duplicada)
      const occupiedDaysSet = new Set<string>();
      
      propertyReservations.forEach(reservation => {
        const checkIn = new Date(reservation.check_in_date);
        const checkOut = new Date(reservation.check_out_date);

        allDays.forEach(day => {
          if (isWithinInterval(day, { start: checkIn, end: checkOut }) && day < checkOut) {
            occupiedDaysSet.add(day.toISOString());
          }
        });
      });

      const occupiedDays = occupiedDaysSet.size;
      const totalRevenue = propertyReservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);

      return {
        propertyId: property.id,
        propertyName: property.nickname || property.name,
        totalDays,
        occupiedDays,
        occupancyRate: totalDays > 0 ? (occupiedDays / totalDays) * 100 : 0,
        totalRevenue,
        averageDailyRate: occupiedDays > 0 ? totalRevenue / occupiedDays : 0,
        reservationCount: propertyReservations.length,
      };
    });
  }, [properties, reservations, startDate, endDate]);
};
