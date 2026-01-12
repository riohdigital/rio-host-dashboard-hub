import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { CommissionSummary, CommissionDetail } from '@/types/painel-gestor';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CommissionDetailsCardProps {
  data: CommissionSummary;
  loading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const getPlatformBadge = (platform: string) => {
  const platformConfig: Record<string, { bg: string; text: string }> = {
    'Airbnb': { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300' },
    'Booking.com': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
    'Direto': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' }
  };
  
  const config = platformConfig[platform] || platformConfig['Direto'];
  
  return (
    <Badge variant="outline" className={`${config.bg} ${config.text} border-0 text-xs`}>
      {platform}
    </Badge>
  );
};

const getPaymentInfo = (platform: string) => {
  switch (platform) {
    case 'Airbnb':
      return 'D+1 do check-in';
    case 'Booking.com':
      return 'Mês seguinte';
    default:
      return 'No check-in';
  }
};

const CommissionItem = ({ item }: { item: CommissionDetail }) => {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">
            {item.propertyNickname || item.propertyName}
          </span>
          {getPlatformBadge(item.platform)}
        </div>
        <div className="text-xs text-muted-foreground">
          <span>{item.guestName}</span>
          <span className="mx-1">•</span>
          <span>Checkout: {format(parseISO(item.checkoutDate), 'dd/MM/yyyy', { locale: ptBR })}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          <span>Pagamento: {item.paymentDate ? format(parseISO(item.paymentDate), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</span>
          <span className="mx-1">•</span>
          <span className="italic">{getPaymentInfo(item.platform)}</span>
        </div>
      </div>
      <div className="text-right ml-3">
        <span className={`font-semibold text-sm ${item.status === 'received' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {formatCurrency(item.commissionAmount)}
        </span>
      </div>
    </div>
  );
};

export const CommissionDetailsCard = ({ data, loading }: CommissionDetailsCardProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const receivedItems = data.details.filter(d => d.status === 'received');
  const pendingItems = data.details.filter(d => d.status === 'pending');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-primary" />
          Comissões do Período
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Recebidas</span>
            </div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(data.totalReceived)}
            </div>
            <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
              {data.receivedCount} {data.receivedCount === 1 ? 'comissão' : 'comissões'}
            </div>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">A Receber</span>
            </div>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
              {formatCurrency(data.totalPending)}
            </div>
            <div className="text-xs text-amber-600/70 dark:text-amber-400/70">
              {data.pendingCount} {data.pendingCount === 1 ? 'comissão' : 'comissões'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="pending" className="text-xs">
              A Receber ({pendingItems.length})
            </TabsTrigger>
            <TabsTrigger value="received" className="text-xs">
              Recebidas ({receivedItems.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending">
            <ScrollArea className="h-[280px] pr-3">
              {pendingItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mb-2 opacity-50" />
                  <span className="text-sm">Nenhuma comissão pendente</span>
                </div>
              ) : (
                pendingItems.map(item => (
                  <CommissionItem key={item.id} item={item} />
                ))
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="received">
            <ScrollArea className="h-[280px] pr-3">
              {receivedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mb-2 opacity-50" />
                  <span className="text-sm">Nenhuma comissão recebida</span>
                </div>
              ) : (
                receivedItems.map(item => (
                  <CommissionItem key={item.id} item={item} />
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
