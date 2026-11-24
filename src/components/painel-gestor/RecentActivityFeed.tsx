import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RolagemComputador from '@/components/comum/RolagemComputador';
import VerTodos from '@/components/comum/VerTodos';
import { useListaCurta } from '@/components/comum/useListaCurta';
import { CalendarPlus, CheckCircle, CreditCard, RefreshCw } from 'lucide-react';
import { RecentActivity } from '@/types/painel-gestor';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RecentActivityFeedProps {
  activities: RecentActivity[];
  loading?: boolean;
}

export const RecentActivityFeed = ({ activities, loading }: RecentActivityFeedProps) => {
  // Celular: 3 atividades + "Ver todas" (sem rolagem dentro da página)
  const lista = useListaCurta(activities, 3, { soCompacto: true, chave: 'gestor.atividades.todas' });
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'new_reservation':
        return <CalendarPlus className="h-4 w-4 text-success-600" />;
      case 'cleaning_completed':
        return <CheckCircle className="h-4 w-4 text-info-600" />;
      case 'payment_received':
        return <CreditCard className="h-4 w-4 text-success-600" />;
      case 'reservation_updated':
        return <RefreshCw className="h-4 w-4 text-warning-600" />;
      default:
        return <CalendarPlus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityColor = (type: RecentActivity['type']) => {
    switch (type) {
      case 'new_reservation':
        return 'bg-success-100';
      case 'cleaning_completed':
        return 'bg-info-100';
      case 'payment_received':
        return 'bg-success-100';
      case 'reservation_updated':
        return 'bg-warning-100';
      default:
        return 'bg-muted';
    }
  };

  if (loading) {
    return (
      <Card className="card-elevated h-full">
        <CardHeader>
          <CardTitle className="text-lg">Atividades Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="card-elevated h-full">
        <CardHeader>
          <CardTitle className="text-lg">Atividades Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>Nenhuma atividade recente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated h-full">
      <CardHeader>
        <CardTitle className="text-lg">Atividades Recentes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <RolagemComputador className="h-[400px] px-[var(--card-pad)] lg:px-6">
          <div className="space-y-3 pb-4">
            {lista.visiveis.map((activity) => (
              <div 
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={`p-2 rounded-full ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {activity.propertyName && (
                      <span className="text-xs text-muted-foreground truncate">
                        {activity.propertyName}
                      </span>
                    )}
                    {activity.amount && (
                      <span className="text-xs font-medium text-success-600">
                        {formatCurrency(activity.amount)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {activity.timestamp && formatDistanceToNow(parseISO(activity.timestamp), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
              </div>
            ))}
          </div>
          {lista.temMais && (
            <VerTodos total={lista.total} rotulo={`Ver todas (${lista.total})`} expandido={lista.expandido} aoClicar={lista.alternar} />
          )}
        </RolagemComputador>
      </CardContent>
    </Card>
  );
};
