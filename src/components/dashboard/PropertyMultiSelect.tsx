
import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import { Property } from '@/types/property';

interface PropertyMultiSelectProps {
  properties: Property[];
  selectedProperties: string[];
  onSelectionChange: (selected: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  compact?: boolean;
}

const PropertyMultiSelect = ({ 
  properties, 
  selectedProperties, 
  onSelectionChange, 
  isOpen, 
  onToggle,
  compact = false 
}: PropertyMultiSelectProps) => {
  const handlePropertyToggle = (propertyId: string) => {
    if (propertyId === 'todas') {
      onSelectionChange(['todas']);
    } else {
      const newSelection = selectedProperties.includes('todas') 
        ? [propertyId]
        : selectedProperties.includes(propertyId)
          ? selectedProperties.filter(id => id !== propertyId)
          : [...selectedProperties.filter(id => id !== 'todas'), propertyId];
      
      onSelectionChange(newSelection.length === 0 ? ['todas'] : newSelection);
    }
  };

  const getSelectedText = () => {
    if (selectedProperties.includes('todas')) {
      return compact ? 'Todas' : 'Todas as propriedades';
    } else if (selectedProperties.length === 1) {
      const property = properties.find(p => p.id === selectedProperties[0]);
      return compact ? property?.nickname || property?.name || 'N/A' : property?.nickname || property?.name || 'Propriedade selecionada';
    } else {
      return compact ? `${selectedProperties.length} props` : `${selectedProperties.length} propriedades selecionadas`;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={onToggle}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={`justify-between ${compact ? 'h-8 text-xs px-2' : 'w-64'}`}
        >
          <span className="truncate">{getSelectedText()}</span>
          <ChevronDown className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} shrink-0 opacity-50`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`${compact ? 'w-56' : 'w-64'} p-0`} align="start">
        <div className="p-1">
          <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded">
            <Checkbox
              id="todas"
              checked={selectedProperties.includes('todas')}
              onCheckedChange={() => handlePropertyToggle('todas')}
            />
            <label htmlFor="todas" className={`${compact ? 'text-xs' : 'text-sm'} cursor-pointer flex-1`}>
              Todas as propriedades
            </label>
          </div>
          <div className="border-t my-1"></div>
          {properties.map((property) => (
            <div key={property.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded">
              <Checkbox
                id={property.id}
                checked={selectedProperties.includes(property.id)}
                onCheckedChange={() => handlePropertyToggle(property.id)}
              />
              <label htmlFor={property.id} className={`${compact ? 'text-xs' : 'text-sm'} cursor-pointer flex-1 truncate`}>
                {property.nickname || property.name}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PropertyMultiSelect;
