
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RecurrenceSettingsProps {
  isVisible: boolean;
  recurrenceType: string;
  recurrenceDuration: number;
  startDate: string;
  onRecurrenceTypeChange: (value: string) => void;
  onRecurrenceDurationChange: (value: number) => void;
  onStartDateChange: (value: string) => void;
}

const RecurrenceSettings = ({
  isVisible,
  recurrenceType,
  recurrenceDuration,
  startDate,
  onRecurrenceTypeChange,
  onRecurrenceDurationChange,
  onStartDateChange
}: RecurrenceSettingsProps) => {
  if (!isVisible) return null;

  return (
    <Card className="border-[#6A6DDF] border-2">
      <CardHeader>
        <CardTitle className="text-[#6A6DDF] text-lg">Configurações de Recorrência</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="recurrence_type">Frequência *</Label>
            <Select value={recurrenceType} onValueChange={onRecurrenceTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar frequência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="annually">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence_duration">Duração (meses) *</Label>
            <Input
              id="recurrence_duration"
              type="number"
              min="1"
              max="60"
              value={recurrenceDuration}
              onChange={(e) => onRecurrenceDurationChange(parseInt(e.target.value) || 1)}
              placeholder="12"
            />
            <span className="text-xs text-gray-500">
              Quantos meses esta despesa deve se repetir
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence_start_date">Data de Início *</Label>
            <Input
              id="recurrence_start_date"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
            <span className="text-xs text-gray-500">
              Primeira ocorrência da despesa
            </span>
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Pré-visualização:</strong> Será criada uma despesa{' '}
            {recurrenceType === 'monthly' ? 'todo mês' : 
             recurrenceType === 'quarterly' ? 'a cada 3 meses' : 
             'todo ano'} por {recurrenceDuration} meses, começando em{' '}
            {startDate ? new Date(startDate).toLocaleDateString('pt-BR') : '[data não selecionada]'}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecurrenceSettings;
