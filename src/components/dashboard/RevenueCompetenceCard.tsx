import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { TrendingUp } from 'lucide-react';

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
        <div className="space-y-4">
          <div>
            <div className="text-3xl font-bold text-gradient-success">
              R$ {financial.totalNetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground">Total Recebido</p>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Airbnb (recebe em D+1)</span>
              <span className="font-semibold">
                R$ {financial.airbnbRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Booking.com (recebe mês seguinte)</span>
              <span className="font-semibold">
                R$ {financial.bookingRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Reservas Diretas (recebe no check-in)</span>
              <span className="font-semibold">
                R$ {financial.directRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          
          {futureBooking && futureBooking.total > 0 && (
            <>
              <Separator />
              <Alert className="border-blue-200 bg-blue-50">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-900">📊 Receita Futura - Booking.com</AlertTitle>
                <AlertDescription className="text-blue-700">
                  <div className="font-semibold text-lg mt-1">
                    R$ {futureBooking.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm mt-1">
                    Previsão de recebimento: {futureBooking.nextMonth}
                  </div>
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
