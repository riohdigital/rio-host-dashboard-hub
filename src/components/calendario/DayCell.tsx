import React from 'react';
import { format, isToday } from 'date-fns';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DayCellProps {
  date: Date;
  reservations: CalendarReservation[];
  properties: Property[];
  isCurrentMonth: boolean;
  onReservationClick: (reservation: CalendarReservation) => void;
  onDayClick?: (date: Date) => void;
}

const getPlatformColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'airbnb': return 'bg-pink-500';
    case 'booking': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Confirmada': return 'bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300';
    case 'Em Andamento': return 'bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-300';
    case 'Finalizada': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    case 'Cancelada': return 'bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-300';
  }
};

export const DayCell: React.FC<DayCellProps> = ({
  date,
  reservations,
  properties,
  isCurrentMonth,
  onReservationClick,
  onDayClick,
}) => {
  const maxVisible = 3;
  const visibleReservations = reservations.slice(0, maxVisible);
  const hiddenCount = Math.max(0, reservations.length - maxVisible);

  return (
    <div
      className={cn(
        'min-h-[120px] p-2 transition-colors hover:bg-accent/50',
        !isCurrentMonth && 'opacity-40',
        isToday(date) && 'bg-accent/30'
      )}
      onClick={() => onDayClick?.(date)}
    >
      {/* Número do dia */}
      <div
        className={cn(
          'text-sm font-medium mb-1',
          isToday(date) && 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground'
        )}
      >
        {format(date, 'd')}
      </div>

      {/* Lista de reservas */}
      <div className="space-y-1">
        {visibleReservations.map((reservation) => {
          const property = properties.find(p => p.id === reservation.property_id);
          
          return (
            <TooltipProvider key={reservation.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded cursor-pointer truncate transition-all hover:shadow-md',
                      getStatusColor(reservation.reservation_status || 'Confirmada')
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReservationClick(reservation);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <div
                        className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          getPlatformColor(reservation.platform)
                        )}
                      />
                      <span className="truncate font-medium">
                        {property?.nickname || property?.name || 'Imóvel'}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-semibold">{reservation.reservation_code}</p>
                    <p className="text-xs">{property?.nickname || property?.name}</p>
                    <p className="text-xs">{reservation.guest_name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground">
                      {reservation.platform} • {reservation.reservation_status}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}

        {/* Mostrar mais reservas */}
        {hiddenCount > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left px-1.5 py-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                +{hiddenCount} mais
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {reservations.slice(maxVisible).map((reservation) => {
                  const property = properties.find(p => p.id === reservation.property_id);
                  return (
                    <div
                      key={reservation.id}
                      className={cn(
                        'text-xs px-2 py-1.5 rounded cursor-pointer',
                        getStatusColor(reservation.reservation_status || 'Confirmada')
                      )}
                      onClick={() => onReservationClick(reservation)}
                    >
                      <p className="font-medium">{reservation.reservation_code}</p>
                      <p className="text-xs opacity-80">{property?.nickname || property?.name}</p>
                      <p className="text-xs opacity-70">{reservation.guest_name || 'Sem nome'}</p>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};
