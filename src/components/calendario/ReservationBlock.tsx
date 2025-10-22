import React from 'react';
import { CalendarReservation } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { formatDateSafe } from '@/lib/dateUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Home, User, CreditCard, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ReservationBlockProps {
  reservation: CalendarReservation;
  startDate: Date;
  dayWidth: number;
  onClick: () => void;
}

const getStatusColor = (status: string) => {
  const statusColors: Record<string, string> = {
    'Confirmada': 'bg-blue-500',
    'Em Andamento': 'bg-green-500',
    'Finalizada': 'bg-gray-500',
    'Cancelada': 'bg-red-500',
  };
  return statusColors[status] || 'bg-gray-400';
};

const getPaymentBorder = (status?: string) => {
  if (status === 'Pago') return 'border-2 border-yellow-400';
  if (status === 'Pendente') return 'border-2 border-dashed border-orange-400';
  return '';
};

const getPlatformIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'airbnb': return '🏠';
    case 'booking': return '📘';
    default: return '📋';
  }
};

const getPlatformColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'airbnb': return 'bg-pink-500';
    case 'booking': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
};

export const ReservationBlock: React.FC<ReservationBlockProps> = ({
  reservation,
  startDate,
  dayWidth,
  onClick,
}) => {
  // Calcular posição e largura do bloco
  const checkIn = new Date(reservation.check_in_date);
  const checkOut = new Date(reservation.check_out_date);
  
  const daysFromStart = Math.floor((checkIn.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  
  const left = daysFromStart * dayWidth;
  const width = duration * dayWidth - 4; // -4 para espaçamento

  const statusColor = getStatusColor(reservation.reservation_status);
  const paymentBorder = getPaymentBorder(reservation.payment_status);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={onClick}
            style={{
              left: `${left}px`,
              width: `${width}px`,
            }}
            className={cn(
              'absolute h-12 rounded-md cursor-pointer transition-all hover:z-10 hover:shadow-lg',
              statusColor,
              paymentBorder,
              'flex items-center gap-1.5 px-2 overflow-hidden'
            )}
          >
            {/* Ícone de plataforma */}
            <span className="text-base flex-shrink-0">{getPlatformIcon(reservation.platform)}</span>
            
            {/* Código e nome */}
            <span className="text-xs font-medium text-white truncate">
              {reservation.reservation_code}
              {reservation.guest_name && ` • ${reservation.guest_name}`}
            </span>
          </div>
        </TooltipTrigger>
        
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-2">
            {/* Cabeçalho */}
            <div className="border-b pb-2">
              <p className="font-bold text-base">{reservation.reservation_code}</p>
              <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
                <Home className="h-3.5 w-3.5" />
                {reservation.properties?.nickname || reservation.properties?.name}
              </p>
            </div>

            {/* Informações do hóspede */}
            <div className="space-y-1">
              <p className="text-sm flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium">Hóspede:</span> {reservation.guest_name || 'Sem nome'}
              </p>
              {reservation.number_of_guests && (
                <p className="text-sm text-muted-foreground ml-5">
                  {reservation.number_of_guests} {reservation.number_of_guests === 1 ? 'pessoa' : 'pessoas'}
                </p>
              )}
            </div>

            {/* Datas */}
            <div className="space-y-1">
              <p className="text-sm flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span className="font-medium">Check-in:</span> {format(new Date(reservation.check_in_date), 'dd/MM/yyyy')}
                {reservation.checkin_time && ` às ${reservation.checkin_time}`}
              </p>
              <p className="text-sm flex items-center gap-1.5 ml-5">
                <span className="font-medium">Check-out:</span> {format(new Date(reservation.check_out_date), 'dd/MM/yyyy')}
                {reservation.checkout_time && ` às ${reservation.checkout_time}`}
              </p>
            </div>

            {/* Status e plataforma */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', getPlatformColor(reservation.platform))} />
                <span className="text-xs">{reservation.platform}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{reservation.reservation_status}</span>
                {reservation.payment_status && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      {reservation.payment_status}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Receita */}
            {reservation.total_revenue && (
              <p className="text-sm font-semibold pt-2 border-t">
                Receita: {reservation.total_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
