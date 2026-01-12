import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { UpcomingEvent } from '@/types/painel-gestor';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UpcomingEventsTimelineProps {
  events: UpcomingEvent[];
  loading?: boolean;
}

export const UpcomingEventsTimeline = ({ events, loading }: UpcomingEventsTimelineProps) => {
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
          <Badge className="bg-green-100 text-green-700 text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Concluída
          </Badge>
        );
      case 'Em Andamento':
        return (
          <Badge className="bg-blue-100 text-blue-700 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Em Andamento
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 text-xs">
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
          <CardTitle className="text-lg">📅 Próximos Eventos</CardTitle>
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
          📅 Próximos Eventos
          <Badge variant="secondary" className="text-xs">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6">
          <div className="space-y-3 pb-4">
            {events.map((event) => (
              <div 
                key={`${event.id}-${event.type}`}
                className={`relative p-4 rounded-lg border transition-colors ${
                  event.type === 'check-in' 
                    ? 'border-green-200 bg-green-50/50 hover:bg-green-50' 
                    : 'border-blue-200 bg-blue-50/50 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      event.type === 'check-in' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {event.type === 'check-in' 
                        ? <ArrowDownLeft className="h-4 w-4" />
                        : <ArrowUpRight className="h-4 w-4" />
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {event.type === 'check-in' ? 'Check-in' : 'Check-out'}
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
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">
                      {formatCurrency(event.commission)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      comissão
                    </p>
                  </div>
                </div>
                
                {event.type === 'check-out' && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    {getCleaningStatusBadge(event.cleaningStatus, event.hasCleanerAssigned)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
