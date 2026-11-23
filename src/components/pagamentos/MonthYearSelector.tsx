import React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface MonthYearSelectorProps {
  month: number; // 1-12
  year: number;
  onChange: (month: number, year: number) => void;
}

const MonthYearSelector = ({ month, year, onChange }: MonthYearSelectorProps) => {
  const handlePrev = () => {
    if (month === 1) {
      onChange(12, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };

  const handleNext = () => {
    if (month === 12) {
      onChange(1, year + 1);
    } else {
      onChange(month + 1, year);
    }
  };

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <CalendarDays className="hidden h-5 w-5 text-muted-foreground sm:block" />
      <div className="flex flex-1 items-center justify-between gap-1 rounded-full border bg-card p-1 sm:flex-none">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={handlePrev}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 px-2 py-1 text-center text-sm font-semibold sm:min-w-[160px] sm:px-4">
          {MONTHS[month - 1]} {year}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={handleNext}
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MonthYearSelector;
