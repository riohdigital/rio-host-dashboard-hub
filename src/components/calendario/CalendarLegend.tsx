import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CalendarLegend: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Legenda</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 text-sm">
            {/* Status das Reservas */}
            <div>
              <h4 className="font-medium mb-2 text-muted-foreground">Status das Reservas</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-info-100 dark:bg-info-900/20 border border-info-300 dark:border-info-700" />
                  <span className="text-xs">Confirmada</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-success-100 dark:bg-success-900/20 border border-success-300 dark:border-success-700" />
                  <span className="text-xs">Em Andamento</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700" />
                  <span className="text-xs">Finalizada</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-danger-100 dark:bg-danger-900/20 border border-danger-300 dark:border-danger-700" />
                  <span className="text-xs">Cancelada</span>
                </div>
              </div>
            </div>

            {/* Status de Pagamento */}
            <div>
              <h4 className="font-medium mb-2 text-muted-foreground">Status de Pagamento</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-muted border-2 border-warning-500" />
                  <span className="text-xs">Pago</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-muted border-2 border-dashed border-orange-500" />
                  <span className="text-xs">Pendente</span>
                </div>
              </div>
            </div>

            {/* Plataformas */}
            <div>
              <h4 className="font-medium mb-2 text-muted-foreground">Plataformas</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-pink-500" />
                  <span className="text-xs">Airbnb</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-info-500" />
                  <span className="text-xs">Booking</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-xs">Direto</span>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
