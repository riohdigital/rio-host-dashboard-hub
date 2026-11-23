import React from 'react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronLeft, ChevronRight, List, Grid3x3, ListChecks, SlidersHorizontal } from 'lucide-react';
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
  /** Abre a gaveta de exibição (densidade e legenda) */
  onAbrirExibicao?: () => void;
}

const VISOES = [
  { valor: 'list', rotulo: 'Lista', curto: 'Lista', icone: ListChecks },
  { valor: 'timeline', rotulo: 'Linha do tempo', curto: 'Linha', icone: List },
  { valor: 'grid', rotulo: 'Mês', curto: 'Mês', icone: Grid3x3 },
] as const;

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  view,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onAbrirExibicao,
}) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      {/* Celular: o nome da tela fica só na barra do topo */}
      <div className="max-lg:sr-only">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Calendário de Reservas</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday} className="h-10">
          Hoje
        </Button>
        <div className="flex flex-1 items-center justify-between rounded-full border bg-card sm:flex-none">
          <Button variant="ghost" size="icon" onClick={onPrevious} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-center text-sm font-semibold capitalize sm:min-w-36">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={onNext} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => value && onViewChange(value as CalendarView)}
        className="flex-1 justify-start rounded-full bg-muted p-1 sm:flex-none"
      >
        {VISOES.map(({ valor, rotulo, curto, icone: Icone }) => (
          <ToggleGroupItem
            key={valor}
            value={valor}
            aria-label={rotulo}
            className="h-9 flex-1 gap-1.5 rounded-full px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm sm:flex-none sm:text-sm"
          >
            <Icone className="h-4 w-4" />
            <span className="sm:hidden">{curto}</span>
            <span className="hidden sm:inline">{rotulo}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {onAbrirExibicao && (
        <Button variant="outline" size="icon" onClick={onAbrirExibicao} aria-label="Densidade e legenda" className="shrink-0">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      )}
    </div>
  </div>
);
