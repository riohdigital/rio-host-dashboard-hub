import React from 'react';
import { CalendarReservation } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { formatDateSafe } from '@/lib/dateUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
              'flex items-center justify-start px-2 overflow-hidden'
            )}
          >
            <span className="text-xs font-medium text-white truncate">
              {reservation.reservation_code} - {reservation.guest_name || 'Sem nome'}
            </span>
          </div>
        </TooltipTrigger>
        
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{reservation.reservation_code}</p>
            <p className="text-sm">Hóspede: {reservation.guest_name || 'Não informado'}</p>
            <p className="text-sm">Check-in: {formatDateSafe(reservation.check_in_date)}</p>
            <p className="text-sm">Check-out: {formatDateSafe(reservation.check_out_date)}</p>
            <p className="text-sm">Status: {reservation.reservation_status}</p>
            <p className="text-sm">Pagamento: {reservation.payment_status || 'Não informado'}</p>
            {reservation.total_revenue && (
              <p className="text-sm">Receita: R$ {reservation.total_revenue.toFixed(2)}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
