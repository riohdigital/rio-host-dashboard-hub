import React from 'react';
import { format, eachDayOfInterval, isToday, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DateAxisProps {
  startDate: Date;
  endDate: Date;
  dayWidth: number;
}

export const DateAxis: React.FC<DateAxisProps> = ({ startDate, endDate, dayWidth }) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="sticky top-0 z-20 bg-background border-b">
      <div className="flex">
        {/* Coluna de propriedades (fixa à esquerda) */}
        <div className="w-48 flex-shrink-0 border-r bg-muted/50 px-4 py-3">
          <span className="text-sm font-semibold text-muted-foreground">Propriedades</span>
        </div>

        {/* Dias */}
        <div className="flex flex-1 overflow-x-auto relative">
          {days.map((day) => {
            const isTodayDate = isToday(day);
            const isWeekendDate = isWeekend(day);

            return (
              <div
                key={day.toISOString()}
                style={{ minWidth: `${dayWidth}px`, width: `${dayWidth}px` }}
                className={cn(
                  'border-r flex flex-col items-center justify-center py-2 relative',
                  isTodayDate && 'bg-primary/10',
                  isWeekendDate && !isTodayDate && 'bg-muted/30'
                )}
              >
                {/* Linha vertical indicadora de "hoje" */}
                {isTodayDate && (
                  <div className="absolute inset-x-0 top-0 bottom-0 w-0.5 bg-primary/50 left-1/2 -translate-x-1/2 z-10" />
                )}
                <span className="text-xs font-medium text-muted-foreground">
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span className={cn(
                  'text-sm font-semibold',
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
