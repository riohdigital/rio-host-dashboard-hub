import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { TrendingUp } from 'lucide-react';

interface RevenueCompetenceCardProps {
  mode: 'operational' | 'financial';
  operational?: {
    occupancyRate: number;
    totalReservations: number;
    totalRevenue: number;
    totalNetRevenue: number;
  };
  financial?: {
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
  mode, 
  operational, 
  financial, 
  futureBooking 
}: RevenueCompetenceCardProps) => {
  return (
    <Card className="bg-white card-elevated">
      <CardHeader>
        <CardTitle className="text-gradient-primary">
          {mode === 'operational' ? '📅 Visão Operacional' : '💰 Visão Financeira'}
        </CardTitle>
        <CardDescription>
          {mode === 'operational' 
            ? 'Reservas ativas no período selecionado' 
            : 'Pagamentos efetivamente recebidos no período'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === 'operational' && operational && (
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-bold text-gradient-primary">
                {operational.occupancyRate.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">Taxa de Ocupação</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xl font-semibold">
                  {operational.totalReservations}
                </div>
                <p className="text-xs text-muted-foreground">Reservas Ativas</p>
              </div>
              <div>
                <div className="text-xl font-semibold text-gradient-success">
                  R$ {operational.totalNetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">Receita Líquida</p>
              </div>
            </div>
          </div>
        )}
        
        {mode === 'financial' && financial && (
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-bold text-gradient-success">
                R$ {financial.totalNetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-muted-foreground">Receita Líquida Recebida</p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Airbnb (D+1)</span>
                <span className="font-semibold">
                  R$ {financial.airbnbRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Booking.com</span>
                <span className="font-semibold">
                  R$ {financial.bookingRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Direto</span>
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
                  <AlertTitle className="text-blue-900">Receita Futura - Booking.com</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    <div className="font-semibold text-lg mt-1">
                      R$ {futureBooking.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm mt-1">
                      Pagamento previsto em {futureBooking.nextMonth}
                    </div>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
