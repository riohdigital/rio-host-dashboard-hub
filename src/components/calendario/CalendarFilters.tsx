import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Filter, X } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

export interface AdvancedFilters {
  reservationStatus: string[];
  paymentStatus: string[];
  guestsRange: [number, number];
  durationRange: [number, number];
  showConflictsOnly: boolean;
  searchText: string;
}

interface CalendarFiltersProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
}

const RESERVATION_STATUSES = ['Confirmada', 'Em Andamento', 'Finalizada', 'Cancelada'];
const PAYMENT_STATUSES = ['Pago', 'Pendente', 'Nenhum'];

const CalendarFilters = ({ filters, onFiltersChange }: CalendarFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      onFiltersChange({ ...filters, searchText: value });
    },
    300
  );

  const handleReservationStatusChange = (status: string, checked: boolean) => {
    const newStatuses = checked
      ? [...filters.reservationStatus, status]
      : filters.reservationStatus.filter(s => s !== status);
    onFiltersChange({ ...filters, reservationStatus: newStatuses });
  };

  const handlePaymentStatusChange = (status: string, checked: boolean) => {
    const newStatuses = checked
      ? [...filters.paymentStatus, status]
      : filters.paymentStatus.filter(s => s !== status);
    onFiltersChange({ ...filters, paymentStatus: newStatuses });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      reservationStatus: [],
      paymentStatus: [],
      guestsRange: [1, 10],
      durationRange: [1, 30],
      showConflictsOnly: false,
      searchText: '',
    });
  };

  const activeFiltersCount =
    filters.reservationStatus.length +
    filters.paymentStatus.length +
    (filters.guestsRange[0] !== 1 || filters.guestsRange[1] !== 10 ? 1 : 0) +
    (filters.durationRange[0] !== 1 || filters.durationRange[1] !== 30 ? 1 : 0) +
    (filters.showConflictsOnly ? 1 : 0) +
    (filters.searchText ? 1 : 0);

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 hover:bg-accent"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="font-semibold">Filtros Avançados</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount} ativo{activeFiltersCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                isOpen ? 'transform rotate-180' : ''
              }`}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="p-4 pt-0 space-y-6">
          {/* Busca por Texto */}
          <div className="space-y-2">
            <Label>Buscar</Label>
            <Input
              placeholder="Código, hóspede, propriedade..."
              defaultValue={filters.searchText}
              onChange={e => debouncedSearch(e.target.value)}
              className="bg-background"
            />
          </div>

          {/* Status da Reserva */}
          <div className="space-y-3">
            <Label>Status da Reserva</Label>
            <div className="grid grid-cols-2 gap-3">
              {RESERVATION_STATUSES.map(status => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status}`}
                    checked={filters.reservationStatus.includes(status)}
                    onCheckedChange={checked =>
                      handleReservationStatusChange(status, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`status-${status}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {status}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Status de Pagamento */}
          <div className="space-y-3">
            <Label>Status de Pagamento</Label>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_STATUSES.map(status => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`payment-${status}`}
                    checked={filters.paymentStatus.includes(status)}
                    onCheckedChange={checked =>
                      handlePaymentStatusChange(status, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`payment-${status}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {status}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Número de Hóspedes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Número de Hóspedes</Label>
              <span className="text-sm text-muted-foreground">
                {filters.guestsRange[0]} - {filters.guestsRange[1]}
                {filters.guestsRange[1] >= 10 ? '+' : ''} hóspedes
              </span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={filters.guestsRange}
              onValueChange={value =>
                onFiltersChange({ ...filters, guestsRange: value as [number, number] })
              }
              className="w-full"
            />
          </div>

          {/* Duração da Estadia */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Duração da Estadia</Label>
              <span className="text-sm text-muted-foreground">
                {filters.durationRange[0]} - {filters.durationRange[1]}
                {filters.durationRange[1] >= 30 ? '+' : ''} dias
              </span>
            </div>
            <Slider
              min={1}
              max={30}
              step={1}
              value={filters.durationRange}
              onValueChange={value =>
                onFiltersChange({ ...filters, durationRange: value as [number, number] })
              }
              className="w-full"
            />
          </div>

          {/* Mostrar Apenas Conflitos */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <Label htmlFor="conflicts-only" className="cursor-pointer">
              Mostrar apenas conflitos
            </Label>
            <Switch
              id="conflicts-only"
              checked={filters.showConflictsOnly}
              onCheckedChange={checked =>
                onFiltersChange({ ...filters, showConflictsOnly: checked })
              }
            />
          </div>

          {/* Botão Limpar Filtros */}
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Todos os Filtros
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default CalendarFilters;
