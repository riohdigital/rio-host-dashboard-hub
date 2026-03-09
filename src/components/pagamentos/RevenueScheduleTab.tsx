import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ScheduleDay } from '@/hooks/painel-gestor/usePaymentsDashboard';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const getPlatformStyle = (platform: string) => {
  switch (platform) {
    case 'Airbnb':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'Booking.com':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
};

interface RevenueScheduleTabProps {
  schedule: ScheduleDay[];
  loading: boolean;
}

const RevenueScheduleTab = ({ schedule, loading }: RevenueScheduleTabProps) => {
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (schedule.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhum recebimento previsto neste período</p>
        <p className="text-sm mt-1">Os recebimentos aparecem com base na data de pagamento calculada por plataforma.</p>
      </div>
    );
  }

  const grandTotal = schedule.reduce((s, d) => s + d.dailyTotal, 0);
  const receivedTotal = schedule
    .flatMap(d => d.entries)
    .filter(e => e.status === 'received')
    .reduce((s, e) => s + e.amount, 0);
  const pendingTotal = grandTotal - receivedTotal;

  let runningTotal = 0;

  return (
    <div className="space-y-1">
      {/* Grand total */}
      <div className="flex flex-wrap gap-4 bg-muted/30 rounded-lg px-4 py-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span className="text-sm text-muted-foreground">Total do Período:</span>
          <span className="font-bold">{fmt(grandTotal)}</span>
        </div>
        <div className="h-5 border-l" />
        <span className="text-sm text-emerald-600 font-medium">Recebido: {fmt(receivedTotal)}</span>
        <div className="h-5 border-l" />
        <span className="text-sm text-amber-600 font-medium">A Receber: {fmt(pendingTotal)}</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[92px] top-0 bottom-0 w-0.5 bg-border" />

        {schedule.map(day => {
          runningTotal += day.dailyTotal;
          const date = parseISO(day.date);
          const dayOfWeek = format(date, 'EEE', { locale: ptBR });
          const dayNum = format(date, 'dd');
          const month = format(date, 'MMM', { locale: ptBR });
          const isPast = date < new Date();

          return (
            <div key={day.date} className="flex gap-4 mb-6">
              {/* Date marker */}
              <div className="flex-shrink-0 w-[80px] text-right">
                <div className={`inline-flex flex-col items-center rounded-lg px-2 py-1.5 text-center
                  ${isPast ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <span className="text-xs font-medium text-muted-foreground capitalize">{dayOfWeek}</span>
                  <span className={`text-xl font-bold leading-none ${isPast ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {dayNum}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{month}</span>
                </div>
              </div>

              {/* Dot */}
              <div className="flex-shrink-0 flex items-start pt-3">
                <div className={`h-3 w-3 rounded-full border-2 bg-background z-10 
                  ${isPast ? 'border-emerald-500' : 'border-amber-400'}`} />
              </div>

              {/* Entries */}
              <div className="flex-1 space-y-2">
                {day.entries.map((entry, idx) => (
                  <div
                    key={`${entry.reservationId}-${idx}`}
                    className={`rounded-lg border p-3 ${
                      entry.status === 'received'
                        ? 'bg-emerald-50/50 border-emerald-100'
                        : 'bg-amber-50/50 border-amber-100'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${getPlatformStyle(entry.platform)}`}>
                          {entry.platform}
                        </Badge>
                        <span className="font-medium text-sm">
                          {entry.propertyNickname || entry.propertyName}
                        </span>
                        {entry.guestName && (
                          <span className="text-xs text-muted-foreground">
                            · {entry.guestName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={entry.status === 'received'
                            ? 'text-emerald-700 border-emerald-300 bg-emerald-50 text-xs'
                            : 'text-amber-700 border-amber-300 bg-amber-50 text-xs'
                          }
                        >
                          {entry.status === 'received' ? '✓ Recebido' : 'A Receber'}
                        </Badge>
                        <span className="font-bold text-sm">{fmt(entry.amount)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Day subtotal */}
                <div className="flex justify-between items-center px-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    Subtotal do dia
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Acumulado: {fmt(runningTotal)}
                    </span>
                    <span className="text-sm font-bold">{fmt(day.dailyTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RevenueScheduleTab;
