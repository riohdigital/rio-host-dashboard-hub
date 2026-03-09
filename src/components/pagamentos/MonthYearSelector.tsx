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
    <div className="flex items-center gap-2">
      <CalendarDays className="h-5 w-5 text-muted-foreground" />
      <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handlePrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-4 py-1 min-w-[160px] text-center font-semibold text-sm">
          {MONTHS[month - 1]} {year}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MonthYearSelector;
