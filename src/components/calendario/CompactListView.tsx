import { useMemo } from 'react';
import { corDoCanal } from '@/components/comum/cores';
import { EtiquetaPlataforma, EtiquetaStatus } from '@/components/comum/Etiquetas';
import { formatarData, formatarMoeda } from '@/components/comum/formatos';
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
        return 'bg-danger-500';
      case 'booking':
        return 'bg-info-500';
      case 'direto':
        return 'bg-success-500';
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg">
                  {property.nickname || property.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    Ocupação
                  </span>
                  <span className="font-mono text-base font-semibold tabular-nums text-primary sm:text-lg">
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
                    .map((reservation) => {
                      const canal = corDoCanal(reservation.platform);
                      return (
                        <button
                          type="button"
                          key={reservation.id}
                          onClick={() => onReservationClick(reservation)}
                          className="flex w-full items-stretch gap-3 rounded-xl border p-3 text-left transition-colors hover:border-brand/40 hover:bg-accent"
                        >
                          <span className={cn('w-1 shrink-0 rounded-full', canal.ponto)} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium text-foreground">
                                {reservation.guest_name || 'Hóspede não informado'}
                              </span>
                              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-ink">
                                {formatarMoeda(reservation.total_revenue)}
                              </span>
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 font-mono tabular-nums">
                                <CalendarDays className="h-3 w-3" />
                                {formatarData(reservation.check_in_date, true)} → {formatarData(reservation.check_out_date, true)}
                              </span>
                              {reservation.number_of_guests ? (
                                <span>
                                  {reservation.number_of_guests} {reservation.number_of_guests === 1 ? 'hóspede' : 'hóspedes'}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-2 flex flex-wrap items-center gap-1.5">
                              <EtiquetaPlataforma plataforma={reservation.platform} />
                              {reservation.reservation_status && <EtiquetaStatus status={reservation.reservation_status} />}
                              {reservation.payment_status && <EtiquetaStatus status={reservation.payment_status} />}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};