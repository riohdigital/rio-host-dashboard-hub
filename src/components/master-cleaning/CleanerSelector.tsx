import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CleanerProfile } from '@/types/master-cleaning';

interface CleanerSelectorProps {
  cleaners: CleanerProfile[];
  selectedCleaner: string | null;
  onCleanerChange: (cleanerId: string | null) => void;
}

const CleanerSelector = ({ cleaners, selectedCleaner, onCleanerChange }: CleanerSelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-foreground">Faxineira:</label>
      <Select value={selectedCleaner || 'all'} onValueChange={(value) => onCleanerChange(value === 'all' ? null : value)}>
        <SelectTrigger className="w-64 bg-background border-border">
          <SelectValue placeholder="Selecionar faxineira" />
        </SelectTrigger>
        <SelectContent className="bg-background border-border">
          <SelectItem value="all">Todas as faxineiras</SelectItem>
          {cleaners.map((cleaner) => (
            <SelectItem key={cleaner.user_id} value={cleaner.user_id}>
              {cleaner.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CleanerSelector;