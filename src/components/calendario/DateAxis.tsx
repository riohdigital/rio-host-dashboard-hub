import React from 'react';
import { format, eachDayOfInterval, isToday, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DateAxisProps {
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  /** Dias de feriado ou evento onde os imóveis estão ('AAAA-MM-DD' → nomes). */
  datasEspeciais?: Map<string, string[]>;
}

export const DateAxis: React.FC<DateAxisProps> = ({ startDate, endDate, dayWidth, datasEspeciais }) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="sticky top-0 z-20 border-b bg-background">
      <div className="flex">
        {/* Coluna de imóveis (fixa à esquerda e no topo) */}
        <div className="sticky left-0 z-30 flex w-[var(--coluna-imovel)] shrink-0 items-center border-r bg-gray-50 px-3 py-3 sm:px-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imóveis</span>
        </div>

        {/* Dias */}
        <div className="relative flex">
          {days.map((day) => {
            const isTodayDate = isToday(day);
            const isWeekendDate = isWeekend(day);
            const especiais = datasEspeciais?.get(format(day, 'yyyy-MM-dd'));

            return (
              <div
                key={day.toISOString()}
                style={{ minWidth: `${dayWidth}px`, width: `${dayWidth}px` }}
                title={especiais ? especiais.join(' • ') : undefined}
                className={cn(
                  'border-r flex flex-col items-center justify-center py-2 relative',
                  isTodayDate && 'bg-primary/10',
                  especiais && !isTodayDate && 'bg-warning-50',
                  isWeekendDate && !isTodayDate && !especiais && 'bg-muted/30'
                )}
              >
                {especiais && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warning-500" />}
                {/* Linha vertical indicadora de "hoje" */}
                {isTodayDate && (
                  <div className="absolute inset-x-0 top-0 bottom-0 w-0.5 bg-primary/50 left-1/2 -translate-x-1/2 z-10" />
                )}
                <span className="text-xs font-medium text-muted-foreground">
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span className={cn(
                  'font-mono text-sm font-semibold',
                  isTodayDate && 'text-primary'
                )}>
                  {format(day, 'd')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
