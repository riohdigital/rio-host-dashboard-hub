import { useMemo } from 'react';
import { differenceInDays, format } from 'date-fns';
import { somarDias } from '@/components/pricing/ocupacao';
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
    // Datas em texto 'AAAA-MM-DD': comparar assim evita o fuso (new Date('AAAA-MM-DD') é meia-noite
    // em UTC, e no Brasil isso contava o dia do check-out como ocupado).
    const inicio = format(startDate, 'yyyy-MM-dd');
    const fim = format(endDate, 'yyyy-MM-dd');

    return properties.map(property => {
      const propertyReservations = reservations.filter(
        r => r.property_id === property.id && r.reservation_status !== 'Cancelada'
      );

      // Dias ocupados (união das noites, para não contar duas vezes): do check-in à véspera do check-out
      const occupiedDaysSet = new Set<string>();
      propertyReservations.forEach(reservation => {
        const checkOut = reservation.check_out_date.slice(0, 10);
        let dia = reservation.check_in_date.slice(0, 10);
        if (dia < inicio) dia = inicio;
        while (dia < checkOut && dia <= fim) {
          occupiedDaysSet.add(dia);
          dia = somarDias(dia, 1);
        }
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
