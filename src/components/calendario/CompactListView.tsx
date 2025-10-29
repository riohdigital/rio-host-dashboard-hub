import { useMemo } from 'react';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CalendarDays, DollarSign } from 'lucide-react';

interface CompactListViewProps {
  reservations: CalendarReservation[];
  properties: Property[];
  startDate: Date;
  endDate: Date;
  onReservationClick: (reservation: CalendarReservation) => void;
}

export const CompactListView = ({
  reservations,
  properties,
  startDate,
  endDate,
  onReservationClick,
}: CompactListViewProps) => {
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

  // Calcular ocupação por propriedade
  const calculateOccupancy = (propertyReservations: CalendarReservation[]) => {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    let occupiedDays = 0;
    propertyReservations.forEach(reservation => {
      const checkIn = new Date(reservation.check_in_date);
      const checkOut = new Date(reservation.check_out_date);
      const start = checkIn < startDate ? startDate : checkIn;
      const end = checkOut > endDate ? endDate : checkOut;
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      occupiedDays += days;
    });

    return Math.min(100, (occupiedDays / totalDays) * 100);
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'airbnb':
        return 'bg-rose-500';
      case 'booking':
        return 'bg-blue-500';
      case 'direto':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (properties.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhuma propriedade encontrada
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {properties.map((property) => {
        const propertyReservations = reservationsByProperty[property.id] || [];
        const occupancy = calculateOccupancy(propertyReservations);

        return (
          <Card key={property.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {property.nickname || property.name}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Taxa de Ocupação:
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {occupancy.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress value={occupancy} className="mt-2 h-2" />
            </CardHeader>
            <CardContent>
              {propertyReservations.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma reserva neste período
                </div>
              ) : (
                <div className="space-y-2">
                  {propertyReservations
                    .sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime())
                    .map((reservation) => (
                      <div
                        key={reservation.id}
                        onClick={() => onReservationClick(reservation)}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border cursor-pointer',
                          'hover:bg-accent hover:border-primary/50 transition-all',
                          'group'
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={cn('w-1 h-12 rounded-full', getPlatformColor(reservation.platform))} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-foreground truncate">
                                {reservation.guest_name || 'Hóspede não informado'}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {reservation.platform}
                              </Badge>
                              {reservation.reservation_status && (
                                <Badge 
                                  variant={
                                    reservation.reservation_status === 'Confirmada' ? 'default' :
                                    reservation.reservation_status === 'Cancelada' ? 'destructive' :
                                    'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {reservation.reservation_status}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {format(new Date(reservation.check_in_date), 'dd MMM', { locale: ptBR })}
                                {' → '}
                                {format(new Date(reservation.check_out_date), 'dd MMM', { locale: ptBR })}
                              </span>
                              {reservation.number_of_guests && (
                                <span>
                                  {reservation.number_of_guests} {reservation.number_of_guests === 1 ? 'hóspede' : 'hóspedes'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                              <DollarSign className="h-4 w-4" />
                              {reservation.total_revenue?.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            {reservation.payment_status && (
                              <Badge 
                                variant={reservation.payment_status === 'Pago' ? 'default' : 'secondary'}
                                className="text-xs mt-1"
                              >
                                {reservation.payment_status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};