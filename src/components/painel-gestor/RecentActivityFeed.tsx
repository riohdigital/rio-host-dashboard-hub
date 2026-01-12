import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarPlus, CheckCircle, CreditCard, RefreshCw } from 'lucide-react';
import { RecentActivity } from '@/types/painel-gestor';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RecentActivityFeedProps {
  activities: RecentActivity[];
  loading?: boolean;
}

export const RecentActivityFeed = ({ activities, loading }: RecentActivityFeedProps) => {
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
        return <CalendarPlus className="h-4 w-4 text-green-600" />;
      case 'cleaning_completed':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'payment_received':
        return <CreditCard className="h-4 w-4 text-emerald-600" />;
      case 'reservation_updated':
        return <RefreshCw className="h-4 w-4 text-amber-600" />;
      default:
        return <CalendarPlus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityColor = (type: RecentActivity['type']) => {
    switch (type) {
      case 'new_reservation':
        return 'bg-green-100';
      case 'cleaning_completed':
        return 'bg-blue-100';
      case 'payment_received':
        return 'bg-emerald-100';
      case 'reservation_updated':
        return 'bg-amber-100';
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
          <CardTitle className="text-lg">📰 Atividades Recentes</CardTitle>
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
        <CardTitle className="text-lg">📰 Atividades Recentes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6">
          <div className="space-y-3 pb-4">
            {activities.map((activity) => (
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
                      <span className="text-xs font-medium text-green-600">
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
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
