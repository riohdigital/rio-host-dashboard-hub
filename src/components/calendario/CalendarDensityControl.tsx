import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarDensityControlProps {
  dayWidth: number;
  onDayWidthChange: (width: number) => void;
  className?: string;
}

const PRESETS = {
  compact: 40,
  normal: 60,
  expanded: 100,
};

export const CalendarDensityControl: React.FC<CalendarDensityControlProps> = ({
  dayWidth,
  onDayWidthChange,
  className,
}) => {
  const handlePreset = (preset: keyof typeof PRESETS) => {
    onDayWidthChange(PRESETS[preset]);
  };

  const handleZoomIn = () => {
    const newWidth = Math.min(120, dayWidth + 20);
    onDayWidthChange(newWidth);
  };

  const handleZoomOut = () => {
    const newWidth = Math.max(40, dayWidth - 20);
    onDayWidthChange(newWidth);
  };

  const handleAutoFit = () => {
    // Calcula o dayWidth ideal baseado na largura da tela
    const screenWidth = window.innerWidth;
    const sidebarWidth = 192; // w-48 = 192px
    const availableWidth = screenWidth - sidebarWidth - 100; // margin
    const daysVisible = 30; // aproximadamente um mês
    const idealWidth = Math.floor(availableWidth / daysVisible);
    const clampedWidth = Math.max(40, Math.min(120, idealWidth));
    onDayWidthChange(clampedWidth);
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Botões de zoom */}
      <div className="flex items-center gap-1 border rounded-lg p-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          disabled={dayWidth <= 40}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          disabled={dayWidth >= 120}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAutoFit}
          title="Ajustar à tela"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Slider */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Densidade:</span>
        <Slider
          value={[dayWidth]}
          onValueChange={(value) => onDayWidthChange(value[0])}
          min={40}
          max={120}
          step={10}
          className="flex-1"
        />
      </div>

      {/* Presets */}
      <div className="flex items-center gap-1 border rounded-lg p-1">
        <Button
          variant={dayWidth === PRESETS.compact ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handlePreset('compact')}
          className="text-xs"
        >
          Compacto
        </Button>
        <Button
          variant={dayWidth === PRESETS.normal ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handlePreset('normal')}
          className="text-xs"
        >
          Normal
        </Button>
        <Button
          variant={dayWidth === PRESETS.expanded ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handlePreset('expanded')}
          className="text-xs"
        >
          Expandido
        </Button>
      </div>
    </div>
  );
};