import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { CleaningRiskAlert } from '@/types/painel-gestor';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface CleaningRiskAlertsProps {
  alerts: CleaningRiskAlert[];
  loading?: boolean;
}

export const CleaningRiskAlerts = ({ alerts, loading }: CleaningRiskAlertsProps) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="card-elevated border-amber-200 bg-amber-50/30">
        <CardContent className="p-4">
          <div className="h-16 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  const getDaysLabel = (days: number) => {
    if (days === 0) return 'Hoje!';
    if (days === 1) return 'Amanhã';
    return `Em ${days} dias`;
  };

  const getUrgencyColor = (days: number) => {
    if (days === 0) return 'bg-red-500';
    if (days === 1) return 'bg-amber-500';
    return 'bg-yellow-500';
  };

  return (
    <Card className="card-elevated border-red-200 bg-red-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          Alertas de Risco - Faxinas
          <Badge variant="destructive">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-red-600 mb-4">
          Os seguintes checkouts estão sem faxineira atribuída:
        </p>
        
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div 
              key={alert.reservationId}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100 hover:border-red-200 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${getUrgencyColor(alert.daysUntilCheckout)}`} />
                <div>
                  <p className="font-medium text-sm">
                    {alert.propertyNickname || alert.propertyName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {alert.guestName} • Checkout {format(parseISO(alert.checkoutDate), "dd 'de' MMM", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={alert.daysUntilCheckout === 0 ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {getDaysLabel(alert.daysUntilCheckout)}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate('/gestao-faxinas')}
                >
                  Atribuir
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
