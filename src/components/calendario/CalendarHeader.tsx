import React from 'react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid3x3 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarView } from '@/types/calendar';

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
}) => {
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="h-8 w-8" />
            Calendário de Reservas
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToday}>
            Hoje
          </Button>
          
          <div className="flex items-center gap-1 border rounded-lg">
            <Button variant="ghost" size="icon" onClick={onPrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="px-4 py-2 text-sm font-medium min-w-[180px] text-center">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </div>
            
            <Button variant="ghost" size="icon" onClick={onNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Toggle de visualização */}
      <div className="flex justify-center">
        <ToggleGroup type="single" value={view} onValueChange={(value) => value && onViewChange(value as CalendarView)}>
          <ToggleGroupItem value="timeline" aria-label="Visão Timeline" className="gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Timeline</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Visão Grade" className="gap-2">
            <Grid3x3 className="h-4 w-4" />
            <span className="hidden sm:inline">Grade Mensal</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};
