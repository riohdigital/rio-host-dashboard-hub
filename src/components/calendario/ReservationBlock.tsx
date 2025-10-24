import React from 'react';
import { CalendarReservation } from '@/types/calendar';
import { differenceInDays, format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, Home, Users, Clock, CreditCard } from 'lucide-react';

interface ReservationBlockProps {
  reservation: CalendarReservation;
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  onReservationClick: (reservation: CalendarReservation) => void;
  style?: React.CSSProperties;
  hasConflict?: boolean;
}

const getStatusColor = (status: string) => {
  const statusColors: Record<string, string> = {
    'Confirmada': 'bg-blue-500 text-white',
    'Em Andamento': 'bg-green-500 text-white',
    'Finalizada': 'bg-gray-500 text-white',
    'Cancelada': 'bg-red-500 text-white',
  };
  return statusColors[status] || 'bg-gray-400 text-white';
};

const getPaymentBorder = (status?: string) => {
  if (status === 'Pago') return 'border-2 border-yellow-400';
  if (status === 'Pendente') return 'border-2 border-dashed border-orange-400';
  return '';
};

const getPlatformColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'airbnb': return 'bg-pink-500 text-white';
    case 'booking': return 'bg-blue-600 text-white';
    default: return 'bg-gray-600 text-white';
  }
};

export const ReservationBlock = React.memo<ReservationBlockProps>(({
  reservation,
  startDate,
  endDate,
  dayWidth,
  onReservationClick,
  style,
  hasConflict = false,
}) => {
  const checkIn = new Date(reservation.check_in_date);
  const checkOut = new Date(reservation.check_out_date);
  
  const daysFromStart = differenceInDays(checkIn, startDate);
  const duration = differenceInDays(checkOut, checkIn);
  
  const position = {
    left: Math.max(0, daysFromStart * dayWidth),
    width: Math.max(dayWidth - 4, duration * dayWidth - 4),
  };

  const statusColor = getStatusColor(reservation.reservation_status);
  const paymentBorder = getPaymentBorder(reservation.payment_status);
  const platformColor = getPlatformColor(reservation.platform);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={() => onReservationClick(reservation)}
            className={cn(
              'absolute h-8 rounded cursor-pointer transition-all hover:z-10 hover:shadow-lg',
              'flex items-center px-2 text-xs font-medium',
              statusColor,
              paymentBorder,
              hasConflict && 'border-2 border-red-600 bg-red-50 dark:bg-red-900/20 animate-pulse'
            )}
            style={{
              left: `${position.left}px`,
              width: `${position.width}px`,
              ...style,
            }}
          >
            <span className="truncate flex-1">{reservation.reservation_code}</span>
            {hasConflict && (
              <AlertTriangle className="h-3 w-3 text-red-600 ml-1 flex-shrink-0" />
            )}
            <Badge
              variant="outline"
              className={cn('ml-1 px-1 py-0 h-4 text-[10px] flex-shrink-0', platformColor)}
            >
              {reservation.platform.substring(0, 1)}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-3">
          <div className="space-y-2">
            {hasConflict && (
              <div className="flex items-center gap-2 text-red-600 font-semibold text-xs mb-2 pb-2 border-b border-red-200">
                <AlertTriangle className="h-4 w-4" />
                <span>Conflito detectado!</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Home className="h-3 w-3 text-muted-foreground" />
              <p className="font-semibold text-sm">{reservation.reservation_code}</p>
            </div>
            
            {reservation.guest_name && (
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs">
                  {reservation.guest_name}
                  {reservation.number_of_guests && ` (${reservation.number_of_guests} hóspede${reservation.number_of_guests > 1 ? 's' : ''})`}
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs">
                {format(new Date(reservation.check_in_date), 'dd/MM/yyyy')} {reservation.checkin_time || '15:00'} -{' '}
                {format(new Date(reservation.check_out_date), 'dd/MM/yyyy')} {reservation.checkout_time || '11:00'}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-xs', platformColor)}>
                {reservation.platform}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {reservation.reservation_status}
              </Badge>
            </div>
            
            {reservation.payment_status && (
              <div className="flex items-center gap-2">
                <CreditCard className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs">Pagamento: {reservation.payment_status}</p>
              </div>
            )}
            
            {reservation.total_revenue && (
              <p className="text-xs font-semibold text-primary">
                R$ {reservation.total_revenue.toFixed(2)}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.reservation.id === nextProps.reservation.id &&
    prevProps.hasConflict === nextProps.hasConflict &&
    prevProps.dayWidth === nextProps.dayWidth &&
    prevProps.startDate.getTime() === nextProps.startDate.getTime() &&
    prevProps.endDate.getTime() === nextProps.endDate.getTime()
  );
});

ReservationBlock.displayName = 'ReservationBlock';
