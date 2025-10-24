import { Reservation } from './reservation';
import { Property } from './property';

export type CalendarView = 'timeline' | 'grid' | 'property' | 'comparison';

export interface CalendarReservation extends Reservation {
  properties?: {
    id: string;
    name: string;
    nickname: string;
    address: string;
  };
  position?: {
    left: number;
    width: number;
  };
}

export interface OccupancyStats {
  propertyId: string;
  propertyName: string;
  totalDays: number;
  occupiedDays: number;
  occupancyRate: number;
  totalRevenue: number;
  averageDailyRate: number;
}

export interface CalendarFilters {
  startDate: Date;
  endDate: Date;
  propertyIds: string[];
  platform?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface Conflict {
  propertyId: string;
  propertyName: string;
  reservations: CalendarReservation[];
  conflictType: 'overlap' | 'gap_too_short';
  message: string;
}
