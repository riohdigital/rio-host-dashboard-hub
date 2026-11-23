import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import RolagemComputador from '@/components/comum/RolagemComputador';
import VerTodos from '@/components/comum/VerTodos';
import { useListaCurta } from '@/components/comum/useListaCurta';
import { ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { UpcomingEvent } from '@/types/painel-gestor';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UpcomingEventsTimelineProps {
  events: UpcomingEvent[];
  loading?: boolean;
}

export const UpcomingEventsTimeline = ({ events, loading }: UpcomingEventsTimelineProps) => {
  // Celular: 3 eventos + "Ver todos" (sem rolagem dentro da página)
  const lista = useListaCurta(events, 3, { soCompacto: true });
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "dd 'de' MMM", { locale: ptBR });
  };

  const getCleaningStatusBadge = (status: string, hasCleanerAssigned: boolean) => {
    if (!hasCleanerAssigned) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Sem Faxineira
        </Badge>
      );
    }
    
    switch (status) {
      case 'Realizada':
        return (
          <Badge className="bg-success-100 text-success-700 text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Concluída
          </Badge>
        );
      case 'Em Andamento':
        return (
          <Badge className="bg-info-100 text-info-700 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Em Andamento
          </Badge>
        );
      default:
        return (
          <Badge className="bg-warning-100 text-warning-700 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card className="card-elevated h-full">
        <CardHeader>
          <CardTitle className="text-lg">Próximos Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="card-elevated h-full">
        <CardHeader>
          <CardTitle className="text-lg">Próximos Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>Nenhum evento nos próximos 7 dias.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Próximos Eventos
          <Badge variant="secondary" className="text-xs">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <RolagemComputador className="h-[400px] px-[var(--card-pad)] lg:px-6">
          <div className="space-y-3 pb-4">
            {lista.visiveis.map((event) => {
              const getEventStyles = () => {
                switch(event.type) {
                  case 'check-in':
                    return { border: 'border-success-200', bg: 'bg-success-50/50', hover: 'hover:bg-success-50', iconBg: 'bg-success-100 text-success-600' };
                  case 'check-out':
                    return { border: 'border-info-200', bg: 'bg-info-50/50', hover: 'hover:bg-info-50', iconBg: 'bg-info-100 text-info-600' };
                  case 'cleaning':
                    return { border: 'border-brand-200', bg: 'bg-brand-50/50', hover: 'hover:bg-brand-50', iconBg: 'bg-brand-100 text-brand-600' };
                }
              };

              const styles = getEventStyles();

              const getEventIcon = () => {
                switch(event.type) {
                  case 'check-in':
                    return <ArrowDownLeft className="h-4 w-4" />;
                  case 'check-out':
                    return <ArrowUpRight className="h-4 w-4" />;
                  case 'cleaning':
                    return <Sparkles className="h-4 w-4" />;
                }
              };

              const getEventLabel = () => {
                switch(event.type) {
                  case 'check-in':
                    return 'Check-in';
                  case 'check-out':
                    return 'Check-out';
                  case 'cleaning':
                    return 'Faxina';
                }
              };

              return (
              <div 
                key={`${event.id}-${event.type}`}
                className={`relative p-4 rounded-lg border transition-colors ${styles.border} ${styles.bg} ${styles.hover}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${styles.iconBg}`}>
                      {getEventIcon()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {getEventLabel()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getDateLabel(event.date)} {event.time && `às ${event.time}`}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{event.guestName}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.propertyNickname || event.propertyName}
                      </p>
                    </div>
                  </div>
                  {event.type !== 'cleaning' && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-success-600">
                      {formatCurrency(event.commission)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      comissão
                    </p>
                  </div>
                  )}
                  {event.type === 'cleaning' && (
                  <div className="text-right">
                    {getCleaningStatusBadge(event.cleaningStatus, event.hasCleanerAssigned)}
                  </div>
                  )}
                </div>
                
                {event.type === 'check-out' && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    {getCleaningStatusBadge(event.cleaningStatus, event.hasCleanerAssigned)}
                  </div>
                )}
              </div>
              );
            })}
          </div>
          {lista.temMais && <VerTodos total={lista.total} expandido={lista.expandido} aoClicar={lista.alternar} />}
        </RolagemComputador>
      </CardContent>
    </Card>
  );
};
