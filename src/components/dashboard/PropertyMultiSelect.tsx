
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Property } from '@/types/property';

interface PropertyMultiSelectProps {
  properties: Property[];
  selectedProperties: string[];
  onSelectionChange: (selected: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const PropertyMultiSelect = ({ 
  properties, 
  selectedProperties, 
  onSelectionChange, 
  isOpen, 
  onToggle 
}: PropertyMultiSelectProps) => {
  const handleSelectAll = () => {
    if (selectedProperties.length === properties.length + 1) {
      onSelectionChange([]);
    } else {
      onSelectionChange(['todas', ...properties.map(p => p.id)]);
    }
  };

  const handlePropertyToggle = (propertyId: string) => {
    if (propertyId === 'todas') {
      if (selectedProperties.includes('todas')) {
        onSelectionChange(selectedProperties.filter(id => id !== 'todas'));
      } else {
        onSelectionChange([...selectedProperties, 'todas']);
      }
    } else {
      if (selectedProperties.includes(propertyId)) {
        onSelectionChange(selectedProperties.filter(id => id !== propertyId));
      } else {
        onSelectionChange([...selectedProperties, propertyId]);
      }
    }
  };

  const getSelectedText = () => {
    if (selectedProperties.length === 0) return "Selecionar Propriedades";
    if (selectedProperties.includes('todas') && selectedProperties.length > 1) {
      return "Todas + outras selecionadas";
    }
    if (selectedProperties.includes('todas')) return "Todas as Propriedades";
    if (selectedProperties.length === 1) {
      const property = properties.find(p => p.id === selectedProperties[0]);
      return property?.nickname || property?.name || "1 propriedade";
    }
    return `${selectedProperties.length} propriedades`;
  };

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="w-48 px-4 py-2 text-left bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center justify-between gradient-hover transition-all duration-200"
      >
        <span className="text-gradient-primary font-medium">{getSelectedText()}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <Card className="absolute top-full left-0 w-64 mt-1 z-50 shadow-lg">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={selectedProperties.length === properties.length + 1}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium text-gradient-primary cursor-pointer">
                  Selecionar Todas
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="todas"
                  checked={selectedProperties.includes('todas')}
                  onCheckedChange={() => handlePropertyToggle('todas')}
                />
                <label htmlFor="todas" className="text-sm text-gradient-accent cursor-pointer">
                  Todas as Propriedades
                </label>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {properties.map((property) => (
                  <div key={property.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={property.id}
                      checked={selectedProperties.includes(property.id)}
                      onCheckedChange={() => handlePropertyToggle(property.id)}
                    />
                    <label 
                      htmlFor={property.id} 
                      className="text-sm cursor-pointer hover:text-gradient-primary transition-colors"
                    >
                      {property.nickname || property.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PropertyMultiSelect;
