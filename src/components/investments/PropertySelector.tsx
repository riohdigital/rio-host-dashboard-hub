import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Property } from '@/types/property';

interface PropertySelectorProps {
  properties: Property[];
  selectedPropertyId?: string;
  onPropertyChange: (propertyId: string | undefined) => void;
  loading?: boolean;
}

const PropertySelector = ({ 
  properties, 
  selectedPropertyId, 
  onPropertyChange, 
  loading 
}: PropertySelectorProps) => {
  const handleValueChange = (value: string) => {
    if (value === 'all') {
      onPropertyChange(undefined);
    } else {
      onPropertyChange(value);
    }
  };

  if (loading) {
    return (
      <div className="w-64">
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Carregando..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className="w-64">
      <Select 
        value={selectedPropertyId || 'all'} 
        onValueChange={handleValueChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Filtrar por propriedade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as propriedades</SelectItem>
          {properties.map((property) => (
            <SelectItem key={property.id} value={property.id}>
              {property.name}
              {property.nickname && ` (${property.nickname})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default PropertySelector;