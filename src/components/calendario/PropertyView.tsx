import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';
import { format, differenceInDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, MapPin, TrendingUp, Calendar, Users } from 'lucide-react';
import { ReservationBlock } from './ReservationBlock';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface PropertyViewProps {
  property: Property | undefined;
  reservations: CalendarReservation[];
  startDate: Date;
  endDate: Date;
  onReservationClick: (reservation: CalendarReservation) => void;
  onBackToAll: () => void;
}

const PLATFORM_COLORS = {
  Airbnb: 'hsl(var(--chart-1))',
  Booking: 'hsl(var(--chart-2))',
  Direto: 'hsl(var(--chart-3))',
};

const PropertyView = ({
  property,
  reservations,
  startDate,
  endDate,
  onReservationClick,
  onBackToAll,
}: PropertyViewProps) => {
  if (!property) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Propriedade não encontrada</p>
          <Button onClick={onBackToAll} className="mt-4">
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalDays = differenceInDays(endDate, startDate);
  const occupiedDays = reservations.reduce((sum, r) => {
    const checkIn = new Date(r.check_in_date);
    const checkOut = new Date(r.check_out_date);
    const start = checkIn < startDate ? startDate : checkIn;
    const end = checkOut > endDate ? endDate : checkOut;
    return sum + differenceInDays(end, start);
  }, 0);

  const occupancyRate = totalDays > 0 ? (occupiedDays / totalDays) * 100 : 0;
  const totalRevenue = reservations.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
  const avgDailyRate = occupiedDays > 0 ? totalRevenue / occupiedDays : 0;
  const avgGapDays =
    reservations.length > 1
      ? reservations.reduce((sum, r, i) => {
          if (i === 0) return sum;
          const prevCheckOut = new Date(reservations[i - 1].check_out_date);
          const currentCheckIn = new Date(r.check_in_date);
          return sum + differenceInDays(currentCheckIn, prevCheckOut);
        }, 0) /
        (reservations.length - 1)
      : 0;

  // Dados para gráficos
  const platformData = Object.entries(
    reservations.reduce((acc, r) => {
      acc[r.platform] = (acc[r.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const guestDistribution = Object.entries(
    reservations.reduce((acc, r) => {
      const guests = r.number_of_guests || 0;
      const key = guests === 0 ? 'Não informado' : `${guests} hóspede${guests > 1 ? 's' : ''}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const DAY_WIDTH = 60;
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBackToAll}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h2 className="text-2xl font-bold text-foreground">
              {property.nickname || property.name}
            </h2>
          </div>
          {property.address && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{property.address}</span>
            </div>
          )}
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {reservations.length} reserva{reservations.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Estatísticas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Taxa de Ocupação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{occupancyRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {occupiedDays} de {totalDays} dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Receita Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              R$ {totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">No período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Diária Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              R$ {avgDailyRate.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Por dia ocupado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Gap Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {avgGapDays.toFixed(1)} dias
            </div>
            <p className="text-xs text-muted-foreground mt-1">Entre reservas</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Expandida */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline de Reservas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div
              className="relative bg-muted/30 rounded-lg p-4"
              style={{
                minWidth: days.length * DAY_WIDTH,
                height: '200px',
              }}
            >
              {/* Eixo de datas */}
              <div className="flex mb-4">
                {days.map((day, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 text-center"
                    style={{ width: DAY_WIDTH }}
                  >
                    <div className="text-xs font-medium text-foreground">
                      {format(day, 'dd')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(day, 'EEE', { locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Blocos de reservas */}
              <div className="relative h-32">
                {reservations.map(reservation => (
                  <ReservationBlock
                    key={reservation.id}
                    reservation={reservation}
                    startDate={startDate}
                    endDate={endDate}
                    dayWidth={DAY_WIDTH}
                    onReservationClick={onReservationClick}
                    style={{ top: '0px' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={platformData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {platformData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PLATFORM_COLORS[entry.name as keyof typeof PLATFORM_COLORS] || 'hsl(var(--chart-4))'}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Hóspedes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={guestDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PropertyView;
