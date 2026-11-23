import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RevenueCompetenceCardProps {
  periodType: 'past' | 'current' | 'future';
  financial: {
    totalNetRevenue: number;
    airbnbRevenue: number;
    bookingRevenue: number;
    directRevenue: number;
  };
  futureBooking?: {
    total: number;
    nextMonth: string;
  };
}

export const RevenueCompetenceCard = ({ 
  periodType,
  financial, 
  futureBooking 
}: RevenueCompetenceCardProps) => {
  const platforms = [
    {
      name: 'Airbnb',
      timing: 'Recebe em D+1',
      value: financial.airbnbRevenue,
      color: 'bg-airbnb',
    },
    {
      name: 'Booking.com',
      timing: 'Recebe mês seguinte',
      value: financial.bookingRevenue,
      color: 'bg-booking',
    },
    {
      name: 'Reservas Diretas',
      timing: 'Recebe no check-in',
      value: financial.directRevenue,
      color: 'bg-success',
    },
  ];

  return (
    <Card className="bg-white card-elevated">
      <CardHeader>
        <CardTitle className="text-gradient-primary">
          💰 Detalhamento por Plataforma
        </CardTitle>
        <CardDescription>
          Receita líquida recebida no período
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Grid de Plataformas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {platforms.map((platform) => (
              <div 
                key={platform.name}
                className="relative p-6 rounded-lg border border-border/50 bg-gradient-to-br from-background to-muted/20 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${platform.color}`} />
                  <h3 className="font-semibold text-foreground">{platform.name}</h3>
                </div>
                <Badge variant="outline" className="mb-3 text-xs">
                  {platform.timing}
                </Badge>
                <div className="text-2xl font-bold text-gradient-success">
                  R$ {platform.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>

          {/* Alerta de Booking Futuro */}
          {futureBooking && futureBooking.total > 0 && (
            <div className="flex items-center gap-4 p-4 rounded-lg border border-info-200 bg-info-50">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-info-100 flex items-center justify-center">
                  <span className="text-xl">📊</span>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-info-900 mb-1">
                  Receita Futura - Booking.com
                </h4>
                <p className="text-sm text-info-700">
                  Previsão de recebimento: {futureBooking.nextMonth}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-info-900">
                  R$ {futureBooking.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
