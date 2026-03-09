import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, User, Phone, Banknote, Calendar, Home, CheckCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CleanerPayment } from '@/hooks/painel-gestor/usePaymentsDashboard';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'Pago':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">✓ Pago</Badge>;
    case 'Próximo Ciclo':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Próximo Ciclo</Badge>;
    case 'Pagamento na Data':
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Na Data</Badge>;
    case 'D+1':
      return <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 text-xs">D+1</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Pendente</Badge>;
  }
};

const getPlatformColor = (platform: string) => {
  switch (platform) {
    case 'Airbnb': return 'text-rose-600';
    case 'Booking.com': return 'text-blue-600';
    default: return 'text-emerald-600';
  }
};

interface CleanerCardProps {
  cleaner: CleanerPayment;
}

const CleanerCard = ({ cleaner }: CleanerCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const initials = cleaner.cleanerName
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6A6DDF] to-[#F472B6] flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{cleaner.cleanerName}</h3>
              <div className="flex items-center gap-3 mt-1">
                {cleaner.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {cleaner.phone}
                  </span>
                )}
                {cleaner.pix && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Banknote className="h-3 w-3" />
                    PIX: {cleaner.pix}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <CheckCircle className="h-3 w-3 text-emerald-500" />
              Pago
            </div>
            <div className="font-semibold text-sm text-emerald-600">{fmt(cleaner.totalPaid)}</div>
          </div>
          <div className="text-center border-x">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3 text-amber-500" />
              Pendente
            </div>
            <div className="font-semibold text-sm text-amber-600">{fmt(cleaner.totalPending)}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <RefreshCw className="h-3 w-3 text-blue-500" />
              Próx. Ciclo
            </div>
            <div className="font-semibold text-sm text-blue-600">{fmt(cleaner.totalNextCycle)}</div>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Imóvel</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Plataforma</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Valor</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {cleaner.cleanings.map((cleaning, idx) => (
                  <tr key={cleaning.reservationId} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {format(parseISO(cleaning.date), 'dd/MM', { locale: ptBR })}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Home className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{cleaning.propertyNickname || cleaning.propertyName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium ${getPlatformColor(cleaning.platform)}`}>
                        {cleaning.platform}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {fmt(cleaning.fee)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {getStatusBadge(cleaning.paymentStatus)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-sm">Total</td>
                  <td className="px-3 py-2 text-right text-sm">{fmt(cleaner.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

interface CleanerPaymentsTabProps {
  cleanerPayments: CleanerPayment[];
  loading: boolean;
}

const CleanerPaymentsTab = ({ cleanerPayments, loading }: CleanerPaymentsTabProps) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (cleanerPayments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhuma faxina encontrada neste período</p>
        <p className="text-sm mt-1">Verifique se há reservas com faxineiras atribuídas e taxa de limpeza definida.</p>
      </div>
    );
  }

  const totalPaid = cleanerPayments.reduce((s, c) => s + c.totalPaid, 0);
  const totalPending = cleanerPayments.reduce((s, c) => s + c.totalPending, 0);
  const grandTotal = cleanerPayments.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          {cleanerPayments.length} faxineira{cleanerPayments.length !== 1 ? 's' : ''} • {cleanerPayments.reduce((s, c) => s + c.cleanings.length, 0)} faxinas
        </span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-emerald-600 font-medium">Pago: {fmt(totalPaid)}</span>
          <span className="text-amber-600 font-medium">Pendente: {fmt(totalPending)}</span>
          <span className="font-bold">Total: {fmt(grandTotal)}</span>
        </div>
      </div>

      {cleanerPayments.map(cleaner => (
        <CleanerCard key={cleaner.cleanerId} cleaner={cleaner} />
      ))}
    </div>
  );
};

export default CleanerPaymentsTab;
